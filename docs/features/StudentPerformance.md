




Let me analyze deeply and design the best Student Performance system for your project.**Approach B is the clear choice** — it uses only data you already have (marks, attendance, assignments), needs zero new database tables, and gives every role exactly the view they need for their job. Here are the phases to build it.

---

## Phase 1 — Backend: Performance score computation service

Create `services/performance.service.js`. This is the entire engine — one file, four functions:

```js
// services/performance.service.js
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

// WEIGHTS — configurable per institute later
const W = { marks: 0.40, attendance: 0.30, assignments: 0.20, engagement: 0.10 };

// Single student score — called by student, parent, faculty views
async function getStudentScore(studentId, instituteId) {
  const [marks, attendance, assignments] = await Promise.all([
    sequelize.query(`
      SELECT AVG((m.marks_obtained / e.total_marks) * 100) AS avg_pct
      FROM marks m JOIN exams e ON e.id = m.exam_id
      WHERE m.student_id = :sid AND e.institute_id = :iid
        AND e.marks_locked = 1 AND m.is_absent = 0
    `, { replacements: { sid: studentId, iid: instituteId }, type: QueryTypes.SELECT }),

    sequelize.query(`
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present
      FROM attendance
      WHERE student_id = :sid AND institute_id = :iid
    `, { replacements: { sid: studentId, iid: instituteId }, type: QueryTypes.SELECT }),

    sequelize.query(`
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN status IN ('submitted','graded') THEN 1 ELSE 0 END) AS submitted
      FROM assignment_submissions asub
      JOIN assignments a ON a.id = asub.assignment_id
      WHERE asub.student_id = :sid AND a.institute_id = :iid
    `, { replacements: { sid: studentId, iid: instituteId }, type: QueryTypes.SELECT }),
  ]);

  const marksPct = parseFloat(marks[0]?.avg_pct) || 0;
  const attPct   = attendance[0]?.total > 0
    ? (attendance[0].present / attendance[0].total) * 100 : 0;
  const assPct   = assignments[0]?.total > 0
    ? (assignments[0].submitted / assignments[0].total) * 100 : 0;

  const score = (marksPct * W.marks) + (attPct * W.attendance) + (assPct * W.assignments);

  return {
    score:       Math.round(score),
    grade:       scoreToGrade(score),
    marks_pct:   Math.round(marksPct),
    att_pct:     Math.round(attPct),
    ass_pct:     Math.round(assPct),
    status:      score >= 75 ? 'good' : score >= 50 ? 'average' : 'at_risk',
  };
}

function scoreToGrade(s) {
  if (s >= 90) return 'A+'; if (s >= 80) return 'A';
  if (s >= 70) return 'B+'; if (s >= 60) return 'B';
  if (s >= 50) return 'C';  if (s >= 40) return 'D'; return 'F';
}

// Class-level scores — used by faculty and admin
async function getClassScores(classId, instituteId) {
  // Returns array of { student_id, student_name, roll_no, score, grade, status }
  // using same three queries but for all students in the class
}

// Month-over-month trend — used by parent and student
async function getStudentTrend(studentId, instituteId) {
  // Returns last 6 months of { month, marks_pct, att_pct, ass_pct, score }
}

// Institute overview — used by admin
async function getInstituteOverview(instituteId) {
  // Returns { avg_score, top_class, at_risk_count, pass_rate, class_breakdown[] }
}

module.exports = { getStudentScore, getClassScores, getStudentTrend, getInstituteOverview };
```

---

## Phase 2 — Backend: API endpoints

Add to your existing controllers:

```
GET /api/performance/me              → student's own score + breakdown
GET /api/performance/me/trend        → student's 6-month trend
GET /api/performance/class/:classId  → faculty sees class scores ranked
GET /api/performance/student/:id     → parent sees their child (with auth check)
GET /api/performance/institute       → admin/manager sees institute overview
GET /api/performance/at-risk         → admin/faculty sees at-risk student list
GET /api/performance/export          → admin downloads Excel
```

All auth through your existing `verifyToken` + `allowRoles` middleware. The `parent` endpoint validates the parent-child relationship before returning data.

---

## Phase 3 — Student dashboard: `/student/performance`

New page with 4 sections:

**Section 1 — Score card row** (4 metric cards): Overall score with grade badge · Attendance % · Avg marks % · Assignment rate

**Section 2 — Weak subjects alert** (shown only if any subject < passing marks): Red banner listing subject names and their average %. This is the most actionable thing for a student.

**Section 3 — Subject performance chart**: Line chart using `react-chartjs-2`, one line per subject, x-axis = exam dates, y-axis = percentage. Uses data from your existing `GET /api/marks/student/trend` (Phase 6 of the exam feature).

**Section 4 — Attendance calendar heatmap**: Month grid where each day is colored: green = present, red = absent, gray = holiday/no class. Uses your existing attendance data. Build with plain CSS grid — no external library needed.

---

## Phase 4 — Parent dashboard: performance tab

Add a "Performance" tab to the existing parent dashboard tabs (alongside Overview, Attendance, Marks, Fees, Timetable, Assignments, Chat).

Shows per selected child:
- Score summary card: score / 100 with colored grade badge + status (Good / Average / At Risk)
- Three progress bars: Marks (40% weight), Attendance (30%), Assignments (20%)
- Concern alerts section (red banner): "Attendance below 75%" or "Failing in Mathematics" — only shown when triggered
- Month-over-month sparkline: tiny 6-month line showing score trajectory

When parent has two children (like Meena Khan with Sameer Khan and Sameer Reddy in your screenshot), the child selector at the top already works — the performance tab just reads from the selected child.

---

## Phase 5 — Faculty dashboard: class performance view

Add a "Class Performance" link to the Faculty Dashboard quick actions grid (alongside the existing View Students, Mark Attendance, Enter Marks, etc.).

The page shows:
- **Stats bar**: Class avg score, pass rate, highest, at-risk count
- **Ranked table**: Roll No · Student Name · Score · Grade · Marks% · Attendance% · Assignment% · Status badge
- **At-risk section** below the table: students with status = `at_risk` highlighted in a red card — these need teacher intervention
- **Subject distribution chart**: Bar chart showing how many students fall in each grade band (A+, A, B+, B, C, D, F)

Faculty only sees data for students in their assigned classes. Your existing `verifyToken` + class ownership check handles this.

---

## Phase 6 — Admin/Manager dashboard: institute overview

Add a "Performance" section to the existing Admin Dashboard, and a separate full page at `/admin/performance`.

Dashboard section (compact): Two stat cards — Institute avg score + At-risk student count — plus a "View Full Report" link.

Full page (`/admin/performance`):
- **4 overview cards**: Avg institute score · Pass rate · At-risk count · Top performing class
- **Class comparison bar chart**: One bar per class showing average score — admin instantly sees which class needs attention
- **Top 10 / Bottom 10 students** table: sortable, with export to Excel button
- **Monthly trend line**: Institute-wide average score over last 6 months

---

## Phase 7 — Performance caching (important for speed)

The performance score query hits 3 tables (marks, attendance, assignment_submissions) for every student. At 200 students per class, this gets slow.

Add a simple in-memory cache in the service layer:

```js
const cache = new Map(); // key: `${instituteId}:${studentId}`, value: { score, cachedAt }
const TTL = 5 * 60 * 1000; // 5 minutes

async function getStudentScore(studentId, instituteId) {
  const key = `${instituteId}:${studentId}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.cachedAt < TTL) return cached.score;

  const score = await computeScore(studentId, instituteId); // your SQL queries
  cache.set(key, { score, cachedAt: Date.now() });
  return score;
}

// Invalidate when marks/attendance/assignments change:
// Call cache.delete(`${instituteId}:${studentId}`) in mark save, attendance mark, and assignment grade controllers
```

This brings the institute overview from ~2 seconds to under 100ms for repeat requests.

---

## Execution order (7 days)

| Day | Task |
|-----|------|
| Day 1 | Phase 1 — `performance.service.js` with all 4 functions |
| Day 2 | Phase 2 — 6 API endpoints + tests |
| Day 3 | Phase 3 — Student performance page |
| Day 4 | Phase 4 — Parent performance tab |
| Day 5 | Phase 5 — Faculty class performance page |
| Day 6 | Phase 6 — Admin institute overview |
| Day 7 | Phase 7 — Caching + end-to-end test all 5 roles |

Start with the service file (Phase 1) before any frontend — the moment `getStudentScore()` returns correct numbers, all 5 role views can be built in parallel.