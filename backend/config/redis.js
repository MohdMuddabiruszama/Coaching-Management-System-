/**
 * ✅ Phase 3.2: Redis Cache Configuration
 * Uses Upstash Redis (free tier: 10,000 commands/day)
 * Falls back gracefully if Redis is unavailable (no crash)
 *
 * Setup:
 *  1. Go to https://upstash.com → Create free account
 *  2. Create DB: zf-solution-cache
 *  3. Add to .env:
 *     UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
 *     UPSTASH_REDIS_REST_TOKEN=your_token
 */

let redis = null;
let redisAvailable = false;

// Only init Redis if credentials are provided
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
        const { Redis } = require("@upstash/redis");

        redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });

        // Test connection
        redis
            .ping()
            .then(() => {
                redisAvailable = true;
                console.log("✅ Redis Connected (Upstash)");
            })
            .catch(() => {
                redisAvailable = false;
                console.warn("⚠️  Redis Unavailable — caching disabled (add UPSTASH_REDIS_REST_URL to .env)");
            });
    } catch (err) {
        console.warn("⚠️  Redis init error:", err.message);
        redis = null;
        redisAvailable = false;
    }
} else {
    console.log("ℹ️  Redis not configured — caching disabled (set UPSTASH_REDIS_REST_URL + TOKEN to enable)");
}

/**
 * Safe redis wrapper — never throws, returns null on failure
 */
const safeRedis = {
    get: async (key) => {
        if (!redis) return null;
        try { return await redis.get(key); } catch { return null; }
    },
    set: async (key, ttl, value) => {
        if (!redis) return;
        try { await redis.setex(key, ttl, value); } catch { /* silent */ }
    },
    del: async (...keys) => {
        if (!redis) return;
        try { await redis.del(...keys); } catch { /* silent */ }
    },
    keys: async (pattern) => {
        if (!redis) return [];
        try { return await redis.keys(pattern); } catch { return []; }
    },
    scan: async (cursor = 0, options = {}) => {
        if (!redis) return ["0", []];
        try {
            const result = await redis.scan(cursor, options);
            if (Array.isArray(result)) return result;
            if (result && typeof result === "object") {
                return [String(result.cursor ?? "0"), result.keys || result.results || []];
            }
            return ["0", []];
        } catch {
            return ["0", []];
        }
    },
    isAvailable: () => redisAvailable,
};

module.exports = safeRedis;
