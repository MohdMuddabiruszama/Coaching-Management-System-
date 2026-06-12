ZenithFlows
Institute Management SaaS Platform
Phase A — Foundation Implementation Guide
Single DB + tenant_id Multi-Tenant Architecture
Basic Level  →  Intermediate  →  Advanced

Version 1.0	Stack: Node.js + MySQL/PostgreSQL	Estimated: 1–2 Weeks

 
Introduction — What Is Phase A and Why It Comes First

Read this before writing a single line of code
Phase A is the structural foundation of your entire SaaS platform. Everything else — caching, pagination, performance, scaling — depends on this being correct from the very beginning.
 
If you skip Phase A or do it wrong, you will face a catastrophic problem later: data from Institute A visible to Institute B, broken queries as your database grows, and a refactor so painful it could require rebuilding the project from scratch.
 
Phase A must be implemented before any institute goes live. The 4 steps take 1–2 weeks total.

ZenithFlows serves multiple institutes simultaneously. Each institute is a tenant. Your system must ensure that:
•	Institute A (e.g., Greenwood School) never sees Institute B's (e.g., Sunrise Academy) students, fees, or data
•	All institutes share one database, one backend, one codebase — this keeps costs manageable
•	The system remains fast even with 200 institutes and 500,000 total student records
•	Adding a new institute takes minutes, not days

The 4 Steps of Phase A

Step	What You Do	Why It Matters
A1	Add tenant_id to every database table	Data isolation — the most critical step
A2	Add compound indexes on tenant_id	Query speed with many tenants and rows
A3	Update JWT to carry tenant_id + role + user_id	Security and zero extra DB lookups per request
A4	Set up subdomain routing	Each institute gets its own URL automatically

 
Step A1 — Add tenant_id to Every Database Table

Concept: What Is tenant_id?
Every table in your database represents data that belongs to a specific institute. The tenant_id column is a unique identifier that tells the database which institute owns each row of data.

Real-world analogy
Think of a large apartment building (your database). Many families (institutes) live there. Every piece of furniture has a label showing which apartment it belongs to. tenant_id is that label. Without it, you can’t tell which furniture belongs to which family.

A1.1 — Basic Level: Understanding the Concept
Before adding tenant_id, your students table probably looks like this:

Current broken table structure
-- Your CURRENT table (without multi-tenancy)
CREATE TABLE students (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100),
  email       VARCHAR(200),
  class_id    INT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
 
-- Problem: If Institute A has student ID=5 and Institute B
-- also has student ID=5, there is NO way to tell them apart.
-- A query for 'all students' returns EVERYONE from ALL institutes.

After adding tenant_id, the same table looks like this:

Correct multi-tenant table structure
-- CORRECT multi-tenant table
CREATE TABLE students (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id   VARCHAR(36) NOT NULL,  -- <-- Added: which institute owns this row
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(200),
  class_id    INT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 
  INDEX idx_tenant (tenant_id)  -- <-- Index for fast filtering
);
 
-- Now Institute A's students have tenant_id = 'greenwood-uuid'
-- Institute B's students have tenant_id = 'sunrise-uuid'
-- They can NEVER be confused.

A1.2 — Intermediate Level: The Master Tenants Table
First, create a master table that stores every institute (tenant) that signs up for ZenithFlows:

tenants master table — SQL
-- STEP 1: Create the tenants master table
-- This stores every institute that uses ZenithFlows
CREATE TABLE tenants (
  id          VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name        VARCHAR(200) NOT NULL,       -- 'Greenwood International School'
  subdomain   VARCHAR(100) NOT NULL UNIQUE, -- 'greenwood' (used in URL)
  email       VARCHAR(200) NOT NULL,       -- admin contact email
  phone       VARCHAR(20),
  address     TEXT,
  logo_url    VARCHAR(500),
  plan        ENUM('basic','pro','enterprise') DEFAULT 'basic',
  is_active   BOOLEAN DEFAULT TRUE,
  trial_ends_at DATETIME,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 
  INDEX idx_subdomain (subdomain),
  INDEX idx_active (is_active)
);

A1.3 — Advanced Level: All Tables With tenant_id
Now update every single table in your project. Below are all the core tables for ZenithFlows with tenant_id correctly added. Use UUID for tenant_id (VARCHAR 36) — it is safer than integer IDs for multi-tenant systems.

Users table — all 6 roles in one table
users table — all roles
CREATE TABLE users (
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  tenant_id       VARCHAR(36) NOT NULL,  -- which institute
  role            ENUM('super_admin','institute_admin','manager',
                       'faculty','student','parent') NOT NULL,
  name            VARCHAR(200) NOT NULL,
  email           VARCHAR(200) NOT NULL,
  phone           VARCHAR(20),
  password_hash   VARCHAR(255) NOT NULL,
  profile_photo   VARCHAR(500),
  is_active       BOOLEAN DEFAULT TRUE,
  last_login      TIMESTAMP,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 
  -- Unique email PER TENANT (same email can exist in 2 different institutes)
  UNIQUE KEY uq_tenant_email (tenant_id, email),
  INDEX idx_tenant_role (tenant_id, role),
  INDEX idx_tenant_active (tenant_id, is_active),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

Students table
students table
CREATE TABLE students (
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  tenant_id       VARCHAR(36) NOT NULL,
  user_id         VARCHAR(36) NOT NULL,   -- FK to users table
  roll_number     VARCHAR(50) NOT NULL,   -- unique within tenant
  class_id        VARCHAR(36),
  section         VARCHAR(10),
  admission_date  DATE,
  date_of_birth   DATE,
  gender          ENUM('male','female','other'),
  blood_group     VARCHAR(5),
  address         TEXT,
  parent_id       VARCHAR(36),
  status          ENUM('active','inactive','graduated','expelled') DEFAULT 'active',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 
  UNIQUE KEY uq_tenant_roll (tenant_id, roll_number),
  INDEX idx_tenant_id (tenant_id, id),           -- cursor pagination
  INDEX idx_tenant_class (tenant_id, class_id),  -- class-wise queries
  INDEX idx_tenant_status (tenant_id, status),   -- active students
  INDEX idx_tenant_created (tenant_id, created_at),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

Faculty table
faculty table
CREATE TABLE faculty (
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  tenant_id       VARCHAR(36) NOT NULL,
  user_id         VARCHAR(36) NOT NULL,
  employee_id     VARCHAR(50) NOT NULL,
  designation     VARCHAR(100),
  department      VARCHAR(100),
  joining_date    DATE,
  qualification   VARCHAR(200),
  salary          DECIMAL(10,2),
  status          ENUM('active','inactive','resigned') DEFAULT 'active',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 
  UNIQUE KEY uq_tenant_emp (tenant_id, employee_id),
  INDEX idx_tenant_id (tenant_id, id),
  INDEX idx_tenant_status (tenant_id, status),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

Fees table
fees table
CREATE TABLE fees (
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  tenant_id       VARCHAR(36) NOT NULL,
  student_id      VARCHAR(36) NOT NULL,
  fee_type        VARCHAR(100) NOT NULL,  -- 'tuition','transport','hostel'
  amount          DECIMAL(10,2) NOT NULL,
  paid_amount     DECIMAL(10,2) DEFAULT 0,
  due_date        DATE NOT NULL,
  paid_date       DATE,
  status          ENUM('pending','partial','paid','overdue') DEFAULT 'pending',
  payment_method  VARCHAR(50),
  transaction_id  VARCHAR(100),
  month           INT,  -- 1-12
  year            INT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 
  INDEX idx_tenant_id (tenant_id, id),
  INDEX idx_tenant_student (tenant_id, student_id),
  INDEX idx_tenant_status (tenant_id, status, due_date),
  INDEX idx_tenant_month (tenant_id, year, month),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

Timetable table
timetable table
CREATE TABLE timetable (
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  tenant_id       VARCHAR(36) NOT NULL,
  class_id        VARCHAR(36) NOT NULL,
  faculty_id      VARCHAR(36) NOT NULL,
  subject         VARCHAR(100) NOT NULL,
  day_of_week     TINYINT NOT NULL,  -- 0=Monday, 6=Sunday
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  room_number     VARCHAR(20),
  academic_year   VARCHAR(10),  -- '2024-25'
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 
  INDEX idx_tenant_class (tenant_id, class_id, day_of_week),
  INDEX idx_tenant_faculty (tenant_id, faculty_id, day_of_week),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

Attendance table
attendance table
CREATE TABLE attendance (
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  tenant_id       VARCHAR(36) NOT NULL,
  student_id      VARCHAR(36) NOT NULL,
  class_id        VARCHAR(36),
  date            DATE NOT NULL,
  status          ENUM('present','absent','late','half_day') NOT NULL,
  marked_by       VARCHAR(36),  -- faculty user_id who marked attendance
  remarks         VARCHAR(200),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 
  -- No duplicate attendance for same student on same date in same tenant
  UNIQUE KEY uq_tenant_student_date (tenant_id, student_id, date),
  INDEX idx_tenant_date (tenant_id, date),
  INDEX idx_tenant_student (tenant_id, student_id, date),
  INDEX idx_tenant_class_date (tenant_id, class_id, date),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

Classes table
classes table
CREATE TABLE classes (
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  tenant_id       VARCHAR(36) NOT NULL,
  name            VARCHAR(100) NOT NULL,  -- 'Class 10', 'Grade 5'
  section         VARCHAR(10),            -- 'A', 'B'
  academic_year   VARCHAR(10),
  class_teacher_id VARCHAR(36),
  max_students    INT DEFAULT 50,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 
  INDEX idx_tenant (tenant_id),
  INDEX idx_tenant_year (tenant_id, academic_year),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

Announcements and notifications table
announcements table
CREATE TABLE announcements (
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  tenant_id       VARCHAR(36) NOT NULL,
  title           VARCHAR(300) NOT NULL,
  content         TEXT NOT NULL,
  target_roles    JSON,  -- ['student','parent'] or ['all']
  class_id        VARCHAR(36),  -- null = all classes
  created_by      VARCHAR(36) NOT NULL,
  is_active       BOOLEAN DEFAULT TRUE,
  publish_at      TIMESTAMP,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 
  INDEX idx_tenant_active (tenant_id, is_active, publish_at),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

Rule: Every table you add in the future must follow this pattern
1.  First column after id must always be tenant_id VARCHAR(36) NOT NULL
2.  Always add FOREIGN KEY (tenant_id) REFERENCES tenants(id)
3.  Always add INDEX idx_tenant (tenant_id, id) as the very first index
4.  Never create a table without tenant_id unless it is a global lookup table (e.g., countries, currencies)

 
Step A2 — Compound Indexes on tenant_id

Why Indexes Are Critical
Without proper indexes, every query scans ALL rows in the table — across all institutes — every single time. With 50 institutes and 10,000 students each, that is 500,000 rows scanned for a query that should only look at 10,000 rows.

Scenario	Without Index	With Compound Index
10 institutes, 1,000 students each	10,000 rows scanned per query	1,000 rows scanned per query
50 institutes, 5,000 students each	250,000 rows scanned	5,000 rows scanned
200 institutes, 5,000 students each	1,000,000 rows scanned	5,000 rows scanned
Response time (estimated)	800ms – 3s per query	5ms – 20ms per query

A2.1 — Mandatory Indexes for Every Table
Mandatory compound indexes — run for every table
-- Pattern: Always create these 2 indexes on EVERY table
 
-- Index 1: Primary lookup (tenant + id for cursor pagination)
CREATE INDEX idx_students_tenant_id ON students (tenant_id, id);
 
-- Index 2: Time-based sorting (tenant + created_at for chronological lists)
CREATE INDEX idx_students_tenant_created ON students (tenant_id, created_at);
 
-- Apply the same pattern to ALL your tables:
CREATE INDEX idx_faculty_tenant_id      ON faculty     (tenant_id, id);
CREATE INDEX idx_faculty_tenant_created ON faculty     (tenant_id, created_at);
CREATE INDEX idx_fees_tenant_id         ON fees        (tenant_id, id);
CREATE INDEX idx_fees_tenant_created    ON fees        (tenant_id, created_at);
CREATE INDEX idx_timetable_tenant_id    ON timetable   (tenant_id, id);
CREATE INDEX idx_attendance_tenant_id   ON attendance  (tenant_id, id);
CREATE INDEX idx_classes_tenant_id      ON classes     (tenant_id, id);

A2.2 — Feature-Specific Indexes
Beyond the two mandatory indexes, add these for the specific queries your 26+ features will run:

Feature-specific indexes
-- Fee management: filter by status and due date
CREATE INDEX idx_fees_tenant_status_due ON fees (tenant_id, status, due_date);
 
-- Fee management: monthly reports
CREATE INDEX idx_fees_tenant_month ON fees (tenant_id, year, month);
 
-- Attendance: class-wise daily attendance
CREATE INDEX idx_att_tenant_class_date ON attendance (tenant_id, class_id, date);
 
-- Attendance: student attendance history
CREATE INDEX idx_att_tenant_student_date ON attendance (tenant_id, student_id, date);
 
-- Timetable: day-wise schedule for a class
CREATE INDEX idx_tt_tenant_class_day ON timetable (tenant_id, class_id, day_of_week);
 
-- Timetable: faculty schedule
CREATE INDEX idx_tt_tenant_faculty_day ON timetable (tenant_id, faculty_id, day_of_week);
 
-- Students: filter by class
CREATE INDEX idx_students_tenant_class ON students (tenant_id, class_id, status);
 
-- Users: login lookup by email within a tenant
CREATE UNIQUE INDEX idx_users_tenant_email ON users (tenant_id, email);

 
Step A3 — JWT Structure With tenant_id + Role + User ID

Why JWT Carries tenant_id
Every API request from the frontend must prove: (1) who the user is, (2) which institute they belong to, and (3) what role they have. If this information is in the JWT token, the backend reads it in milliseconds from the token itself — no database lookup needed on every single request.

Without tenant_id in JWT vs With tenant_id in JWT
WITHOUT:  Request arrives → Verify JWT → DB query to find tenant_id → DB query to find role → check permission → run actual query  (3 DB queries per request)
 
WITH:     Request arrives → Verify JWT → read tenant_id + role from token → run actual query  (1 DB query per request)
 
At 1,000 requests per minute, that is 2,000 fewer DB queries per minute — just from JWT design.

A3.1 — JWT Token Structure
JWT payload structure
// What your JWT payload should look like
// This is decoded from the token on every request
{
  'sub': 'user-uuid-here',          // user's unique ID
  'tenant_id': 'tenant-uuid-here',  // institute's unique ID
  'tenant_subdomain': 'greenwood',  // institute's subdomain
  'role': 'institute_admin',        // one of 6 roles
  'name': 'Rajesh Kumar',           // display name (no extra DB call)
  'email': 'rajesh@greenwood.com',  // email (no extra DB call)
  'permissions': [                  // pre-computed permissions
    'students:read',
    'students:write',
    'fees:read',
    'fees:write',
    'reports:read'
  ],
  'iat': 1717171717,  // issued at (Unix timestamp)
  'exp': 1717257600   // expires at (24 hours later)
}

A3.2 — Login API: Generate JWT With tenant_id
Login API — auth.controller.js
// File: src/controllers/auth.controller.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../db');
 
const JWT_SECRET = process.env.JWT_SECRET;  // long random string in .env
const JWT_EXPIRES = '24h';
 
// Define permissions for each role
const ROLE_PERMISSIONS = {
  super_admin:       ['*'],  // all permissions
  institute_admin:   ['students:*', 'faculty:*', 'fees:*', 'timetable:*', 'reports:*', 'settings:*'],
  manager:           ['students:read', 'students:write', 'fees:read', 'fees:write', 'reports:read'],
  faculty:           ['students:read', 'attendance:write', 'timetable:read', 'grades:write'],
  student:           ['profile:read', 'fees:read', 'timetable:read', 'attendance:read'],
  parent:            ['children:read', 'fees:read', 'attendance:read', 'announcements:read'],
};
 
async function login(req, res) {
  const { email, password, subdomain } = req.body;
 
  try {
    // Step 1: Find the tenant by subdomain
    const [tenants] = await db.query(
      'SELECT id, name, is_active FROM tenants WHERE subdomain = ? LIMIT 1',
      [subdomain]
    );
    if (!tenants.length || !tenants[0].is_active) {
      return res.status(404).json({ error: 'Institute not found or inactive' });
    }
    const tenant = tenants[0];
 
    // Step 2: Find user within THIS tenant only (tenant_id in query!)
    const [users] = await db.query(
      'SELECT id, name, email, role, password_hash, is_active FROM users WHERE tenant_id = ? AND email = ? LIMIT 1',
      [tenant.id, email.toLowerCase()]  // always lowercase email
    );
    if (!users.length || !users[0].is_active) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = users[0];
 
    // Step 3: Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
 
    // Step 4: Generate JWT with tenant_id embedded
    const token = jwt.sign(
      {
        sub:              user.id,
        tenant_id:        tenant.id,
        tenant_subdomain: subdomain,
        role:             user.role,
        name:             user.name,
        email:            user.email,
        permissions:      ROLE_PERMISSIONS[user.role] || [],
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );
 
    // Step 5: Update last login time
    await db.query(
      'UPDATE users SET last_login = NOW() WHERE id = ? AND tenant_id = ?',
      [user.id, tenant.id]
    );
 
    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      tenant: { id: tenant.id, name: tenant.name, subdomain }
    });
 
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
}
 
module.exports = { login };

A3.3 — Tenant Middleware: Validate Every Request
This middleware runs on every protected API route. It reads the JWT, extracts tenant_id and role, and attaches them to req so your controllers can use them without any extra database calls.

Tenant middleware — tenant.middleware.js
// File: src/middleware/tenant.middleware.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;
 
function tenantMiddleware(req, res, next) {
  // Step 1: Get token from Authorization header
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
 
  try {
    // Step 2: Verify and decode the JWT
    const decoded = jwt.verify(token, JWT_SECRET);
 
    // Step 3: Attach everything to req — controllers read from here
    req.tenantId   = decoded.tenant_id;   // used in EVERY DB query
    req.userId     = decoded.sub;          // logged-in user
    req.userRole   = decoded.role;         // for permission checks
    req.userName   = decoded.name;
    req.permissions = decoded.permissions || [];
 
    next();  // proceed to the actual controller
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired, please login again' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}
 
// Role-based access control helper
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}`
      });
    }
    next();
  };
}
 
module.exports = { tenantMiddleware, requireRole };

A3.4 — How to Use Middleware in Routes
Route definitions with middleware
// File: src/routes/student.routes.js
const express = require('express');
const router = express.Router();
const { tenantMiddleware, requireRole } = require('../middleware/tenant.middleware');
const studentController = require('../controllers/student.controller');
 
// All routes below require a valid JWT
router.use(tenantMiddleware);
 
// GET all students — institute_admin, manager, faculty can view
router.get('/',
  requireRole('institute_admin', 'manager', 'faculty'),
  studentController.getStudents
);
 
// POST add student — only institute_admin and manager
router.post('/',
  requireRole('institute_admin', 'manager'),
  studentController.createStudent
);
 
// DELETE student — only institute_admin
router.delete('/:id',
  requireRole('institute_admin'),
  studentController.deleteStudent
);
 
module.exports = router;

A3.5 — Controller: Always Use req.tenantId in DB Queries
Student controller — student.controller.js
// File: src/controllers/student.controller.js
const db = require('../db');
 
async function getStudents(req, res) {
  // Read tenantId from middleware — NEVER from request body or params
  const tenantId = req.tenantId;
 
  // Cursor-based pagination
  const cursor = req.query.cursor || null;
  const limit  = parseInt(req.query.limit) || 10;
 
  try {
    let query, params;
 
    if (cursor) {
      // Page 2+: get students after the cursor (last seen id)
      query = `
        SELECT s.id, u.name, u.email, s.roll_number, s.status, c.name as class_name,
               s.created_at
        FROM students s
        JOIN users u ON u.id = s.user_id AND u.tenant_id = ?
        LEFT JOIN classes c ON c.id = s.class_id AND c.tenant_id = ?
        WHERE s.tenant_id = ?         -- ALWAYS first
          AND s.status = 'active'
          AND s.id > ?                -- cursor position
        ORDER BY s.id ASC
        LIMIT ?
      `;
      params = [tenantId, tenantId, tenantId, cursor, limit + 1];
    } else {
      // Page 1: get first N students
      query = `
        SELECT s.id, u.name, u.email, s.roll_number, s.status, c.name as class_name,
               s.created_at
        FROM students s
        JOIN users u ON u.id = s.user_id AND u.tenant_id = ?
        LEFT JOIN classes c ON c.id = s.class_id AND c.tenant_id = ?
        WHERE s.tenant_id = ?         -- ALWAYS first
          AND s.status = 'active'
        ORDER BY s.id ASC
        LIMIT ?
      `;
      params = [tenantId, tenantId, tenantId, limit + 1];
    }
 
    const [rows] = await db.query(query, params);
 
    // Determine if there's a next page
    const hasMore = rows.length > limit;
    const students = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? students[students.length - 1].id : null;
 
    return res.json({ students, nextCursor, hasMore });
 
  } catch (err) {
    console.error('getStudents error:', err);
    return res.status(500).json({ error: 'Failed to fetch students' });
  }
}
 
async function createStudent(req, res) {
  const tenantId = req.tenantId;
  const { name, email, roll_number, class_id, date_of_birth, gender } = req.body;
 
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
 
    // Always include tenant_id in INSERT
    const userId = require('uuid').v4();
    await conn.query(
      'INSERT INTO users (id, tenant_id, role, name, email, password_hash) VALUES (?,?,?,?,?,?)',
      [userId, tenantId, 'student', name, email, await require('bcrypt').hash('temp123', 10)]
    );
 
    const studentId = require('uuid').v4();
    await conn.query(
      'INSERT INTO students (id, tenant_id, user_id, roll_number, class_id, date_of_birth, gender) VALUES (?,?,?,?,?,?,?)',
      [studentId, tenantId, userId, roll_number, class_id, date_of_birth, gender]
    );
 
    await conn.commit();
    return res.status(201).json({ message: 'Student created', studentId });
 
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Roll number or email already exists in this institute' });
    }
    return res.status(500).json({ error: 'Failed to create student' });
  } finally {
    conn.release();
  }
}
 
module.exports = { getStudents, createStudent };

 
Step A4 — Subdomain Routing

Concept: How Subdomains Work
Each institute gets its own subdomain on ZenithFlows. When an admin visits greenwood.zenithflows.com, the backend immediately knows the tenant is Greenwood School. No manual institute selection needed at login.

URL	Tenant Identified	Who Sees It
greenwood.zenithflows.com	Greenwood International School	Greenwood admins, students, parents
sunrise.zenithflows.com	Sunrise Academy	Sunrise admins, students, parents
admin.zenithflows.com	No tenant (super admin panel)	ZenithFlows super admin only
zenithflows.com	No tenant (marketing page)	Public — signup, pricing

A4.1 — Backend: Extract Subdomain From Request
Subdomain middleware — subdomain.middleware.js
// File: src/middleware/subdomain.middleware.js
const db = require('../db');
 
// Cache tenant lookups to avoid hitting DB on every request
const tenantCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
 
async function getTenantBySubdomain(subdomain) {
  // Check cache first
  if (tenantCache.has(subdomain)) {
    const cached = tenantCache.get(subdomain);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.tenant;
    }
    tenantCache.delete(subdomain);
  }
 
  // DB lookup
  const [rows] = await db.query(
    'SELECT id, name, subdomain, plan, is_active FROM tenants WHERE subdomain = ? LIMIT 1',
    [subdomain]
  );
  if (rows.length) {
    tenantCache.set(subdomain, { tenant: rows[0], timestamp: Date.now() });
    return rows[0];
  }
  return null;
}
 
async function subdomainMiddleware(req, res, next) {
  const host = req.headers.host || '';
  // Extract subdomain: 'greenwood.zenithflows.com' -> 'greenwood'
  const parts = host.split('.');
 
  // Local dev: use X-Tenant-Subdomain header for testing
  const subdomain = parts.length >= 3
    ? parts[0]
    : req.headers['x-tenant-subdomain'];
 
  if (!subdomain || subdomain === 'www' || subdomain === 'admin') {
    req.tenant = null;
    return next();
  }
 
  try {
    const tenant = await getTenantBySubdomain(subdomain);
    if (!tenant || !tenant.is_active) {
      return res.status(404).json({ error: 'Institute not found' });
    }
    req.tenant   = tenant;
    req.tenantId = tenant.id;  // available before JWT auth
    next();
  } catch (err) {
    next(err);
  }
}
 
module.exports = { subdomainMiddleware };

A4.2 — Application Entry Point: app.js
app.js — complete application entry point
// File: src/app.js
const express = require('express');
const cors    = require('cors');
const { subdomainMiddleware } = require('./middleware/subdomain.middleware');
 
const app = express();
 
app.use(express.json({ limit: '10mb' }));  // for bulk imports
 
// CORS: allow all zenithflows.com subdomains
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin.endsWith('.zenithflows.com') || origin === 'https://zenithflows.com') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
 
// Apply subdomain middleware to all routes
app.use(subdomainMiddleware);
 
// Public routes (no JWT required)
app.use('/api/auth', require('./routes/auth.routes'));
 
// Protected routes (JWT required — middleware applied in route file)
app.use('/api/students',      require('./routes/student.routes'));
app.use('/api/faculty',       require('./routes/faculty.routes'));
app.use('/api/fees',          require('./routes/fee.routes'));
app.use('/api/attendance',    require('./routes/attendance.routes'));
app.use('/api/timetable',     require('./routes/timetable.routes'));
app.use('/api/dashboard',     require('./routes/dashboard.routes'));
app.use('/api/classes',       require('./routes/class.routes'));
app.use('/api/announcements', require('./routes/announcement.routes'));
 
// Super admin routes (separate, no tenant context)
app.use('/api/super', require('./routes/super.routes'));
 
module.exports = app;

A4.3 — Frontend: Auto-Detect Subdomain
Frontend tenant utility — tenant.js
// File: src/utils/tenant.js (in your React/Vue frontend)
 
export function getSubdomain() {
  const host = window.location.hostname;
  const parts = host.split('.');
 
  // Production: greenwood.zenithflows.com -> 'greenwood'
  if (parts.length >= 3) return parts[0];
 
  // Local dev: http://localhost:3000 (use env variable)
  return import.meta.env.VITE_TENANT_SUBDOMAIN || 'demo';
}
 
// API call always includes subdomain
export async function apiPost(endpoint, body) {
  const subdomain = getSubdomain();
  const token = localStorage.getItem('token');
 
  const response = await fetch(`https://${subdomain}.zenithflows.com/api${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
 
  if (response.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    return;
  }
 
  return response.json();
}

 
Bonus: The 5 Role-Scoped Dashboard Summary APIs

As part of Phase A completion, build these 5 lightweight dashboard APIs. Each returns only count-level data — no full records — so every dashboard loads in under 300ms.

Institute Admin Dashboard API
Institute admin dashboard API — parallel queries
// File: src/controllers/dashboard.controller.js
 
async function getInstituteAdminDashboard(req, res) {
  const tenantId = req.tenantId;  // from JWT middleware
 
  try {
    // Run all queries in parallel — Promise.all is key for speed
    const [
      [studentStats],
      [facultyStats],
      [feeStats],
      [attendanceStats],
      [todayTimetable],
      [recentAnnouncements]
    ] = await Promise.all([
 
      // Total and active students
      db.query(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active
        FROM students WHERE tenant_id = ?
      `, [tenantId]),
 
      // Faculty count
      db.query(`
        SELECT COUNT(*) as total,
          SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active
        FROM faculty WHERE tenant_id = ?
      `, [tenantId]),
 
      // Fee summary
      db.query(`
        SELECT
          SUM(CASE WHEN status='paid' THEN amount ELSE 0 END) as collected,
          SUM(CASE WHEN status IN ('pending','overdue') THEN amount ELSE 0 END) as pending,
          COUNT(CASE WHEN status='overdue' THEN 1 END) as overdue_count
        FROM fees WHERE tenant_id = ? AND year = YEAR(NOW()) AND month = MONTH(NOW())
      `, [tenantId]),
 
      // Today's attendance percentage
      db.query(`
        SELECT
          COUNT(*) as total_marked,
          SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) as present
        FROM attendance WHERE tenant_id = ? AND date = CURDATE()
      `, [tenantId]),
 
      // Today's class count
      db.query(`
        SELECT COUNT(DISTINCT class_id) as classes_today
        FROM timetable WHERE tenant_id = ? AND day_of_week = WEEKDAY(NOW())
      `, [tenantId]),
 
      // Latest 5 announcements
      db.query(`
        SELECT id, title, created_at FROM announcements
        WHERE tenant_id = ? AND is_active = 1
        ORDER BY created_at DESC LIMIT 5
      `, [tenantId])
    ]);
 
    return res.json({
      students:      { total: studentStats[0].total, active: studentStats[0].active },
      faculty:       { total: facultyStats[0].total, active: facultyStats[0].active },
      fees:          feeStats[0],
      attendance:    attendanceStats[0],
      timetable:     todayTimetable[0],
      announcements: recentAnnouncements,
    });
 
  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(500).json({ error: 'Failed to load dashboard' });
  }
}

Student and Parent Dashboard API
Student dashboard API
// Student dashboard — personal data only
async function getStudentDashboard(req, res) {
  const tenantId = req.tenantId;
  const userId   = req.userId;  // the logged-in student's user_id
 
  // First get the student record for this user
  const [[student]] = await db.query(
    'SELECT id, class_id, roll_number FROM students WHERE tenant_id = ? AND user_id = ? LIMIT 1',
    [tenantId, userId]
  );
  if (!student) return res.status(404).json({ error: 'Student record not found' });
 
  const [
    [feeStatus],
    [attendanceSummary],
    [todayClasses],
    [announcements]
  ] = await Promise.all([
    db.query(`SELECT SUM(amount - paid_amount) as due FROM fees WHERE tenant_id=? AND student_id=? AND status != 'paid'`, [tenantId, student.id]),
    db.query(`SELECT COUNT(*) as total, SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) as present FROM attendance WHERE tenant_id=? AND student_id=?`, [tenantId, student.id]),
    db.query(`SELECT subject, start_time, end_time FROM timetable WHERE tenant_id=? AND class_id=? AND day_of_week=WEEKDAY(NOW()) ORDER BY start_time`, [tenantId, student.class_id]),
    db.query(`SELECT title, created_at FROM announcements WHERE tenant_id=? AND is_active=1 ORDER BY created_at DESC LIMIT 3`, [tenantId])
  ]);
 
  const att = attendanceSummary[0];
  const attendancePercent = att.total > 0 ? Math.round((att.present / att.total) * 100) : 0;
 
  return res.json({
    student: { roll_number: student.roll_number },
    feeDue: feeStatus[0].due || 0,
    attendance: { percent: attendancePercent, total: att.total, present: att.present },
    todayClasses: todayClasses,
    announcements: announcements
  });
}

 
Phase A — Complete Implementation Checklist

Use this checklist to verify Phase A is 100% complete

A1 — Database Tables
Task	Status
tenants master table created with all columns	[ ]
users table updated with tenant_id column + FK	[ ]
students table updated with tenant_id column + FK	[ ]
faculty table updated with tenant_id column + FK	[ ]
fees table updated with tenant_id column + FK	[ ]
attendance table updated with tenant_id column + FK	[ ]
timetable table updated with tenant_id column + FK	[ ]
classes table updated with tenant_id column + FK	[ ]
announcements table updated with tenant_id column + FK	[ ]
All remaining 17+ tables updated with tenant_id	[ ]

A2 — Indexes
Task	Status
Compound index (tenant_id, id) on every table	[ ]
Compound index (tenant_id, created_at) on every table	[ ]
Feature-specific indexes for fees, attendance, timetable	[ ]
Unique index (tenant_id, email) on users table	[ ]
Unique index (tenant_id, roll_number) on students table	[ ]

A3 — JWT and Middleware
Task	Status
JWT_SECRET set in .env file (minimum 64 random characters)	[ ]
Login API generates JWT with tenant_id + role + user_id + permissions	[ ]
tenantMiddleware.js created and tested	[ ]
requireRole() helper working for all 6 roles	[ ]
All protected routes wrapped with tenantMiddleware	[ ]
All DB queries in controllers use req.tenantId	[ ]
No controller queries the DB without WHERE tenant_id = ?	[ ]

A4 — Subdomain Routing
Task	Status
subdomainMiddleware.js created and tested	[ ]
Wildcard DNS record *.zenithflows.com pointing to server	[ ]
CORS updated to allow *.zenithflows.com	[ ]
Frontend reads subdomain from window.location.hostname	[ ]
Local dev works using X-Tenant-Subdomain header	[ ]
Tested: login on greenwood.zenithflows.com sees only Greenwood data	[ ]
Tested: login on sunrise.zenithflows.com sees only Sunrise data	[ ]

Bonus — Dashboard APIs
Task	Status
Super admin dashboard API returning cross-tenant stats	[ ]
Institute admin dashboard API with Promise.all parallel queries	[ ]
Manager dashboard API with scoped stats	[ ]
Student dashboard API with personal data only	[ ]
Faculty dashboard API with class-specific data	[ ]
Parent dashboard API showing only their child's data	[ ]

You are ready for Phase B when all items above are checked
Phase B adds Redis caching on top of this foundation. Once tenant_id is on every table and in every JWT, you can safely cache data using tenant-namespaced keys: tenant:{id}:dashboard, tenant:{id}:students:page:1.
 
Without Phase A complete, Phase B caching would serve wrong data across institutes. Always complete Phase A first.

 
Critical Mistakes to Avoid — Phase A

Mistake	Why It Is Dangerous	Correct Approach
Querying without tenant_id	Returns data from ALL institutes mixed together. A bug becomes a data breach.	Every SELECT, UPDATE, DELETE must have WHERE tenant_id = ? as the first condition.
Using integer IDs for tenant_id	Sequential integers are guessable. A user can change tenant_id=1 to tenant_id=2 and access another institute.	Use UUID (VARCHAR 36). UUIDs are random and cannot be guessed.
Storing tenant_id in request body or params	Users can forge the tenant_id in their request to access other institutes' data.	Always read tenant_id from req.tenantId (set by JWT middleware). Never trust client-sent tenant_id.
Missing index on tenant_id	With 50 institutes and 5000 students each, every student query scans 250,000 rows instead of 5,000.	Add compound index (tenant_id, id) and (tenant_id, created_at) on every single table.
Skipping FOREIGN KEY constraint on tenant_id	Orphaned rows with invalid tenant_id accumulate and corrupt data integrity.	Always add FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE.

 
What Comes Next — Phase B Preview

Once Phase A is complete and tested with at least 2 real institutes, begin Phase B. Phase B adds the speed layer on top of the solid foundation you built in Phase A.

Phase B Step	What You Build	Speed Gain
B1	Redis with per-tenant cache keys (tenant:{id}:dashboard)	Dashboard load: 300ms → 5ms
B2	Cache invalidation on write operations	Always fresh data, no stale cache
B3	Cursor-based pagination on all list APIs	Page load: 500ms → 50ms
B4	Read replica for all SELECT queries	DB read capacity doubles
B5	Per-role dashboard summary APIs with Promise.all	All dashboard queries parallel

Summary: What Phase A gives you
1.  Complete data isolation — Institute A can never see Institute B data, ever
2.  Zero extra DB queries per request — tenant_id and role read from JWT
3.  Instant queries — compound indexes make tenant-filtered queries run in milliseconds
4.  Scalable to 200+ institutes — one database, one codebase, zero per-institute configuration
5.  Secure by default — tenant_id enforced in middleware, not trusted from client

