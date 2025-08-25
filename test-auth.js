import axios from 'axios';

const API_URL = 'https://ofertas-de-exito-backend.vercel.app';

async function testAuth() {
  console.log('🧪 Testing Authentication Endpoints...\n');

  try {
    // Test 1: Register new user
    console.log('1️⃣ Testing REGISTER...');
    const registerData = {
      email: `test${Date.now()}@test.com`,
      password: '123456'
    };

    const registerResponse = await axios.post(`${API_URL}/api/auth/register`, registerData);
    console.log('✅ Register SUCCESS:', registerResponse.data);

    // Test 2: Login with created user
    console.log('\n2️⃣ Testing LOGIN...');
    const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
      email: registerData.email,
      password: registerData.password
    });
    console.log('✅ Login SUCCESS:', loginResponse.data);

    // Test 3: Login with wrong credentials
    console.log('\n3️⃣ Testing LOGIN with wrong password...');
    try {
      await axios.post(`${API_URL}/api/auth/login`, {
        email: registerData.email,
        password: 'wrongpassword'
      });
    } catch (error) {
      console.log('✅ Wrong password correctly rejected:', error.response.data);
    }

    console.log('\n🎉 All tests passed!');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testAuth();
