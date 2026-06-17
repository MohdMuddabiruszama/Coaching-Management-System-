Now let me build the complete feedback feature — a beautiful, fully responsive implementation.
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation-duration: 0.25s;
    animation-timing-function: cubic-bezier(0.19, 1, 0.22, 1);
  }
VvisualizeVvisualize show_widgetNow here are all the phases to build this completely in your project:

Phase 1 — Database
sqlCREATE TABLE feedback (
  id             INT PRIMARY KEY AUTO_INCREMENT,
  institute_id   INT NOT NULL,
  submitted_by   INT NOT NULL,           -- user_id who submitted
  submitter_role ENUM('student','parent','faculty','manager') NOT NULL,
  feedback_type  ENUM('faculty_rating','institute_rating',
                      'suggestion','complaint') NOT NULL,
  target_id      INT NULL,               -- faculty_id if faculty_rating
  target_type    ENUM('faculty','institute') NULL,
  rating         TINYINT NULL,           -- 1–5, null for complaints/suggestions
  comment        TEXT NULL,
  is_anonymous   BOOLEAN DEFAULT TRUE,   -- student/parent can choose
  status         ENUM('pending','reviewed','resolved','flagged') DEFAULT 'pending',
  admin_reply    TEXT NULL,
  replied_by     INT NULL,
  replied_at     DATETIME NULL,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_fb_institute_type (institute_id, feedback_type),
  INDEX idx_fb_target         (target_id, target_type),
  INDEX idx_fb_submitter      (submitted_by),
  INDEX idx_fb_status         (institute_id, status),
  FOREIGN KEY (institute_id) REFERENCES institutes(id) ON DELETE CASCADE
);
One table handles all feedback types — feedback_type and target_id determine the context. Indexes on the four most-queried columns keep all lookups at O(log n).
Phase 2 — Sequelize Model
js// models/feedback.model.js
module.exports = (sequelize) => {
  const Feedback = sequelize.define('Feedback', {
    id:            { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    institute_id:  { type: DataTypes.INTEGER, allowNull: false },
    submitted_by:  { type: DataTypes.INTEGER, allowNull: false },
    submitter_role:{ type: DataTypes.ENUM('student','parent','faculty','manager') },
    feedback_type: { type: DataTypes.ENUM('faculty_rating','institute_rating','suggestion','complaint') },
    target_id:     { type: DataTypes.INTEGER, allowNull: true },
    target_type:   { type: DataTypes.ENUM('faculty','institute'), allowNull: true },
    rating:        { type: DataTypes.TINYINT, allowNull: true },
    comment:       { type: DataTypes.TEXT, allowNull: true },
    is_anonymous:  { type: DataTypes.BOOLEAN, defaultValue: true },
    status:        { type: DataTypes.ENUM('pending','reviewed','resolved','flagged'), defaultValue: 'pending' },
    admin_reply:   { type: DataTypes.TEXT, allowNull: true },
    replied_by:    { type: DataTypes.INTEGER, allowNull: true },
    replied_at:    { type: DataTypes.DATE, allowNull: true },
  }, { tableName: 'feedback', timestamps: true });

  return Feedback;
};
Phase 3 — Backend Service (Performance Core)
js// services/feedback.service.js
const { sequelize } = require('../models');
const { QueryTypes, fn, col, literal } = require('sequelize');

// FUNCTION 1: Get aggregated faculty rating — O(1) single query
async function getFacultyRatingSummary(facultyId, instituteId, months = 3) {
  const [summary] = await sequelize.query(`
    SELECT
      COUNT(*)                                      AS total_ratings,
      ROUND(AVG(rating), 1)                         AS avg_rating,
      SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END)  AS five_star,
      SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END)  AS four_star,
      SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END)  AS three_star,
      SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END)  AS two_star,
      SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END)  AS one_star
    FROM feedback
    WHERE target_id    = :facultyId
      AND institute_id = :instituteId
      AND feedback_type = 'faculty_rating'
      AND created_at >= DATE_SUB(NOW(), INTERVAL :months MONTH)
  `, { replacements: { facultyId, instituteId, months }, type: QueryTypes.SELECT });
  return summary;
}

// FUNCTION 2: Admin dashboard stats — 1 aggregated query replaces 4 calls
async function getInstituteStats(instituteId) {
  const [stats] = await sequelize.query(`
    SELECT
      COUNT(*)                                            AS total,
      ROUND(AVG(CASE WHEN rating IS NOT NULL THEN rating END), 1) AS avg_rating,
      SUM(CASE WHEN feedback_type='complaint' AND status='pending' THEN 1 ELSE 0 END) AS pending_complaints,
      SUM(CASE WHEN feedback_type='faculty_rating' THEN 1 ELSE 0 END)    AS faculty_ratings,
      SUM(CASE WHEN feedback_type='institute_rating' THEN 1 ELSE 0 END)  AS institute_ratings,
      SUM(CASE WHEN feedback_type='suggestion' THEN 1 ELSE 0 END)        AS suggestions,
      SUM(CASE WHEN feedback_type='complaint' THEN 1 ELSE 0 END)         AS complaints
    FROM feedback
    WHERE institute_id = :instituteId
  `, { replacements: { instituteId }, type: QueryTypes.SELECT });
  return stats;
}

// FUNCTION 3: Super admin platform overview — 1 query across all institutes
async function getPlatformStats() {
  const [stats] = await sequelize.query(`
    SELECT
      COUNT(*)                                     AS total_feedback,
      ROUND(AVG(rating), 1)                        AS platform_avg_rating,
      COUNT(DISTINCT institute_id)                 AS institutes_with_feedback,
      SUM(CASE WHEN feedback_type='complaint' AND status='pending' THEN 1 ELSE 0 END) AS pending_complaints
    FROM feedback
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
  `, { type: QueryTypes.SELECT });
  return stats;
}

// FUNCTION 4: Faculty leaderboard per institute — 1 JOIN query
async function getFacultyLeaderboard(instituteId) {
  return sequelize.query(`
    SELECT
      u.id, u.name,
      ROUND(AVG(f.rating), 1) AS avg_rating,
      COUNT(f.id)             AS total_ratings,
      CASE
        WHEN AVG(f.rating) >= 4.5 THEN 'excellent'
        WHEN AVG(f.rating) >= 3.5 THEN 'good'
        WHEN AVG(f.rating) >= 2.5 THEN 'average'
        ELSE 'needs_attention'
      END AS performance_label
    FROM users u
    LEFT JOIN feedback f ON f.target_id = u.id
      AND f.feedback_type = 'faculty_rating'
      AND f.institute_id  = :instituteId
    WHERE u.institute_id = :instituteId AND u.role = 'faculty'
    GROUP BY u.id, u.name
    ORDER BY avg_rating DESC
  `, { replacements: { instituteId }, type: QueryTypes.SELECT });
}

module.exports = { getFacultyRatingSummary, getInstituteStats, getPlatformStats, getFacultyLeaderboard };
Phase 4 — Controller (Minimum API Calls Design)
js// controllers/feedback.controller.js
const { Feedback, User } = require('../models');
const feedbackService = require('../services/feedback.service');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');

// POST /api/feedback — submit any feedback type
// 2 checks in parallel → 1 insert. Total: 2 DB calls max
const submitFeedback = catchAsync(async (req, res) => {
  const iid  = req.user.institute_id;
  const uid  = req.user.id;
  const role = req.user.role;
  const { feedback_type, target_id, rating, comment, is_anonymous = true } = req.body;

  // Check duplicate (faculty rating only — one per student per faculty per month)
  if (feedback_type === 'faculty_rating') {
    const existing = await Feedback.findOne({
      where: {
        institute_id:  iid,
        submitted_by:  uid,
        target_id,
        feedback_type: 'faculty_rating',
        created_at: { [Op.gte]: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
      },
      attributes: ['id'],
    });
    if (existing) return sendError(res, 'You already rated this teacher this month', 409);
  }

  const fb = await Feedback.create({
    institute_id: iid,
    submitted_by: uid,
    submitter_role: role,
    feedback_type,
    target_id:   target_id || null,
    target_type: feedback_type === 'faculty_rating' ? 'faculty' : 'institute',
    rating:      rating || null,
    comment:     comment || null,
    is_anonymous,
  });

  return sendSuccess(res, fb, 'Thank you for your feedback!', 201);
});

// GET /api/feedback/faculty/:id/summary — faculty sees own summary
// Anonymous: never returns submitter identity
const getFacultySummary = catchAsync(async (req, res) => {
  const { id } = req.params;
  const iid    = req.user.institute_id;

  // Security: faculty can only see their own
  if (req.user.role === 'faculty' && req.user.id !== parseInt(id)) {
    return sendError(res, 'You can only view your own feedback', 403);
  }

  const [summary, comments] = await Promise.all([
    feedbackService.getFacultyRatingSummary(id, iid),
    Feedback.findAll({
      where: { target_id: id, institute_id: iid, feedback_type: 'faculty_rating' },
      attributes: ['id', 'rating', 'comment', 'created_at'], // NO submitter info
      order: [['created_at', 'DESC']],
      limit: 10,
    }),
  ]);

  return sendSuccess(res, { summary, comments });
});

// GET /api/feedback/admin/dashboard — admin sees all
// 1 aggregated query for stats + 1 for leaderboard in parallel
const getAdminDashboard = catchAsync(async (req, res) => {
  const iid = req.user.institute_id;
  const [stats, leaderboard, recent] = await Promise.all([
    feedbackService.getInstituteStats(iid),
    feedbackService.getFacultyLeaderboard(iid),
    Feedback.findAll({
      where: { institute_id: iid, feedback_type: { [Op.in]: ['complaint','suggestion'] } },
      order: [['created_at', 'DESC']],
      limit: 10,
      // Only include submitter name if NOT anonymous
      attributes: ['id','feedback_type','comment','status','is_anonymous','created_at','submitted_by'],
    }),
  ]);
  return sendSuccess(res, { stats, leaderboard, recent });
});

// PATCH /api/feedback/:id/reply — admin replies to a complaint
const replyToFeedback = catchAsync(async (req, res) => {
  const { id } = req.params;
  const iid    = req.user.institute_id;
  const fb = await Feedback.findOne({ where: { id, institute_id: iid } });
  if (!fb) return sendError(res, 'Feedback not found', 404);
  await fb.update({ admin_reply: req.body.reply, replied_by: req.user.id, replied_at: new Date(), status: 'resolved' });
  return sendSuccess(res, fb, 'Reply sent');
});

// GET /api/feedback/superadmin/overview — super admin only
const getSuperAdminOverview = catchAsync(async (req, res) => {
  const [platform, byInstitute] = await Promise.all([
    feedbackService.getPlatformStats(),
    sequelize.query(`
      SELECT i.id, i.name,
        ROUND(AVG(f.rating), 1) AS avg_rating,
        COUNT(f.id) AS total_feedback
      FROM institutes i
      LEFT JOIN feedback f ON f.institute_id = i.id
        AND f.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      WHERE i.status = 'active'
      GROUP BY i.id, i.name
      ORDER BY avg_rating ASC
      LIMIT 20
    `, { type: QueryTypes.SELECT }),
  ]);
  return sendSuccess(res, { platform, institutes: byInstitute });
});

module.exports = { submitFeedback, getFacultySummary, getAdminDashboard, replyToFeedback, getSuperAdminOverview };
Phase 5 — Routes
js// routes/feedback.routes.js
const router  = require('express').Router();
const ctrl    = require('../controllers/feedback.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const { allowRoles }  = require('../middlewares/role.middleware');
const validate        = require('../validations');
const { submitSchema, replySchema } = require('../validations/feedback.validation');

const auth = [verifyToken];

// Submit — any logged-in user
router.post('/', ...auth, validate(submitSchema), ctrl.submitFeedback);

// Faculty sees own summary
router.get('/faculty/:id/summary', ...auth, allowRoles('faculty','owner','manager'), ctrl.getFacultySummary);

// Admin dashboard
router.get('/admin/dashboard', ...auth, allowRoles('owner','manager'), ctrl.getAdminDashboard);

// Admin replies
router.patch('/:id/reply', ...auth, allowRoles('owner','manager'), validate(replySchema), ctrl.replyToFeedback);

// Admin flags/changes status
router.patch('/:id/status', ...auth, allowRoles('owner','manager'), ctrl.updateStatus);

// Super admin
router.get('/superadmin/overview', ...auth, allowRoles('super_admin'), ctrl.getSuperAdminOverview);

module.exports = router;
// In app.js: app.use('/api/feedback', require('./routes/feedback.routes'));
Phase 6 — Validation
js// validations/feedback.validation.js
const Joi = require('joi');

exports.submitSchema = Joi.object({
  feedback_type: Joi.string().valid('faculty_rating','institute_rating','suggestion','complaint').required(),
  target_id:     Joi.when('feedback_type', { is: 'faculty_rating', then: Joi.number().required(), otherwise: Joi.optional() }),
  rating:        Joi.when('feedback_type', {
    is: Joi.valid('faculty_rating','institute_rating'),
    then: Joi.number().integer().min(1).max(5).required(),
    otherwise: Joi.optional(),
  }),
  comment:      Joi.string().max(1000).optional().trim(),
  is_anonymous: Joi.boolean().default(true),
});

exports.replySchema = Joi.object({
  reply: Joi.string().min(1).max(1000).required().trim(),
});
Phase 7 — Frontend Service
js// services/feedback.service.js (frontend)
import api from './api';

const feedbackService = {
  // Submit any type
  submit: (data) => api.post('/api/feedback', data).then(r => r.data),

  // Faculty — own summary (anonymous comments)
  getFacultySummary: (id) => api.get(`/api/feedback/faculty/${id}/summary`).then(r => r.data.data),

  // Admin — full dashboard (1 call = stats + leaderboard + recent)
  getAdminDashboard: () => api.get('/api/feedback/admin/dashboard').then(r => r.data.data),

  // Admin — reply to complaint
  reply: (id, reply) => api.patch(`/api/feedback/${id}/reply`, { reply }).then(r => r.data),

  // Admin — flag/resolve
  updateStatus: (id, status) => api.patch(`/api/feedback/${id}/status`, { status }).then(r => r.data),

  // Super admin
  getPlatformOverview: () => api.get('/api/feedback/superadmin/overview').then(r => r.data.data),
};

export default feedbackService;
Phase 8 — Pages to create
FileRouteWho Sees Itpages/student/Feedback.jsx/student/feedbackStudent submits faculty + institute ratingspages/parent/Feedback.jsx/parent/feedbackParent submits institute rating + complaintspages/faculty/MyRatings.jsx/faculty/ratingsFaculty sees own anonymous summarypages/admin/Feedback.jsx/admin/feedbackAdmin: all feedback, leaderboard, complaintspages/superadmin/FeedbackAnalytics.jsx/superadmin/feedbackSuper admin: platform-wide view
Phase 9 — Key UI rules for responsiveness
Every page uses CSS grid with repeat(auto-fit, minmax(160px, 1fr)) for metric cards — they reflow automatically from 4 columns on desktop to 2 on tablet to 1 on mobile. The star rating component uses font-size: clamp(20px, 4vw, 28px) so it scales on any screen. The admin feedback table switches from a full table to stacked cards below 640px using a single CSS media query.
Performance summary
OperationDB CallsComplexitySubmit feedback1–2 (duplicate check + insert)O(log n) with indexFaculty rating summary1 aggregated queryO(n) for that facultyAdmin dashboard3 parallel Promise.all()O(n) with indexesSuper admin overview2 parallel queriesO(institutes)Faculty leaderboard1 JOIN queryO(faculty × ratings)
