const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Assignment = sequelize.define("Assignment", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    institute_id: { type: DataTypes.INTEGER, allowNull: false },
    faculty_id: { type: DataTypes.INTEGER, allowNull: false },
    class_id: { type: DataTypes.INTEGER, allowNull: false },
    subject_id: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    reference_file_url: { type: DataTypes.STRING(500), allowNull: true },
    reference_file_type: { type: DataTypes.STRING(50), allowNull: true },
    due_date: { type: DataTypes.DATE, allowNull: false },
    max_marks: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    allowed_file_types: {
        type: DataTypes.JSONB,
        defaultValue: ['pdf', 'docx', 'jpg', 'png', 'zip']
    },
    max_file_size_mb: { type: DataTypes.INTEGER, defaultValue: 10 },
    allow_late_submission: { type: DataTypes.BOOLEAN, defaultValue: true },
    status: { 
        type: DataTypes.STRING(20), 
        validate: { isIn: [['draft', 'published', 'closed']] }, 
        defaultValue: 'draft' 
    },
    total_submissions: { type: DataTypes.INTEGER, defaultValue: 0 }
}, {
    tableName: 'assignments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paranoid:  true,    // ✅ Soft delete
    indexes: [
        { fields: ['institute_id', 'class_id', 'subject_id', 'status'] },
        { fields: ['faculty_id', 'due_date'] }
    ]
});

module.exports = Assignment;
