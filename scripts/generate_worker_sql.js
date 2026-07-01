const fs = require('fs');
const source = 'warehouse_workers_final.json';
const target = 'warehouse_workers_final.sql';
const json = JSON.parse(fs.readFileSync(source, 'utf8'));
const rows = json.workers || [];
const columns = ['worker_id','name','role','shift','status','tasks_completed','age','gender'];
const escape = (v) => v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;
let sql = 'CREATE TABLE IF NOT EXISTS warehouse_workers_final (worker_id TEXT PRIMARY KEY, name TEXT, role TEXT, shift TEXT, status TEXT, tasks_completed INTEGER, age INTEGER, gender TEXT);\n\n';
for (const row of rows) {
  const vals = columns.map((c) => escape(row[c])).join(', ');
  sql += `INSERT INTO warehouse_workers_final (${columns.join(', ')}) VALUES (${vals});\n`;
}
fs.writeFileSync(target, sql, 'utf8');
console.log(`Generated ${target} with ${rows.length} rows.`);
