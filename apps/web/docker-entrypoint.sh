#!/bin/sh
set -e
node -e "
const fs = require('fs');
const path = require('path');
const url = process.env.NEXT_PUBLIC_API_URL;
const token = '__RUNTIME_NEXT_PUBLIC_API_URL__';
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(js|json)$/.test(entry.name)) {
      const content = fs.readFileSync(p, 'utf8');
      if (content.includes(token)) fs.writeFileSync(p, content.split(token).join(url));
    }
  }
}
walk('apps/web/.next');
"
exec node apps/web/server.js
