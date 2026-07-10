COACHING MANAGEMENT SYSTEM
Unified Multi-Channel Attendance
& Live Timetable Integration — Technical Architecture
One event. One record. Every channel in sync — instantly.
Implementation Blueprint  |  Manual Grid · Smart QR · Biometric  |  Student & Faculty
 Table of Contents
Table of Contents	1
1. Executive Summary	1
2. Core Architectural Principle	1
2.1 Single Source of Truth (SSOT)	1
2.2 Event-Driven, Not Polling-Driven	1
3. Phase 1 — Unified Data Model	1
3.1 Attendance (Student) — confirmed fields + additions	1
3.2 FacultyAttendance — identical pattern	1
3.3 Why not FacultyPeriodAttendance as a new table?	1
4. Phase 2 — The Unified Marking Service	1
4.1 Conflict Resolution — which channel wins?	1
4.2 Idempotency	1
4.3 One Write → One Fan-Out (Outbox Pattern)	1
5. Phase 3 — Real-Time Cross-Channel Sync	1
5.1 WebSocket rooms, not global broadcast	1
5.2 Why this beats polling on every metric you asked about	1
6. Phase 4 — Channel Adapters (thin, no business logic)	1
7. Phase 5 — Notification De-duplication	1
8. Phase 6 — Live Timetable Integration	1
8.1 Current-period resolution, O(1) via cache	1
8.2 'Live Now' faculty & admin dashboards	1
8.3 Faculty period-wise attendance (in/out mode)	1
9. Phase 7 — Performance & Scalability Checklist	1
10. Phase 8 — Unified API Surface	1
11. Implementation Roadmap	1
12. Summary of Guarantees	1

 1. Executive Summary
Your current plan is architecturally sound: reuse the existing Attendance/FacultyAttendance models, keep time_in/time_out where they already live, drive mode flags off Institute, and reuse Timetable/TimetableSlot for period lookups instead of creating parallel structures. This document builds on that plan and answers the one question it doesn't yet answer: how do three independent input channels — Manual Grid, Smart QR, and Biometric — write to the same underlying truth so that marking on any one of them instantly reflects as ‘already marked’ on the other two, with zero duplicate records, zero duplicate notifications, and minimum API round-trips.
The short answer, expanded across this document: treat every channel as a thin adapter that emits the same internal event into one Unified Marking Service, which performs a single idempotent upsert against one row per (student, date [, period]), then fans out state via WebSocket push — not polling — to every open client screen. The same engine, unchanged, powers Faculty Attendance. Live Timetable becomes the thing that tells the engine which period an event belongs to, in O(1) via a cached period lookup.
2. Core Architectural Principle
2.1 Single Source of Truth (SSOT)
The single biggest risk in a multi-channel attendance system is three separate write paths creating three separate records for the same real-world event. The fix is not ‘sync the three tables afterward’ — it is to never let three tables exist in the first place.
Key decision:  Do not model Manual, QR, and Biometric as three attendance sources with separate tables that get reconciled. Model them as three input adapters that all call one write path into one table. Reconciliation-after-the-fact is the expensive, bug-prone, real-world anti-pattern — avoid it entirely.
•	One row = one student, one date (add period_id for period-wise faculty/timetable-linked attendance).
•	The row carries marked_by_type (manual | qr | biometric) purely as metadata / audit trail — it never causes a second row to be created.
•	A unique compound index enforces this at the database level, not just in application code, so even a race condition (QR scan and biometric punch within the same second) cannot create a duplicate.
2.2 Event-Driven, Not Polling-Driven
Point 1 (dedupe) solves correctness. This point solves speed and API-call volume, which you explicitly asked to minimize. The naive way to make three screens agree is for each screen to re-fetch (poll) the attendance list every few seconds. That multiplies API calls by the number of open screens × poll frequency, and still gives you a 2–5 second staleness window.
Performance decision:  Replace polling with a single persistent WebSocket connection per active screen. The write path emits one event after the DB commit; the server pushes it to every subscriber in the same class/room. Each screen updates its local state directly from the push payload — no re-fetch call at all. This turns an O(clients × polls) API load into a O(1) push per event.
 3. Phase 1 — Unified Data Model
No new attendance tables. The existing Attendance and FacultyAttendance models already carry the right shape; we only tighten constraints and add the fields that make cross-channel dedupe and live-period linking possible.
3.1 Attendance (Student) — confirmed fields + additions
Field	Type	Purpose
student_id, date	FK, Date	Composite unique key — one row per student per day. Prevents any channel from creating a duplicate.
period_id	FK (nullable)	Links to TimetableSlot when period-wise attendance is enabled (see Phase 6). Null = whole-day mode.
status	enum	present | absent | late | half_day | holiday — unchanged.
marked_by_type	enum	manual | qr | biometric — audit trail only, not a partition key.
marked_by_user_id	FK (nullable)	Faculty/admin id for manual; null for QR/biometric self-marks.
source_meta	JSON	device_id for biometric, session_id for QR, ip/geofence for manual — keeps forensic detail off the hot columns.
time_in / time_out	DateTime	Already exists from biometrics — reused as-is, now also set by QR scan-in/out if you support that.
version	int, default 1	Optimistic-lock counter — used by the conflict-resolution engine in Phase 2.
updated_at	DateTime	Drives ‘last write wins with priority’ logic and cache invalidation.
Do not skip:  Add a UNIQUE constraint on (student_id, date, period_id). This single line of schema is what makes the whole ‘any channel updates all channels’ guarantee crash-proof, not just application-logic-proof.
3.2 FacultyAttendance — identical pattern
Reuse the same shape: unique (faculty_id, date [, period_id]), same marked_by_type enum, same source_meta, same version/updated_at pair. This is intentional — Faculty Attendance is not a separate system, it is the same Unified Marking Service pointed at a different model. You get the QR/biometric/manual sync for free without writing it twice.
3.3 Why not FacultyPeriodAttendance as a new table?
Your own analysis flags this as the one new table, gated by an in/out mode toggle. That is reasonable if you need per-period in/out timestamps distinct from the daily record. Keep it — but wire it through the same Unified Marking Service rather than a separate controller, so it inherits dedupe, push-sync, and notification logic instead of re-implementing them.
 4. Phase 2 — The Unified Marking Service
This is the core of the whole feature. Every adapter — markBulkAttendance, markAttendanceByStudentQR, receivePunch, and their faculty equivalents markByQR / biometric punch / updateGridBulk — stops writing to the database directly. Instead each calls one internal function:
async function markAttendance({
  studentId, date, periodId,
  status, sourceType,      // 'manual' | 'qr' | 'biometric'
  actorId, sourceMeta
}) {
  return db.transaction(async (trx) => {
    const existing = await Attendance.findOne(
      { student_id: studentId, date, period_id: periodId },
      { lock: 'FOR UPDATE', transaction: trx }
    );
 
    if (existing && !canOverride(existing, sourceType)) {
      return { ok: true, noop: true, record: existing }; // idempotent, no duplicate write
    }
 
    const record = await Attendance.upsert({
      student_id: studentId, date, period_id: periodId,
      status, marked_by_type: sourceType, marked_by_user_id: actorId,
      source_meta: sourceMeta, updated_at: now(),
    }, { transaction: trx });
 
    await outbox.publish('attendance.marked', record); // one write, one event
    return { ok: true, record };
  });
}
4.1 Conflict Resolution — which channel wins?
Because three physical devices can technically fire for the same student on the same day (e.g., a QR self-mark followed minutes later by a biometric punch), the engine needs a deterministic priority rule, not ‘last write wins by accident’.
Priority	Source	Rationale
1 (highest)	Biometric	Hardware-verified identity, cannot be spoofed by another person — treated as ground truth.
2	Smart QR	Verified by the student's logged-in device + rotating token, harder to fake than a manual tick.
3	Manual (Admin/Faculty)	Human-entered; can still correct or override any record for exceptions (medical leave, device outage) — admin override always wins regardless of numeric priority.
Key decision:  canOverride(existing, newSource) = true only when the new source's priority is ≥ existing, OR the actor is an explicit manual override (isAdminOverride flag bypasses priority entirely). This gives you automatic conflict handling for the 95% case and a manual escape hatch for the 5% exception case, in one rule.
4.2 Idempotency
•	QR sessions and biometric devices can retry on network hiccups — the (student_id, date, period_id) unique key plus the upsert makes retries safe by construction, not by client-side dedupe.
•	The 'noop' branch above means a re-scan of an already-present student costs one indexed SELECT, not a full write + notification cycle — keeps the hot path fast under real classroom load (30–60 scans in a 2-minute window).
4.3 One Write → One Fan-Out (Outbox Pattern)
The transaction commits the row, then publishes exactly one domain event (attendance.marked) inside the same transaction boundary via a lightweight outbox table (or a Redis stream if you prefer). A single downstream dispatcher consumes that event and does three things in parallel: push the WebSocket update, enqueue the push notification, and invalidate the relevant dashboard cache key. Because there is exactly one event per real write, there is exactly one notification and one UI update — never three.
 5. Phase 3 — Real-Time Cross-Channel Sync
5.1 WebSocket rooms, not global broadcast
Use Socket.IO (or native WS) with one room per class-section-date (e.g., room class:9A:2026-07-09) for the Manual Grid and QR session screens, and one room per faculty for the 'My Attendance' view. When markAttendance commits, the dispatcher emits attendance:update to that room only — not to every connected client — keeping payloads tiny and irrelevant traffic at zero.
// server — after outbox event consumed
io.to(`class:${classId}:${date}`).emit('attendance:update', {
  studentId, status, markedByType, time: record.updated_at
});
 
// Manual Grid client — no re-fetch, just patch local state
socket.on('attendance:update', (evt) => {
  setRow(evt.studentId, { status: evt.status, source: evt.markedByType });
});
5.2 Why this beats polling on every metric you asked about
Metric	Polling every 3s (3 open screens)	WebSocket push
API calls / minute / class	60	0 (server-initiated push, no client call)
Worst-case staleness	~3s	< 200ms typically
Server load pattern	Constant, scales with clients × polls	Scales only with actual marking events
Extra DB reads	Every poll re-queries the grid	Zero — clients patch state from the push payload
Performance decision:  Keep one lightweight REST fallback (GET /attendance/grid) purely for initial page load / reconnect — never for steady-state sync. Everything after the first paint is push-driven.
 6. Phase 4 — Channel Adapters (thin, no business logic)
Each existing endpoint becomes a thin translator into the unified call — this is the refactor step, and it's small because the heavy lifting already lives in Phase 2.
Existing endpoint	Becomes
markBulkAttendance (Manual Grid)	Loop rows → markAttendance({ sourceType: 'manual', actorId: req.user.id, ... }) per student, wrapped in one outer transaction for the whole grid submit.
startSmartSession / markAttendanceByStudentQR	Session issues rotating token as today; on scan, call markAttendance({ sourceType: 'qr', sourceMeta: { sessionId } }).
receivePunch (Biometric)	Resolve biometric_punch_id → student_id, then markAttendance({ sourceType: 'biometric', sourceMeta: { deviceId } }); sets time_in/time_out on the same row.
Faculty: markByQR / device punch / updateGridBulk	Identical pattern, pointed at the faculty variant of the same service.
Key decision:  No adapter ever checks 'has this student already been marked by another channel' itself — that logic lives once, in the Unified Marking Service. This is what actually delivers your requirement: mark via biometric → Manual Grid and QR session both show present immediately, because they're reading the same row, pushed to them by the same event.
7. Phase 5 — Notification De-duplication
Notifications are now triggered from the single outbox event, not from each adapter. This removes an entire class of bug where a student who is present via biometric would previously also fire a manual-adapter notification if a teacher's grid auto-refreshed and re-submitted the same row.
•	One event → one push to Student device + one push to Parent device (as today), sent once regardless of which channel produced the event.
•	The noop branch in Phase 2 (already-marked, lower-priority source) explicitly skips notification dispatch — re-scans and grid re-submits never spam a second alert.
 8. Phase 6 — Live Timetable Integration
‘Live’ timetable means the system always knows which period is happening right now for a given class/faculty, and attendance events are automatically tagged with that period — without the client having to look it up and pass it explicitly (which would be an extra API call per mark).
8.1 Current-period resolution, O(1) via cache
TimetableSlot already defines start/end boundaries per class per weekday. On server boot (and on any timetable edit), precompute a per-class, per-weekday sorted slot list into Redis: timetable:{classId}:{weekday} → [{slotId, start, end, subjectId, facultyId, isBreak}]. Resolving 'what period is it right now' becomes a cache read + binary search over a handful of slots — no DB round-trip on the attendance hot path.
function getCurrentPeriod(classId, now) {
  const slots = cache.get(`timetable:${classId}:${now.weekday}`);
  return slots.find(s => now >= s.start && now < s.end); // O(log n), n ≤ ~10
}
 
// inside markAttendance() when periodId is not supplied by the caller:
periodId = periodId || getCurrentPeriod(classId, now())?.slotId;
Key decision:  This is why zero Timetable schema changes are needed, exactly as your analysis concluded — Timetable + TimetableSlot already contain everything required; the only addition is a cache-backed lookup function, not new tables.
8.2 'Live Now' faculty & admin dashboards
•	Faculty App 'My Schedule' subscribes to the same WebSocket room as the class it's teaching right now — as students get marked (any channel), the live headcount updates on the faculty's screen with zero polling.
•	Admin HR Dashboard shows 'who is in class right now' by joining current-period lookups with today's Attendance rows — one indexed query, cached for the duration of the period (invalidated only on new attendance events for that class), not re-run per request.
•	Break periods (is_break: true) are automatically excluded from attendance prompts — the adapters check isBreak from the cached slot before allowing a mark, avoiding wasted writes.
8.3 Faculty period-wise attendance (in/out mode)
When the Institute-level in_out mode flag is on, the same markAttendance() call is simply invoked once per period boundary (period start → time_in, period end or next punch → time_out) instead of once per day, writing into FacultyPeriodAttendance with the identical dedupe/priority/push machinery. This is the one new table from your plan — it plugs into the existing engine rather than needing its own sync logic.
 9. Phase 7 — Performance & Scalability Checklist
Concern	Optimization	Effect
Duplicate writes across channels	Unique (student_id, date, period_id) index + upsert	Database-level guarantee, zero reconciliation jobs needed
Cross-screen sync speed	WebSocket room push instead of polling	0 extra API calls at steady state; < 200ms propagation
Bulk grid submit (30–100 students)	Single outer transaction, batched upsert	1 round trip instead of N; consistent under partial failure
Current-period lookup	Redis-cached per class/weekday slot list	O(1)/O(log n), no DB hit on the attendance hot path
Repeated/duplicate device pings	Idempotent noop branch on existing higher/equal-priority row	Cheap indexed SELECT instead of full write + notify cycle
Dashboard read load	Cache getAttendanceDashboard / getDashboardStats keyed by class+date, invalidated only by the outbox event	Dashboards stay live without re-querying on every open tab
Notification storms	Single outbox event per real state change drives notification dispatch	One push per actual change, never per channel
Biometric device bursts (entry rush)	Queue punches (processPendingPunches) and batch-flush through markAttendance in chunks	Smooths DB write spikes at peak entry times
10. Phase 8 — Unified API Surface
Endpoint	Channel(s)	Notes
POST /attendance/mark	Internal — called by all adapters	Not directly exposed to clients; the single choke point through the Unified Marking Service.
POST /attendance/manual/bulk	Manual Grid	Wraps N calls to the internal service in one transaction; one response for the whole grid.
POST /attendance/qr/session/start, POST /attendance/qr/scan	Smart QR	Unchanged signatures; scan now routes through the unified service.
POST /biometric/punch	Hardware	Unchanged; resolves punch → student/faculty → unified service call.
GET /attendance/grid?classId&date	Initial load / reconnect only	Steady-state updates come from WebSocket, not repeated GETs.
WS attendance:update (room-scoped)	All screens	Server-pushed; the actual cross-channel sync mechanism.
 11. Implementation Roadmap
Step	Deliverable	Depends on
1	Add unique compound indexes + version/source_meta columns to Attendance & FacultyAttendance	—
2	Build Unified Marking Service (markAttendance) with priority + idempotency logic	Step 1
3	Refactor Manual/QR/Biometric controllers into thin adapters calling the service	Step 2
4	Add outbox table/stream + single dispatcher (notification + cache invalidation + WS emit)	Step 2
5	Wire WebSocket rooms per class/faculty; switch Manual Grid & Faculty App off polling	Step 4
6	Build Redis-cached getCurrentPeriod() off existing TimetableSlot data	— (parallel)
7	Auto-tag attendance events with periodId via getCurrentPeriod when not explicit	Steps 2, 6
8	FacultyPeriodAttendance table + in_out mode toggle wired through the same service	Steps 2, 7
9	'Live Now' dashboards (Faculty + Admin HR) subscribing to WS rooms	Step 5
10	Load test: simulate biometric entry-rush + concurrent QR scans + manual grid edit on the same student	All above
12. Summary of Guarantees
•	Mark via any one of Manual, QR, or Biometric → the other two channels reflect ‘present’ within one push, with no duplicate row ever created (enforced at the DB level).
•	Exactly one notification per real state change, regardless of how many channels or screens are open.
•	Zero steady-state polling; cross-screen sync cost is one small WebSocket payload per event, not N periodic API calls.
•	Faculty Attendance and Live Timetable reuse the same engine and existing tables — no parallel systems to keep in sync with each other.
•	The only new schema is what your own analysis already identified (FacultyPeriodAttendance, gated by the Institute in_out flag) — this document adds the sync/priority/performance layer around it.
