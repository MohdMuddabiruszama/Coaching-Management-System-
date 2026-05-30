const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const User = sequelize.define("User", {
    institute_id: DataTypes.INTEGER,
    role: {
        type: DataTypes.STRING(20),
        validate: { isIn: [["super_admin", "admin", "manager", "faculty", "student", "parent"]] }
    },
    name: DataTypes.STRING,
    email: { type: DataTypes.STRING, unique: 'unique_user_email' },
    phone: DataTypes.STRING,
    password_hash: DataTypes.STRING,
    status: {
        type: DataTypes.STRING(20),
        validate: { isIn: [["active", "blocked"]] }
    },
    theme_dark: { type: DataTypes.BOOLEAN, defaultValue: false },
    theme_style: { 
        type: DataTypes.STRING(20),
        validate: { isIn: [["simple", "pro"]] },
        defaultValue: "simple" 
    },
    permissions: { type: DataTypes.JSONB, defaultValue: null },
    last_announcement_seen_at: { type: DataTypes.DATE, defaultValue: null },
    last_chat_seen_at: { type: DataTypes.DATE, defaultValue: null },
    last_assignment_seen_at: { type: DataTypes.DATE, defaultValue: null },
    last_note_seen_at: { type: DataTypes.DATE, defaultValue: null },
    last_enquiry_seen_at: { type: DataTypes.DATE, defaultValue: null },
    manager_type: {
        type: DataTypes.ENUM('fees', 'data', 'academic', 'ops', 'hr', 'custom'),
        defaultValue: 'custom',
        allowNull: true,
    },
    manager_type_label: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: null,
    },
    // Student credential management fields
    is_first_login: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: true,
    },
    temp_password_expires_at: {
        type: DataTypes.DATE,
        defaultValue: null,
        allowNull: true,
    },
    credentials_sent_at: {
        type: DataTypes.DATE,
        defaultValue: null,
        allowNull: true,
    },
    initial_password: {
        type: DataTypes.STRING(255),
        defaultValue: null,
        allowNull: true,
    },
});

module.exports = User;
