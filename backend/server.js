import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(BASE_DIR, 'data', 'registry');
const PROCESSED_DIR = path.join(BASE_DIR, 'data', 'processed');
const SVG_DIR = path.join(BASE_DIR, 'frontend', 'svgs');
const MODELS_DIR = path.join(BASE_DIR, 'ml', 'models');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());
app.use('/data', express.static(path.join(BASE_DIR, 'data')));

app.post('/api/orders', (req, res) => {
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

app.get('/api/forecast', (req, res) => {
    const forecastPath = path.join(PROCESSED_DIR, 'forecast_output.csv');
    if (fs.existsSync(forecastPath)) {
        res.download(forecastPath);
    } else {
        res.status(404).json({ error: 'Forecast data not found' });
    }
});

app.post('/api/arrive', (req, res) => {
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

app.post('/api/reset-warehouse', (req, res) => {
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
                });
                registry.total_batches = 0;
                registry.last_updated = new Date().toISOString();
                fs.writeFileSync(resetRegistryPath, JSON.stringify(registry, null, 2));
            }
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

app.listen(port, () => {
    console.log(`Backend API running at http://localhost:${port}`);
});
