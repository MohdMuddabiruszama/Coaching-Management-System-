This is a great next step — it naturally extends the period-attendance model I proposed for faculty. The key insight: "Live Timetable" isn't a new attendance system — it's a real-time read-layer on top of the same period-based attendance data, plus a live/historical dual-mode view. Let me break down the full architecture.
Conceptual model first
Three states of the same data, viewed differently:

Live view — "what's happening right now" (today, current period, running counts)
Drill-down view — click a subject → full roster with in/out
Historical view — class → date → subject → same roster, just not "live"

Critical design decision: views 2 and 3 should be the exact same endpoint. A subject on a specific date is a specific timetable_entry_id + date combination — whether that date is today or last week is irrelevant to the query shape. This alone cuts your API surface roughly in half.

Schema additions
You'll need a student-side twin of the FacultyPeriodAttendance table I described earlier — because "how many students are live in this class" is inherently period-level, not daily.
StudentPeriodAttendance {
  id
  student_id
  timetable_entry_id   -- FK → Timetable (has class, subject, faculty, room, slot, day)
  date
  time_in       NULLABLE
  time_out      NULLABLE
  status ENUM('present','absent','late')  -- auto-computed
  marked_by_type ENUM('qr','biometric','manual')

  UNIQUE (student_id, timetable_entry_id, date)
}
FacultyPeriodAttendance {   -- from earlier design, reused as-is
  ...
  UNIQUE (faculty_id, timetable_entry_id, date)
}
Indexes that matter for speed:

(timetable_entry_id, date) on both tables — this is your hot path for "count students/faculty in this period today"
Composite covers both the live aggregate query and the drill-down query

No new table for "live status" — see next section on why.

Endpoint 1 — The Live Board (today's overview)
GET /live-timetable?class_id=X&date=YYYY-MM-DD (date defaults to today)
Returns one row per period, aggregated:
json{
  "period_1": {
    "subject": "Economics", "faculty": "Rohit Mehta", "room": "101",
    "start": "07:00", "end": "08:00",
    "is_live": false,
    "faculty_status": "in",
    "students_present": 28, "students_total": 32
  },
  "period_2": { ..., "is_live": true, ... }
}
Why this is fast:

is_live is computed at read-time (now BETWEEN slot.start AND slot.end), not stored. No cron job needed to flip statuses, no write amplification, no stale data risk.
students_present / faculty_status come from one aggregate query with COUNT() + GROUP BY timetable_entry_id, hitting your indexed columns — cheap even at scale.
This single call renders your entire live board. No per-period follow-up calls.

Refresh strategy (real-time counts updating live):
This is the one place I'd flag a decision for you — two options:
OptionHowTradeoffWebSocket push (recommended)On every markAttendanceByStudentQR / receivePunch, emit a scoped event (class:{id}:live) with just the delta ({period_id, students_present: 29})True real-time, near-zero API calls after initial load, but needs Socket.io/similar in your stackSmart polling fallbackFrontend polls Endpoint 1 every 20–30sSimpler, no new infra, but not instant and slightly more server load
Since your aggregate query is already cheap (indexed COUNT), polling won't hurt you even at fallback — but if you're open to it, WebSocket turns this into genuinely "live" behavior with a fraction of the calls. Do you already have Socket.io or similar set up anywhere in your stack, or would you rather I design this around polling to keep things simpler?

Endpoint 2 — Drill-down (click a subject → serves both live AND historical)
GET /live-timetable/entry/:timetable_entry_id?date=YYYY-MM-DD
json{
  "subject": "Economics", "room": "101",
  "faculty": { "name": "Rohit Mehta", "time_in": "06:58", "time_out": null },
  "students": [
    { "name": "Aarav Shah", "time_in": "07:02", "time_out": null, "status": "present" },
    { "name": "Diya Patel", "time_in": null, "time_out": null, "status": "absent" }
  ]
}
This one query serves:

Live drill-down (admin clicks a currently-running period → time_out fields naturally show null until class ends)
Historical drill-down (admin picks class → date → subject in the past → same shape, fully populated)

Your flow "select class → select date → select subject → show records" maps directly to this endpoint — no separate historical API needed.

"Class closed" logic — the one thing needing a rule
You need a clear definition of when out-times populate. Two clean options, and I'd combine them:

Auto-close (default): the moment now > slot.end_time, the drill-down and live board treat the period as closed. Anyone who checked in but never punched out gets time_out backfilled to slot.end_time (or flagged left_early/incomplete if you want stricter accuracy) via a lightweight batch job that runs once at day-end — not per-second, so no performance cost.
Manual close (optional, mirrors your existing Smart QR Session pattern): faculty's app gets an "End Session" button — same shape as startSmartSession you already built — which immediately punches out everyone still marked in. Nice UX parity with what you already have, and instant instead of waiting for the batch job.

I'd implement #1 as the safety net and #2 as the polish — but #1 alone is enough to ship correctly.

Performance checklist for this feature specifically
ConcernSolutionLive board must be fast on every loadSingle aggregate query, indexed (timetable_entry_id, date)Avoid recomputing "is it live" via storageComputed at read-time from slot times, zero writesAvoid N+1 calls for period countsOne GROUP BY query, not one call per periodAvoid duplicate live/historical endpointsSame drill-down endpoint serves both — date param is the only differenceReal-time count updatesWebSocket delta push (preferred) or cheap indexed polling (fallback)Auto-closing stale sessionsEnd-of-day batch job, not continuous polling

One more small thing worth confirming: for the student "live" count, do you want it to reflect only QR/biometric self-check-ins in real time, or should admin's manual grid marking (markBulkAttendance) also count toward the live number if a teacher marks attendance mid-class? This affects whether the live count needs to react to two different write paths or just one.