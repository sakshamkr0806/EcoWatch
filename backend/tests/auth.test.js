require('dotenv').config();
const express = require('express');
const router = require('../routes/auth');
const app = express();
app.use(express.json());
app.use('/api/auth', router);

(async () => {
  try {
    const supertest = require('supertest');
    
    const res1 = await supertest(app)
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send({ name: 'Test User', email: 'test@test.com', password: 'password123' });
    
    if (res1.status !== 201) {
      console.log('Register Response:', JSON.stringify(res1.body, null, 2));
      throw new Error(`Expected 201, got ${res1.status}`);
    }
    if (res1.body.email !== 'test@test.com') {
      throw new Error(`Email mismatch`);
    }

    const res2 = await supertest(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send({ email: 'test@test.com', password: 'password123' });
    
    if (res2.status !== 200) {
      console.log('Login Response:', JSON.stringify(res2.body, null, 2));
      throw new Error(`Expected 200, got ${res2.status}`);
    }
    if (!res2.body.token) {
      throw new Error(`Token not defined`);
    }

    const res3 = await supertest(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send({ email: 'user@test.com', password: 'wrong' });
    
    if (res3.status !== 401) {
      console.log('Wrong cred Response:', JSON.stringify(res3.body, null, 2));
      throw new Error(`Expected 401, got ${res3.status}`);
    }

    console.log('✅ All auth tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Auth test failed:', error.message);
    process.exit(1);
  }
})();
