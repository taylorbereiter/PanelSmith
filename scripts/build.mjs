// Bundles the app into a single self-contained HTML file: dist/index.html.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const watch = process.argv.includes('--dev');
const result = await build({
  entryPoints: ['src/main.jsx'],
  bundle: true, write: false, format: 'iife', target: 'es2020',
  minify: !watch, sourcemap: watch ? 'inline' : false,
  jsx: 'automatic', jsxImportSource: 'preact',
  loader: { '.woff2': 'dataurl', '.css': 'text' },
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'none',
});
const js = result.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const html = readFileSync('src/index.html', 'utf8').replace('<!--APP-->', () => `<script>${js}</script>`);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.html', html);
console.log(`dist/index.html  ${(html.length / 1024).toFixed(0)} KB`);
