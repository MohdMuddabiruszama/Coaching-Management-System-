/**
 * PromotionRule Model
 * Phase 2 — Academic Year Promotion Engine
 *
 * One row = one step in the institute's class/batch/course sequence.
 * The same table drives all institution types:
 *   School     → Class 1 → Class 2 → ... → Class 12 (end_action: graduate)
 *   College    → Year 1 → Year 2 → Final Year (end_action: graduate)
 *   Coaching   → Foundation → Beginner → Advanced (end_action: course_completed)
 *   Training   → Module 1 → Module 2 → Final (end_action: course_completed)
 *
 * to_class_id = NULL means end of sequence — end_action determines what happens.
 */
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PromotionRule = sequelize.define("PromotionRule", {
    institute_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    from_class_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "NULL = applies to all classes without an explicit rule",
    },
    to_class_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "NULL = end of sequence; use end_action to decide outcome",
    },
    end_action: {
        type: DataTypes.STRING(20),
        allowNull: true,
        validate: {
            isIn: [["graduate", "course_completed", "alumni", null]],
        },
        comment: "Action for students at the end of the sequence",
    },
    sort_order: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: "Defines the sequence order for this institute",
    },
}, {
    tableName: "promotion_rules",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
});

module.exports = PromotionRule;
