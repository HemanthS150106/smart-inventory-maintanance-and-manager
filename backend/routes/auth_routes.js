import express from 'express';
import { readJSON } from '../utils/jsonStore.js';
import jwt from 'jsonwebtoken';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

router.post('/admin-login', (req, res) => {
  const { login_id, password } = req.body;

  // Check users.json first (as it is a JSON array)
  const users = readJSON('users.json', []);
  const admin = users.find(
    u => (u.email === login_id || u.login_id === login_id) &&
         u.password === password
  );

  if (admin) {
    const token = jwt.sign({ email: admin.email }, JWT_SECRET, { expiresIn: '8h' });
    return res.json({ 
      success: true, 
      admin: { login_id: admin.email, name: 'Admin', role: 'admin' }, 
      token 
    });
  }

  // Fallback hardcoded admin
  if (login_id === 'admin' && password === 'admin123') {
    const token = jwt.sign({ email: 'admin@company.com' }, JWT_SECRET, { expiresIn: '8h' });
    return res.json({
      success: true,
      admin: { login_id: 'admin', name: 'Admin', role: 'admin' },
      token
    });
  }

  res.status(401).json({ success: false, error: 'Invalid admin credentials' });
});

export default router;
