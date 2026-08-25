import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cartRoutes from './routes/cart_routes.js';
import workerRoutes from './routes/worker_routes.js';
import cartAllocationRoutes from './routes/cart_allocation_routes.js';
import taskRoutes from './routes/task_routes.js';
import authRoutes from './routes/auth_routes.js';
import dispatchRoutes from './routes/dispatch_routes.js';
import comparisonRoutes from './routes/comparison_routes.js';
import { readJSON, writeJSON } from './utils/jsonStore.js';
import { cleanupStaleTasks } from './utils/task_cleanup.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(BASE_DIR, 'data', 'registry');
const PROCESSED_DIR = path.join(BASE_DIR, 'data', 'processed');
const SVG_DIR = path.join(BASE_DIR, 'frontend', 'svgs');
const MODELS_DIR = path.join(BASE_DIR, 'ml', 'models');

const app = express();
const port = 3001;

function migrateWorkers() {
  const data = readJSON('workers.json', { workers: [] });
  let changed = false;
  data.workers.forEach(w => {
    if (w.active_tasks === undefined) {
      w.active_tasks = 0; changed = true;
    }
    if (w.current_zone === undefined) {
      w.current_zone = null; changed = true;
    }
    if (w.last_assigned_at === undefined) {
      w.last_assigned_at = null; changed = true;
    }
    if (w.efficiency_score === undefined) {
      w.efficiency_score = 100; changed = true;
    }
    if (w.status === undefined) {
      w.status = 'Available'; changed = true;
    }
    if (w.position_x === undefined) {
      w.position_x = 3080;
      w.position_y = 960;
      changed = true;
    }
    if (w.position_zone === undefined) {
      w.position_zone = null;
      changed = true;
    }
  });
  if (changed) writeJSON('workers.json', data);
  console.log('✅ Worker model migration complete');
}
migrateWorkers();

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  cleanupStaleTasks().catch(err => console.error('[Cleanup Middleware] Error:', err));
  next();
});
app.use('/data', express.static(path.join(BASE_DIR, 'data')));

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const USERS_PATH = path.join(DATA_DIR, 'users.json');

function loadUsers() {
    if (!fs.existsSync(USERS_PATH)) return [];
    try { return JSON.parse(fs.readFileSync(USERS_PATH)); } catch(e) { return []; }
}

function saveUsers(users) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2));
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Missing token' });
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    } catch (e) {
        return res.status(403).json({ error: 'Invalid token' });
    }
}

app.post('/api/register', (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const users = loadUsers();
    if (users.find(u => u.email === email)) return res.status(409).json({ error: 'User exists' });

    const hashed = bcrypt.hashSync(password, 10);
    users.push({ email, password: hashed });
    saveUsers(users);
    res.json({ success: true });
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const users = loadUsers();
    const user = users.find(u => u.email === email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    let valid = false;
    try {
        if (typeof user.password === 'string' && user.password.startsWith('$2')) {
            valid = bcrypt.compareSync(password, user.password);
        } else {
            // support plaintext password in dev users.json
            valid = password === user.password;
        }
    } catch (e) {
        valid = false;
    }
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user: { email } });
});

app.post('/api/orders', authenticateToken, (req, res) => {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    
    const ordersPath = path.join(DATA_DIR, 'orders.json');
    let orders = [];
    if (fs.existsSync(ordersPath)) {
        try { orders = JSON.parse(fs.readFileSync(ordersPath)); } catch(e) {}
    }
    
    const newOrder = req.body;
    orders.push(newOrder);
    fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));
    
    res.json({ success: true, order_id: newOrder.order_id });
});

app.get('/api/orders', (req, res) => {
    const ordersPath = path.join(DATA_DIR, 'orders.json');
    let orders = [];
    if (fs.existsSync(ordersPath)) {
        try { orders = JSON.parse(fs.readFileSync(ordersPath)); } catch(e) {}
    }
    res.json({ orders: orders });
});

app.get('/api/slots', (req, res) => {
    const registry = readJSON('slot_registry.json', { slots: {} });
    res.json({ success: true, slots: registry.slots || {} });
});

app.get('/api/forecast', (req, res) => {
    const forecastPath = path.join(PROCESSED_DIR, 'forecast_output.csv');
    if (fs.existsSync(forecastPath)) {
        res.download(forecastPath);
    } else {
        res.status(404).json({ error: 'Forecast data not found' });
    }
});

app.post('/api/arrive', authenticateToken, (req, res) => {
    const ordersPath = path.join(DATA_DIR, 'orders.json');
    const pendingPath = path.join(DATA_DIR, 'pending_arrival.json');
    
    let orders = [];
    if (fs.existsSync(ordersPath)) {
        try { orders = JSON.parse(fs.readFileSync(ordersPath)); } catch(e) {}
    }
    
    const { order_id, arrived_item_ids } = req.body;
    
    // Find order
    const order = orders.find(o => o.order_id === order_id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    // Mark items arrived
    let allArrived = true;
    let pendingAllocations = [];
    
    order.items.forEach(item => {
        if (arrived_item_ids.includes(item.item_id)) {
            if (!item.arrived) {
                item.arrived = true;
                pendingAllocations.push({
                   item_id: item.item_id,
                   weight: item.weight,
                   qty: item.qty_ordered
                });
            }
        }
        if (!item.arrived) allArrived = false;
    });
    
    order.status = allArrived ? 'Complete' : 'Partial';
    fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));
    
    // Write pending allocations for python
    fs.writeFileSync(pendingPath, JSON.stringify({ order_id, items: pendingAllocations }, null, 2));
    
    const scriptPath = path.join(BASE_DIR, 'ml', 'utils', 'batch_simulator.py');
    exec(`python "${scriptPath}" --allocate`, { cwd: path.join(BASE_DIR, 'ml', 'utils') }, (error, stdout, stderr) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: 'Allocation failed' });
        }
        res.json({ success: true, status: order.status });
    });
});

app.post('/api/reset-warehouse', authenticateToken, (req, res) => {
    try {
        const resetRegistryPath = path.join(DATA_DIR, 'slot_registry.json');
        
        // Preserve slot structure, clear occupancy data
        if (fs.existsSync(resetRegistryPath)) {
            let registry = JSON.parse(fs.readFileSync(resetRegistryPath));
            if (registry.slots) {
                Object.keys(registry.slots).forEach(slotId => {
                    registry.slots[slotId].occupied = false;
                    registry.slots[slotId].item_id = null;
                    registry.slots[slotId].batch_id = null;
                    registry.slots[slotId].cart_status = 'not_allocated';
                });
                registry.total_batches = 0;
                registry.last_updated = new Date().toISOString();
                fs.writeFileSync(resetRegistryPath, JSON.stringify(registry, null, 2));
            }
        }
        
        // Clear cart_groups.json
        const cartGroupsPath = path.join(DATA_DIR, 'cart_groups.json');
        fs.writeFileSync(cartGroupsPath, JSON.stringify({ groups: [] }, null, 2));

        // Clear tasks.json
        const tasksPath = path.join(DATA_DIR, 'tasks.json');
        fs.writeFileSync(tasksPath, JSON.stringify({ tasks: [] }, null, 2));

        // Reset workers.json to Available status and reset coordinates
        const workersPath = path.join(DATA_DIR, 'workers.json');
        if (fs.existsSync(workersPath)) {
            try {
                let workersData = JSON.parse(fs.readFileSync(workersPath, 'utf8'));
                if (workersData.workers) {
                    workersData.workers.forEach(w => {
                        w.status = 'Available';
                        w.active_tasks = 0;
                        w.current_zone = null;
                        w.position_x = 3080;
                        w.position_y = 960;
                        w.position_zone = null;
                    });
                    fs.writeFileSync(workersPath, JSON.stringify(workersData, null, 2));
                }
            } catch(e) {}
        }

        // Reset carts.json to available
        const cartsPath = path.join(DATA_DIR, 'carts.json');
        if (fs.existsSync(cartsPath)) {
            try {
                let cartsData = JSON.parse(fs.readFileSync(cartsPath, 'utf8'));
                if (cartsData.carts) {
                    cartsData.carts.forEach(c => {
                        c.status = 'available';
                        c.assigned_worker_id = null;
                    });
                    fs.writeFileSync(cartsPath, JSON.stringify(cartsData, null, 2));
                }
            } catch(e) {}
        }
        
        // Clear arrivals_history
        if (fs.existsSync(path.join(DATA_DIR, 'arrivals_history.json'))) {
            fs.writeFileSync(path.join(DATA_DIR, 'arrivals_history.json'), '[]');
        }
        
        // Clear orders
        const ordersPath = path.join(DATA_DIR, 'orders.json');
        if (fs.existsSync(ordersPath)) {
            let orders = JSON.parse(fs.readFileSync(ordersPath));
            orders.forEach(order => {
                order.status = 'Ordered';
                if (order.items) { order.items.forEach(item => { item.arrived = false; }); }
            });
            fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));
        }

        // Regenerate empty SVG BEFORE responding
        const scriptPath = path.join(__dirname, 'services', 'svg_generator.py');
        exec(`python "${scriptPath}"`, { cwd: path.join(__dirname, 'services') }, (error) => {
            if (error) return res.status(500).json({ error: 'Failed' });
            
            try {
                fs.copyFileSync(
                    path.join(SVG_DIR, 'warehouse_blueprint.svg'),
                    path.join(SVG_DIR, 'warehouse_allocated.svg')
                );
            } catch(e) {}
            
            res.json({ success: true, message: 'Reset complete.' });
        });
    } catch(err) {
        res.status(500).json({ error: 'Reset failed' });
    }
});

app.use('/api/carts', cartRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/cart-allocation', cartAllocationRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/assign-workers', taskRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/dispatch', dispatchRoutes);
app.use('/api/algorithm-compare', comparisonRoutes);

function startupCleanup() {
  try {
    const tasksData   = readJSON('tasks.json',  { tasks:   [] });
    const workersData = readJSON('workers.json', { workers: [] });
    const cartsData   = readJSON('carts.json',   { carts:   [] });
    const workerIds   = new Set(
      workersData.workers.map(w => w.worker_id)
    );
    const now = new Date();
    let changed = false;

    tasksData.tasks.forEach(task => {
      if (task.status === 'Completed' ||
          task.status === 'Abandoned') return;
      const isOrphan = task.workerId && !workerIds.has(task.workerId);
      const isStale  = task.assignedAt &&
        (now - new Date(task.assignedAt)) / 3600000 > 12;
      if (isOrphan || isStale) {
        task.status      = 'Abandoned';
        task.abandonedAt = now.toISOString();
        task.abandonReason = isOrphan
          ? 'Worker deleted' : 'Stale task';
        changed = true;
        console.log(`Abandoned stale task: ${task.taskId}`);
      }
    });

    if (changed) {
      writeJSON('tasks.json', tasksData);
      console.log('Startup cleanup complete');
    }
  } catch (err) {
    console.error('Startup cleanup error:', err);
  }
}

startupCleanup();

app.listen(port, () => {
    console.log(`Backend API running at http://localhost:${port}`);
});
