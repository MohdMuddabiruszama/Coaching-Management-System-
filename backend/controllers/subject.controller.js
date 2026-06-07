/**
 * Subject Controller
 * Handles CRUD operations for subjects
 */

const { Subject, Faculty, Class } = require("../models");
const { Op } = require("sequelize");

exports.createSubject = async (req, res) => {
    try {
        const { name, code, class_id, faculty_id } = req.body;
        const institute_id = req.user.institute_id;

        const subject = await Subject.create({
            institute_id,
            name,
            code: code || null,
            class_id: class_id || null,
            faculty_id: faculty_id || null,
        });

        res.status(201).json({
            success: true,
            message: "Subject created successfully",
            data: subject,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

exports.getAllSubjects = async (req, res) => {
    try {
        const { page = 1, limit = 100, class_id, search = "" } = req.query;
        const institute_id = req.user.institute_id;

        const offset = (page - 1) * limit;
        const whereClause = { institute_id };

        if (class_id) {
            whereClause.class_id = class_id;
        }

        if (search) {
            whereClause.name = { [Op.like]: `%${search}%` };
        }

        if (req.user.role === "faculty") {
            const facultyRecord = await Faculty.findOne({ where: { user_id: req.user.id } });
            if (facultyRecord) {
                whereClause.faculty_id = facultyRecord.id;
            } else {
                return res.status(200).json({ success: true, message: "Subjects retrieved successfully", data: [], count: 0 });
            }
        }

        const { count, rows } = await Subject.findAndCountAll({
            where: whereClause,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [["name", "ASC"]],
            include: [
                {
                    model: Faculty,
                    attributes: ["id", "designation"],
                    include: [
                        { model: require("../models").User, attributes: ["name"] }
                    ]
                },
                {
                    model: Class,
                    attributes: ["id", "name", "section"],
                },
            ],
        });

        const subjectIds = rows.map(r => r.id);
        const StudentSubject = require("../models/studentSubject");
        const studentCounts = await StudentSubject.findAll({
            where: { subject_id: subjectIds, institute_id },
            attributes: ['subject_id', [require("sequelize").fn("COUNT", require("sequelize").col("student_id")), "count"]],
            group: ['subject_id']
        });

        const countsMap = {};
        studentCounts.forEach(sc => {
            countsMap[sc.subject_id] = parseInt(sc.get('count'), 10);
        });

        const dataWithCounts = rows.map(r => {
            const data = r.toJSON();
            data.enrolled_students_count = countsMap[r.id] || 0;
            return data;
        });

        res.status(200).json({
            success: true,
            message: "Subjects retrieved successfully",
            data: dataWithCounts,
            count: count
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

exports.getSubjectById = async (req, res) => {
    try {
        const { id } = req.params;
        const institute_id = req.user.institute_id;

        const subject = await Subject.findOne({
            where: { id, institute_id },
            include: [
                {
                    model: Faculty,
                    attributes: ["id", "specialization"],
                },
                {
                    model: Class,
                    attributes: ["id", "name", "section"],
                },
            ],
        });

        if (!subject) {
            return res.status(404).json({
                success: false,
                message: "Subject not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Subject retrieved successfully",
            data: subject,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

exports.updateSubject = async (req, res) => {
    try {
        const { id } = req.params;
        const institute_id = req.user.institute_id;
        const { name, code, class_id, faculty_id, description } = req.body;

        const subject = await Subject.findOne({
            where: { id, institute_id },
        });

        if (!subject) {
            return res.status(404).json({
                success: false,
                message: "Subject not found",
            });
        }

        await subject.update({
            name: name || subject.name,
            code: code || subject.code,
            class_id: class_id || subject.class_id,
            faculty_id: faculty_id || subject.faculty_id,
            description: description || subject.description,
        });

        res.status(200).json({
            success: true,
            message: "Subject updated successfully",
            data: subject,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

exports.deleteSubject = async (req, res) => {
    try {
        const { id } = req.params;
        const institute_id = req.user.institute_id;

        const subject = await Subject.findOne({
            where: { id, institute_id },
        });

        if (!subject) {
            return res.status(404).json({
                success: false,
                message: "Subject not found",
            });
        }

        await subject.destroy();

        res.status(200).json({
            success: true,
            message: "Subject deleted successfully",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

module.exports = exports;
