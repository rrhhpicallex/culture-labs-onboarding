const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const [k, ...v] = t.split('=');
    if (k && v.length && !process.env[k]) process.env[k] = v.join('=');
  });
}

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error('Faltan env vars:', missing.join(', '));
  process.exit(1);
}

const dist = path.join(__dirname, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist);

let html = fs.readFileSync('index.html', 'utf8');
html = html
  .replace(/__SUPABASE_URL__/g, process.env.SUPABASE_URL)
  .replace(/__SUPABASE_ANON_KEY__/g, process.env.SUPABASE_ANON_KEY)
  .replace(/__SUPABASE_SCHEMA__/g, process.env.SUPABASE_SCHEMA || 'public');
fs.writeFileSync(path.join(dist, 'index.html'), html);

for (const asset of ['audio']) {
  if (fs.existsSync(asset)) fs.cpSync(asset, path.join(dist, asset), { recursive: true });
}

console.log('Build OK → dist/index.html');
