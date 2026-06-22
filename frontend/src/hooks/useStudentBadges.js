/**
 * useStudentBadges — Zero extra API calls
 * ─────────────────────────────────────────────────────────────────────────────
 * Derives notification badges for every Student app tab using ONLY the data
 * already fetched by useStudentDashboard (React Query cache).
 *
 * Strategy (localStorage-based count-snapshot tracking):
 *
 *  ATTENDANCE (count-based — most reliable):
 *    - Stores the attendance.total count when student last viewed the section.
 *    - Badge fires ONLY when the count INCREASES (faculty marked new attendance).
 *    - This correctly handles: student visits at 9AM, faculty marks at 9:15AM → badge.
 *    - clearBadge('attendance') saves the current count snapshot.
 *
 *  MARKS / PERFORMANCE (exam date timestamp):
 *    - Badge if any recentMarks have examDate newer than last-seen timestamp.
 *
 *  ASSIGNMENTS, CHAT, ANNOUNCEMENTS:
 *    - Driven directly by live server counts — no timestamp needed.
 *
 *  FEES:
 *    - Dot badge whenever pending fees exist (persistent reminder).
 *
 * Usage:
 *   const { badges, clearBadge } = useStudentBadges(dashboardData, userId);
 *   badges.attendance  // { count: 1, type: 'dot' } | null
 *   clearBadge('attendance');
 */

import { useState, useEffect, useCallback } from 'react';

// ── localStorage key factory ─────────────────────────────────────────────────
const LSKey    = (userId, section)  => `student_badge_seen_${userId}_${section}`;
const LSCntKey = (userId, section)  => `student_badge_cnt_${userId}_${section}`;

// ── Read last-seen ISO timestamp → ms epoch (0 if never) ─────────────────────
function getLastSeen(userId, section) {
    try {
        const raw = localStorage.getItem(LSKey(userId, section));
        return raw ? new Date(raw).getTime() : 0;
    } catch {
        return 0;
    }
}

// ── Read last-seen numeric count (for attendance / assignment tracking) ────────
function getLastCount(userId, section) {
    try {
        const raw = localStorage.getItem(LSCntKey(userId, section));
        return raw !== null ? parseInt(raw, 10) : -1; // -1 = never stored
    } catch {
        return -1;
    }
}

// ── Write "seen now" timestamp ─────────────────────────────────────────────────
function markSeen(userId, section) {
    try {
        localStorage.setItem(LSKey(userId, section), new Date().toISOString());
    } catch { /* private / quota — ignore */ }
}

// ── Snapshot the current numeric count for a section ─────────────────────────
export function advanceStudentAttendanceBadge(userId, count) {
    if (!userId || count === undefined) return;
    try {
        localStorage.setItem(LSCntKey(userId, 'attendance'), String(count));
    } catch { }
}

export function advanceStudentAssignmentsBadge(userId, count) {
    if (!userId || count === undefined) return;
    try {
        localStorage.setItem(LSCntKey(userId, 'assignments'), String(count));
    } catch { }
}

function saveCount(userId, section, count) {
    try {
        localStorage.setItem(LSCntKey(userId, section), String(count));
    } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────────
export function useStudentBadges(dashboardData, userId) {
    const [badges, setBadges] = useState({});

    useEffect(() => {
        if (!dashboardData || !userId) return;

        // ── Attendance — COUNT-BASED (fires when faculty adds new records) ─────
        //
        // Two localStorage keys per user:
        //   LSCntKey(userId, 'attendance')        ← written by this hook on first load
        //                                            OR by advanceAttendanceCount when
        //                                            student actually views the page.
        //
        // Detection:
        //   dashboardMonthTotal = attendance.total  (this month's records)
        //   storedCount         = last snapshot     (set to -1 on first ever open)
        //
        //   First load ever → save monthTotal, no badge.
        //   monthTotal > storedCount → faculty added records → show badge.
        //   monthTotal ≤ storedCount → nothing new.
        //
        const currentTotal = Number(dashboardData.attendance?.total) || 0;
        const storedCount  = getLastCount(userId, 'attendance');

        let attendanceBadge = null;
        if (storedCount === -1) {
            // Very first time this user opens the app — snapshot silently.
            saveCount(userId, 'attendance', currentTotal);
        } else if (currentTotal > storedCount) {
            // Faculty/admin added new attendance records since student last viewed!
            attendanceBadge = { count: currentTotal - storedCount, type: 'dot' };
        }
        // Equal or lower → no change, no badge.

        // ── Marks (exams) — TIMESTAMP-BASED ──────────────────────────────────
        const lastSeenMarks = getLastSeen(userId, 'exams');
        const newMarks = (dashboardData.recentMarks || []).filter(m => {
            if (!m.examDate) return false;
            return new Date(m.examDate).getTime() > lastSeenMarks;
        }).length;
        const marksBadge = newMarks > 0
            ? { count: newMarks, type: 'number' }
            : null;

        // ── Assignments — COUNT-SNAPSHOT (since we only have numeric count) ─────
        const pendingAssignments = dashboardData.pendingAssignments || 0;
        const storedAsgCount = getLastCount(userId, 'assignments');
        
        let assignmentsBadge = null;
        if (storedAsgCount === -1) {
             saveCount(userId, 'assignments', pendingAssignments);
        } else if (pendingAssignments > storedAsgCount) {
             assignmentsBadge = { count: pendingAssignments - storedAsgCount, type: 'number' };
        }

        // ── Fees — persistent dot whenever fees are due ───────────────────────
        const hasPendingFees = dashboardData.fees?.hasPendingFees;
        const feesBadge = hasPendingFees
            ? { count: 1, type: 'dot' }
            : null;

        // ── Chat — LIVE SERVER COUNT ──────────────────────────────────────────
        const unreadChat = Number(dashboardData.unreadChatCount) || 0;
        const chatBadge  = unreadChat > 0
            ? { count: unreadChat, type: 'number' }
            : null;

        // ── Announcements — LIVE SERVER COUNT ─────────────────────────────────
        const unreadAnn         = Number(dashboardData.unreadAnnouncementsCount) || 0;
        const announcementsBadge = unreadAnn > 0
            ? { count: unreadAnn, type: 'number' }
            : null;

        // ── Performance — follows marks badge ─────────────────────────────────
        const lastSeenPerf = getLastSeen(userId, 'performance');
        const lastSeenMarksTs = getLastSeen(userId, 'exams');
        const perfBadge = newMarks > 0 && lastSeenPerf < lastSeenMarksTs
            ? { count: 1, type: 'dot' }
            : null;

        setBadges({
            attendance:    attendanceBadge,
            exams:         marksBadge,
            assignments:   assignmentsBadge,
            fees:          feesBadge,
            chat:          chatBadge,
            announcements: announcementsBadge,
            performance:   perfBadge,
        });

    }, [dashboardData, userId]);

    /**
     * clearBadge(tabId)
     * Call this when the user navigates to a section.
     * - Writes "seen now" timestamp  → clears timestamp-based badges.
     * - For attendance: saves the current total count → next badge only fires
     *   when faculty marks MORE records.
     */
    const clearBadge = useCallback((tabId) => {
        if (!userId) return;

        // Always stamp the timestamp
        markSeen(userId, tabId);

        // For attendance: snapshot the current total so we only badge on *new* additions
        if (tabId === 'attendance') {
            setBadges(prev => {
                const badge = prev['attendance'];
                if (badge && badge.count) {
                    const existing = getLastCount(userId, 'attendance');
                    saveCount(userId, 'attendance', existing + badge.count);
                }
                const next = { ...prev };
                delete next['attendance'];
                return next;
            });
        } else if (tabId === 'assignments') {
            setBadges(prev => {
                const badge = prev['assignments'];
                if (badge && badge.count) {
                    const existing = getLastCount(userId, 'assignments') === -1 ? 0 : getLastCount(userId, 'assignments');
                    saveCount(userId, 'assignments', existing + badge.count);
                }
                const next = { ...prev };
                delete next['assignments'];
                return next;
            });
        } else {
            setBadges(prev => {
                if (!prev[tabId]) return prev;
                const next = { ...prev };
                delete next[tabId];
                return next;
            });
        }
    }, [userId]);

    /**
     * advanceAttendanceCount(currentTotal)
     * Call this from the attendance page after data loads, so the snapshot
     * is always accurate to what the student actually SAW.
     */
    const advanceAttendanceCount = useCallback((currentTotal) => {
        if (!userId || currentTotal === undefined) return;
        saveCount(userId, 'attendance', Number(currentTotal) || 0);
        setBadges(prev => {
            if (!prev.attendance) return prev;
            const next = { ...prev };
            delete next.attendance;
            return next;
        });
    }, [userId]);

    return { badges, clearBadge, advanceAttendanceCount };
}
