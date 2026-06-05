import api from "./api";

// --- ADMIN ROUTES ---
export const getAllParents = async (search = "") => {
    const response = await api.get(`/parents?search=${search}`);
    return response.data;
};

export const createParent = async (parentData) => {
    const response = await api.post(`/parents`, parentData);
    return response.data;
};

// --- PARENT PORTAL ROUTES ---
export const getParentDashboard = async () => {
    const response = await api.get(`/parents/dashboard`);
    return response.data;
};

export const getLinkedStudentProfile = async (id) => {
    const response = await api.get(`/parents/student/${id}`);
    return response.data;
};

export const getLinkedStudentAttendance = async (id) => {
    const response = await api.get(`/parents/attendance/${id}`);
    return response.data;
};

export const getLinkedStudentResults = async (id) => {
    const response = await api.get(`/parents/results/${id}`);
    return response.data;
};

export const getLinkedStudentFees = async (id) => {
    const response = await api.get(`/parents/fees/${id}`);
    return response.data;
};

export const getClassNotes = async (classId) => {
    const response = await api.get(`/parents/notes/${classId}`);
    return response.data;
};

export const getLinkedStudentAssignments = async (id) => {
    const response = await api.get(`/assignments/parent/child/${id}`);
    return response.data;
};
