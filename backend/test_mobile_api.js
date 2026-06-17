const { User, Student } = require('./models');
const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config();

async function test() {
    try {
        const student = await Student.findOne({ include: [User] });
        if (!student) {
            console.log('No student found');
            return;
        }

        const user = student.User;
        if (user.is_first_login) {
            await user.update({ is_first_login: false });
        }
        console.log(`Testing with user: ${user.email} (ID: ${user.id}, Institute: ${user.institute_id})`);

        const token = jwt.sign(
            { id: user.id, email: user.email, role: 'student', institute_id: user.institute_id },
            process.env.JWT_SECRET || 'your_super_secret_key_123!@#',
            { expiresIn: '1d' }
        );

        console.log(`Token: ${token}`);

        const response = await axios.get('http://127.0.0.1:5000/api/mobile/student/dashboard', {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('Success:', response.data);
    } catch (err) {
        if (err.response) {
            console.log(`Error ${err.response.status}:`, err.response.data);
        } else {
            console.log('Error:', err.message);
        }
    }
}

test();
