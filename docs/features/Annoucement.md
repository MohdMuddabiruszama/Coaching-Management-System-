📢
ANNOUNCEMENTS SYSTEM
Approach B — Smart Announcement System
All 5 Roles  ·  Colored Bell Icon  ·  Read/Unread Tracking  ·  Priority System  ·  ZenithFlows SaaS


Feature	Smart Announcement System — Approach B
Roles Covered	Admin · Faculty · Student · Parent · Manager
Total Phases	8 Phases (DB → Bell Icon → All Dashboards)
DB Changes	4 columns + 1 new table (announcement_reads)
Bell Icon Colors	🔴 Urgent  🟠 High  ⚪ Normal
Bugs Fixed	Invalid Date · Truncated title · Missing priority badge
 
1. Current State Audit — What Your Screenshots Show
From the 6 screenshots (URLs confirm role: /admin, /faculty, /student, /parent), here is exactly what exists and what is broken:

Dashboard	URL	What Exists	Bugs Found
Admin	/admin/announcements	Create (title, content, audience, priority) + Delete only	Title shows 'Toda' — truncated. No Edit button.
Faculty	/faculty/announcements	Create + Delete. Same card style as admin.	Shows admin announcements too — no separation. No read status.
Student	/student/announcements	Basic list — title, content, audience, date	'Invalid Date' bug. No priority badge color. No bell on page.
Parent	/parent/dashboard	No announcements tab or section visible	Missing completely — parents cannot see announcements.
Faculty Dashboard	/faculty/dashboard	Bell icon on 'My Announcements' card with red badge (1)	Badge shows count but color doesn't change by priority.
Parent Dashboard	/parent/dashboard	No announcement bell or indicator anywhere	Completely missing.


Bugs That Must Be Fixed First (Before Adding Features)
BUG 1 — 'Invalid Date' on student page:
  Cause: API returns createdAt as raw DB timestamp without formatting.
  Fix: new Date(announcement.createdAt).toLocaleDateString('en-IN')
  Or use: dayjs(announcement.createdAt).format('DD/MM/YYYY') if dayjs is in project.

BUG 2 — Title truncated ('Toda' instead of 'Today is Holiday'):
  Cause: CSS overflow:hidden with max-width cuts off text in the card.
  Fix: Remove max-width limit on title, or add title={announcement.title} tooltip.

BUG 3 — Faculty sees admin announcements mixed with own:
  Cause: GET /api/announcements returns ALL announcements for the institute.
  Fix: Add created_by filter for faculty's own announcements page.
  Faculty 'My Announcements' → only their own.
  Faculty also sees admin/institute announcements separately (read-only).

2. Approach B — What Gets Built

Approach B Complete Feature List
FIXES (Day 1):
  ✓  Fix Invalid Date bug on student/parent view
  ✓  Fix title truncation CSS bug
  ✓  Fix faculty seeing admin announcements mixed with own

NEW FEATURES (Days 2–5):
  ✓  Read/Unread tracking — announcement_reads table
  ✓  Colored bell icon — 🔴 red=urgent, 🟠 orange=high, ⚫ gray=normal/none
  ✓  Unread count badge on bell — shows number of unread announcements
  ✓  Bell icon on Student dashboard Quick Actions card
  ✓  Bell icon on Parent dashboard with unread count
  ✓  Priority badge color — red=urgent, orange=high, blue=normal
  ✓  Pin announcement — admin can pin important ones to top
  ✓  Edit announcement — admin/faculty can edit their own
  ✓  Expiry date — announcement auto-hides after a date
  ✓  Mark as Read — clicking announcement marks it read
  ✓  Mark All Read — button to clear all unread at once
  ✓  Parent dashboard Announcements tab — new tab added
  ✓  Admin can target: All / Students Only / Faculty Only / Parents Only / Specific Class

Phase 1 — Database Migration 
4 new columns on the existing announcements table + 1 new announcement_reads table for tracking who has read what.

1.1 Migration SQL
-- ════════════════════════════════════════
-- STEP 1: Add columns to announcements table
-- ════════════════════════════════════════
ALTER TABLE announcements
  ADD COLUMN is_pinned    BOOLEAN   NOT NULL DEFAULT FALSE AFTER priority,
  ADD COLUMN expires_at   DATETIME  NULL AFTER is_pinned,
  ADD COLUMN updated_at   DATETIME  NULL AFTER expires_at,
  ADD COLUMN target_class INT       NULL AFTER updated_at;

-- ════════════════════════════════════════
-- STEP 2: Create announcement_reads table
-- Tracks which user has read which announcement
-- ════════════════════════════════════════
CREATE TABLE announcement_reads (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  announcement_id INT NOT NULL,
  user_id         INT NOT NULL,
  read_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ann_user (announcement_id, user_id),
  FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)         REFERENCES users(id)         ON DELETE CASCADE
);

-- ════════════════════════════════════════
-- STEP 3: Performance indexes
-- ════════════════════════════════════════
CREATE INDEX idx_ann_reads_user ON announcement_reads(user_id);
CREATE INDEX idx_ann_institute  ON announcements(institute_id);
CREATE INDEX idx_ann_pinned     ON announcements(is_pinned, created_at DESC);

1.2 Sequelize Model Updates
// models/Announcement.js — add to existing model:
is_pinned:    { type: DataTypes.BOOLEAN,  defaultValue: false },
expires_at:   { type: DataTypes.DATE,     allowNull: true },
target_class: { type: DataTypes.INTEGER,  allowNull: true },
updated_at:   { type: DataTypes.DATE,     allowNull: true },

// models/AnnouncementRead.js — NEW model:
module.exports = (sequelize, DataTypes) => {
  const AnnouncementRead = sequelize.define('AnnouncementRead', {
    announcement_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id:         { type: DataTypes.INTEGER, allowNull: false },
    read_at:         { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, {
    tableName: 'announcement_reads',
    timestamps: false,
  });
  return AnnouncementRead;
};

// models/index.js — add associations:
Announcement.hasMany(AnnouncementRead, { foreignKey:'announcement_id' });
AnnouncementRead.belongsTo(Announcement, { foreignKey:'announcement_id' });
AnnouncementRead.belongsTo(User, { foreignKey:'user_id' });

Phase 2 — Backend: Announcement Service 
One service file handles all the business logic. Controllers stay thin. The key function is getUnreadCount() — this is what powers the colored bell icon across all dashboards.

2.1 Create: services/announcement.service.js
// services/announcement.service.js
const { sequelize, Announcement, AnnouncementRead } = require('../models');
const { QueryTypes } = require('sequelize');
const { Op } = require('sequelize');

// ─── FUNCTION 1: getAnnouncementsForUser ─────────────────────
// Returns announcements visible to a user with their read status
// Used by: Student, Faculty (institute), Parent
async function getAnnouncementsForUser(userId, role, instituteId, classId=null) {
  const now = new Date();
  const whereClause = {
    institute_id: instituteId,
    [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: now } }],
  };

  // Target audience filter
  if (role === 'student') {
    whereClause.target_audience = { [Op.in]: ['all','students'] };
    if (classId) {
      whereClause[Op.or] = [
        { target_audience: { [Op.in]: ['all','students'] }, target_class: null },
        { target_class: classId },
      ];
    }
  } else if (role === 'faculty') {
    whereClause.target_audience = { [Op.in]: ['all','faculty'] };
  } else if (role === 'parent') {
    whereClause.target_audience = { [Op.in]: ['all','parents'] };
  }

  const announcements = await Announcement.findAll({
    where: whereClause,
    order: [['is_pinned','DESC'], ['created_at','DESC']],
    include: [{
      model: AnnouncementRead,
      where: { user_id: userId },
      required: false,  // LEFT JOIN — include even if not read
      attributes: ['read_at'],
    }],
  });

  return announcements.map(a => ({
    ...a.toJSON(),
    is_read: a.AnnouncementReads?.length > 0,
    read_at: a.AnnouncementReads?.[0]?.read_at || null,
  }));
}

// ─── FUNCTION 2: getUnreadCount ──────────────────────────────
// Returns { count, highest_priority } for the bell icon
// highest_priority: 'urgent' | 'high' | 'normal' | null
// This is what controls the bell color on every dashboard
async function getUnreadCount(userId, role, instituteId) {
  const announcements = await getAnnouncementsForUser(userId, role, instituteId);
  const unread = announcements.filter(a => !a.is_read);
  const priorities = unread.map(a => a.priority);
  let highest = null;
  if (priorities.includes('urgent')) highest = 'urgent';
  else if (priorities.includes('high')) highest = 'high';
  else if (priorities.length > 0)      highest = 'normal';
  return { count: unread.length, highest_priority: highest };
}

// ─── FUNCTION 3: markAsRead ──────────────────────────────────
async function markAsRead(announcementId, userId) {
  await AnnouncementRead.findOrCreate({
    where: { announcement_id: announcementId, user_id: userId },
    defaults: { read_at: new Date() },
  });
}

// ─── FUNCTION 4: markAllAsRead ───────────────────────────────
async function markAllAsRead(userId, role, instituteId) {
  const announcements = await getAnnouncementsForUser(userId, role, instituteId);
  const unreadIds = announcements.filter(a=>!a.is_read).map(a=>a.id);
  if (!unreadIds.length) return 0;
  const records = unreadIds.map(id=>({ announcement_id:id, user_id:userId }));
  await AnnouncementRead.bulkCreate(records, { ignoreDuplicates:true });
  return unreadIds.length;
}

module.exports = {
  getAnnouncementsForUser,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};

Phase 3 — Backend: API Endpoints 
Update your existing announcement controller and routes. The critical new endpoint is GET /api/announcements/unread-count — this is called by every dashboard on load to power the bell icon.

3.1 Updated Announcement Controller
// controllers/announcement.controller.js
const announcementService = require('../services/announcement.service');
const { Announcement } = require('../models');
const catchAsync = require('../utils/catchAsync');

// ─── EXISTING: createAnnouncement — add new fields ────────────
exports.createAnnouncement = catchAsync(async (req, res) => {
  const { title, content, target_audience, priority,
          is_pinned, expires_at, target_class } = req.body;
  const announcement = await Announcement.create({
    title, content, target_audience, priority,
    is_pinned: is_pinned || false,
    expires_at: expires_at || null,
    target_class: target_class || null,
    institute_id: req.user.institute_id,
    created_by:   req.user.id,
    posted_by:    req.user.name || req.user.username,
  });
  return res.status(201).json({ success:true, data:announcement });
});

// ─── NEW: updateAnnouncement ──────────────────────────────────
exports.updateAnnouncement = catchAsync(async (req, res) => {
  const ann = await Announcement.findOne({
    where: { id:req.params.id, institute_id:req.user.institute_id }
  });
  if (!ann) return res.status(404).json({ message:'Not found' });
  // Faculty can only edit their own; admin can edit all
  if (req.user.role==='faculty' && ann.created_by !== req.user.id)
    return res.status(403).json({ message:'Cannot edit other faculty announcements' });
  const { title, content, target_audience, priority,
          is_pinned, expires_at } = req.body;
  await ann.update({ title, content, target_audience, priority,
                     is_pinned, expires_at, updated_at: new Date() });
  return res.json({ success:true, data:ann });
});

// ─── NEW: getMyAnnouncements (faculty — own only) ─────────────
exports.getMyAnnouncements = catchAsync(async (req, res) => {
  const announcements = await Announcement.findAll({
    where: { institute_id:req.user.institute_id, created_by:req.user.id },
    order: [['created_at','DESC']],
  });
  return res.json({ success:true, data:announcements });
});

// ─── NEW: getInstituteAnnouncements (student/parent — with read status) ─
exports.getInstituteAnnouncements = catchAsync(async (req, res) => {
  const list = await announcementService.getAnnouncementsForUser(
    req.user.id, req.user.role, req.user.institute_id,
    req.user.class_id || null
  );
  return res.json({ success:true, data:list });
});

// ─── NEW: getUnreadCount — powers the bell icon ───────────────
exports.getUnreadCount = catchAsync(async (req, res) => {
  const result = await announcementService.getUnreadCount(
    req.user.id, req.user.role, req.user.institute_id
  );
  return res.json({ success:true, data:result });
  // Returns: { count: 3, highest_priority: 'urgent' }
  // Bell color logic: urgent=red, high=orange, normal=gray
});

// ─── NEW: markAsRead ─────────────────────────────────────────
exports.markAsRead = catchAsync(async (req, res) => {
  await announcementService.markAsRead(req.params.id, req.user.id);
  return res.json({ success:true });
});

// ─── NEW: markAllAsRead ───────────────────────────────────────
exports.markAllAsRead = catchAsync(async (req, res) => {
  const count = await announcementService.markAllAsRead(
    req.user.id, req.user.role, req.user.institute_id
  );
  return res.json({ success:true, data:{ marked_count:count } });
});

3.2 Updated Routes
// routes/announcement.routes.js
// IMPORTANT: Static routes must be BEFORE /:id routes

router.post('/',
  verifyToken, allowRoles('admin','faculty','manager'),
  announcementCtrl.createAnnouncement
);
router.put('/:id',
  verifyToken, allowRoles('admin','faculty','manager'),
  announcementCtrl.updateAnnouncement
);
router.delete('/:id',
  verifyToken, allowRoles('admin','faculty','manager'),
  announcementCtrl.deleteAnnouncement
);
// Admin: all announcements for institute
router.get('/admin/all',
  verifyToken, allowRoles('admin','manager'),
  announcementCtrl.getAllAnnouncements
);
// Faculty: own announcements only
router.get('/faculty/mine',
  verifyToken, allowRoles('faculty'),
  announcementCtrl.getMyAnnouncements
);
// Student + Parent: institute announcements with read status
router.get('/institute',
  verifyToken, allowRoles('student','parent'),
  announcementCtrl.getInstituteAnnouncements
);
// Bell icon endpoint — all roles call this on dashboard load
router.get('/unread-count',
  verifyToken,
  announcementCtrl.getUnreadCount
);
// Mark individual as read
router.post('/:id/read',
  verifyToken,
  announcementCtrl.markAsRead
);
// Mark all as read
router.post('/mark-all-read',
  verifyToken,
  announcementCtrl.markAllAsRead
);

3.3 API Reference Table
Method	Endpoint	Auth Role	Description
POST	/api/announcements	admin, faculty, manager	Create new announcement
PUT	/api/announcements/:id	admin, faculty, manager	Edit own announcement
DELETE	/api/announcements/:id	admin, faculty, manager	Delete announcement
GET	/api/announcements/admin/all	admin, manager	All institute announcements
GET	/api/announcements/faculty/mine	faculty	Faculty's own announcements only
GET	/api/announcements/institute	student, parent	Targeted announcements with read status
GET	/api/announcements/unread-count	all roles	Unread count + highest priority for bell
POST	/api/announcements/:id/read	all roles	Mark one announcement as read
POST	/api/announcements/mark-all-read	all roles	Mark all unread as read

Phase 4 — Colored Bell Icon Component 
This is the core UI component shared across all dashboards. The bell color changes based on the highest priority of unread announcements. This component calls /api/announcements/unread-count on mount and every 60 seconds.

4.1 AnnouncementBell.jsx — Reusable Component
// components/AnnouncementBell.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import announcementService from '../services/announcement.service';

// Bell color based on highest unread priority
const BELL_COLORS = {
  urgent: { bg:'#B71C1C', color:'#fff', emoji:'🔴', label:'Urgent' },
  high:   { bg:'#E65100', color:'#fff', emoji:'🟠', label:'High Priority' },
  normal: { bg:'#1565C0', color:'#fff', emoji:'🔵', label:'New' },
  null:   { bg:'transparent', color:'#9E9E9E', emoji:'🔔', label:'' },
};

export default function AnnouncementBell({ linkTo, size='medium' }) {
  const [data, setData] = useState({ count:0, highest_priority:null });
  const navigate = useNavigate();

  const fetchCount = async () => {
    try {
      const res = await announcementService.getUnreadCount();
      setData(res);
    } catch(e) { /* silent fail — don't break dashboard */ }
  };

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 60_000); // poll every 60s
    return () => clearInterval(interval);
  }, []);

  const style = BELL_COLORS[data.highest_priority] || BELL_COLORS.null;
  const iconSize = size==='large' ? '28px' : size==='small' ? '18px' : '22px';

  return (
    <div
      onClick={() => navigate(linkTo)}
      style={{ position:'relative', cursor:'pointer',
               display:'inline-flex', alignItems:'center',
               justifyContent:'center', padding:'6px',
               borderRadius:'50%', transition:'background 0.2s' }}
      title={`${data.count} unread announcement${data.count!==1?'s':''}`}
    >
      {/* Bell icon — color changes with priority */}
      <span style={{ fontSize:iconSize,
        filter: data.count > 0 ? 'none' : 'grayscale(1) opacity(0.4)' }}>
        🔔
      </span>

      {/* Unread count badge */}
      {data.count > 0 && (
        <span style={{
          position:'absolute', top:'-2px', right:'-2px',
          background: style.bg,
          color: style.color,
          fontSize:'11px', fontWeight:'bold',
          borderRadius:'50%', minWidth:'18px', height:'18px',
          display:'flex', alignItems:'center', justifyContent:'center',
          padding:'0 3px', border:'2px solid #fff',
          boxShadow:'0 1px 4px rgba(0,0,0,0.3)',
          animation: data.highest_priority==='urgent'
            ? 'pulse 1.5s infinite' : 'none',
        }}>
          {data.count > 99 ? '99+' : data.count}
        </span>
      )}
    </div>
  );
}

/* Add to your global CSS (index.css or App.css): */
/* @keyframes pulse {
     0%,100% { transform: scale(1); opacity: 1; }
     50%      { transform: scale(1.2); opacity: 0.8; }
   } */

4.2 Priority Badge Component (shared)
// components/PriorityBadge.jsx
const PRIORITY_STYLES = {
  urgent: { background:'#B71C1C', color:'#fff', label:'🚨 Urgent' },
  high:   { background:'#E65100', color:'#fff', label:'⚠️ High' },
  normal: { background:'#1565C0', color:'#fff', label:'ℹ️ Normal' },
};

export default function PriorityBadge({ priority }) {
  const s = PRIORITY_STYLES[priority] || PRIORITY_STYLES.normal;
  return (
    <span style={{
      background:s.background, color:s.color,
      fontSize:'11px', fontWeight:'bold',
      padding:'2px 8px', borderRadius:'12px',
      display:'inline-block',
    }}>
      {s.label}
    </span>
  );
}

Phase 5 — Admin Dashboard: Manage Announcements 
Your admin page already has Create + Delete. Add Edit, Pin, Expiry date, and a Stats row showing total / by priority.

5.1 Updated Create/Edit Modal — New Fields
// In your Create Announcement modal — add these fields:

// 1. Pin toggle
<label style={{display:'flex',alignItems:'center',gap:'8px',marginTop:'12px'}}>
  <input type='checkbox'
    checked={form.is_pinned}
    onChange={e => setForm({...form, is_pinned:e.target.checked})}
  />
  <span>📌 Pin this announcement (shows at top for everyone)</span>
</label>

// 2. Expiry date
<label>Expiry Date (optional)</label>
<input type='datetime-local'
  value={form.expires_at || ''}
  onChange={e => setForm({...form, expires_at:e.target.value})}
  style={{width:'100%',padding:'8px',borderRadius:'6px'}}
/>
<small style={{color:'#888'}}>
  Announcement will auto-hide after this date. Leave blank for permanent.
</small>

// 3. Target audience — add 'parents' option:
<option value='all'>All (Everyone)</option>
<option value='students'>Students Only</option>
<option value='faculty'>Faculty Only</option>
<option value='parents'>Parents Only</option>

5.2 Updated Announcement Card — Admin
// Announcement card in admin list:
{announcements.map(ann => (
  <div key={ann.id} style={{
    border: ann.is_pinned ? '2px solid #1565C0' : '1px solid #E0E0E0',
    borderRadius:'8px', padding:'1rem', marginBottom:'0.75rem',
    background: ann.is_pinned ? '#E3F2FD' : '#fff',
  }}>
    <div style={{display:'flex',justifyContent:'space-between',
                 alignItems:'flex-start'}}>
      <div style={{flex:1}}>
        <div style={{display:'flex',gap:'8px',alignItems:'center',
                     marginBottom:'6px'}}>
          {ann.is_pinned && <span title='Pinned'>📌</span>}
          <PriorityBadge priority={ann.priority} />
          <span style={{fontSize:'12px',color:'#888'}}>
            To: {ann.target_audience}
          </span>
        </div>
        <h3 style={{margin:'0 0 6px',fontSize:'16px'}}>{ann.title}</h3>
        <p style={{margin:'0 0 8px',color:'#555',fontSize:'14px'}}>
          {ann.content}
        </p>
        <small style={{color:'#999'}}>
          Posted by {ann.posted_by} on
          {new Date(ann.created_at).toLocaleDateString('en-IN')}
          {ann.expires_at && ` · Expires: ${new Date(ann.expires_at).toLocaleDateString('en-IN')}`}
        </small>
      </div>
      <div style={{display:'flex',gap:'6px',marginLeft:'12px'}}>
        <button onClick={()=>openEditModal(ann)}
          style={{background:'#1565C0',color:'#fff',border:'none',
                  padding:'4px 10px',borderRadius:'5px'}}>
          ✏️ Edit
        </button>
        <button onClick={()=>handleDelete(ann.id)}
          style={{background:'#B71C1C',color:'#fff',border:'none',
                  padding:'4px 10px',borderRadius:'5px'}}>
          🗑️ Delete
        </button>
      </div>
    </div>
  </div>
))}

Phase 6 — Student Dashboard: Announcements 
Fix the 3 bugs (Invalid Date, truncated title, no priority color) and add the bell icon to the student dashboard Quick Actions.

6.1 Add Bell Icon to Student Dashboard
// In your student dashboard Quick Actions grid,
// replace the plain 'Announcements' card with:

import AnnouncementBell from '../components/AnnouncementBell';

{/* Quick Action card for Announcements */}
<div
  onClick={() => navigate('/student/announcements')}
  style={{ cursor:'pointer', border:'1px solid #eee',
           borderRadius:'12px', padding:'1.5rem',
           textAlign:'center', position:'relative' }}>
  <div style={{ position:'relative', display:'inline-block' }}>
    <span style={{ fontSize:'2.5rem' }}>📢</span>
    {/* Bell badge — floats top-right of the icon */}
    <div style={{ position:'absolute', top:'-8px', right:'-12px' }}>
      <AnnouncementBell linkTo='/student/announcements' size='small' />
    </div>
  </div>
  <div style={{ marginTop:'8px', fontSize:'14px', fontWeight:'500' }}>
    Announcements
  </div>
</div>

6.2 Fix Student Announcements Page (ViewAnnouncements.jsx)
// Switch from old API to new institute endpoint:
// OLD: api.get('/api/announcements')
// NEW: announcementService.getInstituteAnnouncements()

// Fixed announcement card for student:
{announcements.map(ann => (
  <div key={ann.id}
    onClick={() => handleRead(ann.id)}
    style={{
      border: `2px solid ${ann.is_pinned ? '#1565C0' :
               ann.priority==='urgent' ? '#B71C1C' :
               ann.priority==='high'   ? '#E65100' : '#E0E0E0'}`,
      borderLeft: `6px solid ${ann.priority==='urgent' ? '#B71C1C' :
                   ann.priority==='high' ? '#E65100' : '#1565C0'}`,
      borderRadius:'8px', padding:'1rem',
      marginBottom:'0.75rem',
      background: ann.is_read ? '#fafafa' : '#fff',
      opacity: ann.is_read ? 0.85 : 1,
      cursor:'pointer',
    }}>
    <div style={{display:'flex',gap:'8px',alignItems:'center',
                 marginBottom:'6px'}}>
      {ann.is_pinned && <span>📌</span>}
      <PriorityBadge priority={ann.priority} />
      {!ann.is_read && (
        <span style={{
          background:'#1565C0',color:'#fff',fontSize:'10px',
          padding:'1px 6px',borderRadius:'10px',fontWeight:'bold'
        }}>NEW</span>
      )}
    </div>
    <h3 style={{margin:'0 0 6px',fontSize:'16px',
                fontWeight: ann.is_read ? 'normal' : 'bold'}}>
      {ann.title}  {/* BUG FIX: no max-width truncation */}
    </h3>
    <p style={{margin:'0 0 8px',color:'#555',fontSize:'14px'}}>
      {ann.content}
    </p>
    <div style={{display:'flex',justifyContent:'space-between',
                 alignItems:'center'}}>
      <small style={{color:'#999'}}>
        Target: {ann.target_audience}
      </small>
      {/* BUG FIX: Invalid Date fixed */}
      <small style={{color:'#999'}}>
        {ann.created_at
          ? new Date(ann.created_at).toLocaleDateString('en-IN',
              {day:'2-digit',month:'short',year:'numeric'})
          : 'Date unavailable'}
      </small>
    </div>
  </div>
))}

// Mark All Read button:
<button onClick={handleMarkAllRead}
  style={{marginBottom:'1rem',background:'#1565C0',color:'#fff',
          border:'none',padding:'8px 16px',borderRadius:'6px'}}>
  ✅ Mark All as Read
</button>

// handleRead function:
const handleRead = async (id) => {
  await announcementService.markAsRead(id);
  setAnnouncements(prev =>
    prev.map(a => a.id===id ? {...a, is_read:true} : a)
  );
};
const handleMarkAllRead = async () => {
  await announcementService.markAllAsRead();
  setAnnouncements(prev => prev.map(a => ({...a, is_read:true})));
};

Phase 7 — Faculty Dashboard: Announcements 
Faculty has two announcement views: 'My Announcements' (own posts, can edit/delete) and 'Institute Announcements' (admin posts, read-only with bell icon). Your faculty dashboard already shows a red badge on the My Announcements card — extend it to show priority color.

7.1 Faculty Dashboard — Bell Icon Enhancement
// In faculty/Dashboard.jsx Quick Actions — replace the current
// 'My Announcements' card notification badge:

// CURRENT: Simple red badge showing count
// NEW: AnnouncementBell component with priority color

<div style={{ position:'relative', display:'inline-block' }}>
  <span style={{ fontSize:'2.5rem' }}>📢</span>
  <div style={{ position:'absolute', top:'-8px', right:'-12px' }}>
    <AnnouncementBell linkTo='/faculty/announcements' size='small' />
  </div>
</div>
<div>My Announcements</div>

7.2 Faculty Announcements Page — Two Sections
// pages/faculty/Announcements.jsx — two tabs:
const [tab, setTab] = useState('mine'); // 'mine' | 'institute'

{/* Tab switcher */}
<div style={{display:'flex',gap:'8px',marginBottom:'1.5rem'}}>
  <button onClick={()=>setTab('mine')}
    style={{background:tab==='mine'?'#1565C0':'#f5f5f5',
            color:tab==='mine'?'#fff':'#333',
            border:'none',padding:'8px 20px',borderRadius:'6px'}}>
    My Announcements
  </button>
  <button onClick={()=>setTab('institute')}
    style={{background:tab==='institute'?'#1565C0':'#f5f5f5',
            color:tab==='institute'?'#fff':'#333',
            border:'none',padding:'8px 20px',borderRadius:'6px'}}>
    Institute Announcements
  </button>
</div>

{tab==='mine' && (
  /* Faculty's own posts — can Edit/Delete */
  <MyAnnouncementsTab />
)}
{tab==='institute' && (
  /* Admin posts — read-only with priority badges */
  <InstituteAnnouncementsTab />
)}

Phase 8 — Parent Dashboard: Add Announcements 
Parents currently have zero announcement visibility. Add a bell icon to the parent dashboard and a new Announcements tab in their dashboard tabs row.

8.1 Add Bell Icon to Parent Dashboard Header
// In pages/parent/Dashboard.jsx — add bell to header area:
import AnnouncementBell from '../../components/AnnouncementBell';

{/* In the dashboard header, next to Logout: */}
<div style={{display:'flex',alignItems:'center',gap:'16px'}}>
  <AnnouncementBell linkTo='/parent/announcements' size='medium' />
  <button onClick={handleLogout}>Logout</button>
</div>

8.2 Add Announcements Tab to Parent Dashboard
// In the parent tabs row — add after 'Chat':
// Currently: Overview | Attendance | Marks | Fees | Timetable | Assignments | Chat
// New:       Overview | Attendance | Marks | Fees | Timetable | Assignments | Chat | Announcements

<button
  onClick={() => setActiveTab('announcements')}
  style={{...tabStyle, background:activeTab==='announcements'?'#1565C0':'transparent',
          color:activeTab==='announcements'?'#fff':'inherit',
          position:'relative'}}>
  📢 Announcements
  {unreadCount > 0 && (
    <span style={{
      position:'absolute',top:'-4px',right:'-4px',
      background:'#B71C1C',color:'#fff',
      fontSize:'10px',borderRadius:'50%',
      minWidth:'16px',height:'16px',
      display:'flex',alignItems:'center',justifyContent:'center',
    }}>{unreadCount}</span>
  )}
</button>

{activeTab==='announcements' && (
  <ParentAnnouncementsTab studentId={selectedChild.id} />
)}

8.3 Parent Announcements Tab Component
// Parent sees announcements targeted to 'all' or 'parents'
// Same card style as student — priority badge + read tracking
function ParentAnnouncementsTab() {
  const [list, setList] = useState([]);
  useEffect(() => {
    announcementService.getInstituteAnnouncements().then(setList);
  }, []);
  return (
    <div>
      {list.length === 0 && (
        <p style={{color:'#888',textAlign:'center',padding:'2rem'}}>
          No announcements yet.
        </p>
      )}
      {list.map(ann => (
        <div key={ann.id}
          onClick={() => handleRead(ann.id)}
          style={{
            borderLeft:`6px solid ${ann.priority==='urgent'?'#B71C1C':
                       ann.priority==='high'?'#E65100':'#1565C0'}`,
            border:'1px solid #eee', borderRadius:'8px',
            padding:'1rem', marginBottom:'0.75rem',
            background: ann.is_read ? '#fafafa' : '#fff',
            cursor:'pointer',
          }}>
          <div style={{display:'flex',gap:'8px',marginBottom:'6px'}}>
            <PriorityBadge priority={ann.priority} />
            {!ann.is_read && (
              <span style={{background:'#1565C0',color:'#fff',
                fontSize:'10px',padding:'1px 6px',borderRadius:'10px'}}>
                NEW
              </span>
            )}
          </div>
          <h3 style={{fontWeight:ann.is_read?'normal':'bold',
                      margin:'0 0 6px'}}>{ann.title}</h3>
          <p style={{color:'#555',fontSize:'14px',margin:'0 0 8px'}}>
            {ann.content}
          </p>
          <small style={{color:'#999'}}>
            {ann.created_at
              ? new Date(ann.created_at).toLocaleDateString('en-IN')
              : ''}
          </small>
        </div>
      ))}
    </div>
  );
}

Phase 9 — Frontend Service File
All announcement API calls go through one service file — no page component calls api.js directly.

9.1 services/announcement.service.js (frontend)
// frontend/src/services/announcement.service.js
import api from './api';

const announcementService = {
  // Admin / Faculty — manage
  create: (data) =>
    api.post('/api/announcements', data).then(r=>r.data.data),
  update: (id, data) =>
    api.put(`/api/announcements/${id}`, data).then(r=>r.data.data),
  delete: (id) =>
    api.delete(`/api/announcements/${id}`).then(r=>r.data),
  getAll: () =>
    api.get('/api/announcements/admin/all').then(r=>r.data.data),
  getMine: () =>
    api.get('/api/announcements/faculty/mine').then(r=>r.data.data),

  // Student / Parent — receive
  getInstituteAnnouncements: () =>
    api.get('/api/announcements/institute').then(r=>r.data.data),

  // Bell icon — all roles
  getUnreadCount: () =>
    api.get('/api/announcements/unread-count').then(r=>r.data.data),
  // Returns: { count: 3, highest_priority: 'urgent' }

  // Read tracking
  markAsRead: (id) =>
    api.post(`/api/announcements/${id}/read`).then(r=>r.data),
  markAllAsRead: () =>
    api.post('/api/announcements/mark-all-read').then(r=>r.data),
};

export default announcementService;

Phase 10 — Execution Plan, Bugs Fix First & Testing Checklist

10.1 Day-by-Day Execution Timeline
Day	Phase	Tasks	Verify When Done
Day 1 AM	Bug Fixes	Fix Invalid Date · Fix title truncation CSS · Fix faculty seeing admin posts mixed	Student page shows correct date and full title
Day 1 PM	Phase 1	Run SQL migration · Create AnnouncementRead model · Add associations in index.js	DESCRIBE announcement_reads — see new table
Day 2 AM	Phase 2	Create services/announcement.service.js (backend) — 4 functions	node -e "require('./services/announcement.service')"
Day 2 PM	Phase 3	9 API endpoints in controller + routes. Static routes before /:id.	Postman: GET /api/announcements/unread-count returns {count,priority}
Day 3 AM	Phase 4	AnnouncementBell.jsx component · PriorityBadge.jsx component	Bell shows correct color when urgent announcement exists
Day 3 PM	Phase 5	Admin: Add Edit button · Pin toggle · Expiry date · fixed card display	Admin can edit, pin, set expiry on an announcement
Day 4 AM	Phase 6	Student: Bell icon on dashboard · Fixed announcement page with read tracking	Student sees colored bell + unread count + priority badges
Day 4 PM	Phase 7	Faculty: Bell icon enhancement · Two-tab page (Mine + Institute)	Faculty bell changes color. Mine tab shows only own posts.
Day 5	Phase 8+9	Parent: Bell in header · Announcements tab · Frontend service file	Parent can see and read announcements with colored badges


10.2 Bell Icon Color Logic — Quick Reference
Condition	Bell Badge Color	CSS Background	When
No unread announcements	Gray / Invisible	transparent	Bell is dimmed, no badge
Unread normal priority only	Blue	#1565C0	1 or more normal unread
Unread high priority exists	Orange	#E65100	At least 1 high priority unread
Unread urgent priority exists	Red + Pulse animation	#B71C1C	At least 1 urgent unread


10.3 Role Permission Matrix
Feature	Admin	Manager	Faculty	Student	Parent
Create Announcement	✅	✅	✅	❌	❌
Edit Own Announcement	✅	✅	✅ own only	❌	❌
Delete Announcement	✅ any	✅ any	✅ own only	❌	❌
Pin Announcement	✅	✅	❌	❌	❌
Set Expiry Date	✅	✅	❌	❌	❌
See Bell Icon + Unread Count	✅	✅	✅	✅	✅
Bell Color Changes by Priority	✅	✅	✅	✅	✅
View Institute Announcements	✅	✅	✅	✅	✅
Mark as Read	✅	✅	✅	✅	✅
Mark All as Read	✅	✅	✅	✅	✅


10.4 Final Testing Checklist
	Test Scenario	Expected Result	Role
☐	Student page — date shows correctly	26/05/2026 shown (not 'Invalid Date')	Student
☐	Student page — title shows in full	Full title displayed, not truncated	Student
☐	Create urgent announcement → student dashboard	Bell badge turns RED with unread count	Admin
☐	Create high priority announcement → faculty dashboard	Bell badge turns ORANGE	Admin
☐	No unread announcements	Bell icon is grayed out with no badge	All
☐	Click announcement → mark as read	'NEW' badge disappears, text becomes normal weight	Student
☐	Mark All as Read → bell resets	Bell badge disappears, count = 0	Student
☐	Faculty 'My Announcements' tab — shows only own posts	Admin's posts not visible here	Faculty
☐	Faculty 'Institute Announcements' tab — shows admin posts	Can see but not edit/delete	Faculty
☐	Parent dashboard — Announcements tab visible	New tab appears in parent tabs row	Parent
☐	Parent sees bell icon in header	Bell shows unread count + correct color	Parent
☐	Pin an announcement — shows at top	Pinned card has blue border, appears first	Admin
☐	Set expiry date — announcement disappears after	After expiry, students cannot see it	Admin
☐	Edit announcement — changes saved	Updated content shows immediately	Admin
☐	Bell polls every 60 seconds	New announcement appears without page refresh	All


10.5 Files Changed Summary
File	Action	Phase
backend/models/Announcement.js	Modify — 4 new fields	1
backend/models/AnnouncementRead.js	New model	1
backend/models/index.js	Add associations	1
backend/scripts/announcement_migration.sql	New migration file	1
backend/services/announcement.service.js	New service — 4 functions	2
backend/controllers/announcement.controller.js	Modify — 6 updated/new handlers	3
backend/routes/announcement.routes.js	Modify — 9 routes	3
frontend/src/components/AnnouncementBell.jsx	New shared component	4
frontend/src/components/PriorityBadge.jsx	New shared component	4
frontend/src/services/announcement.service.js	New frontend service	9
frontend/src/pages/admin/Announcements.jsx	Modify — Edit + Pin + Expiry	5
frontend/src/pages/student/Announcements.jsx	Modify — Bug fixes + read tracking	6
frontend/src/pages/student/Dashboard.jsx	Modify — Add bell to quick actions	6
frontend/src/pages/faculty/Announcements.jsx	Modify — Two tabs + bell	7
frontend/src/pages/faculty/Dashboard.jsx	Modify — Bell color enhancement	7
frontend/src/pages/parent/Dashboard.jsx	Modify — Bell + Announcements tab	8


Performance Notes
getUnreadCount() — single Sequelize query with LEFT JOIN on announcement_reads.
Polling interval: 60 seconds. Does not fire on every keystroke or page event.
markAsRead() uses findOrCreate with UNIQUE constraint — safe for double-clicks.
markAllAsRead() uses bulkCreate with ignoreDuplicates — single DB call for all.
Bell component uses useEffect cleanup to clear interval on unmount — no memory leaks.
Announcement list query uses is_pinned DESC, created_at DESC index — O(log n).

DB calls per dashboard load:
  Bell icon:            1 call (unread-count endpoint)
  Announcements page:   1 call (institute list with LEFT JOIN read status)
  Mark as read:         1 call (findOrCreate — upsert with UNIQUE constraint)
  Mark all read:        1 call (bulkCreate with ignoreDuplicates)

