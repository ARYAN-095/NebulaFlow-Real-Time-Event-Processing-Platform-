require('dotenv').config({ path: './.env' });
  // 👈 important
const jwt = require('jsonwebtoken');

console.log('Loaded JWT_SECRET:', process.env.JWT_SECRET);
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in environment variables');
}

const token = jwt.sign(
  { sub: 'user1', tenant_id: 'tenant-2' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('✅ Use this token:\n', token);
