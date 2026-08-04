// backend/utils/audit.js
// ─── Audit Log Helper ─────────────────────────────────────────────────────────
// Fire-and-forget function to log any critical action in ZenithFlows.
// Call from any controller after a critical operation.
// Never throws — audit logging must NEVER crash the main operation.
// ZenithFlows — Enterprise DB Safety Architecture (Phase 4)

const { AuditLog } = require('../models');

/**
 * Log a critical action to the audit_logs table.
 *
 * @param {Object} opts
 * @param {import('express').Request} opts.req  - Express request (for user info + IP)
 * @param {string}  opts.action      - e.g. 'student.delete', 'fee.payment', 'exam.lock'
 * @param {string}  opts.entity_type - e.g. 'Student', 'Fee', 'Exam', 'Institute'
 * @param {number}  [opts.entity_id] - PK of the affected row
 * @param {Object}  [opts.old_value] - Full row data BEFORE the change
 * @param {Object}  [opts.new_value] - Full row data AFTER the change
 * @param {string}  [opts.remarks]   - Optional human note
 *
 * @example
 * // In any controller:
 * auditLog({
 *   req,
 *   action:      'student.soft_delete',
 *   entity_type: 'Student',
 *   entity_id:   student.id,
 *   old_value:   student.toJSON(),
 *   new_value:   { deleted_at: new Date() },
 *   remarks:     `Soft deleted by ${req.user.role}`,
 * });
 */
async function auditLog({ req, action, entity_type, entity_id, old_value, new_value, remarks }) {
  try {
    const user = req?.user || {};
    await AuditLog.create({
      institute_id: user.institute_id || null,
      user_id:      user.id           || null,
      user_role:    user.role         || null,
      user_name:    user.name         || null,
      method:       req?.method       || null,
      path:         req?.originalUrl  || null,
      action:       action,
      entity_type:  entity_type       || null,
      entity_id:    entity_id         || null,
      old_value:    old_value ? JSON.parse(JSON.stringify(old_value)) : null,
      new_value:    new_value ? JSON.parse(JSON.stringify(new_value)) : null,
      ip_address:   req?.ip || req?.connection?.remoteAddress || null,
      user_agent:   req?.headers?.['user-agent']               || null,
      remarks:      remarks || null,
      metadata:     {},
    });
  } catch (err) {
    // NEVER let audit logging crash the main operation
    console.error('[AuditLog] Failed to write audit log:', err.message);
  }
}

module.exports = { auditLog };
