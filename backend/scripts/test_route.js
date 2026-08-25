import { buildPickingRoute } from '../services/route_planner.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  const registryPath = path.join(__dirname, '..', '..', 'data', 'registry', 'slot_registry.json');
  const reg = JSON.parse(
    fs.readFileSync(registryPath, 'utf-8')
  );
  
  const occupied = Object.entries(reg.slots || {})
    .filter(([_, s]) => s.occupied)
    .slice(0, 6)
    .map(([slot_id, s]) => ({ slot_id, item_id: s.item_id, x: s.x, y: s.y }));

  if (occupied.length === 0) {
    console.log('No occupied slots found in slot_registry.json. Generating mock slots for testing.');
    occupied.push(
      { slot_id: 'A1A-01-L1', item_id: 'ITEM_01', x: 100, y: 230 },
      { slot_id: 'B2A-03-L1', item_id: 'ITEM_02', x: 1800, y: 668 }
    );
  }

  console.log('Computing route for slots:', occupied.map(s => s.slot_id));
  const result = buildPickingRoute(occupied);
  const steps  = result.route;
  const last   = steps[steps.length - 1];
  const second = steps[steps.length - 2];

  console.log('Total steps:', steps.length);
  console.log('Last step type:', last.type, '| node:', last.node_id);
  console.log('Second-to-last:', second?.type, '| node:', second?.node_id);
  console.log('DISPATCH is last:', last.type === 'end' ? 'YES ✅' : 'NO ❌');

  // Check no intermediate end steps
  const endSteps = steps.filter(s => s.type === 'end');
  console.log('Number of end steps:', endSteps.length,
    endSteps.length === 1 ? '✅' : '❌ MULTIPLE END STEPS FOUND');
} catch (e) {
  console.error('Error running test script:', e);
}
