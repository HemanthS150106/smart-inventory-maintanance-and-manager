/**
 * TESTING RESET SCRIPT
 * Run with: node backend/scripts/reset_for_testing.js
 *
 * This script:
 * 1. Resets ALL workers to Available status
 * 2. Resets ALL carts to available status
 * 3. Creates 3 test workers if fewer than 3 exist
 * 4. Creates 3 test carts if fewer than 3 exist
 * 5. Prints a summary showing worker login IDs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE     = path.join(__dirname, '..', '..', 'data', 'registry');
const W_FILE   = path.join(BASE, 'workers.json');
const C_FILE   = path.join(BASE, 'carts.json');
const T_FILE   = path.join(BASE, 'tasks.json');
const CG_FILE  = path.join(BASE, 'cart_groups.json');

function readJSON(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch { return fallback; }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

console.log('\n🔧 TESTING RESET STARTING...\n');

// ── RESET ALL WORKERS ─────────────────────────────────────
const workersData = readJSON(W_FILE, { workers: [] });
workersData.workers.forEach(w => {
  w.status          = 'Available';
  w.active_tasks    = 0;
  w.current_zone    = null;
  w.last_assigned_at= null;
});

// ── ADD TEST WORKERS IF NEEDED ───────────────────────────
const pickers = workersData.workers.filter(
  w => w.role === 'picker'
);

if (pickers.length < 3) {
  const needed = 3 - pickers.length;
  const base   = workersData.workers.length;
  for (let i = 0; i < needed; i++) {
    const num      = base + i + 1;
    const loginId  = `worker${String(num).padStart(3,'0')}`;
    const workerId = `W${String(num).padStart(3,'0')}`;
    workersData.workers.push({
      worker_id:       workerId,
      login_id:        loginId,
      name:            `Test Picker ${num}`,
      password:        'warehouse123',
      role:            'picker',
      shift:           'morning',
      status:          'Available',
      active_tasks:    0,
      tasks_completed: 0,
      efficiency_score:100,
      is_active:       true,
      position_x:      3080,
      position_y:      960,
      position_zone:   null,
      last_assigned_at:null,
      current_zone:    null
    });
    console.log(`✅ Created worker: ${workerId} | login: ${loginId}`);
  }
}

writeJSON(W_FILE, workersData);

// ── RESET ALL CARTS ───────────────────────────────────────
const cartsData = readJSON(C_FILE, { carts: [] });
cartsData.carts.forEach(c => {
  c.status             = 'available';
  c.assigned_worker_id = null;
});

// ── ADD TEST CARTS IF NEEDED ─────────────────────────────
if (cartsData.carts.length < 3) {
  const needed = 3 - cartsData.carts.length;
  const base   = cartsData.carts.length;
  for (let i = 0; i < needed; i++) {
    const num    = base + i + 1;
    const cartId = `CART-${String(num).padStart(3,'0')}`;
    cartsData.carts.push({
      cart_id:             cartId,
      max_weight_kg:       150,
      max_volume_cf:       40,
      status:              'available',
      assigned_worker_id:  null
    });
    console.log(`✅ Created cart: ${cartId}`);
  }
}

writeJSON(C_FILE, cartsData);

// ── PRINT SUMMARY ─────────────────────────────────────────
console.log('\n════════════════════════════════════');
console.log('   TESTING READY — USE THESE LOGINS');
console.log('════════════════════════════════════\n');

const allPickers = workersData.workers.filter(
  w => w.role === 'picker' && w.is_active !== false
);

console.log('WORKER LOGINS (password: warehouse123):');
allPickers.forEach(w => {
  console.log(
    `  Login ID: ${w.login_id.padEnd(12)} | ` +
    `Name: ${w.name.padEnd(20)} | ` +
    `Worker ID: ${w.worker_id}`
  );
});

console.log('\nCARTS AVAILABLE:');
cartsData.carts.filter(c => c.status === 'available').forEach(c => {
  console.log(`  ${c.cart_id} | ${c.max_weight_kg}kg capacity`);
});

const groups = readJSON(CG_FILE, { groups: [] });
const pending = groups.groups.filter(g => g.status === 'pending');
console.log(`\nPENDING CART GROUPS: ${pending.length}`);
if (pending.length === 0) {
  console.log(
    '  ⚠️  No pending groups. Run clustering on Cart Allocation page first.'
  );
} else {
  pending.forEach(g => {
    console.log(
      `  ${g.cart_group_id} | ${g.items?.length || 0} items`
    );
  });
}

console.log('\n✅ Reset complete. Workers and carts are ready.\n');
