// Regenerates api/lib/manual.js from docs/user-manual.md.
// Run: node scripts/build-manual.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const md = fs.readFileSync(path.join(root, 'docs', 'user-manual.md'), 'utf8');

// Escape for a JS template literal: backslashes, backticks, ${
const escaped = md
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$\{/g, '\\${');

const out =
  '// AUTO-GENERATED from docs/user-manual.md — keep the two in sync.\n' +
  'export const MANUAL = `' + escaped + '`\n';

fs.writeFileSync(path.join(root, 'api', 'lib', 'manual.js'), out);
console.log('api/lib/manual.js written:', out.length, 'chars');
