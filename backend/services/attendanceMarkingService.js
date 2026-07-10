const { Attendance, FacultyAttendance, StudentPeriodAttendance, FacultyPeriodAttendance, sequelize } = require("../models");
const socketUtils = require("../utils/socket");
const timetableCacheService = require("./timetableCacheService");
const NotificationService = require("./notificationService");

const PRIORITY = {
    biometric: 3,
    qr: 2,
    manual: 1
};

const getModelInfo = (entityType, isPeriodWise) => {
    if (entityType === "student") {
        return isPeriodWise ? StudentPeriodAttendance : Attendance;
    } else {
        return isPeriodWise ? FacultyPeriodAttendance : FacultyAttendance;
    }
};

const canOverride = (existingRecord, newSourceType, isAdminOverride) => {
    if (isAdminOverride) return true;
    const existingPriority = PRIORITY[existingRecord.marked_by_type] || 0;
    const newPriority = PRIORITY[newSourceType] || 0;
    return newPriority >= existingPriority;
};

const markAttendance = async ({
    entityType, // 'student' | 'faculty'
    entityId,
    instituteId,
    classId, // required for student daily, or for finding current period
    subjectId, // optional, for subject-wise attendance
    date,
    periodId, // optional. If null, we might resolve it via Live Timetable if isPeriodWise = true
    status,
    sourceType, // 'manual' | 'qr' | 'biometric'
    actorId,
    sourceMeta,
    timeIn,
    timeOut,
    isAdminOverride = false,
    isPeriodWise = false,
    remarks
}) => {
    return sequelize.transaction(async (trx) => {
        let finalPeriodId = periodId;

        // Auto-resolve current period if requested for period-wise attendance but not provided
        if (isPeriodWise && !finalPeriodId) {
            // we need classId or facultyId to resolve
            const resolvedSlot = timetableCacheService.getCurrentPeriod(instituteId, classId, entityType === 'faculty' ? entityId : null, new Date(date));
            if (resolvedSlot) {
                finalPeriodId = resolvedSlot.id;
            }
        }

        const Model = getModelInfo(entityType, isPeriodWise);

        // Build where clause for unique record
        const whereClause = {
            institute_id: instituteId,
            date: date
        };
        
        if (entityType === "student") {
            whereClause.student_id = entityId;
            if (!isPeriodWise && classId) whereClause.class_id = classId;
            if (!isPeriodWise && subjectId) whereClause.subject_id = subjectId;
        } else {
            whereClause.faculty_id = entityId;
        }

        if (isPeriodWise && finalPeriodId) {
            whereClause.timetable_entry_id = finalPeriodId;
        }

        // Lock row for update
        const existing = await Model.findOne({
            where: whereClause,
            lock: true,
            transaction: trx
        });

        if (existing && !canOverride(existing, sourceType, isAdminOverride)) {
            return { ok: true, noop: true, record: existing }; // Idempotent, no write
        }

        const payload = {
            ...whereClause,
            status,
            marked_by_type: sourceType,
            marked_by: actorId,
            source_meta: sourceMeta,
            time_in: timeIn || existing?.time_in,
            time_out: timeOut || existing?.time_out,
            remarks: remarks || existing?.remarks,
            version: (existing?.version || 0) + 1
        };

        let record;
        if (existing) {
            record = await existing.update(payload, { transaction: trx });
        } else {
            record = await Model.create(payload, { transaction: trx });
        }

        // After successful commit, we will publish a domain event for WS and notifications
        // The transaction will commit successfully if we reach here without throwing.
        // We defer the event emission to after the transaction commits using a hook or just returning and doing it in the controller, 
        // but it's cleaner to use `afterCommit` hook on the transaction.
        
        trx.afterCommit(() => {
            publishAttendanceEvent({
                instituteId,
                entityType,
                entityId,
                classId,
                date,
                status,
                markedByType: sourceType,
                time: record.updatedAt
            });
        });

        return { ok: true, record };
    });
};

const publishAttendanceEvent = (eventData) => {
    // 1. Cross-Channel Sync via WebSocket
    let roomName = "";
    if (eventData.entityType === "student" && eventData.classId) {
        roomName = `attendance:class:${eventData.classId}:${eventData.date}`;
    } else if (eventData.entityType === "faculty") {
        roomName = `attendance:faculty:${eventData.instituteId}:${eventData.date}`;
    }

    if (roomName) {
        try {
            socketUtils.getIo().to(roomName).emit('attendance:update', eventData);
        } catch (e) {
            console.error("Socket emit failed:", e.message);
        }
    }

    // 2. Notification De-duplication dispatch
    if (eventData.entityType === "student" && ["present", "absent", "late"].includes(eventData.status)) {
        const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        const statusCapitalized = eventData.status.charAt(0).toUpperCase() + eventData.status.slice(1);
        
        NotificationService.notifyStudentAndParents(
            eventData.instituteId, 
            eventData.entityId, 
            `attendance_${eventData.status}`, 
            `${statusCapitalized} Alert`, 
            `You were marked ${eventData.status} on ${eventData.date} at ${currentTime}.`,
            `/student/attendance`
        );
    }
};

module.exports = {
    markAttendance,
    canOverride
};
