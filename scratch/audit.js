import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

function searchFile(filePath, regex, maxLines = 30) {
  const absPath = path.join(rootDir, filePath);
  if (!fs.existsSync(absPath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  const lines = fs.readFileSync(absPath, 'utf-8').split('\n');
  let count = 0;
  console.log(`--- ${filePath} ---`);
  lines.forEach((line, idx) => {
    if (regex.test(line) && count < maxLines) {
      console.log(`${idx + 1}: ${line.trim()}`);
      count++;
    }
  });
}

console.log('=== AUDIT CHECK 1 ===');
searchFile('backend/services/route_planner.js', /DISPATCH|DISPATCH_X|DISPATCH_Y|3120|3080|3160/i, 20);

console.log('\n=== AUDIT CHECK 2 ===');
searchFile('backend/services/svg_generator.py', /DISPATCH|dispatch|3080|3120|3160/i, 20);

console.log('\n=== AUDIT CHECK 3 ===');
searchFile('frontend/src/pages/WorkerDashboard.jsx', /highlightWorkerSlots|data-slot-id|opacity|dimm/i, 30);

console.log('\n=== AUDIT CHECK 4 ===');
searchFile('frontend/src/pages/MonitorDashboard.jsx', /getWorkerColor|worker.*color|color.*worker|#3b82f6|#ef4444/i, 20);

console.log('\n=== AUDIT CHECK 5 ===');
searchFile('frontend/src/pages/Simulation.jsx', /marker|circle|stop.*marker|drawMarker|pickup/i, 20);
