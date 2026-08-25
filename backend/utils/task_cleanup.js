import { readJSON, writeJSON } from './jsonStore.js';
import { regenerateSVG } from '../services/svg_generator.js';

export async function cleanupStaleTasks() {
  try {
    const tasksData = readJSON('tasks.json', { tasks: [] });
    // Filter tasks that are actively Assigned or In Progress
    const activeTasks = (tasksData.tasks || []).filter(
      t => t.status !== 'Completed' && t.status !== 'Unassigned'
    );
    if (activeTasks.length === 0) return;

    const now = new Date();
    const STALE_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours
    let changed = false;

    // Load other databases lazily
    let cartGroupsData = null;
    let cartsData = null;
    let workersData = null;
    let slotRegistryData = null;
    let dispatchOrdersData = null;

    for (const task of activeTasks) {
      const lastUpdateStr = task.lastUpdatedAt || task.createdAt || task.assignedAt;
      if (!lastUpdateStr) continue;

      const lastUpdate = new Date(lastUpdateStr);
      if (now - lastUpdate >= STALE_THRESHOLD) {
        console.log(`[Task Cleanup] Task ${task.taskId} is stale (>24h). Unassigning worker & cart...`);
        changed = true;

        if (!cartGroupsData) cartGroupsData = readJSON('cart_groups.json', { groups: [] });
        if (!cartsData) cartsData = readJSON('carts.json', { carts: [] });
        if (!workersData) workersData = readJSON('workers.json', { workers: [] });
        if (!slotRegistryData) slotRegistryData = readJSON('slot_registry.json', { slots: {} });
        if (!dispatchOrdersData) dispatchOrdersData = readJSON('dispatch_orders.json', { dispatch_orders: [] });

        const isOutbound = task.type === 'outbound' || !!task.dispatch_order_id;

        // 1. Unassign worker
        const worker = workersData.workers.find(w => w.worker_id === task.workerId);
        if (worker) {
          worker.active_tasks = Math.max(0, (worker.active_tasks || 1) - 1);
          if (worker.active_tasks <= 0) {
            worker.status = 'Available';
            worker.current_zone = null;
          }
        }

        // 2. Unassign cart
        const cart = cartsData.carts.find(c => c.cart_id === task.cartId);
        if (cart) {
          cart.status = 'available';
          cart.assigned_worker_id = null;
        }

        if (isOutbound) {
          // Outbound unassignment
          const order = dispatchOrdersData.dispatch_orders.find(o => o.dispatch_order_id === task.dispatch_order_id);
          if (order) {
            order.status = 'pending';
            order.assigned_worker_id = null;
            order.assigned_cart_id = null;
            order.pick_task_id = null;
          }
        } else {
          // Inbound unassignment
          const group = cartGroupsData.groups.find(g => g.cart_group_id === task.clusterId);
          if (group) {
            group.status = 'pending';
            group.worker_id = null;
            group.cart_id = null;
          }

          // Unallocate slot status
          if (task.shelfCoordinates) {
            task.shelfCoordinates.forEach(sc => {
              if (slotRegistryData.slots[sc.slot_id]) {
                slotRegistryData.slots[sc.slot_id].cart_status = 'not_allocated';
              }
            });
          }
        }

        // 3. Mark task unassigned
        task.status = 'Unassigned';
        task.lastUpdatedAt = now.toISOString();
      }
    }

    if (changed) {
      writeJSON('tasks.json', tasksData);
      if (cartGroupsData) writeJSON('cart_groups.json', cartGroupsData);
      if (cartsData) writeJSON('carts.json', cartsData);
      if (workersData) writeJSON('workers.json', workersData);
      if (slotRegistryData) writeJSON('slot_registry.json', slotRegistryData);
      if (dispatchOrdersData) writeJSON('dispatch_orders.json', dispatchOrdersData);

      await regenerateSVG();
    }
  } catch (err) {
    console.error('[Task Cleanup] Stale tasks cleanup failed:', err);
  }
}
