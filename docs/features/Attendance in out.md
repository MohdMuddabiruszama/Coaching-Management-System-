Good — I read through your architecture doc. This is a clean ask: you want an attendance capture mode toggle ("Full Time Record" vs "In-Out Timing") that applies to both Student and Faculty attendance, with the faculty version tied to timetable slots (since faculty attendance is period-based, not just daily). Here's the professional, low-overhead way to build this.
Core design principle
Don't build two parallel systems. Build one flexible schema driven by a single mode flag, so you don't duplicate CRUD logic, don't double your API surface, and don't fragment your reports. This is what keeps API calls and complexity minimal.

Phase 1 (Modified): Student Attendance
Schema change — no new table needed
Your time_in/time_out fields already exist (from biometric). Just add a mode flag:
InstituteSettings (or ClassSettings for per-class override) {
  id
  institute_id
  class_id (nullable → null means institute-wide default)
  student_attendance_mode: ENUM('simple', 'in_out')  -- the slider
  updated_by, updated_at
}
StudentAttendance {
  ...existing fields...
  time_in        NULLABLE
  time_out       NULLABLE
  mode_snapshot  ENUM('simple','in_out')  -- freeze the mode at time of marking
}
Why mode_snapshot matters: if admin flips the toggle mid-term, old records shouldn't visually break or get misinterpreted in reports. Each row remembers what mode it was created under.
Behavior

Simple mode: markBulkAttendance just needs status (present/absent/late/half_day/holiday). time_in/time_out stay null — exactly like 7/8/2026, 9:35 PM, Present you described.
In-Out mode: same endpoint, same payload shape — just now time_in is required and time_out optional (fills when they leave, via biometric/QR or manual). Status can be auto-derived: late if time_in > slot_start + grace, absent if no punch by cutoff.

API impact: zero new endpoints

markBulkAttendance stays as-is; validate server-side whether time fields are required based on the active mode (never trust the frontend toggle state).
Embed the current mode inside the response of whatever screen loads attendance (getAttendanceDashboard / grid fetch) — don't make the frontend fire a separate "get mode" call. One less round trip.
Toggle itself: one endpoint, PATCH /settings/attendance-mode, updates the row and invalidates cache.


Phase 2 (Modified): Faculty Attendance — tied to Timetable
This is the part that actually needs new structure, because faculty attendance in "in-out" mode isn't one row per day — it's one row per timetable period (2 PM class ≠ 4 PM class, each has its own entry/exit).
New table (only used when faculty mode = in_out)
FacultyPeriodAttendance {
  id
  faculty_id
  timetable_entry_id   -- FK to Timetable (links slot, class, subject, day)
  date
  scheduled_start       -- pulled from linked TimetableSlot
  scheduled_end
  actual_time_in
  actual_time_out
  status ENUM('present','late','left_early','absent')  -- auto-computed
  marked_by_type ENUM('biometric','qr','manual')
}

Simple mode keeps using your existing daily FacultyAttendance table untouched — no migration risk, no breaking changes.
In-Out mode activates this new table. Your existing Payroll/Salary engine can still work off a daily rollup (see below) so FacultySalarySettings logic doesn't need to change.

The key engineering move: auto-resolve punches to periods
When receivePunch fires from a biometric device for a faculty member:

Look up today's timetable for that faculty (cache this in memory/Redis per faculty per day — one query per day, not per punch).
Match punch timestamp to the slot whose window it falls into (with a grace buffer, e.g. ±10 min).
Upsert actual_time_in or actual_time_out on that period's row.

This means zero manual marking calls for the common case — punches self-route to the correct class period automatically. That's your speed win.
Daily rollup for payroll (no schema change to Salary engine)
Run either as a lightweight scheduled job (nightly) or as an on-read aggregation query:
day_status = if periods_attended / periods_scheduled >= threshold → 'present'
             else partial/absent, based on your policy
Feed that single derived value into the existing FacultySalarySettings logic — payroll code stays untouched.

Phase 3: Timetable — no changes needed
Your slot/entry architecture already gives Phase 2 everything it needs (TimetableSlot start/end, Timetable entry linking faculty+class+subject+day). This is exactly why the period-attendance design above is cheap to build — you're referencing existing data, not duplicating it.

The toggle button (UI)
A single segmented/slide switch on the Attendance settings screen:
[ Full Time Record ] ⟷ [ In - Out Timing ]

On flip → one PATCH call → update local state immediately → re-render attendance grid columns (show/hide In/Out) client-side, no refetch needed.
Keep it available at institute level (default) with an optional per-class override, since some batches may want simple daily marking while others (e.g., hostel or younger classes) want strict in-out.


Performance / minimum-complexity checklist
ConcernSolutionAvoid extra API call to check modeEmbed mode flag in existing dashboard/grid response payloadAvoid DB hit on every attendance loadCache institute:{id}:attendance_mode in Redis, invalidate on toggleAvoid slow punch-to-period matchingCache today's timetable per faculty in memory once per day, not per punchAvoid breaking historical reportsmode_snapshot column freezes context per recordAvoid touching payroll logicRollup derived daily status feeds existing Salary engine unchangedAvoid duplicate marking endpointsSingle markBulkAttendance / receivePunch handles both modes, branching only on validationIndexingComposite index (student_id, date) and (faculty_id, date, timetable_entry_id) for fast reads
Rollout (non-breaking)

Add nullable columns/tables (no downtime).
Default every institute's mode to 'simple' — zero behavior change on deploy day.
Ship the toggle UI behind a feature flag, enable per-institute as they opt in.
Backfill mode_snapshot = 'simple' on existing rows.


If you want, I can write out the actual markBulkAttendance and receivePunch controller logic (with the mode branching and punch-to-slot resolver) in Node/Express + your existing schema style — just tell me which stack (Express/Mongoose vs Sequelize/SQL) you're using so I match your existing files.