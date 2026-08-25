import express from 'express';
import { readJSON, writeJSON } from '../utils/jsonStore.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { regenerateSVG } from '../services/svg_generator.js';
import { buildPickingRoute, validateRoute } from '../services/route_planner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

router.post('/cluster', async (req, res) => {
  try {
    const registry = readJSON('slot_registry.json', { slots: {} });

    const slotOnly = Object.entries(registry.slots)
      .filter(([_, s]) => s.cart_status === 'slot_only')
      .map(([slot_id, s]) => ({
        slot_id, item_id: s.item_id, x: s.x, y: s.y
      }));

    if (slotOnly.length === 0) {
      return res.json({ success: true, groups: [], message: 'No slot-only items to cluster' });
    }

    const scriptPath = path.join(__dirname, '..', 'services', 'cart_clusterer.py');
    // Use 'python' for Windows compatibility instead of 'python3'
    const py = spawn('python', [scriptPath]);
    let output = '';
    let errorOutput = '';
    
    py.stdout.on('data', d => output += d.toString());
    py.stderr.on('data', d => errorOutput += d.toString());
    
    py.stdin.write(JSON.stringify({
      slots: slotOnly, avg_items_per_cart: 8
    }));
    py.stdin.end();

    py.on('close', (code) => {
      if (code !== 0) {
        console.error('Python clustering error output:', errorOutput);
        return res.status(500).json({ error: 'Clustering failed: ' + errorOutput });
      }
      try {
        const { clusters } = JSON.parse(output);

        const groupsData = readJSON('cart_groups.json', { groups: [] });
        const newGroups = [];

        clusters.forEach((slotIds) => {
          const groupId = `CG-${String(groupsData.groups.length + 1).padStart(3,'0')}`;
          const items = slotIds.map(slotId => {
            const s = registry.slots[slotId];
            return { item_id: s.item_id, slot_id: slotId, x: s.x, y: s.y };
          });
          const group = {
            cart_group_id: groupId,
            status: 'pending',
            cart_id: null,
            worker_id: null,
            created_at: new Date().toISOString(),
            items
          };
          groupsData.groups.push(group);
          newGroups.push(group);
        });

        writeJSON('cart_groups.json', groupsData);
        res.json({ success: true, groups: newGroups });
      } catch (parseErr) {
        console.error('Failed to parse Python clustering output:', output, parseErr);
        res.status(500).json({ error: 'Failed to parse clustering output: ' + parseErr.message });
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/pending-groups', (req, res) => {
  const data = readJSON('cart_groups.json', { groups: [] });
  res.json({ success: true, groups: data.groups.filter(g => g.status === 'pending') });
});

router.post('/assign', async (req, res) => {
  try {
    const { cart_group_id, worker_id, cart_id } = req.body;

    // CHECK 1 — Worker must not have any active tasks
    const tasksData = readJSON('tasks.json', { tasks: [] });
    const workerActiveTasks = tasksData.tasks.filter(t =>
      t.workerId === worker_id &&
      (t.status === 'Assigned' || t.status === 'In Progress')
    );
    if (workerActiveTasks.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Worker already has ${workerActiveTasks.length} active task(s). Worker must complete current task before receiving a new assignment.`
      });
    }

    // CHECK 2 — Cart must not already be assigned
    const cartsData = readJSON('carts.json', { carts: [] });
    const cart = cartsData.carts.find(c => c.cart_id === cart_id);
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }
    if (cart.status !== 'available') {
      return res.status(400).json({
        success: false,
        error: `Cart ${cart_id} is currently ${cart.status}. Cart must be available before assignment.`
      });
    }

    // CHECK 3 — Worker must be Available status
    const workersData = readJSON('workers.json', { workers: [] });
    const worker = workersData.workers.find(
      w => w.worker_id === worker_id
    );
    if (!worker || worker.status !== 'Available') {
      return res.status(400).json({
        success: false,
        error: 'Worker is not available for assignment.'
      });
    }

    // All checks passed — proceed with assignment (existing logic)
    const groupsData = readJSON('cart_groups.json', { groups: [] });
    const group = groupsData.groups.find(
      g => g.cart_group_id === cart_group_id
    );
    if (!group) return res.status(404).json({ error: 'Group not found' });

    group.status = 'assigned';
    group.worker_id = worker_id;
    group.cart_id = cart_id;
    writeJSON('cart_groups.json', groupsData);

    cart.status = 'assigned';
    cart.assigned_worker_id = worker_id;
    writeJSON('carts.json', cartsData);

    const registry = readJSON('slot_registry.json', { slots: {} });
    group.items.forEach(item => {
      if (registry.slots[item.slot_id]) {
        registry.slots[item.slot_id].cart_status = 'cart_allocated';
      }
    });
    writeJSON('slot_registry.json', registry);

    await regenerateSVG();

    // Update worker status to Busy
    const workerRef = workersData.workers.find(
      w => w.worker_id === worker_id
    );
    if (workerRef) {
      workerRef.status           = 'Busy';
      workerRef.active_tasks     = (workerRef.active_tasks || 0) + 1;
      workerRef.last_assigned_at = new Date().toISOString();
      workerRef.current_zone     = group.items?.[0]?.zone || null;
    }
    writeJSON('workers.json', workersData);

    // Calculate picking route
    const routeData = buildPickingRoute(
      group.items.map(i => ({
        slot_id: i.slot_id,
        item_id: i.item_id,
        x:       i.x,
        y:       i.y
      }))
    );

    // Create task entry
    const taskId = `TASK-${String(tasksData.tasks.length + 1)
      .padStart(4,'0')}`;

    if (!validateRoute(routeData.route, taskId)) {
      console.error('Invalid route — rejecting task creation');
      return res.status(500).json({
        error: 'Route generation failed validation'
      });
    }

    const task = {
      taskId,
      workerId:  worker_id,
      cartId:    cart_id,
      clusterId: cart_group_id,
      status:    'Assigned',
      assignedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      shelfCoordinates: group.items.map(i => ({
        slot_id: i.slot_id, x: i.x, y: i.y, item_id: i.item_id
      })),
      route:         routeData.route,
      totalDistance: routeData.totalDistance,
      totalStops:    routeData.totalStops,
      sourceZone:    group.items?.[0]?.zone || null,
      destinationZone: 'DISPATCH',
      completedSlots: [],
      currentStopIndex: 0
    };
    tasksData.tasks.push(task);
    writeJSON('tasks.json', tasksData);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/worker-todo/:worker_id', (req, res) => {
  const data = readJSON('cart_groups.json', { groups: [] });
  const group = data.groups.find(
    g => g.worker_id === req.params.worker_id &&
         (g.status === 'assigned' || g.status === 'in_progress')
  );
  if (!group) {
    return res.json({ success: true, group: null, items: [] });
  }
  res.json({ success: true, group, items: group.items });
});

// ─── WORKER ASSIGNMENT ENGINE ──────────────────────────────

// Simple in-memory lock to prevent race conditions during
// simultaneous cart allocations
const assignmentLock = new Set();

function scoreWorker(worker, now, maxIdleMinutes, maxTasks,
                     maxActiveTasks) {
  // Availability score — longer idle = higher score
  let availScore = 100;
  if (worker.last_assigned_at) {
    const idleMinutes = (now - new Date(worker.last_assigned_at))
                        / 60000;
    availScore = Math.min(100,
      (idleMinutes / maxIdleMinutes) * 100
    );
  }

  // Experience score — more tasks completed = higher score
  const expScore = maxTasks > 0
    ? Math.min(100, (worker.tasks_completed / maxTasks) * 100)
    : 0;

  // Workload score — fewer active tasks = higher score
  const workloadScore = maxActiveTasks > 0
    ? Math.min(100,
        (1 - (worker.active_tasks / maxActiveTasks)) * 100
      )
    : 100;

  return (0.5 * availScore) +
         (0.3 * expScore)  +
         (0.2 * workloadScore);
}

async function assignWorkersToAllocatedCarts(allocatedCarts,
                                              orderId) {
  const workersData = readJSON('workers.json', { workers: [] });
  const tasksData   = readJSON('tasks.json',   { tasks:   [] });

  const now = new Date();

  // Pre-compute normalization constants across ALL workers
  const allWorkers    = workersData.workers;
  const maxTasks      = Math.max(...allWorkers.map(
                          w => w.tasks_completed || 0), 1);
  const maxActiveTasks= Math.max(...allWorkers.map(
                          w => w.active_tasks    || 0), 1);
  const maxIdleMinutes= 480; // 8 hour shift cap

  // Eligible workers: Available + matching shift
  // (role filter applied per-cart if cart has required_role,
  //  otherwise any role is eligible)
  const currentShift = getCurrentShift(now); // helper below

  const eligible = allWorkers.filter(w =>
    w.status === 'Available' && w.shift && w.shift.toLowerCase() === currentShift.toLowerCase()
  );

  // Score all eligible workers ONCE before looping carts
  // so scoring is O(workers) not O(workers × carts)
  const scored = eligible
    .map(w => ({
      ...w,
      score: scoreWorker(w, now, maxIdleMinutes,
                         maxTasks, maxActiveTasks)
    }))
    .sort((a, b) => {
      if (Math.abs(a.score - b.score) > 0.5) return b.score - a.score;
      // Tie breaker 1: fewer active tasks
      if (a.active_tasks !== b.active_tasks)
        return a.active_tasks - b.active_tasks;
      // Tie breaker 2: older last_assigned_at
      const aTime = a.last_assigned_at
        ? new Date(a.last_assigned_at).getTime() : 0;
      const bTime = b.last_assigned_at
        ? new Date(b.last_assigned_at).getTime() : 0;
      return aTime - bTime;
    });

  const assignedWorkerIds = new Set(); // prevent double assign
  const newTasks = [];

  for (const cart of allocatedCarts) {
    if (assignmentLock.has(cart.cart_id)) {
      console.warn(`Cart ${cart.cart_id} already being assigned`);
      continue;
    }
    assignmentLock.add(cart.cart_id);

    try {
      // Pick highest-scoring worker not already assigned this round
      const worker = scored.find(
        w => !assignedWorkerIds.has(w.worker_id)
      );

      if (!worker) {
        console.warn('No eligible workers available for cart',
                      cart.cart_id);
        continue;
      }

      assignedWorkerIds.add(worker.worker_id);

      // Update worker fields in allWorkers array
      const wRef = allWorkers.find(
        w => w.worker_id === worker.worker_id
      );
      if (wRef) {
        wRef.status           = 'Busy';
        wRef.active_tasks     = (wRef.active_tasks || 0) + 1;
        wRef.last_assigned_at = now.toISOString();
        wRef.current_zone     = cart.zone || null;
      }

      // Build task
      const taskId = `TASK-${String(tasksData.tasks.length + 
                      newTasks.length + 1).padStart(4,'0')}`;

      const task = {
        taskId,
        orderId:   orderId || null,
        workerId:  worker.worker_id,
        cartId:    cart.cart_id,
        clusterId: cart.cart_group_id || null,
        status:    'Assigned',
        assignedAt: now.toISOString(),
        createdAt: now.toISOString(),
        lastUpdatedAt: now.toISOString(),
        estimatedCompletionTime: null,
        // Routing metadata (not implemented yet — stored for future)
        shelfCoordinates: cart.items
          ? cart.items.map(i => ({ slot_id: i.slot_id,
                                   x: i.x, y: i.y }))
          : [],
        sourceZone:      cart.zone      || null,
        destinationZone: 'DISPATCH'
      };

      newTasks.push(task);
    } finally {
      assignmentLock.delete(cart.cart_id);
    }
  }

  // Persist everything ONCE after loop (not per iteration)
  writeJSON('workers.json',
    { workers: workersData.workers });
  writeJSON('tasks.json',
    { tasks: [...tasksData.tasks, ...newTasks] });

  return newTasks;
}

function getCurrentShift(now) {
  const hour = now.getHours();
  if (hour >= 6  && hour < 14) return 'morning';
  if (hour >= 14 && hour < 22) return 'afternoon';
  return 'night';
}

export default router;
