import express from 'express';
const router = express.Router();
import { readJSON, writeJSON } from '../utils/jsonStore.js';
import { buildPickingRoute, validateRoute } from '../services/route_planner.js';
import { regenerateSVG } from '../services/svg_generator.js';

// GET /api/dispatch — all dispatch orders
router.get('/', (req, res) => {
  const data = readJSON('dispatch_orders.json', { dispatch_orders: [] });
  res.json({ success: true, dispatch_orders: data.dispatch_orders });
});

// POST /api/dispatch — create new dispatch order
// Body: { items: [{ item_id, qty_needed }] }
router.post('/', (req, res) => {
  try {
    const { items } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No items provided' });
    }

    const data     = readJSON('dispatch_orders.json', { dispatch_orders: [] });
    const registry = readJSON('slot_registry.json', { slots: {} });

    const num = data.dispatch_orders.length + 1;
    const id  = `DO-${String(num).padStart(3, '0')}`;

    // Find where each item is slotted in the warehouse
    const enrichedItems = items.map(reqItem => {
      // Find occupied slot containing this item
      const slot = Object.entries(registry.slots || {}).find(
        ([_, s]) => s.item_id === reqItem.item_id && s.occupied
      );
      return {
        item_id:    reqItem.item_id,
        qty_needed: reqItem.qty_needed || 1,
        slot_id:    slot ? slot[0] : null,
        slot_x:     slot ? slot[1].x : null,
        slot_y:     slot ? slot[1].y : null,
        picked:     false
      };
    });

    const unlocated = enrichedItems.filter(i => !i.slot_id);
    if (unlocated.length > 0) {
      return res.status(400).json({
        error: 'Items not found in warehouse',
        unlocated: unlocated.map(i => i.item_id)
      });
    }

    const order = {
      dispatch_order_id:  id,
      created_at:         new Date().toISOString(),
      status:             'pending',
      items:              enrichedItems,
      assigned_worker_id: null,
      assigned_cart_id:   null,
      pick_task_id:       null
    };

    data.dispatch_orders.push(order);
    writeJSON('dispatch_orders.json', data);

    res.json({ success: true, dispatch_order: order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/dispatch/:id/assign — assign worker + cart to pick order
router.post('/:id/assign', (req, res) => {
  try {
    const { worker_id, cart_id } = req.body;
    const data = readJSON('dispatch_orders.json', { dispatch_orders: [] });
    const order = data.dispatch_orders.find(
      o => o.dispatch_order_id === req.params.id
    );
    if (!order) return res.status(404).json({ error: 'Not found' });

    // Build pick route for this order's slot locations
    const slotsForRoute = order.items
      .filter(i => i.slot_id)
      .map(i => ({
        slot_id: i.slot_id,
        item_id: i.item_id,
        x:       i.slot_x || 0,
        y:       i.slot_y || 0
      }));

    const routeData = buildPickingRoute(slotsForRoute);

    // Create pick task in tasks.json
    const tasksData = readJSON('tasks.json', { tasks: [] });
    const taskId    = `PICK-${String(tasksData.tasks.length + 1).padStart(4, '0')}`;

    if (!validateRoute(routeData.route, taskId)) {
      console.error('Invalid route — rejecting task creation');
      return res.status(500).json({
        error: 'Route generation failed validation'
      });
    }

    const task = {
      taskId,
      type:             'outbound',    // distinguish from inbound tasks
      workerId:         worker_id,
      cartId:           cart_id,
      dispatch_order_id: order.dispatch_order_id,
      status:           'Assigned',
      assignedAt:       new Date().toISOString(),
      createdAt:        new Date().toISOString(),
      lastUpdatedAt:    new Date().toISOString(),
      shelfCoordinates: slotsForRoute,
      route:            routeData.route,
      totalDistance:    routeData.totalDistance,
      totalStops:       routeData.totalStops,
      sourceZone:       'WAREHOUSE',
      destinationZone:  'DISPATCH',
      completedSlots: [],
      currentStopIndex: 0
    };

    tasksData.tasks.push(task);
    writeJSON('tasks.json', tasksData);

    // Update order
    order.status             = 'assigned';
    order.assigned_worker_id = worker_id;
    order.assigned_cart_id   = cart_id;
    order.pick_task_id       = taskId;
    writeJSON('dispatch_orders.json', data);

    // Update worker status
    const workersData = readJSON('workers.json', { workers: [] });
    const worker = workersData.workers.find(
      w => w.worker_id === worker_id
    );
    if (worker) {
      worker.status           = 'Busy';
      worker.active_tasks     = (worker.active_tasks || 0) + 1;
      worker.last_assigned_at = new Date().toISOString();
    }
    writeJSON('workers.json', workersData);

    // Update cart
    const cartsData = readJSON('carts.json', { carts: [] });
    const cart = cartsData.carts.find(c => c.cart_id === cart_id);
    if (cart) {
      cart.status             = 'assigned';
      cart.assigned_worker_id = worker_id;
    }
    writeJSON('carts.json', cartsData);

    res.json({ success: true, task });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/dispatch/:id/complete — mark order as dispatched
router.patch('/:id/complete', (req, res) => {
  try {
    const data  = readJSON('dispatch_orders.json', { dispatch_orders: [] });
    const order = data.dispatch_orders.find(
      o => o.dispatch_order_id === req.params.id
    );
    if (!order) return res.status(404).json({ error: 'Not found' });

    // Free the slots that were picked
    const registry = readJSON('slot_registry.json', { slots: {} });
    order.items.forEach(item => {
      if (item.slot_id && registry.slots[item.slot_id]) {
        registry.slots[item.slot_id].occupied     = false;
        registry.slots[item.slot_id].item_id      = null;
        registry.slots[item.slot_id].batch_id     = null;
        registry.slots[item.slot_id].cart_status  = 'not_allocated';
      }
    });
    writeJSON('slot_registry.json', registry);

    // Update task status
    const tasksData = readJSON('tasks.json', { tasks: [] });
    const task = tasksData.tasks.find(
      t => t.taskId === order.pick_task_id
    );
    if (task) {
      task.status      = 'Completed';
      task.completedAt = new Date().toISOString();
    }
    writeJSON('tasks.json', tasksData);

    // Free worker + cart
    const workersData = readJSON('workers.json', { workers: [] });
    const worker = workersData.workers.find(
      w => w.worker_id === order.assigned_worker_id
    );
    if (worker) {
      worker.active_tasks = Math.max(0, (worker.active_tasks || 1) - 1);
      if (worker.active_tasks <= 0) worker.status = 'Available';
      worker.tasks_completed = (worker.tasks_completed || 0) + 1;
    }
    writeJSON('workers.json', workersData);

    const cartsData = readJSON('carts.json', { carts: [] });
    const cart = cartsData.carts.find(
      c => c.cart_id === order.assigned_cart_id
    );
    if (cart) {
      cart.status             = 'available';
      cart.assigned_worker_id = null;
    }
    writeJSON('carts.json', cartsData);

    order.status       = 'dispatched';
    order.dispatched_at= new Date().toISOString();
    writeJSON('dispatch_orders.json', data);

    // Regenerate SVG to clear freed slots
    regenerateSVG().catch(console.error);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
