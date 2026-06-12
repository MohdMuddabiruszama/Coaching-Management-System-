const http = require('http');

const loginData = JSON.stringify({
  email: 'superadmin@gmail.com', // Assuming this is the superadmin email, or whatever it is
  password: 'password' // Assuming password
});

// Since I don't know the password, I can just create a test JWT token if I use the same secret
// Or I can just simulate the delete directly using the controller method!

// Let's just simulate the controller method
const { deleteInstitute } = require('./controllers/superadmin.controller.js');
const { User } = require('./models');

async function test() {
  try {
    // mock req, res
    const req = {
      params: { id: 17 },
      body: { force: true },
      user: { id: 1 } // fake user
    };
    
    const res = {
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        console.log('RESPONSE:', this.statusCode, data);
      }
    };
    
    await deleteInstitute(req, res);
  } catch (e) {
    console.error('ERROR', e);
  }
}

test();
