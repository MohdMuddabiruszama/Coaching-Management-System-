const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Subscription = sequelize.define("Subscription", {
    institute_id: DataTypes.INTEGER,
    plan_id: DataTypes.INTEGER,
    start_date: DataTypes.DATEONLY,
    end_date: DataTypes.DATEONLY,
    billing_cycle: {
        type: DataTypes.STRING(20),
        validate: { isIn: [["monthly", "yearly", "lifetime"]] },
        defaultValue: "monthly"
    },
    platform_type: {
        type: DataTypes.STRING(20),
        validate: { isIn: [["web_only", "web_android", "all"]] },
        defaultValue: "web_only"
    },
    status: {
        type: DataTypes.STRING(20),
        validate: { isIn: [["active", "trialing", "past_due", "cancelled", "expired"]] },
        defaultValue: "active"
    },
    auto_renew: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    cancelled_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    next_billing_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    coupon_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    payment_status: {
        type: DataTypes.STRING(20),
        validate: { isIn: [["paid", "unpaid", "failed", "pending"]] }
    },
    transaction_reference: DataTypes.STRING,
    amount_paid: DataTypes.DECIMAL(10, 2),
    discount_amount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    razorpay_order_id: DataTypes.STRING(100),
    razorpay_payment_id: DataTypes.STRING(100),
    coupon_code: DataTypes.STRING(50),
    invoice_number: { type: DataTypes.STRING(50), unique: true },
    tax_amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    paid_at: DataTypes.DATE,
    is_test: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Excluded from revenue metrics when true'
    },
});

module.exports = Subscription;
