/**
 * ✅ Phase 7: Auth Validation Schemas
 * Joi schemas for authentication endpoints.
 */
const Joi = require("joi");

const login = {
    body: Joi.object({
        email: Joi.string().email().required().trim().lowercase()
            .messages({ "string.email": "Please enter a valid email address" }),
        password: Joi.string().min(1).required()
            .messages({ "string.empty": "Password is required" }),
        source: Joi.string().valid("web", "mobile").optional(),
    }),
};

const registerInit = {
    body: Joi.object({
        name: Joi.string().min(2).max(100).required().trim()
            .messages({ "string.min": "Institute name must be at least 2 characters" }),
        email: Joi.string().email().required().trim().lowercase(),
        phone: Joi.string().pattern(/^[0-9]{10,15}$/).required()
            .messages({ "string.pattern.base": "Phone must be 10-15 digits" }),
        password: Joi.string().min(6).max(100).required()
            .messages({ "string.min": "Password must be at least 6 characters" }),
        admin_name: Joi.string().min(2).max(100).optional().trim(),
        testMode: Joi.boolean().optional(),
        address: Joi.string().max(500).optional().allow(""),
        city: Joi.string().max(100).optional().allow(""),
        state: Joi.string().max(100).optional().allow(""),
        pincode: Joi.string().pattern(/^[0-9]{5,10}$/).optional().allow(""),
        plan_id: Joi.number().integer().positive().optional(),
    }),
};

const verifyRegistration = {
    body: Joi.object({
        email: Joi.string().email().required().trim().lowercase(),
        otp: Joi.string().length(6).pattern(/^[0-9]+$/).required()
            .messages({ "string.length": "OTP must be exactly 6 digits" }),
        name: Joi.string().min(2).max(100).required().trim(),
        phone: Joi.string().pattern(/^[0-9]{10,15}$/).required(),
        password: Joi.string().min(6).max(100).required(),
        admin_name: Joi.string().min(2).max(100).optional().trim(),
        address: Joi.string().max(500).optional().allow(""),
        city: Joi.string().max(100).optional().allow(""),
        state: Joi.string().max(100).optional().allow(""),
        pincode: Joi.string().max(10).optional().allow(""),
        plan_id: Joi.number().integer().positive().optional(),
    }),
};

const forgotPassword = {
    body: Joi.object({
        email: Joi.string().email().required().trim().lowercase(),
    }),
};

const resetPassword = {
    body: Joi.object({
        email: Joi.string().email().required().trim().lowercase(),
        otp: Joi.string().length(6).pattern(/^[0-9]+$/).required(),
        new_password: Joi.string().min(6).max(100).required()
            .messages({ "string.min": "New password must be at least 6 characters" }),
        confirm_password: Joi.string().min(6).max(100).required()
            .messages({ "string.min": "Confirm password must be at least 6 characters" }),
    }),
};

const changePassword = {
    body: Joi.object({
        oldPassword: Joi.string().min(1).required()
            .messages({ "string.empty": "Current password is required" }),
        newPassword: Joi.string().min(8).max(100).required()
            .messages({ 
                "string.min": "New password must be at least 8 characters",
                "string.empty": "New password is required"
            }),
    }),
};

const refreshToken = {
    body: Joi.object({
        refreshToken: Joi.string().min(20).required()
            .messages({ "string.empty": "Refresh token is required" }),
    }),
};

module.exports = {
    login,
    registerInit,
    verifyRegistration,
    forgotPassword,
    resetPassword,
    changePassword,
    refreshToken,
};
