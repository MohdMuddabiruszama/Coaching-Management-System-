// backend/utils/withTransaction.js
// ─── Transaction Wrapper ──────────────────────────────────────────────────────
// Runs any async function inside a Sequelize transaction.
// Auto-commits on success, auto-rolls back on any error.
// Use for ALL critical operations: fee payment, admission, promotion, salary.
// ZenithFlows — Enterprise DB Safety Architecture (Phase 6)

const { sequelize } = require('../models');

/**
 * Run an async function inside a database transaction.
 * If fn() throws, the transaction is rolled back automatically.
 * If fn() resolves, the transaction is committed.
 *
 * @param {Function} fn  - async (t) => { ... return result; }
 * @returns {Promise<*>} - whatever fn() returns
 *
 * @example
 * // Fee payment — all 3 steps succeed or all 3 are rolled back:
 * const result = await withTransaction(async (t) => {
 *   await Fee.update({ status: 'paid' }, { where: { id }, transaction: t });
 *   await PaymentLog.create({ fee_id: id, ... }, { transaction: t });
 *   await Student.update({ balance: 0 }, { where: { id: studentId }, transaction: t });
 *   return { success: true };
 * });
 *
 * @example
 * // Student promotion — all 50+ updates are atomic:
 * await withTransaction(async (t) => {
 *   for (const student of students) {
 *     await StudentClass.update({ enrollment_status: 'exited' }, { where: { id: student.enrollmentId }, transaction: t });
 *     await StudentClass.create({ ...newEnrollment }, { transaction: t });
 *   }
 * });
 */
async function withTransaction(fn) {
  const t = await sequelize.transaction();
  try {
    const result = await fn(t);
    await t.commit();
    return result;
  } catch (err) {
    await t.rollback();
    throw err; // re-throw so the controller returns 500 to the client
  }
}

module.exports = { withTransaction };
