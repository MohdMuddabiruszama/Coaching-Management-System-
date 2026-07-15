const axios = require('axios');
(async () => {
  try {
    const login = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'superadmin@example.com',
      password: 'password123'
    });
    const token = login.data.token;
    
    // just put without changing
    await axios.put('http://localhost:5000/api/plans/1', { name: 'Starter' }, {
      headers: { Authorization: 'Bearer ' + token }
    });
    console.log('Put succeeded');
  } catch (err) {
    console.error('Error in PUT:', err.message);
  }
})();
