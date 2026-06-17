/**
 * useMobileDashboard — Phase 2D
 * ─────────────────────────────────────────────────────────────────────────────
 * React Query hooks for all three bundled mobile dashboard endpoints.
 *
 * Each hook:
 *  - Fetches from /api/mobile/{role}/dashboard (single bundled call)
 *  - Caches for 5 minutes (staleTime) — navigating away & back = zero extra calls
 *  - Returns { data, isLoading, isError, refetch } — standard React Query shape
 *
 * Import pattern:
 *   import { useStudentDashboard } from '../hooks/useMobileDashboard';
 *   const { data, isLoading } = useStudentDashboard();
 *   const dashboard = data?.data; // unwrap the { success, data } envelope
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../services/api";

// ─── Query Keys (centralised so invalidation is easy) ─────────────────────────
export const MOBILE_QUERY_KEYS = {
    studentDashboard: ["mobile", "student", "dashboard"],
    facultyDashboard: ["mobile", "faculty", "dashboard"],
    parentDashboard:  ["mobile", "parent",  "dashboard"],
};

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT
// ─────────────────────────────────────────────────────────────────────────────
const fetchStudentDashboard = () =>
    api.get("/mobile/student/dashboard").then(r => r.data);

/**
 * React Query hook — Student mobile dashboard.
 * Automatically cached for 5 minutes.
 */
export function useStudentDashboard(options = {}) {
    return useQuery({
        queryKey: MOBILE_QUERY_KEYS.studentDashboard,
        queryFn:  fetchStudentDashboard,
        staleTime: 5 * 60 * 1000,
        ...options,
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// FACULTY
// ─────────────────────────────────────────────────────────────────────────────
const fetchFacultyDashboard = () =>
    api.get("/mobile/faculty/dashboard").then(r => r.data);

/**
 * React Query hook — Faculty mobile dashboard.
 */
export function useFacultyDashboard(options = {}) {
    return useQuery({
        queryKey: MOBILE_QUERY_KEYS.facultyDashboard,
        queryFn:  fetchFacultyDashboard,
        staleTime: 5 * 60 * 1000,
        ...options,
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// PARENT
// ─────────────────────────────────────────────────────────────────────────────
const fetchParentDashboard = () =>
    api.get("/mobile/parent/dashboard").then(r => r.data);

/**
 * React Query hook — Parent mobile dashboard.
 */
export function useParentDashboard(options = {}) {
    return useQuery({
        queryKey: MOBILE_QUERY_KEYS.parentDashboard,
        queryFn:  fetchParentDashboard,
        staleTime: 5 * 60 * 1000,
        ...options,
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UTILITY — Invalidate all mobile caches (call on logout or role change)
// ─────────────────────────────────────────────────────────────────────────────
export function useInvalidateMobileDashboards() {
    const queryClient = useQueryClient();
    return () => {
        queryClient.invalidateQueries({ queryKey: ["mobile"] });
    };
}
