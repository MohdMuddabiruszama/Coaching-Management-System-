require("dotenv").config({ path: __dirname + "/../.env" });
const { Student, User, StudentFee, StudentFeePayment, Class, Payment } = require("./index");
const sequelize = require("../config/database");

async function run() {
    try {
        await sequelize.authenticate();
        console.log("Connected to DB.");

        const users = await User.findAll({ where: { name: 'Ayesha Siddikha' } });
        console.log("Found Users:", JSON.stringify(users, null, 2));

        for (const user of users) {
            const student = await Student.findOne({ where: { user_id: user.id } });
            if (!student) continue;

            const studentFees = await StudentFee.findAll({
                where: {
                    student_id: student.id
                }
            });

            console.log("Found student fees for Student ID " + student.id + ":", JSON.stringify(studentFees, null, 2));

            for (const fee of studentFees) {
                const payments = await Payment.findAll({
                    where: { student_id: student.id, fee_structure_id: fee.fee_structure_id }
                });
                console.log("Payments for fee ID " + fee.id + ":", JSON.stringify(payments, null, 2));
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        await sequelize.close();
    }
}
run();
