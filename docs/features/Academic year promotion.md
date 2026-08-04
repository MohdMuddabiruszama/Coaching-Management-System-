
🎓
ZenithFlows
Academic Year Promotion — Implementation Roadmap
Approach 2: Enrollment Journal Model — Full Phase-by-Phase Build Plan
Project	ZenithFlows (Coaching Management System)
Feature	Academic Year Promotion Engine
Chosen Approach	Approach 2 — Enrollment Journal (student_classes versioning)
Applies To	Schools, Colleges, Coaching Centers, Training Institutes
Stack	Node.js, Express, Sequelize, PostgreSQL (Neon), Socket.io, Redis
 
Table of Contents


 
Overview — What We're Building
This roadmap implements Academic Year Promotion using the Enrollment Journal model (Approach 2): instead of overwriting a student's current class, every promotion closes the old enrollment record and opens a new one. Nothing is ever deleted, so full historical transcripts are available for every student, every year, automatically.
The plan is broken into 10 phases, designed to be built and shipped incrementally — each phase produces something testable before moving to the next. Total estimated effort: 3-4 weeks for one backend + one frontend developer.
📌 Design principle carried through every phase
●	Bulk, set-based database operations only — never loop over students one at a time in application code.
●	One institute-configurable 'promotion map' drives Schools, Colleges, Coaching Centers, and Training Institutes through the same engine.
●	Every write is wrapped in a single database transaction — it fully succeeds or fully fails, never half-applies.
Phase Map at a Glance
Phase	Focus	Output
1	Database Schema	academic_years table + upgraded student_classes + students.status
2	Sequelize Models & Associations	AcademicYear, updated StudentClass models wired into index.js
3	Promotion Rules Engine	Institute-configurable class/batch/course sequence + end-actions
4	Promotion Service (core logic)	promotionService.js — transactional bulk SQL engine
5	API Layer	3 endpoints: preview, execute, status/history
6	Permissions & Middleware	Role gating (Admin/Manager only) + tenant scope + audit logging
7	Async Engine for Scale	Queue-based execution for large institutes, via existing Redis
8	Related Module Handling	Fees, attendance, exams, ID cards, notifications during promotion
9	Frontend UI/UX	Preview to Review/Override to Confirm to Progress to Done
10	Testing, Rollback & Deployment	Edge cases, rollback strategy, staged rollout
 
PHASE 1  Database Schema Foundation	

Everything else depends on this phase. Add three things: a proper academic_years table (doesn't exist yet), upgrade the existing student_classes junction table into a versioned enrollment journal, and add a status field to students.
1.1 — New table: academic_years
One row per institute per year. Exactly one row can be 'current' at a time per institute (enforced by a partial unique index).
CREATE TABLE academic_years (
  id SERIAL PRIMARY KEY,
  institute_id INTEGER NOT NULL REFERENCES institutes(id),
  label VARCHAR(20) NOT NULL,        -- e.g. "2025-26"
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'active', -- active | closed
  created_at TIMESTAMP DEFAULT now()
);

CREATE UNIQUE INDEX uq_one_current_year
  ON academic_years(institute_id) WHERE is_current = true;
1.2 — Upgrade student_classes into an enrollment journal
This table already exists in your schema as a plain 3-field junction (student_id, class_id). We extend it rather than replace it — no breaking change to existing reads.
ALTER TABLE student_classes
  ADD COLUMN academic_year_id INTEGER REFERENCES academic_years(id),
  ADD COLUMN status VARCHAR(20) DEFAULT 'active',  -- active | completed | transferred
  ADD COLUMN enrolled_at DATE DEFAULT now(),
  ADD COLUMN exited_at DATE;

-- Only one ACTIVE enrollment per student at any time
CREATE UNIQUE INDEX uq_one_active_enrollment
  ON student_classes(student_id) WHERE status = 'active';

CREATE INDEX idx_sc_year ON student_classes(academic_year_id, class_id);
1.3 — Add status to students
ALTER TABLE students ADD COLUMN status VARCHAR(20) DEFAULT 'active';
-- active | graduated | alumni | dropped | transferred | archived
ALTER TABLE students ADD COLUMN current_academic_year_id INTEGER
  REFERENCES academic_years(id);
1.4 — Backfill for existing data
Before this ships, run a one-time migration script (fits your existing scripts/ folder pattern — you already have 23 migration scripts) that creates one academic_years row for the institute's current year and one student_classes row per existing student using their current class_id, marked status='active'.
✅ Deliverable for Phase 1
●	Migration script added to backend/scripts/, tested on a copy of production data
●	Backfill confirmed: every active student has exactly one active student_classes row
●	students.class_id kept as-is for now (used as a fast read cache — see Phase 4)

PHASE 2  Sequelize Models & Associations	

Add the new model, extend the existing one, and register associations — following the same pattern as your other 66 models.
2.1 — New model: models/academicYear.model.js
AcademicYear.init({
  instituteId: DataTypes.INTEGER,
  label: DataTypes.STRING(20),
  startDate: DataTypes.DATEONLY,
  endDate: DataTypes.DATEONLY,
  isCurrent: DataTypes.BOOLEAN,
  status: DataTypes.STRING(20),
}, { sequelize, modelName: 'AcademicYear', tableName: 'academic_years' });
2.2 — Extend models/studentClass.model.js
Add the four new fields (academicYearId, status, enrolledAt, exitedAt) to the existing model definition.
2.3 — Register associations in models/index.js
Institute.hasMany(AcademicYear, { foreignKey: 'institute_id' });
AcademicYear.hasMany(StudentClass, { foreignKey: 'academic_year_id' });
Student.hasMany(StudentClass, { foreignKey: 'student_id', as: 'enrollments' });
StudentClass.belongsTo(Class, { foreignKey: 'class_id' });
StudentClass.belongsTo(AcademicYear, { foreignKey: 'academic_year_id' });
✅ Deliverable for Phase 2
●	AcademicYear model created and exported alongside the other 66 models
●	StudentClass model extended without breaking any existing association calls
●	Sanity check: Student.findByPk(id, { include: 'enrollments' }) returns full year history

 
PHASE 3  Promotion Rules Engine	

This is what makes one engine work for School, College, Coaching Center, and Training Institute — instead of hardcoding 'Class 9 to Class 10' anywhere in code, each institute defines its own ordered sequence once.
3.1 — New table: promotion_rules
CREATE TABLE promotion_rules (
  id SERIAL PRIMARY KEY,
  institute_id INTEGER NOT NULL REFERENCES institutes(id),
  from_class_id INTEGER REFERENCES classes(id),
  to_class_id INTEGER REFERENCES classes(id),  -- NULL = end of sequence
  end_action VARCHAR(20),  -- graduate | course_completed | alumni | null
  sort_order INTEGER
);
3.2 — Auto-suggestion helper
On first setup, auto-suggest the sequence by sorting existing classes by name (Class 1 to 12, or Foundation to Beginner to Intermediate to Advanced via a configurable keyword order list). The admin reviews and adjusts once in a simple settings screen — this becomes reusable every year afterward.
3.3 — How the same engine covers all four institution types
Institution Type	'Class' means	End action offered
School	Class 1-12 (or up to 10/12 depending on level)	Graduate / Move to Alumni / Leave School
College	Year 1 / 2 / 3 / Final Year	Graduate / Alumni
Coaching Center	Foundation / Beginner / Intermediate / Advanced batch	Course Completed
Training Institute	Module 1 / Module 2 / ... / Final Module	Course Completed
✅ Deliverable for Phase 3
●	promotion_rules table + simple CRUD endpoints for institute admins to define/edit the sequence
●	Auto-suggestion logic for first-time setup
●	One rules table drives all institution types — zero institution-specific code branches

 
PHASE 4  Promotion Service — Core Engine	

The heart of the feature: services/promotion.service.js. Follows your existing services/ layer pattern (alongside your other 14 services). Everything here runs as bulk, set-based SQL inside one transaction — never a per-student loop.
4.1 — Preview function
One grouped query — not one query per class:
SELECT c.id, c.name, COUNT(s.id) AS student_count
FROM classes c
LEFT JOIN students s ON s.class_id = c.id AND s.status = 'active'
WHERE c.institute_id = :instituteId
GROUP BY c.id, c.name;
4.2 — Execute function (the actual promotion)
Runs inside a single sequelize.transaction(). Three bulk statements, regardless of student count:
await sequelize.transaction(async (t) => {
  // 1) Close all current active enrollments for this institute
  await StudentClass.update(
    { status: 'completed', exitedAt: new Date() },
    { where: { status: 'active', '$student.institute_id$': instituteId },
      include: [{ model: Student, as: 'student' }], transaction: t }
  );

  // 2) Bulk-insert new enrollments using the promotion_rules map
  await StudentClass.bulkCreate(newEnrollmentRows, { transaction: t });

  // 3) Sync the fast-read cache column on students in one statement
  await sequelize.query(`
    UPDATE students s SET class_id = m.to_class_id, status = 'promoted'
    FROM (VALUES ...) AS m(student_id, to_class_id)
    WHERE s.id = m.student_id`, { transaction: t });

  // 4) Flip the current-year flag
  await AcademicYear.update({ isCurrent: false }, { where: { id: oldYearId }, transaction: t });
  await AcademicYear.update({ isCurrent: true }, { where: { id: newYearId }, transaction: t });
});
4.3 — Why this is fast
Regardless of whether the institute has 50 or 5,000 active students, this is always 4 database round trips, not 4×N. The database engine processes all matching rows internally using the indexes added in Phase 1 — this is the same principle used for your existing bulk import feature.
✅ Deliverable for Phase 4
●	promotion.service.js with previewPromotion() and executePromotion()
●	Fully wrapped in one transaction — all-or-nothing
●	Load-tested against a seeded 3,000-student institute to confirm sub-second execution

 
PHASE 5  API Layer	

Deliberately minimal — 3 endpoints cover the entire feature, following your existing routes/controllers/validators structure.
Method & Route	Purpose	Calls per promotion run
GET /api/academic-years/:id/promotion-preview	Class-wise counts + suggested mapping + flagged overrides (pending fees, incomplete exams)	1
POST /api/academic-years/:id/promote	Executes the promotion using rules + admin overrides	1
GET /api/academic-years/promotion-history/:studentId	Full year-by-year enrollment history for one student (transcript view)	As needed
5.1 — Files to add (matches your existing structure)
●	routes/academicYear.routes.js
●	controllers/academicYear.controller.js
●	validators/academicYear.validator.js — Joi schema for the promotion payload
✅ Deliverable for Phase 5
●	3 documented endpoints, Joi-validated, tested with Postman/Supertest against a seeded institute

PHASE 6  Permissions, Middleware & Audit Logging	

Reuses your existing middleware pipeline — no new infrastructure needed.
Role	Permission
Super Admin	Can view/trigger promotion for any institute (platform support use only)
Admin	Full access — configure rules, preview, execute, override, rollback
Manager (academic type)	Preview + execute only if manager_type includes 'academic'; enforced via your existing checkManagerPermission middleware
Faculty / Student / Parent	No access — route is blocked at the role.middleware layer
Audit trail
Every promotion run writes one summary row to your existing audit_logs table (action: 'academic_year_promotion', with instituteId, fromYearId, toYearId, studentCount, performedBy) — no new audit table needed.
✅ Deliverable for Phase 6
●	role.middleware + checkManagerPermission wired onto the 3 new routes
●	tenantScope applied so an institute can never promote another institute's students
●	One audit_logs row per promotion run

 
PHASE 7  Async Engine for Large-Scale Promotions	

For most institutes, Phase 4's synchronous transaction finishes in well under a second and this phase can be skipped at launch. Add it once you have institutes with several thousand students, or a Super Admin 'promote all branches at once' flow.
1. POST /promote checks student_count against a threshold (e.g. 300).
2. Below threshold: run synchronously as built in Phase 4, respond immediately.
3. Above threshold: enqueue a job using your existing Upstash Redis connection, respond 202 with a job_id.
4. Worker processes the same transaction from Phase 4 in chunks of ~500 students, to avoid holding one long-running transaction.
5. Progress is pushed to the admin's screen via your existing Socket.io connection (same pattern as chat/notifications) — 'promotion:progress' and 'promotion:complete' events.
✅ Deliverable for Phase 7
●	Threshold-based routing between sync and async execution — same API contract either way from the frontend's perspective

 
PHASE 8  Related Module Handling	

Promotion doesn't happen in isolation — decide explicitly what happens to each connected module.
Module	Behavior during promotion
Attendance	Stays linked to the old (now completed) student_classes record — historical attendance % for last year remains accurate and queryable
Fees	Pending dues carry forward as a flag on the new enrollment (student_fees keeps its own history; new fee structure applies to the new class)
Exams & Marks	Remain permanently linked to the academic year they were taken in — report cards for any past year stay generatable
ID Cards	Auto-regenerate on promotion (new class/section printed), old ID card image kept in history
Transport / Hostel	Not auto-changed — flagged for admin review since routes/rooms are class-independent
Notifications	Student + parent get a push notification: 'Promoted to Class 10 for 2026-27' or the relevant end-action message
⚠️ Edge cases to handle explicitly in this phase
●	Students with pending fees — flagged in the preview screen, admin decides: promote anyway or hold
●	Students with incomplete/failed exams — default suggestion is 'repeat,' overridable
●	Repeaters — new student_classes row uses the SAME class_id as before, new academic_year_id
●	Transferred/dropped students — closed enrollment, no new one opened, status set accordingly

 
PHASE 9  Frontend UI/UX Flow	

Four screens, matching the backend's preview to execute contract:
1. Overview screen — cards for each class/batch/course showing current student counts and the suggested next stage (from promotion_rules).
2. Review & Override screen — table of all students, bulk-select, with per-student override dropdown (Promote / Repeat / Graduate / Transfer / Drop). Students with flagged issues (pending fees, incomplete exams) are highlighted automatically.
3. Confirmation screen — final summary: 'X students promoted, Y graduating, Z repeating' with the current to new academic year clearly shown, plus a typed confirmation (e.g. type 'PROMOTE') before the irreversible-feeling action fires.
4. Progress / Result screen — for synchronous runs, an instant success summary; for async runs (Phase 7), a live progress bar fed by the Socket.io events.
✅ Deliverable for Phase 9
●	4-screen flow built in the existing frontend, wired to the 3 API endpoints, with the same design system as the rest of ZenithFlows

 
PHASE 10  Testing, Rollback & Deployment	

10.1 — Rollback strategy
Because every promotion is one transaction, a failure during execution auto-rolls-back with zero side effects (nothing was half-applied). For an after-the-fact undo (admin promoted the wrong year by mistake), a reverse operation re-opens the previous student_classes rows and closes the new ones — driven entirely from the enrollment journal, so no data is ever lost and undo is always possible within your retention policy.
10.2 — Test matrix
Scenario	Expected behavior
Normal promotion, 500 students	All succeed in one transaction, sub-second
Mixed institute (some repeaters, some graduates)	Correct per-student end state, single run
Network drop mid-request	Transaction rolls back fully — no partial promotion
Duplicate promotion attempt (double-click)	Second call detects no active students left in old year, safely no-ops
Multi-branch institute, different rules per branch	promotion_rules scoped per institute_id — branches never interfere
10,000+ student super-admin bulk run	Routes to async engine (Phase 7), completes via chunked jobs
10.3 — Deployment
1. Ship Phase 1's migration to staging first, verify backfill correctness against a production data snapshot.
2. Deploy Phases 2-6 behind a feature flag, enabled only for a pilot institute.
3. Run one real promotion cycle with the pilot institute, verify report cards/transcripts still generate correctly for past years.
4. Roll out to all institutes; keep Phase 7's async path ready but dormant until an institute actually crosses the size threshold.
✅ Final Deliverable
●	Feature live for Schools, Colleges, Coaching Centers, and Training Institutes through one shared engine
●	Every promotion reversible, fully audited, and safe against partial failure
●	Sub-second execution regardless of institute size, with a scale path already built in

This roadmap is based on ZenithFlows' existing backend, database, and frontend architecture as documented in the project's own architecture reports.
