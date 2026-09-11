const NodeCache = require("node-cache");

// Local Tier-1 in-memory cache (ultra-fast 0.05ms lookup, automatic TTL eviction)
const localCache = new NodeCache({ stdTTL: 300, checkperiod: 60, useClones: false });

let redis = null;
let redisAvailable = false;

// Tier-2: Upstash Redis (if configured in .env)
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
        const { Redis } = require("@upstash/redis");
        redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });

        redis.ping()
            .then(() => {
                redisAvailable = true;
            })
            .catch(() => {
                redisAvailable = false;
            });
    } catch (err) {
        redis = null;
        redisAvailable = false;
    }
}

/**
 * Safe Multi-Tier Cache Wrapper
 * Tier 1: Local In-Memory (NodeCache) - 0.05ms latency, always available
 * Tier 2: Distributed Redis (Upstash / Hostinger Local) - cross-process shared
 */
const safeRedis = {
    get: async (key) => {
        // Check Tier 1 (In-Memory) first
        const memValue = localCache.get(key);
        if (memValue !== undefined && memValue !== null) {
            return memValue;
        }

        // Check Tier 2 (Redis) if available
        if (redis && redisAvailable) {
            try {
                const redisValue = await redis.get(key);
                if (redisValue !== null && redisValue !== undefined) {
                    localCache.set(key, redisValue, 60); // Cache locally for 60s
                    return redisValue;
                }
            } catch { /* silent fallback */ }
        }

        return null;
    },

    set: async (key, ttl = 300, value) => {
        // Save to Tier 1
        localCache.set(key, value, ttl);

        // Save to Tier 2 if available
        if (redis && redisAvailable) {
            try {
                await redis.setex(key, ttl, typeof value === 'object' ? JSON.stringify(value) : value);
            } catch { /* silent fallback */ }
        }
    },

    del: async (...keys) => {
        // Invalidate Tier 1
        keys.forEach(k => localCache.del(k));

        // Invalidate Tier 2
        if (redis && redisAvailable) {
            try {
                await redis.del(...keys);
            } catch { /* silent fallback */ }
        }
    },

    keys: async (pattern) => {
        if (redis && redisAvailable) {
            try { return await redis.keys(pattern); } catch { return localCache.keys(); }
        }
        return localCache.keys();
    },

    scan: async (cursor = 0, options = {}) => {
        if (redis && redisAvailable) {
            try {
                const result = await redis.scan(cursor, options);
                if (Array.isArray(result)) return result;
                if (result && typeof result === "object") {
                    return [String(result.cursor ?? "0"), result.keys || result.results || []];
                }
                return ["0", []];
            } catch {
                return ["0", localCache.keys()];
            }
        }
        return ["0", localCache.keys()];
    },

    isAvailable: () => true, // Hybrid cache is always available via in-memory Tier-1
};

module.exports = safeRedis;
