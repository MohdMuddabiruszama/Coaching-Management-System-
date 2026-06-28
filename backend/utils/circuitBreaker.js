/**
 * ✅ PHASE 5: Lightweight Circuit Breaker
 * ─────────────────────────────────────────────────────────────────────────────
 * Prevents cascading failures by "opening the circuit" when a downstream
 * service (Razorpay, Cloudinary, biometric devices) fails repeatedly.
 *
 * States:
 *   CLOSED    → Normal operation. All requests pass through.
 *   OPEN      → Service is failing. All requests fail fast (no network call).
 *   HALF_OPEN → Recovery probe. One request let through to test the service.
 *
 * Usage:
 *   const { getBreaker } = require('../utils/circuitBreaker');
 *   const breaker = getBreaker('razorpay', { failureThreshold: 5 });
 *   const result  = await breaker.fire(() => razorpay.orders.create(data));
 * ─────────────────────────────────────────────────────────────────────────────
 */

const STATE = { CLOSED: "CLOSED", OPEN: "OPEN", HALF_OPEN: "HALF_OPEN" };

class CircuitBreaker {
    /**
     * @param {string} name             - Service name for logging
     * @param {Object} options
     * @param {number} options.failureThreshold - Failures before opening (default: 5)
     * @param {number} options.successThreshold - Successes in HALF_OPEN before closing (default: 2)
     * @param {number} options.timeout          - ms to wait before HALF_OPEN probe (default: 30000)
     */
    constructor(name, options = {}) {
        this.name             = name;
        this.failureThreshold = options.failureThreshold || 5;
        this.successThreshold = options.successThreshold || 2;
        this.timeout          = options.timeout          || 30000; // 30 seconds

        this.state          = STATE.CLOSED;
        this.failureCount   = 0;
        this.successCount   = 0;
        this.lastFailureAt  = null;
        this.nextAttemptAt  = null;
    }

    /**
     * Execute a function through the circuit breaker.
     * @param {Function} fn - Async function to execute
     * @returns {Promise<any>}
     * @throws {Error} with code 'CIRCUIT_OPEN' when circuit is open
     */
    async fire(fn) {
        if (this.state === STATE.OPEN) {
            if (Date.now() < this.nextAttemptAt) {
                const err = new Error(`${this.name} circuit is open — service unavailable`);
                err.code = "CIRCUIT_OPEN";
                err.isOperational = true;
                err.statusCode = 503;
                throw err;
            }
            // Timeout expired — move to HALF_OPEN to probe
            this._toHalfOpen();
        }

        try {
            const result = await fn();
            this._onSuccess();
            return result;
        } catch (err) {
            this._onFailure(err);
            throw err;
        }
    }

    _onSuccess() {
        this.failureCount = 0;
        if (this.state === STATE.HALF_OPEN) {
            this.successCount += 1;
            if (this.successCount >= this.successThreshold) {
                this._toClose();
            }
        }
    }

    _onFailure(err) {
        this.lastFailureAt = Date.now();
        this.failureCount += 1;
        console.warn(`⚡ [CircuitBreaker:${this.name}] Failure #${this.failureCount}: ${err.message}`);

        if (
            this.state === STATE.HALF_OPEN ||
            this.failureCount >= this.failureThreshold
        ) {
            this._toOpen();
        }
    }

    _toOpen() {
        this.state        = STATE.OPEN;
        this.nextAttemptAt = Date.now() + this.timeout;
        console.error(
            `🔴 [CircuitBreaker:${this.name}] Circuit OPENED after ${this.failureCount} failures. ` +
            `Next probe at ${new Date(this.nextAttemptAt).toISOString()}`
        );
    }

    _toHalfOpen() {
        this.state        = STATE.HALF_OPEN;
        this.successCount = 0;
        console.info(`🟡 [CircuitBreaker:${this.name}] Circuit HALF_OPEN — probing service`);
    }

    _toClose() {
        this.state        = STATE.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        console.info(`🟢 [CircuitBreaker:${this.name}] Circuit CLOSED — service recovered`);
    }

    getStats() {
        return {
            name:           this.name,
            state:          this.state,
            failureCount:   this.failureCount,
            lastFailureAt:  this.lastFailureAt,
            nextAttemptAt:  this.nextAttemptAt,
        };
    }
}

// ── Singleton registry — one breaker per service ───────────────────────────
const breakers = new Map();

/**
 * Get or create a named circuit breaker.
 * Calling with the same name always returns the same instance.
 *
 * @param {string} name    - Service name ('razorpay', 'cloudinary', 'biometric-{id}')
 * @param {Object} options - CircuitBreaker options (only applied on first creation)
 * @returns {CircuitBreaker}
 */
const getBreaker = (name, options = {}) => {
    if (!breakers.has(name)) {
        breakers.set(name, new CircuitBreaker(name, options));
    }
    return breakers.get(name);
};

/**
 * Get all breaker stats — useful for the /api/health endpoint.
 */
const getAllStats = () =>
    Array.from(breakers.values()).map((b) => b.getStats());

module.exports = { CircuitBreaker, getBreaker, getAllStats };
