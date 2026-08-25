import express from 'express';
import { readJSON, writeJSON } from '../utils/jsonStore.js';
import { buildPickingRoute, GLOBAL_GRAPH, findNearestNode, astar, validateRoute } from '../services/route_planner.js';
import { runCongestionControl } from '../services/congestion_control.js';

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

// PATCH /:id/position - Update worker position
router.patch('/:id/position', (req, res) => {
  const { x, y, zone } = req.body;
  const data   = readJSON('workers.json', { workers: [] });
  const worker = data.workers.find(w => w.worker_id === req.params.id);
  if (!worker) return res.status(404).json({ error: 'Not found' });
  worker.position_x    = x;
  worker.position_y    = y;
  worker.position_zone = zone || null;
  writeJSON('workers.json', data);
  res.json({ success: true });
});

// GET /positions - Retrieve active worker positions
router.get('/positions', (req, res) => {
  const data = readJSON('workers.json', { workers: [] });
  const positions = data.workers
    .filter(w => w.is_active !== false && w.status === 'Busy')
    .map(w => ({
      worker_id:     w.worker_id,
      name:          w.name,
      position_x:    w.position_x || 3080,
      position_y:    w.position_y || 960,
      position_zone: w.position_zone,
      status:        w.status,
      active_tasks:  w.active_tasks || 0
    }));
  res.json({ success: true, positions });
});

// GET /congestion-check
// Replace existing congestion-check with new capacity-based version
router.get('/congestion-check', (req, res) => {
  try {
    const result = runCongestionControl();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Congestion control error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /aisle-states
// Returns current occupancy for all aisles (for monitor display)
router.get('/aisle-states', (req, res) => {
  try {
    const result = runCongestionControl();
    res.json({ success: true, aisle_states: result.aisle_states });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /reroute/:workerId
router.post('/reroute/:workerId', (req, res) => {
  try {
    const tasksData   = readJSON('tasks.json', { tasks: [] });
    const workersData = readJSON('workers.json', { workers: [] });
    const worker      = workersData.workers.find(
      w => w.worker_id === req.params.workerId
    );

    if (!worker) return res.status(404).json({ error: 'Not found' });

    const activeTask = tasksData.tasks.find(
      t => t.workerId === req.params.workerId &&
           t.status !== 'Completed'
    );

    if (!activeTask || !activeTask.shelfCoordinates) {
      return res.json({ success: true, message: 'No active task' });
    }

    const zone = worker.position_zone || 'A';
    const aisleYs = {
      A: [394, 832, 1270, 1708],
      B: [394, 832, 1270, 1708],
      C: [1294, 1732, 2170],
      D: [1294, 1732, 2170],
    }[zone] || [];

    let bestAisleIdx = 0;
    let bestDist = Infinity;
    aisleYs.forEach((wy, idx) => {
      const d = Math.abs((worker.position_y || 0) - wy);
      if (d < bestDist) { bestDist = d; bestAisleIdx = idx; }
    });

    const avoidAisle = `W_${zone}_P${bestAisleIdx + 1}`;

    const remainingSlots = activeTask.shelfCoordinates.filter(
      s => !(activeTask.completedSlots || []).includes(s.slot_id)
    );

    const newRoute = buildPickingRoute(remainingSlots, avoidAisle);
    if (validateRoute(newRoute.route, activeTask.taskId)) {
      activeTask.route         = newRoute.route;
      activeTask.totalDistance = newRoute.totalDistance;
    }
    activeTask.reroutedAt    = new Date().toISOString();
    activeTask.rerouteReason = 'Congestion avoidance';
    activeTask.lastUpdatedAt = new Date().toISOString();

    writeJSON('tasks.json', tasksData);

    res.json({ success: true, newRoute });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workers/:id/plan-path
router.post('/:id/plan-path', (req, res) => {
  try {
    const { targetX, targetY } = req.body;
    const workersData = readJSON('workers.json', { workers: [] });
    const worker = workersData.workers.find(w => w.worker_id === req.params.id);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    const currentX = worker.position_x || 3080;
    const currentY = worker.position_y || 960;

    const allNodeIds = Object.keys(GLOBAL_GRAPH.nodes);
    const startNode = findNearestNode(allNodeIds, GLOBAL_GRAPH.nodes, currentX, currentY);
    const endNode = findNearestNode(allNodeIds, GLOBAL_GRAPH.nodes, targetX, targetY);

    if (!startNode || !endNode) {
      return res.status(400).json({ error: 'Could not resolve nearest graph nodes' });
    }

    const path = astar(GLOBAL_GRAPH, startNode, endNode);
    const coords = path.map(nodeId => {
      const n = GLOBAL_GRAPH.nodes[nodeId];
      return n ? { x: n.x, y: n.y } : null;
    }).filter(Boolean);

    // Synchronize planned manual route to active task so the worker's route optimization map updates in real-time
    const tasksData = readJSON('tasks.json', { tasks: [] });
    const task = tasksData.tasks.find(
      t => (t.workerId === req.params.id || t.worker_id === req.params.id) && t.status !== 'Completed'
    );
    if (task) {
      task.route = [
        {
          step: 1,
          type: "start",
          slot_id: "CURRENT_POSITION",
          aisle_path: coords
        },
        {
          step: 2,
          type: "end",
          slot_id: "DISPATCH",
          aisle_path: []
        }
      ];
      task.totalDistance = Math.round(coords.length * 15);
      task.lastUpdatedAt = new Date().toISOString();
      writeJSON('tasks.json', tasksData);
    }

    res.json({ success: true, path: coords });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
