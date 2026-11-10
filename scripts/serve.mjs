// Minimal static server for dist/ so the app can run from http://localhost.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const port = process.env.PORT || 5173;
createServer(async (req, res) => {
  try {
    const html = await readFile('dist/index.html');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html);
  } catch { res.writeHead(500); res.end('Run "npm run build" first.'); }
}).listen(port, () => console.log(`Panelsmith is running at http://localhost:${port}`));
