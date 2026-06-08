/**
 * managerPresets.js
 * Central configuration for the 6 Manager Type presets.
 *
 * MANAGER_TYPES  — UI metadata: label, emoji, colors, descriptions
 * MANAGER_PRESETS — pre-selected permissions per type
 *
 * Permission keys MUST match the 'val' fields used in ManageAdmins.jsx:
 *   CRUD_MODULES : students, faculty, classes, subjects, fees, expenses
 *   TOGGLE_MODULES: notes, chat, attendance, reports, announcements,
 *                   exams, collect_fees, recent_payments, transport,
 *                   parents, biometric, finance, assignments
 *
 * The preset system only pre-checks boxes for convenience.
 * Admin can still override any permission after selecting a type.
 */

// ── Type metadata (UI colors, label, emoji, description) ─────────────────────
export const MANAGER_TYPES = [
    {
        id: 'fees',
        label: 'Fees Manager',
        emoji: '💰',
        color: '#16A34A',
        bg: '#F0FDF4',
        border: '#BBF7D0',
        description: 'Fee collection, expenses, transport',
    },
    {
        id: 'data',
        label: 'Data Manager',
        emoji: '📊',
        color: '#2563EB',
        bg: '#EFF6FF',
        border: '#BFDBFE',
        description: 'Students, faculty, classes, subjects',
    },
    {
        id: 'academic',
        label: 'Academic Manager',
        emoji: '📚',
        color: '#7C3AED',
        bg: '#F5F3FF',
        border: '#DDD6FE',
        description: 'Exams, attendance, assignments',
    },
    {
        id: 'ops',
        label: 'Operations Manager',
        emoji: '⚙️',
        color: '#D97706',
        bg: '#FFFBEB',
        border: '#FDE68A',
        description: 'Day-to-day operations, transport',
    },
    {
        id: 'hr',
        label: 'HR Manager',
        emoji: '👥',
        color: '#0D9488',
        bg: '#F0FDFA',
        border: '#99F6E4',
        description: 'Faculty HR, attendance, parents',
    },
    {
        id: 'custom',
        label: 'Custom Manager',
        emoji: '🎛️',
        color: '#DB2777',
        bg: '#FDF2F8',
        border: '#FBCFE8',
        description: 'Manually select all permissions',
    },
];

// ── Pre-selected permissions per type ────────────────────────────────────────
// crudPerms  → array of permission strings (e.g. 'students.read', 'fees.create')
// togglePerms → array of toggle module keys (e.g. 'finance', 'attendance')
//
// These exactly match the CRUD_MODULES val + TOGGLE_MODULES val in ManageAdmins.jsx
export const MANAGER_PRESETS = {
    // ── 💰 Fees Manager ────────────────────────────────────────────────────────
    // Full CRUD: fee structure, expenses, transport
    // Read-only: parents (for contact), finance dashboard (limited view)
    // Feature toggles: collect fees, recent payments, finance dashboard, notes
    fees: {
        crudPerms: [
            'fees.create', 'fees.read', 'fees.update', 'fees.delete',
            'expenses.create', 'expenses.read', 'expenses.update', 'expenses.delete',
        ],
        togglePerms: [
            'collect_fees',
            'recent_payments',
            'finance',    // limited view — backend enforces restriction
            'notes',
            'transport',  // transport as a toggle for fee context
            'parents',    // read-only contact reference (toggle, no CRUD)
        ],
    },

    // ── 📊 Data Manager ─────────────────────────────────────────────────────
    // Full CRUD: students, faculty, classes, subjects, parents
    // Feature toggles: reports & analytics, notes
    // NO financial access whatsoever
    data: {
        crudPerms: [
            'students.create', 'students.read', 'students.update', 'students.delete',
            'faculty.create',  'faculty.read',  'faculty.update',  'faculty.delete',
            'classes.create',  'classes.read',  'classes.update',  'classes.delete',
            'subjects.create', 'subjects.read', 'subjects.update', 'subjects.delete',
        ],
        togglePerms: [
            'parents',
            'reports',
            'notes',
        ],
    },

    // ── 📚 Academic Manager ───────────────────────────────────────────────────
    // Limited read: students (reference), classes (reference)
    // Full CRUD: exams, assignments, announcements
    // Feature toggles: attendance, reports, academic chats, notes
    // NO financial access
    academic: {
        crudPerms: [
            'students.read',                                            // read only
            'classes.read',                                             // read only
            'timetable.create',   'timetable.read',   'timetable.update',  'timetable.delete',
            'exams.create',       'exams.read',       'exams.update',  'exams.delete',
            'assignments.create', 'assignments.read', 'assignments.update', 'assignments.delete',
            'announcements.create','announcements.read','announcements.update','announcements.delete',
        ],
        togglePerms: [
            'attendance',
            'reports',
            'chat',
            'notes',
        ],
    },

    // ── ⚙️ Operations Manager ──────────────────────────────────────────────────
    // Full CRUD: transport, announcements
    // Partial: parents (Create/Read/Update, no Delete)
    // Feature toggles: attendance, biometric, collect_fees (basic), notes, reports
    ops: {
        crudPerms: [
            'transport.create', 'transport.read', 'transport.update', 'transport.delete',
            'announcements.create','announcements.read','announcements.update','announcements.delete',
        ],
        togglePerms: [
            'attendance',
            'biometric',
            'collect_fees',
            'parents',
            'reports',
            'notes',
        ],
    },

    // ── 👥 HR Manager ─────────────────────────────────────────────────────────
    // Full CRUD: faculty, announcements
    // Read: students (context), recent payments (salary reference)
    // Partial: parents (Create/Read/Update, no Delete)
    // Feature toggles: attendance, recent_payments, reports, notes
    hr: {
        crudPerms: [
            'faculty.create', 'faculty.read', 'faculty.update', 'faculty.delete',
            'salary.create', 'salary.read', 'salary.update', 'salary.delete',
            'students.read',                                      // read only
            'announcements.create','announcements.read','announcements.update','announcements.delete',
        ],
        togglePerms: [
            'attendance',
            'recent_payments',
            'reports',
            'notes',
            'parents',
        ],
    },

    // ── 🎛️ Custom Manager ────────────────────────────────────────────────────
    // No presets — admin picks everything from scratch
    custom: {
        crudPerms: [],
        togglePerms: [],
    },
};

/**
 * buildPermissionsFromPreset(typeId)
 * Given a manager type ID, returns the full flat permissions array
 * that matches the format used by ManageAdmins.jsx
 * (same as formData.permissions — array of strings)
 */
export function buildPermissionsFromPreset(typeId) {
    const preset = MANAGER_PRESETS[typeId];
    if (!preset) return [];
    return [...(preset.crudPerms || []), ...(preset.togglePerms || [])];
}
