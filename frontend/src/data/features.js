export const FEATURES = [
  // ── Starter Plan Features (12) ──
  { id: 1, icon: '👔', title: 'Manage Admins / Managers', desc: 'Create, assign roles, and manage accounts with granular permissions.', roles: ['admin'], plan: 'Starter+', color: 'var(--lp-blue)' },
  { id: 2, icon: '👨‍🎓', title: 'Manage Students', desc: 'Complete profiles, enrollment, batch assignment, academic records.', roles: ['admin', 'faculty'], plan: 'Starter+', color: 'var(--lp-violet)' },
  { id: 3, icon: '📝', title: 'Manage Student Attendance', desc: 'Take attendance daily with precise roll-call mechanisms.', roles: ['faculty'], plan: 'Starter+', color: 'var(--lp-green)' },
  { id: 4, icon: '📊', title: 'View Attendance Reports', desc: 'Deep dive into absentee trends and overall percentages.', roles: ['admin', 'faculty'], plan: 'Starter+', color: 'var(--lp-amber)' },
  { id: 5, icon: '📲', title: 'Scan Student QR Code', desc: 'Quickly mark present using mobile QR scanner.', roles: ['faculty'], plan: 'Starter+', color: 'var(--lp-cyan)' },
  { id: 6, icon: '🏫', title: 'Manage Classes', desc: 'Define classrooms, seat limits, and physical arrangements.', roles: ['admin'], plan: 'Starter+', color: 'var(--lp-rose)' },
  { id: 7, icon: '📚', title: 'Manage Subjects', desc: 'Syllabus alignment and dynamic subject associations.', roles: ['admin'], plan: 'Starter+', color: 'var(--lp-emerald)' },
  { id: 8, icon: '🎓', title: 'Manage Faculty', desc: 'Onboard teachers and assign them robust daily schedules.', roles: ['admin'], plan: 'Starter+', color: 'var(--lp-purple)' },
  { id: 9, icon: '📢', title: 'Manage Announcements', desc: 'Instant push notices to active users.', roles: ['admin', 'faculty'], plan: 'Starter+', color: 'var(--lp-violet)' },
  { id: 10, icon: '📞', title: 'Manage Enquiries', desc: 'Track leads and incoming queries effectively.', roles: ['admin'], plan: 'Starter+', color: 'var(--lp-blue)' },
  { id: 11, icon: '📥', title: 'Export Data to Excel', desc: 'Download CSV reports for off-platform analysis.', roles: ['admin'], plan: 'Starter+', color: 'var(--lp-teal)' },
  { id: 12, icon: '🪙', title: 'Manage Expenses', desc: 'Log bills, rent, internet plans with cashflow graphs.', roles: ['admin'], plan: 'Starter+', color: 'var(--lp-red)' },

  // ── Basic Plan Features (+6) ──
  { id: 13, icon: '👆', title: 'Auto Attendance', desc: 'Hands-free attendance marking via Biometric/RFID devices.', roles: ['admin', 'faculty'], plan: 'Basic+', color: 'var(--lp-green)' },
  { id: 14, icon: '💳', title: 'Basic Fees Management', desc: 'Generate receipts, send reminders, collect installments.', roles: ['admin'], plan: 'Basic+', color: 'var(--lp-indigo)' },
  { id: 15, icon: '🗓️', title: 'Master Timetable', desc: 'Conflict-free robust weekly scheduling for everyone.', roles: ['admin', 'faculty'], plan: 'Basic+', color: 'var(--lp-blue)' },
  { id: 16, icon: '⏱️', title: 'Faculty Attendance', desc: 'Track clock-in, clock-out and leaves dynamically.', roles: ['faculty'], plan: 'Basic+', color: 'var(--lp-teal)' },
  { id: 17, icon: '📅', title: 'View Faculty Tracker', desc: 'Monitor the exact workload and performance metrics.', roles: ['admin'], plan: 'Basic+', color: 'var(--lp-fuchsia)' },
  { id: 18, icon: '💬', title: 'WhatsApp Alerts', desc: 'Direct WhatsApp integration for critical notifications.', roles: ['admin', 'parent'], plan: 'Basic+', color: 'var(--lp-emerald)' },

  // ── Professional Plan Features (+5) ──
  { id: 19, icon: '💼', title: 'Advanced Finance', desc: 'Detailed accounting, ledgers, and comprehensive financial reports.', roles: ['admin'], plan: 'Professional+', color: 'var(--lp-pink)' },
  { id: 20, icon: '💸', title: 'Salary & Payroll', desc: 'Manage faculty salaries, deductions, and pay slips automatically.', roles: ['admin'], plan: 'Professional+', color: 'var(--lp-violet)' },
  { id: 21, icon: '🏢', title: 'Multi-branch Management', desc: 'Control multiple institute locations from a single dashboard.', roles: ['admin'], plan: 'Professional+', color: 'var(--lp-rose)' },
  { id: 22, icon: '🔒', title: 'Biometric Integration', desc: 'Direct API integration with enterprise biometric hardware.', roles: ['admin'], plan: 'Professional+', color: 'var(--lp-cyan)' },
  { id: 23, icon: '🧠', title: 'Performance Hub & Analytics', desc: 'AI-driven weak spots and improvement suggestions.', roles: ['admin', 'student', 'analytics'], plan: 'Professional+', color: 'var(--lp-blue)' },

  // ── Enterprise Plan Features (+3) ──
  { id: 24, icon: '🌐', title: 'Custom Domain & Branding', desc: 'Host on your own domain with full white-labeling.', roles: ['admin'], plan: 'Enterprise', color: 'var(--lp-orange)' },
  { id: 25, icon: '🌐', title: 'Public Registration Page', desc: 'Beautiful SEO-friendly site for your institute to accept admissions.', roles: ['admin'], plan: 'Enterprise', color: 'var(--lp-rose)' },
  { id: 26, icon: '🔌', title: 'Open API Access', desc: 'Connect our software with your existing enterprise systems.', roles: ['admin'], plan: 'Enterprise', color: 'var(--lp-teal)' },
];

export const ROLES = ['all', 'admin', 'faculty', 'student', 'parent', 'analytics'];
