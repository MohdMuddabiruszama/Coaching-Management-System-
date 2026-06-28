/**
 * ✅ PHASE 4: Database Deadlock Retry Utility
 * ─────────────────────────────────────────────────────────────────────────────
 * Wraps critical write operations (fee payments, bulk attendance, transactions)
 * with automatic retry logic for transient failures like deadlocks.
 *
 * How to use:
 *   const withRetry = require('../utils/withRetry');
 *
 *   const result = await withRetry(() =>
 *     sequelize.transaction(async (t) => {
 *       // your transaction code
 *     })
 *   );
 *
 * Automatically retries on:
 *   - SequelizeDeadlockError
 *   - MySQL ER_LOCK_DEADLOCK
 *   - PostgreSQL serialization failures (40001, 40P01)
 *   - Connection timeouts (transient)
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * @param {Function} fn          - Async function to execute (usually a transaction)
 * @param {number}   maxRetries  - Max number of retries (default: 3)
 * @param {number}   baseDelayMs - Base delay in ms before first retry (default: 200)
 * @returns {Promise<any>}
 */
const withRetry = async (fn, maxRetries = 3, baseDelayMs = 200) => {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;

            const isRetryable =
                // Sequelize deadlock
                err.name === "SequelizeDeadlockError" ||
                // MySQL deadlock code
                err.parent?.code === "ER_LOCK_DEADLOCK" ||
                // PostgreSQL serialization failure
                err.parent?.code === "40001" ||
                err.parent?.code === "40P01" ||
                // Transient connection errors
                err.name === "SequelizeConnectionTimedOutError" ||
                err.name === "SequelizeConnectionAcquireTimeoutError";

            if (!isRetryable || attempt === maxRetries) {
                // Not retryable or exhausted all attempts — re-throw
                throw err;
            }

            // Exponential backoff: 200ms, 400ms, 800ms, ...
            const delay = baseDelayMs * Math.pow(2, attempt - 1);
            console.warn(
                `⚠️ [withRetry] Retryable error on attempt ${attempt}/${maxRetries}. ` +
                `Retrying in ${delay}ms... Error: ${err.message}`
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    // Should not reach here, but throw last error as safety net
    throw lastError;
};

module.exports = withRetry;
