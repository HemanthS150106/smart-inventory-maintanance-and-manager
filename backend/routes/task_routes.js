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
    task.lastUpdatedAt = new Date().toISOString();

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

// PATCH /api/tasks/:taskId/pick
router.patch('/:taskId/pick', (req, res) => {
  try {
    const { taskId } = req.params;
    const { slot_id } = req.body;

    const tasksData = readJSON('tasks.json', { tasks: [] });
    const task = tasksData.tasks.find(t => t.taskId === taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    if (!task.completedSlots) {
      task.completedSlots = [];
    }

    if (!task.completedSlots.includes(slot_id)) {
      task.completedSlots.push(slot_id);
      task.lastUpdatedAt = new Date().toISOString();
      writeJSON('tasks.json', tasksData);
    }

    res.json({ success: true, task });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/tasks/:taskId/activate
router.patch('/:taskId/activate', (req, res) => {
  try {
    const { taskId } = req.params;
    const tasksData = readJSON('tasks.json', { tasks: [] });
    const task = tasksData.tasks.find(t => t.taskId === taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    task.status = 'Active';
    task.lastUpdatedAt = new Date().toISOString();
    writeJSON('tasks.json', tasksData);

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

/**
 * POST /api/tasks/cleanup
 * Marks stale tasks as Abandoned and frees their workers/carts.
 * A task is stale if:
 *   - status is not Completed AND
 *   - assigned more than STALE_HOURS ago OR
 *   - the assigned worker no longer exists OR
 *   - the assigned cart no longer exists
 */
const STALE_HOURS = 12;

router.post('/cleanup', (req, res) => {
  try {
    const tasksData   = readJSON('tasks.json',  { tasks:   [] });
    const workersData = readJSON('workers.json', { workers: [] });
    const cartsData   = readJSON('carts.json',   { carts:   [] });

    const workerIds = new Set(
      workersData.workers.map(w => w.worker_id)
    );
    const cartIds = new Set(
      cartsData.carts.map(c => c.cart_id)
    );
    const now = new Date();

    const cleaned = [];

    tasksData.tasks.forEach(task => {
      if (task.status === 'Completed' ||
          task.status === 'Abandoned') return;

      const isOrphan = task.workerId &&
        !workerIds.has(task.workerId);

      const isStale = task.assignedAt && (
        (now - new Date(task.assignedAt)) / 3600000 > STALE_HOURS
      );

      const cartGone = task.cartId &&
        !cartIds.has(task.cartId);

      if (isOrphan || isStale || cartGone) {
        task.status      = 'Abandoned';
        task.abandonedAt = now.toISOString();
        task.abandonReason = isOrphan ? 'Worker deleted'
          : cartGone ? 'Cart deleted'
          : `Stale — assigned ${Math.round(
              (now - new Date(task.assignedAt)) / 3600000
            )} hours ago`;

        // Free the worker if they exist and are still linked
        const worker = workersData.workers.find(
          w => w.worker_id === task.workerId
        );
        if (worker) {
          worker.active_tasks = Math.max(
            0, (worker.active_tasks || 1) - 1
          );
          if (worker.active_tasks <= 0) {
            worker.status = 'Available';
          }
        }

        // Free the cart if it exists
        const cart = cartsData.carts.find(
          c => c.cart_id === task.cartId
        );
        if (cart && cart.status === 'assigned') {
          cart.status             = 'available';
          cart.assigned_worker_id = null;
        }

        cleaned.push({
          taskId: task.taskId,
          reason: task.abandonReason
        });
      }
    });

    if (cleaned.length > 0) {
      writeJSON('tasks.json',   tasksData);
      writeJSON('workers.json', workersData);
      writeJSON('carts.json',   cartsData);
    }

    res.json({
      success: true,
      cleaned: cleaned.length,
      details: cleaned
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/tasks/:taskId/stop/:slotId/complete
// Called when worker checks off a slot in their TODO list
router.patch('/:taskId/stop/:slotId/complete', (req, res) => {
  try {
    const { taskId, slotId } = req.params;
    const tasksData = readJSON('tasks.json', { tasks: [] });
    const task = tasksData.tasks.find(t => t.taskId === taskId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Add to completedSlots if not already there
    if (!task.completedSlots) task.completedSlots = [];
    if (!task.completedSlots.includes(slotId)) {
      task.completedSlots.push(slotId);
    }

    // Update currentStopIndex
    const pickupStops = (task.route || []).filter(
      s => s.type === 'pickup'
    );
    task.currentStopIndex = pickupStops.filter(
      s => task.completedSlots.includes(s.slot_id)
    ).length;

    // Check if all stops are done
    const allStops = (task.shelfCoordinates || []).map(
      s => s.slot_id
    );
    const allDone  = allStops.every(
      sid => task.completedSlots.includes(sid)
    );

    if (allDone && task.status !== 'Completed') {
      task.status      = 'In Progress — All Stops Visited';
      // Don't auto-complete — worker still needs to reach ENTRANCE (exit gate)
    }

    writeJSON('tasks.json', tasksData);
    res.json({
      success:          true,
      completedSlots:   task.completedSlots,
      currentStopIndex: task.currentStopIndex,
      allStopsVisited:  allDone
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
