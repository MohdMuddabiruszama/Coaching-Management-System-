const axios = require('axios');
(async () => {
  try {
    const login = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'superadmin@example.com',
      password: 'password123'
    });
    const token = login.data.token;
    
    await axios.put('http://localhost:5000/api/plans/1', { is_hidden: true }, {
      headers: { Authorization: 'Bearer ' + token }
    });
    console.log('Plan 1 updated to is_hidden: true');
    
    const res = await axios.get('http://localhost:5000/api/plans');
    const plan1 = res.data.data.find(p => p.id === 1);
    console.log('Fetched plan 1 is_hidden:', plan1.is_hidden);
    
    await axios.put('http://localhost:5000/api/plans/1', { is_hidden: false }, {
      headers: { Authorization: 'Bearer ' + token }
    });
    console.log('Plan 1 reverted');
  } catch (err) {
    console.error(err.response?.data || err.message);
  }
})();
