// Gera dist/mapa-causal.html: UM ficheiro autónomo, com JS, CSS e KB embutidos, sem recursos externos.
// Uso: node build.js [--dev]   (--dev = sem minificação, com sourcemap inline)
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';

const dev = process.argv.includes('--dev');
const raiz = path.dirname(new URL(import.meta.url).pathname);
const r = (...p) => path.join(raiz, ...p);

const js = await esbuild.build({
  entryPoints: [r('src/ui/main.js')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: !dev,
  sourcemap: dev ? 'inline' : false,
  legalComments: 'eof',
  write: false,
  define: { 'process.env.NODE_ENV': dev ? '"development"' : '"production"' },
  logLevel: 'warning',
});
let codigo = js.outputFiles[0].text;
// Impede o fecho prematuro do <script> inline.
codigo = codigo.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

const css = fs.readFileSync(r('src/ui/styles.css'), 'utf8');
const html = fs.readFileSync(r('src/ui/index.html'), 'utf8')
  .replace('/*__CSS__*/', () => css)
  .replace('/*__JS__*/', () => codigo);

fs.mkdirSync(r('dist'), { recursive: true });
const destino = r('dist/mapa-causal.html');
fs.writeFileSync(destino, html);
const kb = (fs.statSync(destino).size / 1024).toFixed(0);
console.log(`dist/mapa-causal.html — ${kb} KB${dev ? ' (dev)' : ''}`);
