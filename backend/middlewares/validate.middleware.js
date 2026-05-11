/**
 * ✅ Phase 7: Joi Validation Middleware
 * Generic middleware that validates req.body, req.params, and req.query
 * against a Joi schema and returns standardized 400 errors.
 */
const Joi = require("joi");

/**
 * Validate request against a Joi schema
 * @param {Object} schema - { body: JoiSchema, params: JoiSchema, query: JoiSchema }
 * @returns Express middleware
 */
const validate = (schema) => {
    return (req, res, next) => {
        const errors = [];

        // Validate body
        if (schema.body) {
            const { error, value } = schema.body.validate(req.body, { abortEarly: false, stripUnknown: true });
            if (error) {
                errors.push(...error.details.map(d => ({ field: d.path.join("."), message: d.message })));
            } else {
                req.body = value; // Use sanitized values
            }
        }

        // Validate params
        if (schema.params) {
            const { error, value } = schema.params.validate(req.params, { abortEarly: false });
            if (error) {
                errors.push(...error.details.map(d => ({ field: d.path.join("."), message: d.message })));
            } else {
                req.params = value;
            }
        }

        // Validate query
        if (schema.query) {
            const { error, value } = schema.query.validate(req.query, { abortEarly: false, stripUnknown: true });
            if (error) {
                errors.push(...error.details.map(d => ({ field: d.path.join("."), message: d.message })));
            } else {
                req.query = value;
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors,
            });
        }

        next();
    };
};

module.exports = validate;
