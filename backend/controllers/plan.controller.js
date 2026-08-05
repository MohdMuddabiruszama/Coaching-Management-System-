const { Plan } = require("../models");
const sequelize = require("../config/database");

/**
 * Get all subscription plans
 */
exports.getAllPlans = async (req, res) => {
    try {
        const whereClause = {};
        if (req.query.include_hidden !== 'true') {
            whereClause.is_hidden = false;
        }

        const plans = await Plan.findAll({
            where: whereClause,
            order: [["price", "ASC"]],
        });
        res.status(200).json({
            success: true,
            data: plans,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * Create a new subscription plan
 */
exports.createPlan = async (req, res) => {
    try {
        const newPlan = await Plan.create(req.body);
        res.status(201).json({
            success: true,
            message: "Plan created successfully",
            data: newPlan,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * Update an existing plan
 */
exports.updatePlan = async (req, res) => {
    try {
        const { id } = req.params;
        const plan = await Plan.findByPk(id);

        if (!plan) {
            return res.status(404).json({
                success: false,
                message: "Plan not found",
            });
        }

        await plan.update(req.body);
        res.status(200).json({
            success: true,
            message: "Plan updated successfully",
            data: plan,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * Delete a plan
 */
exports.deletePlan = async (req, res) => {
    try {
        const { id } = req.params;
        const plan = await Plan.findByPk(id);

        if (!plan) {
            return res.status(404).json({
                success: false,
                message: "Plan not found",
            });
        }

        await plan.destroy();
        res.status(200).json({
            success: true,
            message: "Plan deleted successfully",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

module.exports = exports;
