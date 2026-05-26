/**
 * Frontend Announcement Service — Phase 5
 * Wraps all API endpoints for announcements.
 */
import api from "./api";

const announcementService = {
    // ── Student & Parent ──
    getInstituteAnnouncements: async () => {
        const res = await api.get("/announcements/institute");
        return res.data.data || [];
    },

    // ── Faculty ──
    getFacultyAnnouncements: async (type = "mine") => {
        // type: "mine" | "institute"
        const res = await api.get(`/announcements/faculty/${type}`);
        return res.data.data || [];
    },

    // ── Admin & Manager ──
    getAllAnnouncements: async (page = 1, limit = 50) => {
        const res = await api.get(`/announcements?page=${page}&limit=${limit}`);
        return res.data.data || { announcements: [], pagination: {} };
    },

    // ── CRUD ──
    createAnnouncement: async (data) => {
        const res = await api.post("/announcements", data);
        return res.data;
    },
    updateAnnouncement: async (id, data) => {
        const res = await api.put(`/announcements/${id}`, data);
        return res.data;
    },
    deleteAnnouncement: async (id) => {
        const res = await api.delete(`/announcements/${id}`);
        return res.data;
    },

    // ── Read Tracking ──
    getUnreadCount: async () => {
        const res = await api.get("/announcements/unread-count");
        return res.data.data || { count: 0, highest_priority: null };
    },
    markAsRead: async (id) => {
        const res = await api.post(`/announcements/${id}/read`);
        return res.data;
    },
    markAllAsRead: async () => {
        const res = await api.post("/announcements/mark-all-read");
        return res.data;
    },
};

export default announcementService;
