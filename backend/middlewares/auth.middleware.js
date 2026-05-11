const jwt = require("jsonwebtoken");
const { User, Institute } = require("../models");
const { sendError } = require("../utils/apiResponse");
const { ROLES, STATUS } = require("../utils/constants");

// Cache institute status in memory for 60 seconds to avoid hitting DB on every API request
const statusCache = new Map();

const getInstituteStatus = async (instituteId) => {
  const cached = statusCache.get(instituteId);
  if (cached && Date.now() - cached.time < 60000) return cached.status;

  const inst = await Institute.findByPk(instituteId, { attributes: ['status'] });
  const status = inst ? inst.status : null;
  statusCache.set(instituteId, { status, time: Date.now() });
  return status;
};

// Export clear function so controllers can instantly invalidate the cache when status changes
const clearInstituteCache = (instituteId) => statusCache.delete(instituteId);

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return sendError(res, "Access denied. No token provided.", 401);
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // For managers, students, and parents: check live status from DB to enforce blocking in real-time
    if (decoded.role === ROLES.MANAGER || decoded.role === ROLES.STUDENT || decoded.role === ROLES.PARENT) {
      const dbUser = await User.findByPk(decoded.id, {
        attributes: ['id', 'status', 'permissions', 'role', 'is_first_login']
      });

      if (!dbUser) {
        return sendError(res, "User not found", 401);
      }

      if (dbUser.status === STATUS.BLOCKED) {
        return sendError(res, "Your account has been blocked by the administrator. Please contact them to regain access.", 403, { code: "ACCOUNT_BLOCKED" });
      }

      // Enforce first login password change for students
      if (decoded.role === ROLES.STUDENT && dbUser.is_first_login) {
        // Allow access to change-password and logout endpoints
        if (!req.path.includes('/change-password') && !req.path.includes('/logout')) {
           return sendError(res, "You must change your password before accessing the system.", 403, { code: "FIRST_LOGIN", is_first_login: true });
        }
      }

      if (decoded.role === ROLES.MANAGER) {
        // Refresh permissions from DB (in case admin updated them after login)
        req.user.permissions = dbUser.permissions;
        req.user.status = dbUser.status;
      }
    }

    // ── Check if institute is suspended ─────────────────────────────────────
    if (req.user.institute_id && req.user.role !== ROLES.SUPER_ADMIN) {
      const instituteStatus = await getInstituteStatus(req.user.institute_id);

      if (!instituteStatus) {
        return sendError(res, "Institute not found. Please contact support.", 401);
      }

      if (instituteStatus === STATUS.BLOCKED || instituteStatus === 'suspended') {
        return sendError(res, "Your institute account has been suspended. Please contact support.", 403, { code: 'INSTITUTE_SUSPENDED' });
      }
    }

    next();
  } catch (error) {
    // ✅ Phase 7: Return specific error codes for frontend token refresh logic
    if (error.name === "TokenExpiredError") {
      return sendError(res, "Access token expired. Please refresh.", 401, { code: "TOKEN_EXPIRED" });
    }
    if (error.name === "JsonWebTokenError") {
      return sendError(res, "Invalid token.", 401, { code: "TOKEN_INVALID" });
    }
    // Pass other errors to the global error middleware
    next(error);
  }
};

module.exports = verifyToken;
module.exports.clearInstituteCache = clearInstituteCache;
