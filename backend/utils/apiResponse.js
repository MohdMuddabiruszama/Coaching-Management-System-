/**
 * Standardized API Response Formatter
 * Used to ensure consistent JSON structure across all endpoints.
 */

/**
 * Send a standardized success response
 * @param {Object} res - Express response object
 * @param {Object|Array|null} data - Payload to send
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code (default: 200)
 */
const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data
    });
};

/**
 * Send a standardized error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 400)
 * @param {Object|Array|null} errors - Detailed errors array or object
 */
const sendError = (res, message = 'An error occurred', statusCode = 400, errors = null) => {
    const response = {
        success: false,
        message
    };
    if (errors) {
        response.errors = errors;
        if (typeof errors === 'object' && !Array.isArray(errors) && errors !== null) {
            if (errors.code) {
                response.code = errors.code;
            }
        }
    }
    return res.status(statusCode).json(response);
};

/**
 * Send a standardized paginated response
 * @param {Object} res - Express response object
 * @param {Array} data - Array of records
 * @param {number} total - Total number of records matching query
 * @param {number} page - Current page number
 * @param {number} limit - Number of records per page
 * @param {string} message - Success message
 */
const sendPaginated = (res, data, total, page, limit, message = 'Data retrieved successfully') => {
    const totalPages = Math.ceil(total / limit) || 1;
    return res.status(200).json({
        success: true,
        message,
        data,
        pagination: {
            total,
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            totalPages
        }
    });
};

/**
 * Send a standardized validation error response (422)
 * @param {Object} res - Express response object
 * @param {Array|Object} errors - Validation errors
 */
const sendValidationError = (res, errors) => {
    return res.status(422).json({
        success: false,
        message: 'Validation Error',
        errors
    });
};

module.exports = {
    sendSuccess,
    sendError,
    sendPaginated,
    sendValidationError
};
