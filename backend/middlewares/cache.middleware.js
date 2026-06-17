const redis = require("../config/redis");

const normalizeUrl = (req) => {
    const [path, rawQuery = ""] = req.originalUrl.split("?");
    if (!rawQuery) return path;

    const params = new URLSearchParams(rawQuery);
    const normalized = new URLSearchParams();
    [...params.keys()].sort().forEach((key) => {
        params.getAll(key).forEach((value) => normalized.append(key, value));
    });

    const query = normalized.toString();
    return query ? `${path}?${query}` : path;
};

const shouldVaryByUser = (req, options = {}) => {
    if (options.scope === "tenant") return false;
    if (options.scope === "user") return true;
    if (Array.isArray(options.varyByUserRoles) && options.varyByUserRoles.includes(req.user?.role)) {
        return true;
    }
    return ["student", "parent", "faculty"].includes(req.user?.role);
};

const buildCacheKey = (req, options = {}) => {
    const instituteId = req.user?.institute_id || "public";
    const role = req.user?.role || "anon";
    const userId = shouldVaryByUser(req, options) ? req.user?.id || "anon" : "shared";
    return `cache:${normalizeUrl(req)}:i:${instituteId}:r:${role}:u:${userId}`;
};

const cacheMiddleware = (ttl = 300, options = {}) => {
    return async (req, res, next) => {
        if (req.method !== "GET") return next();

        if (typeof options.cacheWhen === "function" && !options.cacheWhen(req)) {
            res.setHeader("X-Cache", "BYPASS");
            return next();
        }

        const cacheKey = buildCacheKey(req, options);

        try {
            const cachedData = await redis.get(cacheKey);

            if (cachedData) {
                const parsed = typeof cachedData === "string" ? JSON.parse(cachedData) : cachedData;
                res.setHeader("X-Cache", "HIT");
                res.setHeader("X-Cache-TTL", ttl);
                return res.status(200).json(parsed);
            }

            res.setHeader("X-Cache", "MISS");

            const originalJson = res.json.bind(res);
            res.json = (body) => {
                if (res.statusCode === 200 || res.statusCode === 201) {
                    redis.set(cacheKey, ttl, JSON.stringify(body)).catch(() => {});
                }
                return originalJson(body);
            };

            return next();
        } catch (error) {
            console.error("Cache middleware error:", error.message);
            return next();
        }
    };
};

const clearCache = async (pattern) => {
    try {
        let cursor = "0";
        let deleted = 0;

        do {
            const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 100 });
            cursor = String(nextCursor);

            if (keys.length > 0) {
                await redis.del(...keys);
                deleted += keys.length;
            }
        } while (cursor !== "0");

        if (deleted > 0) {
            console.log(`Cache cleared ${deleted} key(s) matching: ${pattern}`);
        }
    } catch (error) {
        console.error("Cache clear error:", error.message);
    }
};

const invalidateCache = (...patterns) => {
    return async (req, res, next) => {
        if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
            const originalJson = res.json.bind(res);
            res.json = async (body) => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    for (const pattern of patterns) {
                        await clearCache(pattern);
                    }
                }
                return originalJson(body);
            };
        }
        next();
    };
};

module.exports = { cacheMiddleware, clearCache, invalidateCache };
