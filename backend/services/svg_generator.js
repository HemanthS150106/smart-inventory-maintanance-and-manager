import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_DIR = path.join(__dirname, '..', '..');
const SVG_DIR = path.join(BASE_DIR, 'frontend', 'svgs');
const PUBLIC_DIR = path.join(BASE_DIR, 'frontend', 'public');
const REG_PATH = path.join(BASE_DIR, 'data', 'registry', 'slot_registry.json');
const SCRIPT_PATH = path.join(__dirname, 'svg_generator.py');

export function regenerateSVG() {
  return new Promise((resolve, reject) => {
    const outAllocated = path.join(SVG_DIR, 'warehouse_allocated.svg');
    exec(`python "${SCRIPT_PATH}" "${outAllocated}" "${REG_PATH}"`, { cwd: __dirname }, (error, stdout, stderr) => {
      if (error) {
        console.error('Error running svg_generator.py:', error, stderr);
        return reject(error);
      }
      
      try {
        // Copy to public directory for frontend static serving
        fs.copyFileSync(outAllocated, path.join(PUBLIC_DIR, 'warehouse_allocated.svg'));
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
}
