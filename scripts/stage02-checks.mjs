import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const root = path.resolve('..');
const manifest = fs.readFileSync(path.join(root,'docs/audit/BASE_SOURCE_SHA256.txt'),'utf8').trim().split(/\r?\n/);
for(const line of manifest) {
  const [,hash,file] = line.match(/^([a-f0-9]{64})\s+(.+)$/i) ?? [];
  assert.ok(hash, `Invalid manifest line: ${line}`);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),hash, file);
}
console.log(`PASS: Base integrity (${manifest.length} files)`);
assert.match(fs.readFileSync('index.html','utf8'),/lang="en"/);
console.log('PASS: English HTML default');
const db=fs.readFileSync('src/storage/db.ts','utf8');
assert.match(db,/super\('handbook'\)/);
const actions=fs.readFileSync('src/shell/fileActions.ts','utf8');
for(const format of ['handbook-backup','inkforge-backup','handbook-handwriting','inkforge-handwriting','handbook-document','inkforge-document']) assert.ok(actions.includes(format),format);
console.log('PASS: legacy database and dual-format import source guards (not runtime migration)');
const config=JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json','utf8'));
assert.ok(config.app.security.csp);
assert.ok(!/https:\/\//.test(config.app.security.csp));
console.log('PASS: non-null desktop CSP without remote HTTPS allowlist (not runtime verification)');
const files=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(/\.(tsx?|css)$/.test(file))files.push(file);}}
walk('src');
const residual=files.flatMap(file=>fs.readFileSync(file,'utf8').split(/\r?\n/).flatMap((line,i)=>/[А-Яа-яЁё]/.test(line)?[`${file}:${i+1}: ${line.trim()}`]:[]));
console.log(`AUDIT: ${files.length} UI/source files; ${residual.length} Cyrillic-bearing lines require classification (includes required handwriting data and comments)`);
fs.writeFileSync('stage02-cyrillic-audit.log',residual.join('\n'));
