import express from 'express';
import { readJSON, writeJSON } from '../utils/jsonStore.js';

const router = express.Router();

// GET /api/tasks — all tasks with optional status filter
router.get('/', (req, res) => {
  try {
    const data = readJSON('tasks.json', { tasks: [] });
    const { status, workerId } = req.query;
    let tasks = data.tasks || [];
    if (workerId) {
      tasks = tasks.filter(t => (t.workerId === workerId || t.worker_id === workerId));
    }
    if (status) {
      tasks = tasks.filter(t => t.status === status);
    }
    res.json({ success: true, tasks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/tasks/:taskId/complete
router.patch('/:taskId/complete', (req, res) => {
  try {
    const { taskId } = req.params;

    const tasksData   = readJSON('tasks.json',   { tasks:   [] });
    const workersData = readJSON('workers.json',  { workers: [] });

    const task = tasksData.tasks.find(t => t.taskId === taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    task.status      = 'Completed';
    task.completedAt = new Date().toISOString();

    const worker = workersData.workers.find(
      w => w.worker_id === task.workerId
    );
    if (worker) {
      worker.active_tasks = Math.max(0, (worker.active_tasks || 1) - 1);
      worker.tasks_completed = (worker.tasks_completed || 0) + 1;
      if (worker.active_tasks <= 0) {
        worker.status       = 'Available';
        worker.current_zone = null;
      }
    }

    writeJSON('tasks.json',  tasksData);
    writeJSON('workers.json', workersData);

    res.json({ success: true, task });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/assign-workers — manual trigger if needed
router.post('/assign', (req, res) => {
  res.json({ success: true,
    message: 'Assignment is automatic after cart allocation' });
});

router.post('/', (req, res) => {
  res.json({ success: true,
    message: 'Assignment is automatic after cart allocation' });
});

export default router;
