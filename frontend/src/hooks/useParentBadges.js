/**
 * useParentBadges — Minimal API call badge system for Parent Dashboard
 * ─────────────────────────────────────────────────────────────────────────────
 * Tracks notification badges for the Parent Dashboard Quick Actions.
 * Relies on the data already fetched by MobileDashboard.jsx (attendance, results, etc)
 * and uses localStorage to track what the parent has already "seen" for each child.
 *
 * Local storage keys are scoped to BOTH the parent and the specific child:
 *   parent_badge_cnt_{parentId}_{studentId}_{section}
 *
 * Strategy:
 *  ATTENDANCE (count-based):
 *    - Snapshot the total attendance records when parent views it.
 *    - Badge if current total > stored total.
 *
 *  MARKS / PERFORMANCE (timestamp-based):
 *    - Badge if any result's created_at or exam_date > last seen timestamp.
 *
 *  ASSIGNMENTS (live count):
 *    - Badge if there are any incomplete assignments.
 *
 *  FEES (live count):
 *    - Dot badge if there are any pending fees.
 *
 * Usage:
 *   const { badges, clearBadge, advanceAttendanceCount } = useParentBadges(
 *      attendance, results, assignments, fees, parentId, studentId
 *   );
 */

import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

// ── localStorage key factories ───────────────────────────────────────────────
const LSKey    = (parentId, studentId, section) => `parent_badge_seen_${parentId}_${studentId}_${section}`;
const LSCntKey = (parentId, studentId, section) => `parent_badge_cnt_${parentId}_${studentId}_${section}`;

function getLastSeen(parentId, studentId, section) {
    try {
        const raw = localStorage.getItem(LSKey(parentId, studentId, section));
        return raw ? new Date(raw).getTime() : 0;
    } catch { return 0; }
}

function getLastCount(parentId, studentId, section) {
    try {
        const raw = localStorage.getItem(LSCntKey(parentId, studentId, section));
        return raw !== null ? parseInt(raw, 10) : -1;
    } catch { return -1; }
}

function markSeen(parentId, studentId, section) {
    try {
        localStorage.setItem(LSKey(parentId, studentId, section), new Date().toISOString());
    } catch { }
}

function saveCount(parentId, studentId, section, count) {
    try {
        localStorage.setItem(LSCntKey(parentId, studentId, section), String(count));
    } catch { }
}

// ─────────────────────────────────────────────────────────────────────────────
export function useParentBadges(attendance, results, assignments, fees, parentId, studentId) {
    const [badges, setBadges] = useState({});
    const [serverCounts, setServerCounts] = useState({ chat: 0, announcements: 0 });

    // Fetch global counts (Chat / Announcements) that are not student-specific.
    // Parent chat uses standard unread-count. Announcements uses unread-count.
    useEffect(() => {
        if (!parentId) return;
        
        const fetchCounts = async () => {
            try {
                const [chatRes, annRes] = await Promise.all([
                    api.get('/chat/unread-count').catch(() => ({ data: { count: 0 } })),
                    api.get('/announcements/unread-count').catch(() => ({ data: { count: 0 } }))
                ]);
                
                setServerCounts({
                    chat: chatRes?.data?.count || 0,
                    announcements: annRes?.data?.count || annRes?.data?.data?.count || 0
                });
            } catch (err) { }
        };
        
        fetchCounts();
        // Option: we could poll this, but to minimize API calls as requested,
        // we'll just fetch once on mount/student switch.
    }, [parentId, studentId]);

    useEffect(() => {
        if (!parentId || !studentId) return;

        // ── Attendance (count-based snapshot) ──────────────────────────────────
        // parent_controller attendance returns records array. Total count = records.length.
        const currentAttTotal = Array.isArray(attendance?.records) ? attendance.records.length : 0;
        const storedAttCount  = getLastCount(parentId, studentId, 'attendance');

        let attendanceBadge = null;
        if (storedAttCount === -1) {
            saveCount(parentId, studentId, 'attendance', currentAttTotal);
        } else if (currentAttTotal > storedAttCount) {
            attendanceBadge = { count: currentAttTotal - storedAttCount, type: 'dot' };
        }

        // ── Marks & Performance (timestamp-based) ──────────────────────────────
        const lastSeenMarks = getLastSeen(parentId, studentId, 'marks');
        const safeResults = Array.isArray(results) ? results : [];
        const newMarks = safeResults.filter(r => {
            // Check exam date or created_at
            const d = r.Exam?.exam_date || r.created_at || r.updated_at;
            if (!d) return false;
            return new Date(d).getTime() > lastSeenMarks;
        }).length;

        const marksBadge = newMarks > 0 ? { count: newMarks, type: 'number' } : null;

        const lastSeenPerf = getLastSeen(parentId, studentId, 'performance');
        const perfBadge = newMarks > 0 && lastSeenPerf < lastSeenMarks
            ? { count: 1, type: 'dot' }
            : null;

        // ── Assignments ────────────────────────────────────────────────────────
        const lastSeenAssignments = getLastSeen(parentId, studentId, 'assignments');
        const safeAssignments = Array.isArray(assignments) ? assignments : [];
        const newPendingAsg = safeAssignments.filter(a => {
            // Count assignments not submitted
            const isPending = !a.my_submission || !['submitted', 'late', 'graded'].includes(a.my_submission.status);
            const dateStr = a.created_at || a.createdAt || a.publish_date || a.due_date;
            const isNew = dateStr ? new Date(dateStr).getTime() > lastSeenAssignments : true;
            return isPending && isNew;
        }).length;
        const assignmentsBadge = newPendingAsg > 0 ? { count: newPendingAsg, type: 'number' } : null;

        // ── Fees ───────────────────────────────────────────────────────────────
        const safeFees = Array.isArray(fees) ? fees : [];
        const hasPendingFees = safeFees.some(f => f.status === 'pending' || f.status === 'partial');
        const feesBadge = hasPendingFees ? { count: 1, type: 'dot' } : null;

        // ── Chat & Announcements ───────────────────────────────────────────────
        const chatBadge = serverCounts.chat > 0 ? { count: serverCounts.chat, type: 'number' } : null;
        const annBadge = serverCounts.announcements > 0 ? { count: serverCounts.announcements, type: 'number' } : null;

        setBadges({
            attendance: attendanceBadge,
            marks: marksBadge,
            performance: perfBadge,
            assignments: assignmentsBadge,
            fees: feesBadge,
            chat: chatBadge,
            announcements: annBadge
        });

    }, [attendance, results, assignments, fees, parentId, studentId, serverCounts]);

    const clearBadge = useCallback((section) => {
        if (!parentId || !studentId) return;

        markSeen(parentId, studentId, section);

        if (section === 'attendance') {
            setBadges(prev => {
                const badge = prev['attendance'];
                if (badge && badge.count) {
                    const existing = getLastCount(parentId, studentId, 'attendance');
                    saveCount(parentId, studentId, 'attendance', existing + badge.count);
                }
                const next = { ...prev };
                delete next['attendance'];
                return next;
            });
        } else {
            setBadges(prev => {
                if (!prev[section]) return prev;
                const next = { ...prev };
                delete next[section];
                return next;
            });
        }
    }, [parentId, studentId]);

    const advanceAttendanceCount = useCallback((currentTotal) => {
        if (!parentId || !studentId || currentTotal === undefined) return;
        saveCount(parentId, studentId, 'attendance', Number(currentTotal) || 0);
        setBadges(prev => {
            if (!prev.attendance) return prev;
            const next = { ...prev };
            delete next.attendance;
            return next;
        });
    }, [parentId, studentId]);

    return { badges, clearBadge, advanceAttendanceCount };
}

export function advanceParentAttendanceBadge(parentId, studentId, count) {
    if (!parentId || !studentId || count === undefined) return;
    try {
        localStorage.setItem(LSCntKey(parentId, studentId, 'attendance'), String(count));
    } catch { }
}

export function markParentAssignmentsSeen(parentId, studentId) {
    if (!parentId || !studentId) return;
    try {
        localStorage.setItem(LSKey(parentId, studentId, 'assignments'), new Date().toISOString());
    } catch { }
}

