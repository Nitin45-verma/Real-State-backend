const email = `test${Date.now()}@test.com`;
console.log("Registering user:", email);

fetch('http://localhost:5000/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Test Name',
    email: email,
    password: 'password123',
    role: 'Buyer'
  })
})
.then(res => res.json())
.then(data => {
  console.log("Register output:", data);
  return fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email,
      password: 'password123'
    })
  });
})
.then(res => res.json())
.then(data => {
  console.log("Login output:", data);
  process.exit(0);
})
.catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
