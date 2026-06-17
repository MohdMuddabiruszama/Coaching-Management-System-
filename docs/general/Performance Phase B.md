ZenithFlows
Institute Management SaaS Platform
Phase B — Performance Implementation Guide
Redis Caching  ·  Cursor Pagination  ·  Read Replica
Basic Level  →  Intermediate  →  Advanced

Prerequisite: Phase A Complete	Stack: Node.js + Redis + MySQL	Estimated: 2–3 Weeks

 
Introduction — What Phase B Does and Why

Phase B builds the speed layer on top of Phase A’s foundation
Phase A gave you correct data isolation (tenant_id on every table, JWT with tenant + role).
Phase B makes everything fast. Without Phase B, every page load hits the database directly.
With Phase B, most requests are served from memory (Redis) in under 5 milliseconds.
 
Phase B must be built AFTER Phase A is fully working. Never add caching before the data isolation is correct — you risk caching and serving wrong data across institutes.

Phase B has 5 steps. Together they reduce database load by 80–90%, cut API response times from 500ms to under 30ms for most requests, and allow ZenithFlows to serve 200+ institutes without the database becoming a bottleneck.

Step	What You Build	Speed Impact
B1	Install and connect Redis to your Node.js backend	Foundation for all caching
B2	Per-tenant Redis cache for all dashboard APIs	Dashboard: 400ms → 5ms
B3	Cache invalidation on every write operation	Always fresh, never stale data
B4	Cursor-based pagination on all list APIs (students, faculty, parents)	List load: 500ms → 40ms
B5	MySQL read replica for all SELECT queries	DB read capacity doubles

 
Step B1 — Install and Connect Redis

B1.1 — Basic Level: What Is Redis and Why You Need It
Redis is an in-memory key-value store. Think of it as a super-fast notepad that lives entirely in RAM. Your database (MySQL) lives on disk and takes 50–500ms to answer queries. Redis lives in memory and answers in under 1ms.

Real-world analogy
Your database is a library — vast, accurate, but slow to search. Redis is a sticky note on your desk — tiny, fast, and temporary.
When an institute admin loads their dashboard, instead of re-running 6 database queries every time, you run them once, store the result in Redis for 60 seconds, and serve every subsequent request from Redis instantly.
When a student is added (data changes), you delete that Redis entry so the next request fetches fresh data from the database and updates Redis again.

B1.2 — Intermediate Level: Install Redis
On Ubuntu / Debian server:
Install Redis on Ubuntu server
# Install Redis on your server
sudo apt update
sudo apt install redis-server -y
 
# Start Redis and enable on boot
sudo systemctl start redis-server
sudo systemctl enable redis-server
 
# Verify Redis is running
redis-cli ping
# Expected output: PONG
 
# Check Redis version
redis-server --version

Install Redis client in your Node.js project:
Install ioredis npm package
# In your ZenithFlows backend project folder
npm install ioredis
 
# ioredis is the best Redis client for Node.js
# It supports automatic reconnection, pipelining, and Promises

B1.3 — Advanced Level: Redis Connection Module
Create a single Redis connection module that the entire backend uses. Never create multiple Redis connections — it wastes memory and connections.

src/config/redis.js — Redis connection module
// File: src/config/redis.js
const Redis = require('ioredis');
 
// Single Redis instance for the entire application
let redisClient = null;
 
function getRedis() {
  if (redisClient) return redisClient;
 
  redisClient = new Redis({
    host:     process.env.REDIS_HOST || '127.0.0.1',
    port:     parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db:       0,  // use database 0
 
    // Reconnect automatically if connection drops
    retryStrategy(times) {
      if (times > 10) return null;  // stop retrying after 10 attempts
      return Math.min(times * 100, 3000);  // wait up to 3 seconds
    },
 
    // Connection options
    connectTimeout:      10000,  // 10 seconds
    maxRetriesPerRequest: 3,
    lazyConnect:         false,
  });
 
  redisClient.on('connect',  () => console.log('[Redis] Connected'));
  redisClient.on('error',    (err) => console.error('[Redis] Error:', err.message));
  redisClient.on('reconnecting', () => console.log('[Redis] Reconnecting...'));
 
  return redisClient;
}
 
module.exports = { getRedis };

Add Redis config to your .env file:
.env — Redis environment variables
# .env file — add these lines
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=           # leave blank for local, set for production
REDIS_TTL_DASHBOARD=60    # cache dashboard for 60 seconds
REDIS_TTL_LIST=300        # cache list pages for 5 minutes
REDIS_TTL_TENANT=300      # cache tenant info for 5 minutes

B1.4 — Cache Utility Helper
Build a reusable cache helper so every controller uses caching the same way. This prevents code duplication and makes cache management easy.

src/utils/cache.js — cache utility module
// File: src/utils/cache.js
const { getRedis } = require('../config/redis');
 
// ── KEY BUILDER ───────────────────────────────────────────────────────
// All cache keys follow a strict naming pattern:
// tenant:{tenantId}:{section}:{detail}
// This ensures Institute A's cache never overlaps Institute B's cache.
 
const CacheKeys = {
  // Dashboard keys
  adminDashboard:   (tid) => `tenant:${tid}:dashboard:admin`,
  managerDashboard: (tid) => `tenant:${tid}:dashboard:manager`,
  studentDashboard: (tid, uid) => `tenant:${tid}:dashboard:student:${uid}`,
  facultyDashboard: (tid, uid) => `tenant:${tid}:dashboard:faculty:${uid}`,
  parentDashboard:  (tid, uid) => `tenant:${tid}:dashboard:parent:${uid}`,
 
  // List keys (paginated)
  studentPage:  (tid, cursor, limit) => `tenant:${tid}:students:c${cursor}:l${limit}`,
  facultyPage:  (tid, cursor, limit) => `tenant:${tid}:faculty:c${cursor}:l${limit}`,
  parentPage:   (tid, cursor, limit) => `tenant:${tid}:parents:c${cursor}:l${limit}`,
  classList:    (tid)               => `tenant:${tid}:classes:all`,
 
  // Single record keys
  student:  (tid, sid) => `tenant:${tid}:student:${sid}`,
  faculty:  (tid, fid) => `tenant:${tid}:faculty:${fid}`,
 
  // Pattern for bulk deletion (wipes all paginated pages for a section)
  studentPattern: (tid) => `tenant:${tid}:students:*`,
  facultyPattern: (tid) => `tenant:${tid}:faculty:*`,
  parentPattern:  (tid) => `tenant:${tid}:parents:*`,
  dashboardPattern: (tid) => `tenant:${tid}:dashboard:*`,
  allPattern:     (tid) => `tenant:${tid}:*`,
};
 
// ── GET FROM CACHE OR DB ──────────────────────────────────────────────
// Usage: const data = await cacheGetOrSet(key, ttl, async () => dbQuery());
async function cacheGetOrSet(key, ttlSeconds, fetchFn) {
  const redis = getRedis();
  try {
    // Try Redis first
    const cached = await redis.get(key);
    if (cached) {
      return { data: JSON.parse(cached), fromCache: true };
    }
    // Cache miss: run the DB function
    const data = await fetchFn();
    // Store in Redis with expiry
    await redis.setex(key, ttlSeconds, JSON.stringify(data));
    return { data, fromCache: false };
  } catch (err) {
    // If Redis is down, fall through to DB — never crash the app
    console.error('[Cache] Redis error, falling back to DB:', err.message);
    const data = await fetchFn();
    return { data, fromCache: false };
  }
}
 
// ── DELETE CACHE KEYS BY PATTERN ─────────────────────────────────────
// Used when data changes (insert/update/delete) to clear stale cache
async function cacheDeletePattern(pattern) {
  const redis = getRedis();
  try {
    // SCAN is safe for production (KEYS command blocks Redis)
    let cursor = '0';
    let deleted = 0;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== '0');
    return deleted;
  } catch (err) {
    console.error('[Cache] Delete pattern error:', err.message);
  }
}
 
// ── DELETE SINGLE KEY ─────────────────────────────────────────────────
async function cacheDel(key) {
  const redis = getRedis();
  try { await redis.del(key); } catch (err) {
    console.error('[Cache] Delete error:', err.message);
  }
}
 
module.exports = { CacheKeys, cacheGetOrSet, cacheDeletePattern, cacheDel };

 
Step B2 — Cache All 5 Dashboard APIs

B2.1 — Basic Level: Why Dashboard Caching Matters Most
The dashboard is the first thing every user sees after login. Every institute admin, manager, student, faculty member, and parent loads their dashboard. With 50 institutes and 200 active users per institute, that is 10,000 dashboard loads per day — each hitting the database 4–6 times without caching.

Without Cache	With Redis Cache (TTL 60s)
10,000 dashboard loads × 6 DB queries = 60,000 DB queries/day	10,000 dashboard loads × 0 DB queries (served from Redis) = ~0
Each load: 300–600ms (DB round trips)	Each load: 3–5ms (Redis in memory)
Heavy database load during peak hours (9–10am)	Database load near zero during peak hours
Database can become a bottleneck at 100+ institutes	Redis handles 100,000 requests/sec easily

B2.2 — Intermediate Level: Institute Admin Dashboard With Cache
Admin dashboard with Redis cache
// File: src/controllers/dashboard.controller.js
const db = require('../db');
const { CacheKeys, cacheGetOrSet } = require('../utils/cache');
 
const TTL_DASHBOARD = parseInt(process.env.REDIS_TTL_DASHBOARD) || 60;
 
// ── INSTITUTE ADMIN DASHBOARD ─────────────────────────────────────────
async function getAdminDashboard(req, res) {
  const tenantId = req.tenantId;  // from JWT middleware
  const cacheKey = CacheKeys.adminDashboard(tenantId);
 
  try {
    const { data, fromCache } = await cacheGetOrSet(
      cacheKey,
      TTL_DASHBOARD,
      async () => {
        // This function only runs on cache MISS (first load or after invalidation)
        const [
          [studentStats],
          [facultyStats],
          [feeStats],
          [attendanceToday],
          [classesToday],
          recentAnnouncements
        ] = await Promise.all([
 
          db.query(`
            SELECT COUNT(*) AS total,
              SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active
            FROM students WHERE tenant_id = ?`,
            [tenantId]),
 
          db.query(`
            SELECT COUNT(*) AS total,
              SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active
            FROM faculty WHERE tenant_id = ?`,
            [tenantId]),
 
          db.query(`
            SELECT
              COALESCE(SUM(CASE WHEN status='paid' THEN amount END), 0) AS collected,
              COALESCE(SUM(CASE WHEN status IN ('pending','overdue') THEN
                (amount - paid_amount) END), 0) AS pending,
              COUNT(CASE WHEN status='overdue' THEN 1 END) AS overdue_count
            FROM fees
            WHERE tenant_id = ? AND year = YEAR(NOW()) AND month = MONTH(NOW())`,
            [tenantId]),
 
          db.query(`
            SELECT COUNT(*) AS total_marked,
              SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) AS present
            FROM attendance WHERE tenant_id = ? AND date = CURDATE()`,
            [tenantId]),
 
          db.query(`
            SELECT COUNT(DISTINCT id) AS classes_today
            FROM timetable
            WHERE tenant_id = ? AND day_of_week = WEEKDAY(NOW())`,
            [tenantId]),
 
          db.query(`
            SELECT id, title, created_at FROM announcements
            WHERE tenant_id = ? AND is_active = 1
            ORDER BY created_at DESC LIMIT 5`,
            [tenantId])
        ]);
 
        const att = attendanceToday[0];
        const attendancePct = att.total_marked > 0
          ? Math.round((att.present / att.total_marked) * 100) : 0;
 
        return {
          students:      { total: studentStats[0].total, active: studentStats[0].active },
          faculty:       { total: facultyStats[0].total, active: facultyStats[0].active },
          fees:          feeStats[0],
          attendance:    { ...att, percent: attendancePct },
          classesToday:  classesToday[0].classes_today,
          announcements: recentAnnouncements,
        };
      }
    );
 
    // Send response with cache status header (useful for debugging)
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    return res.json(data);
 
  } catch (err) {
    console.error('[Dashboard] Admin error:', err);
    return res.status(500).json({ error: 'Failed to load dashboard' });
  }
}

B2.3 — Advanced Level: All 5 Role Dashboards
All 5 dashboard controllers with caching
// ── MANAGER DASHBOARD ────────────────────────────────────────────────
async function getManagerDashboard(req, res) {
  const tenantId = req.tenantId;
  const cacheKey = CacheKeys.managerDashboard(tenantId);
 
  const { data } = await cacheGetOrSet(cacheKey, TTL_DASHBOARD, async () => {
    const [[admissions], [feesToday], [pendingLeave]] = await Promise.all([
      db.query(`SELECT COUNT(*) AS new_admissions FROM students WHERE tenant_id=?
                AND admission_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)`, [tenantId]),
      db.query(`SELECT COALESCE(SUM(paid_amount),0) AS collected_today FROM fees
                WHERE tenant_id=? AND paid_date=CURDATE()`, [tenantId]),
      db.query(`SELECT COUNT(*) AS pending FROM leave_requests
                WHERE tenant_id=? AND status='pending'`, [tenantId]),
    ]);
    return { admissions: admissions[0], feesToday: feesToday[0], pendingLeave: pendingLeave[0] };
  });
  return res.json(data);
}
 
// ── STUDENT DASHBOARD (per-student cache) ────────────────────────────
async function getStudentDashboard(req, res) {
  const tenantId = req.tenantId;
  const userId   = req.userId;
  // Each student gets their OWN cache key — personal data must not be shared
  const cacheKey = CacheKeys.studentDashboard(tenantId, userId);
 
  const { data } = await cacheGetOrSet(cacheKey, 120, async () => {
    // Get student record first
    const [[student]] = await db.query(
      `SELECT id, class_id, roll_number FROM students WHERE tenant_id=? AND user_id=? LIMIT 1`,
      [tenantId, userId]
    );
    if (!student) throw new Error('Student not found');
 
    const [[feeDue], [attendance], todayClasses, [announcements]] = await Promise.all([
      db.query(`SELECT COALESCE(SUM(amount-paid_amount),0) AS due FROM fees
                WHERE tenant_id=? AND student_id=? AND status!='paid'`,
                [tenantId, student.id]),
      db.query(`SELECT COUNT(*) AS total,
                SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) AS present
                FROM attendance WHERE tenant_id=? AND student_id=?`,
                [tenantId, student.id]),
      db.query(`SELECT subject, start_time, end_time FROM timetable
                WHERE tenant_id=? AND class_id=? AND day_of_week=WEEKDAY(NOW())
                ORDER BY start_time`, [tenantId, student.class_id]),
      db.query(`SELECT title, created_at FROM announcements
                WHERE tenant_id=? AND is_active=1 ORDER BY created_at DESC LIMIT 4`,
                [tenantId]),
    ]);
    const att = attendance[0];
    return {
      rollNumber: student.roll_number,
      feeDue: feeDue[0].due,
      attendance: { total: att.total, present: att.present,
        percent: att.total > 0 ? Math.round(att.present/att.total*100) : 0 },
      todayClasses,
      announcements,
    };
  });
  return res.json(data);
}
 
// ── FACULTY DASHBOARD ────────────────────────────────────────────────
async function getFacultyDashboard(req, res) {
  const tenantId = req.tenantId;
  const userId   = req.userId;
  const cacheKey = CacheKeys.facultyDashboard(tenantId, userId);
 
  const { data } = await cacheGetOrSet(cacheKey, TTL_DASHBOARD, async () => {
    const [[faculty]] = await db.query(
      `SELECT id FROM faculty WHERE tenant_id=? AND user_id=? LIMIT 1`,
      [tenantId, userId]
    );
    const [todayClasses, [pendingAttendance], [assignedClasses]] = await Promise.all([
      db.query(`SELECT t.subject, t.start_time, t.end_time, c.name AS class_name
                FROM timetable t JOIN classes c ON c.id=t.class_id AND c.tenant_id=?
                WHERE t.tenant_id=? AND t.faculty_id=? AND t.day_of_week=WEEKDAY(NOW())
                ORDER BY t.start_time`, [tenantId, tenantId, faculty.id]),
      db.query(`SELECT COUNT(DISTINCT t.class_id) AS count FROM timetable t
                LEFT JOIN attendance a ON a.class_id=t.class_id AND a.date=CURDATE()
                    AND a.tenant_id=?
                WHERE t.tenant_id=? AND t.faculty_id=? AND t.day_of_week=WEEKDAY(NOW())
                AND a.id IS NULL`, [tenantId, tenantId, faculty.id]),
      db.query(`SELECT COUNT(DISTINCT class_id) AS total FROM timetable
                WHERE tenant_id=? AND faculty_id=?`, [tenantId, faculty.id]),
    ]);
    return { todayClasses, pendingAttendance: pendingAttendance[0], assignedClasses: assignedClasses[0] };
  });
  return res.json(data);
}
 
// ── PARENT DASHBOARD ─────────────────────────────────────────────────
async function getParentDashboard(req, res) {
  const tenantId = req.tenantId;
  const userId   = req.userId;
  const cacheKey = CacheKeys.parentDashboard(tenantId, userId);
 
  const { data } = await cacheGetOrSet(cacheKey, 120, async () => {
    // Get all children of this parent
    const [children] = await db.query(
      `SELECT s.id, u.name, s.roll_number, s.class_id, c.name AS class_name
       FROM students s
       JOIN users u ON u.id=s.user_id AND u.tenant_id=?
       LEFT JOIN classes c ON c.id=s.class_id AND c.tenant_id=?
       WHERE s.tenant_id=? AND s.parent_id=?`,
      [tenantId, tenantId, tenantId, userId]
    );
    // For each child, get fee due and attendance
    const childData = await Promise.all(children.map(async (child) => {
      const [[fee], [att]] = await Promise.all([
        db.query(`SELECT COALESCE(SUM(amount-paid_amount),0) AS due FROM fees WHERE tenant_id=? AND student_id=? AND status!='paid'`, [tenantId, child.id]),
        db.query(`SELECT COUNT(*) AS total, SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) AS present FROM attendance WHERE tenant_id=? AND student_id=?`, [tenantId, child.id]),
      ]);
      return { ...child, feeDue: fee[0].due, attendance: { total: att[0].total, present: att[0].present } };
    }));
    return { children: childData };
  });
  return res.json(data);
}
 
module.exports = { getAdminDashboard, getManagerDashboard, getStudentDashboard, getFacultyDashboard, getParentDashboard };

Dashboard Routes:
Dashboard routes
// File: src/routes/dashboard.routes.js
const express = require('express');
const router  = express.Router();
const { tenantMiddleware, requireRole } = require('../middleware/tenant.middleware');
const dash = require('../controllers/dashboard.controller');
 
router.use(tenantMiddleware);
 
router.get('/admin',   requireRole('institute_admin'),        dash.getAdminDashboard);
router.get('/manager', requireRole('manager'),                dash.getManagerDashboard);
router.get('/student', requireRole('student'),                dash.getStudentDashboard);
router.get('/faculty', requireRole('faculty'),                dash.getFacultyDashboard);
router.get('/parent',  requireRole('parent'),                 dash.getParentDashboard);
 
module.exports = router;

 
Step B3 — Cache Invalidation on Every Write

B3.1 — Basic Level: What Is Cache Invalidation?
Cache invalidation means: when data in the database changes (a student is added, a fee is paid, attendance is marked), you must delete the related Redis cache so the next request fetches fresh data from the database.

The golden rule of cache invalidation
When you INSERT, UPDATE, or DELETE any record, immediately delete the Redis cache keys for that data.
 
Example: Admin adds a new student → student count on dashboard changes → delete tenant:{id}:dashboard:admin from Redis → next dashboard load re-fetches from DB → shows correct count.
 
If you forget to invalidate cache, the dashboard shows wrong numbers until TTL expires. This is called a stale cache and it is one of the most common bugs in production systems.

B3.2 — Intermediate Level: Invalidation in Student Controller
Student controller with full cache invalidation
// File: src/controllers/student.controller.js
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const { CacheKeys, cacheGetOrSet, cacheDeletePattern, cacheDel } = require('../utils/cache');
 
const TTL_LIST = parseInt(process.env.REDIS_TTL_LIST) || 300;
 
// ── INVALIDATION HELPER ───────────────────────────────────────────────
// Call this after any student write (create, update, delete)
async function invalidateStudentCache(tenantId) {
  // Clear all student list pages for this tenant
  await cacheDeletePattern(CacheKeys.studentPattern(tenantId));
  // Clear admin and manager dashboards (student count changed)
  await cacheDeletePattern(CacheKeys.dashboardPattern(tenantId));
}
 
// ── CREATE STUDENT ───────────────────────────────────────────────────
async function createStudent(req, res) {
  const tenantId = req.tenantId;
  const { name, email, phone, roll_number, class_id, date_of_birth, gender, parent_id } = req.body;
 
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
 
    // Create user account first
    const userId = uuidv4();
    const tempPassword = await bcrypt.hash('Welcome@123', 10);
    await conn.query(
      `INSERT INTO users (id, tenant_id, role, name, email, phone, password_hash)
       VALUES (?,?,?,?,?,?,?)`,
      [userId, tenantId, 'student', name, email.toLowerCase(), phone, tempPassword]
    );
 
    // Create student profile
    const studentId = uuidv4();
    await conn.query(
      `INSERT INTO students (id, tenant_id, user_id, roll_number, class_id,
         date_of_birth, gender, parent_id, admission_date)
       VALUES (?,?,?,?,?,?,?,?,CURDATE())`,
      [studentId, tenantId, userId, roll_number, class_id, date_of_birth, gender, parent_id]
    );
 
    await conn.commit();
 
    // CRITICAL: Invalidate cache AFTER successful commit
    await invalidateStudentCache(tenantId);
 
    return res.status(201).json({ message: 'Student created successfully', studentId });
 
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Roll number or email already exists in this institute' });
    }
    console.error('[Student] Create error:', err);
    return res.status(500).json({ error: 'Failed to create student' });
  } finally {
    conn.release();
  }
}
 
// ── UPDATE STUDENT ───────────────────────────────────────────────────
async function updateStudent(req, res) {
  const tenantId  = req.tenantId;
  const studentId = req.params.id;
  const { name, class_id, section, status } = req.body;
 
  try {
    const [result] = await db.query(
      `UPDATE students SET class_id=?, section=?, status=?, updated_at=NOW()
       WHERE id=? AND tenant_id=?`,  -- tenant_id MANDATORY in UPDATE
      [class_id, section, status, studentId, tenantId]
    );
 
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
 
    // Invalidate specific student record cache + list pages
    await cacheDel(CacheKeys.student(tenantId, studentId));
    await invalidateStudentCache(tenantId);
 
    return res.json({ message: 'Student updated' });
  } catch (err) {
    console.error('[Student] Update error:', err);
    return res.status(500).json({ error: 'Failed to update student' });
  }
}
 
// ── DELETE STUDENT ───────────────────────────────────────────────────
async function deleteStudent(req, res) {
  const tenantId  = req.tenantId;
  const studentId = req.params.id;
 
  try {
    // Soft delete: set status to inactive instead of removing the row
    const [result] = await db.query(
      `UPDATE students SET status='inactive', updated_at=NOW()
       WHERE id=? AND tenant_id=?`,
      [studentId, tenantId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
 
    // Invalidate cache
    await cacheDel(CacheKeys.student(tenantId, studentId));
    await invalidateStudentCache(tenantId);
 
    return res.json({ message: 'Student deactivated' });
  } catch (err) {
    console.error('[Student] Delete error:', err);
    return res.status(500).json({ error: 'Failed to delete student' });
  }
}
 
module.exports = { createStudent, updateStudent, deleteStudent };

B3.3 — Advanced Level: Invalidation Map for All 26+ Features
Every feature in ZenithFlows must follow this invalidation rule. Here is the complete map of which cache to clear for each type of write:

When This Happens	Clear These Cache Keys	Why
Student added / updated / deleted	tenant:{id}:students:* tenant:{id}:dashboard:*	Student count and list change
Fee paid / added / updated	tenant:{id}:dashboard:admin tenant:{id}:dashboard:manager tenant:{id}:dashboard:student:{uid} tenant:{id}:dashboard:parent:{uid}	Fee stats change on 4 dashboards
Attendance marked / updated	tenant:{id}:dashboard:admin tenant:{id}:dashboard:student:{uid} tenant:{id}:dashboard:faculty:{uid}	Attendance % changes on 3 dashboards
Faculty added / updated / deleted	tenant:{id}:faculty:* tenant:{id}:dashboard:admin	Faculty count and list change
Timetable created / edited / deleted	tenant:{id}:dashboard:* tenant:{id}:timetable:*	Today's classes change everywhere
Announcement published / deleted	tenant:{id}:dashboard:*	All dashboards show announcements
Class created / updated	tenant:{id}:classes:all tenant:{id}:students:*	Class list used in student form

 
Step B4 — Cursor-Based Pagination on All List APIs

B4.1 — Basic Level: Why Cursor Pagination, Not OFFSET?

OFFSET Pagination (old way)	Cursor Pagination (correct way)
SELECT * FROM students LIMIT 10 OFFSET 290	SELECT * FROM students WHERE id > 'lastId' LIMIT 10
To get page 30, DB scans ALL 300 rows before returning 10	To get any page, DB jumps directly to the cursor position
Gets SLOWER as you go deeper into pages	Same speed for page 1 and page 300
Data can shift if new records inserted between pages	Stable: cursor anchors to a specific record
Page 30 of 300 students: 300 rows scanned	Same query: exactly 10 rows scanned

B4.2 — Intermediate Level: Student List With Cursor Pagination + Cache
Student list with cursor pagination and cache
// ── GET STUDENTS (add to student.controller.js) ─────────────────────
async function getStudents(req, res) {
  const tenantId = req.tenantId;
  const cursor   = req.query.cursor || null;   // last seen student id
  const limit    = Math.min(parseInt(req.query.limit) || 10, 100); // max 100
  const search   = req.query.search || null;   // optional name/roll search
  const classId  = req.query.class_id || null; // optional class filter
 
  // Build cache key (include all filter params so different filters get different caches)
  const cacheKey = CacheKeys.studentPage(tenantId, cursor || 'start', limit);
 
  // Only cache unfiltered pages (search results should not be cached)
  const shouldCache = !search && !classId;
 
  try {
    const fetchStudents = async () => {
      // Build query dynamically based on filters
      let whereConditions = ['s.tenant_id = ?'];
      let params = [tenantId];
 
      // Always filter active students unless admin asks for all
      whereConditions.push(`s.status = 'active'`);
 
      // Cursor condition: get records AFTER this id
      if (cursor) {
        whereConditions.push('s.id > ?');
        params.push(cursor);
      }
 
      // Optional class filter
      if (classId) {
        whereConditions.push('s.class_id = ?');
        params.push(classId);
      }
 
      // Optional search (name or roll number)
      if (search) {
        whereConditions.push('(u.name LIKE ? OR s.roll_number LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
      }
 
      params.push(limit + 1);  // fetch 1 extra to detect hasMore
 
      const query = `
        SELECT
          s.id, s.roll_number, s.status, s.admission_date,
          u.name, u.email, u.phone,
          c.name AS class_name,
          s.gender, s.created_at
        FROM students s
        JOIN  users u   ON u.id  = s.user_id  AND u.tenant_id  = ?
        LEFT JOIN classes c ON c.id = s.class_id AND c.tenant_id = ?
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY s.id ASC
        LIMIT ?
      `;
 
      // tenant_id for the JOINs
      const fullParams = [tenantId, tenantId, ...params];
      const [rows] = await db.query(query, fullParams);
 
      const hasMore     = rows.length > limit;
      const students    = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor  = hasMore ? students[students.length - 1].id : null;
 
      return { students, nextCursor, hasMore, total: students.length };
    };
 
    if (shouldCache) {
      const { data, fromCache } = await cacheGetOrSet(cacheKey, TTL_LIST, fetchStudents);
      res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
      return res.json(data);
    } else {
      // Search results: hit DB directly, no cache
      const data = await fetchStudents();
      return res.json(data);
    }
 
  } catch (err) {
    console.error('[Student] List error:', err);
    return res.status(500).json({ error: 'Failed to fetch students' });
  }
}

B4.3 — Advanced Level: How Frontend Uses Cursor Pagination
The frontend keeps track of the cursor and sends it with each page request. Here is how to implement it in React:

StudentList.jsx — React component with cursor pagination
// File: StudentList.jsx (React component)
import { useState, useCallback } from 'react';
 
function StudentList() {
  const [students,   setStudents]   = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore,    setHasMore]    = useState(true);
  const [loading,    setLoading]    = useState(false);
  const [page,       setPage]       = useState(1);
  const [cursors,    setCursors]    = useState([null]); // history for back navigation
 
  const fetchPage = useCallback(async (cursor) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 10 });
      if (cursor) params.set('cursor', cursor);
 
      const res  = await fetch(`/api/students?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
 
      setStudents(data.students);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } finally {
      setLoading(false);
    }
  }, []);
 
  // Load first page on mount
  useState(() => { fetchPage(null); }, []);
 
  function goNext() {
    if (!nextCursor) return;
    setCursors(prev => [...prev, nextCursor]);
    setPage(p => p + 1);
    fetchPage(nextCursor);
  }
 
  function goPrev() {
    if (page <= 1) return;
    const prevCursor = cursors[page - 2];  // cursor for previous page
    setCursors(prev => prev.slice(0, -1));
    setPage(p => p - 1);
    fetchPage(prevCursor);
  }
 
  return (
    <div>
      {loading ? <div>Loading...</div> : (
        <table>
          <thead><tr><th>Name</th><th>Roll No</th><th>Class</th><th>Status</th></tr></thead>
          <tbody>{students.map(s => (
            <tr key={s.id}>
              <td>{s.name}</td><td>{s.roll_number}</td>
              <td>{s.class_name}</td><td>{s.status}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
      <div className='pagination'>
        <button onClick={goPrev} disabled={page === 1}>Previous</button>
        <span>Page {page}</span>
        <button onClick={goNext} disabled={!hasMore}>Next</button>
      </div>
    </div>
  );
}

B4.4 — Apply Same Pattern to Faculty and Parent Lists
Faculty list — same pattern as students
// File: src/controllers/faculty.controller.js
async function getFaculty(req, res) {
  const tenantId = req.tenantId;
  const cursor   = req.query.cursor || null;
  const limit    = Math.min(parseInt(req.query.limit) || 10, 100);
  const cacheKey = CacheKeys.facultyPage(tenantId, cursor || 'start', limit);
 
  const { data } = await cacheGetOrSet(cacheKey, TTL_LIST, async () => {
    let whereClause = 'f.tenant_id = ? AND f.status = ?';
    let params = [tenantId, 'active'];
 
    if (cursor) { whereClause += ' AND f.id > ?'; params.push(cursor); }
    params.push(limit + 1);
 
    const [rows] = await db.query(`
      SELECT f.id, f.employee_id, f.designation, f.department, f.joining_date,
             u.name, u.email, u.phone
      FROM faculty f
      JOIN users u ON u.id = f.user_id AND u.tenant_id = ?
      WHERE ${whereClause}
      ORDER BY f.id ASC LIMIT ?`,
      [tenantId, ...params]
    );
 
    const hasMore  = rows.length > limit;
    const faculty  = hasMore ? rows.slice(0, limit) : rows;
    return { faculty, nextCursor: hasMore ? faculty[faculty.length-1].id : null, hasMore };
  });
  return res.json(data);
}
 
// Apply same pattern for parents, classes, fees list, attendance list...
// Only the SELECT columns and table name change. The cursor pagination
// and caching logic is identical.

 
Step B5 — MySQL Read Replica

B5.1 — Basic Level: What Is a Read Replica?
A read replica is a second copy of your MySQL database that stays in sync with the primary database in real time. All SELECT queries go to the replica. All INSERT, UPDATE, DELETE queries go to the primary. This doubles your database read capacity.

When do you need a read replica?
You need a read replica when your database becomes the bottleneck — typically when you have 30+ institutes with heavy daily usage, or when you run complex reports that take 2–5 seconds each.
 
Before setting up a read replica, make sure Steps B1–B4 are done. Redis caching reduces DB reads by 80–90%. Many ZenithFlows deployments can run for years on a single DB with Redis. Add the replica when you actually see the primary DB at 70%+ CPU during peak hours.

B5.2 — Intermediate Level: DB Connection With Read/Write Split
src/config/db.js — read/write split database module
// File: src/config/db.js
const mysql = require('mysql2/promise');
 
// PRIMARY: handles all writes (INSERT, UPDATE, DELETE)
const primaryPool = mysql.createPool({
  host:            process.env.DB_HOST,
  user:            process.env.DB_USER,
  password:        process.env.DB_PASSWORD,
  database:        process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  charset:         'utf8mb4',
});
 
// REPLICA: handles all reads (SELECT)
// If no replica is configured, falls back to primary
const replicaPool = process.env.DB_REPLICA_HOST
  ? mysql.createPool({
      host:            process.env.DB_REPLICA_HOST,
      user:            process.env.DB_USER,
      password:        process.env.DB_PASSWORD,
      database:        process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit:    20,  // replicas can handle more read connections
      queueLimit:         0,
      charset:         'utf8mb4',
    })
  : primaryPool;  // fall back to primary if no replica
 
// Smart db object: auto-routes queries to correct pool
const db = {
  // SELECT queries -> replica
  query(sql, params) {
    const isWrite = /^\s*(INSERT|UPDATE|DELETE|REPLACE|CREATE|ALTER|DROP|TRUNCATE)/i.test(sql);
    return isWrite ? primaryPool.query(sql, params) : replicaPool.query(sql, params);
  },
 
  // Transactions ALWAYS use primary (must be atomic on one server)
  getConnection() {
    return primaryPool.getConnection();
  },
 
  // Explicit read/write access if needed
  read:  { query: (sql, p) => replicaPool.query(sql, p) },
  write: { query: (sql, p) => primaryPool.query(sql, p) },
};
 
module.exports = db;

Add replica config to .env:
.env — database configuration
# Primary database
DB_HOST=your-primary-db-host
DB_USER=zenithflows
DB_PASSWORD=your-secure-password
DB_NAME=zenithflows_db
 
# Read replica (leave empty to use primary for everything)
DB_REPLICA_HOST=your-replica-db-host
# DB_USER and DB_PASSWORD are shared between primary and replica

B5.3 — Advanced Level: Setting Up MySQL Replication
On your MySQL primary server, enable binary logging and create a replication user:

MySQL replication setup commands
-- On PRIMARY MySQL server
 
-- Step 1: Edit /etc/mysql/mysql.conf.d/mysqld.cnf
-- Add these lines:
-- [mysqld]
-- server-id = 1
-- log_bin = /var/log/mysql/mysql-bin.log
-- binlog_do_db = zenithflows_db
 
-- Step 2: Create replication user
CREATE USER 'replicator'@'%' IDENTIFIED BY 'strong-replica-password';
GRANT REPLICATION SLAVE ON *.* TO 'replicator'@'%';
FLUSH PRIVILEGES;
 
-- Step 3: Get binary log position
FLUSH TABLES WITH READ LOCK;
SHOW MASTER STATUS;
-- Note the File and Position values (e.g., mysql-bin.000003, 154)
UNLOCK TABLES;
 
-- On REPLICA MySQL server
-- Step 4: Edit /etc/mysql/mysql.conf.d/mysqld.cnf
-- server-id = 2  (must be different from primary)
 
-- Step 5: Configure replica
CHANGE MASTER TO
  MASTER_HOST='primary-server-ip',
  MASTER_USER='replicator',
  MASTER_PASSWORD='strong-replica-password',
  MASTER_LOG_FILE='mysql-bin.000003',  -- from step 3
  MASTER_LOG_POS=154;                  -- from step 3
 
START SLAVE;
SHOW SLAVE STATUS\G  -- check Seconds_Behind_Master = 0 means in sync

 
Phase B — Complete Implementation Checklist

Use this checklist to verify Phase B is 100% complete

B1 — Redis Setup
Task	Status
Redis installed on server and running (redis-cli ping returns PONG)	[ ]
ioredis npm package installed in project	[ ]
src/config/redis.js created with reconnect strategy	[ ]
src/utils/cache.js created with CacheKeys, cacheGetOrSet, cacheDeletePattern	[ ]
Redis environment variables added to .env	[ ]
Redis connection tested: getRedis() returns connected client	[ ]

B2 — Dashboard Caching
Task	Status
Admin dashboard API uses cacheGetOrSet with 60s TTL	[ ]
Manager dashboard API uses cacheGetOrSet with 60s TTL	[ ]
Student dashboard API uses per-student cache key with 120s TTL	[ ]
Faculty dashboard API uses per-faculty cache key with 60s TTL	[ ]
Parent dashboard API uses per-parent cache key with 120s TTL	[ ]
All dashboard queries use Promise.all for parallel execution	[ ]
X-Cache: HIT / MISS header visible in browser DevTools Network tab	[ ]

B3 — Cache Invalidation
Task	Status
createStudent() calls invalidateStudentCache() after DB commit	[ ]
updateStudent() calls cacheDel() + invalidateStudentCache()	[ ]
deleteStudent() calls cacheDel() + invalidateStudentCache()	[ ]
createFaculty() / updateFaculty() / deleteFaculty() invalidate faculty cache	[ ]
Fee payment / creation invalidates dashboard cache for admin + student	[ ]
Attendance mark invalidates dashboard cache for admin + student + faculty	[ ]
Timetable changes invalidate timetable + dashboard cache	[ ]
Tested: Add student → dashboard count updates on next load	[ ]

B4 — Cursor Pagination
Task	Status
getStudents() uses cursor-based pagination (WHERE id > cursor)	[ ]
getFaculty() uses cursor-based pagination	[ ]
getParents() uses cursor-based pagination	[ ]
Paginated list pages cached in Redis (TTL 300s)	[ ]
Search queries bypass cache (not cached)	[ ]
Frontend StudentList.jsx uses cursor history for back navigation	[ ]
Tested: Page 1 → Page 2 → Page 3 shows correct, non-repeating records	[ ]
Tested: Adding a record during pagination doesn’t break navigation	[ ]

B5 — Read Replica
Task	Status
src/config/db.js updated with read/write split logic	[ ]
SELECT queries automatically routed to replicaPool	[ ]
INSERT / UPDATE / DELETE queries routed to primaryPool	[ ]
Transactions use getConnection() (always primary)	[ ]
DB_REPLICA_HOST added to .env (or left empty to use primary)	[ ]
Tested: SHOW SLAVE STATUS shows Seconds_Behind_Master = 0	[ ]

Performance results you should see after Phase B is complete
Dashboard load time:    400–600ms  →  3–8ms   (served from Redis)
Student list (page 1):  300–500ms  →  10–40ms  (cursor + cache)
Student list (page 2+): 300–500ms  →  10–40ms  (cursor only, always fast)
Database CPU at peak:   70–80%     →  15–25%  (Redis absorbs 80% of reads)
Concurrent institutes:  10–20       →  100+    (Redis prevents DB bottleneck)

 
Critical Mistakes to Avoid in Phase B

Mistake	Why Dangerous	Correct Approach
Using KEYS command in Redis to find patterns	KEYS blocks the entire Redis server. One slow KEYS call makes every other request wait.	Always use SCAN with COUNT 100 (see cacheDeletePattern function — already implemented correctly).
Caching search/filter results	Search results are unique to each query. Caching them wastes Redis memory and may serve wrong filtered data.	Only cache full unfiltered list pages. Set shouldCache = !search && !classId in the controller.
Not invalidating cache after writes	Dashboard shows wrong counts. User adds a student, refreshes, still sees old count until TTL expires. Looks like a bug.	Every single write controller (create, update, delete) must call the appropriate invalidation function.
Caching without tenant_id in the key	tenant:students:page:1 stores Institute A's students. Institute B's request for the same key gets Institute A's data. Catastrophic data breach.	Always include tenant_id in every Redis key: tenant:{tenantId}:students:c{cursor}:l{limit}
Using OFFSET pagination with large tables	SELECT * FROM students LIMIT 10 OFFSET 2990 on a 3000-row table scans all 3000 rows. Page 300 is as slow as a full table scan.	Use cursor-based pagination: WHERE id > lastId LIMIT 10. Always fast regardless of depth.
Starting transactions on the replica pool	The replica is read-only. Transactions with INSERT/UPDATE on replica will fail or corrupt data.	getConnection() always uses primaryPool. Never use the replica pool for transactions.

What Comes Next — Phase C Preview

Phase C adds the async job queue and real-time features. Build it when you have 30+ active institutes or when bulk imports and report generation start affecting other users.

Phase C Step	What You Build	Problem It Solves
C1	BullMQ job queue for bulk student import (2000 records)	2000-row CSV import completes in background without timeout
C2	Progress tracking via WebSocket / SSE	Admin sees real-time progress bar during bulk operations
C3	Async report generation (PDF, Excel exports)	Large reports don’t freeze the UI or timeout
C4	Email / SMS notification queue	Sending 500 fee reminders doesn’t block the API
C5	Cloudflare CDN for static assets	JS/CSS/images served from edge, reduces server load 40%

Summary: What Phase B gives ZenithFlows
1.  Dashboard loads in under 10ms for all 5 roles (served from Redis)
2.  Student, faculty, parent lists are fast on any page number (cursor pagination)
3.  Cache is always fresh — every write invalidates exactly the right keys
4.  Database is protected from read overload by Redis absorbing 80–90% of traffic
5.  Read replica ready for when you cross 30+ institutes with heavy daily usage
6.  ZenithFlows can serve 100+ institutes simultaneously without performance issues

