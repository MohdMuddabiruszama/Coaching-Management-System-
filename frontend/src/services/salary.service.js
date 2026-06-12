/**
 * Salary Service — Frontend
 * Phase 10.1 — Faculty Salary.md
 * All API calls for salary management (admin) and my-slips (faculty)
 */
import api from "./api";

const salaryService = {
    // ── Admin: Salary Records ─────────────────────────────────────────────
    getAll: (params) =>
        api.get("/salary", { params }).then(r => r.data),

    getReport: (params) =>
        api.get("/salary/report", { params }).then(r => r.data),

    create: (data) =>
        api.post("/salary", data).then(r => r.data),

    update: (id, data) =>
        api.put(`/salary/${id}`, data).then(r => r.data),

    markPaid: (id, data) =>
        api.put(`/salary/${id}/pay`, data).then(r => r.data),

    delete: (id) =>
        api.delete(`/salary/${id}`).then(r => r.data),

    // ── Salary Slip PDF Download (streaming) ─────────────────────────────
    downloadSlip: async (id, fileName) => {
        const res = await api.get(`/salary/${id}/slip`, { responseType: "blob" });
        const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
        const a   = document.createElement("a");
        a.href    = url;
        a.download = fileName || `salary_slip_${id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    // ── Salary Settings (base salary per faculty) ─────────────────────────
    getSettings: () =>
        api.get("/salary/settings").then(r => r.data),

    upsertSettings: (data) =>
        api.post("/salary/settings", data).then(r => r.data),

    deleteSettings: (faculty_id) =>
        api.delete(`/salary/settings/${faculty_id}`).then(r => r.data),

    // ── Admin: manual auto-generate ───────────────────────────────────────
    generateMonth: (month_year) =>
        api.post("/salary/admin/generate-month", { month_year }).then(r => r.data),

    // ── Faculty: own paid salary slips ────────────────────────────────────
    getMySlips: () =>
        api.get("/salary/my-slips").then(r => r.data),
};

export default salaryService;
