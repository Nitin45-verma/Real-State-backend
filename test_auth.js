const axios = require('axios');

(async () => {
  try {
    const email = `test${Date.now()}@test.com`;
    console.log("Registering user:", email);
    
    // Register
    const res = await axios.post('http://localhost:5000/api/auth/register', {
      name: 'Test Name',
      email: email,
      password: 'password123',
      role: 'Buyer'
    });
    
    console.log("Register output:", res.status, res.data);

    // Login
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
      email: email,
      password: 'password123'
    });

    console.log("Login output:", loginRes.status, loginRes.data);
    
    // Get Me
    const meRes = await axios.get('http://localhost:5000/api/auth/me', {
      headers: { Authorization: `Bearer ${loginRes.data.token}` }
    });

    console.log("Me output:", meRes.status, meRes.data);
    process.exit(0);
  } catch (err) {
    if (err.response) {
      console.error("API Error:", err.response.status, err.response.data);
    } else {
      console.error("Error:", err.message);
    }
    process.exit(1);
  }
})();
