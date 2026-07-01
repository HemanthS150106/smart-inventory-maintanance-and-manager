import express from 'express';
import { readJSON, writeJSON } from '../utils/jsonStore.js';

const router = express.Router();

router.get('/', (req, res) => {
  const data = readJSON('workers.json', { workers: [] });
  let workers = data.workers.filter(w => w.is_active !== false);
  if (req.query.role) {
    const targetRole = req.query.role.toLowerCase();
    workers = workers.filter(w => w.role && w.role.toLowerCase() === targetRole);
  }
  res.json({ success: true, workers });
});

router.post('/', (req, res) => {
  const { name, role, shift } = req.body;
  const data = readJSON('workers.json', { workers: [] });
  const num = data.workers.length + 1;
  const loginId = `worker${String(num).padStart(3,'0')}`;
  const workerId = `W${String(num).padStart(3,'0')}`;
  data.workers.push({
    worker_id: workerId,
    login_id: loginId,
    name,
    password: 'warehouse123',
    role,
    shift,
    is_active: true,
    status: 'Available',
    active_tasks: 0,
    current_zone: null,
    last_assigned_at: null,
    efficiency_score: 100
  });
  writeJSON('workers.json', data);
  res.json({ success: true, worker_id: workerId, login_id: loginId });
});

router.delete('/:id', (req, res) => {
  const data = readJSON('workers.json', { workers: [] });
  const w = data.workers.find(w => w.worker_id === req.params.id);
  if (w) w.is_active = false;
  writeJSON('workers.json', data);
  res.json({ success: true });
});

router.post('/login', (req, res) => {
  const { login_id, password } = req.body;
  const data = readJSON('workers.json', { workers: [] });
  const worker = data.workers.find(
    w => w.login_id === login_id && w.is_active
  );
  if (!worker || worker.password !== password) {
    return res.status(401).json({ success: false, error: 'Invalid login ID or password' });
  }
  const { password: _, ...safeWorker } = worker;
  res.json({ success: true, worker: safeWorker });
});

export default router;
