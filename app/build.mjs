// Monta a pasta "dist" do aplicativo: junta a tela do jogo, o painel e o motor num só lugar.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIST = path.join(RAIZ, 'dist');
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'socket.io'), { recursive: true });

await build({
  entryPoints: [path.join(RAIZ, 'app/main.js')],
  bundle: true,
  format: 'iife',
  target: ['chrome90'],
  outfile: path.join(DIST, 'app.js'),
  logLevel: 'warning',
});

// apresentadora 3D (vai para public/, usada no PC e no aplicativo)
await build({
  entryPoints: [path.join(RAIZ, 'fontes/apresentadora.js')],
  bundle: true, format: 'iife', target: ['chrome90'], minify: true,
  outfile: path.join(RAIZ, 'public/apresentadora.js'), logLevel: 'warning',
});
fs.mkdirSync(path.join(DIST, 'modelos'), { recursive: true });
fs.copyFileSync(path.join(RAIZ, 'public/modelos/passarinho.glb'), path.join(DIST, 'modelos/passarinho.glb'));

const pub = (f) => fs.readFileSync(path.join(RAIZ, 'public', f), 'utf8');
for (const f of ['jogo.css', 'jogo.js', 'sons.js', 'painel.html', 'painel.css', 'painel.js', 'apresentadora.js']) fs.writeFileSync(path.join(DIST, f), pub(f));
fs.copyFileSync(path.join(RAIZ, 'app/menu.js'), path.join(DIST, 'menu.js'));
fs.copyFileSync(path.join(RAIZ, 'app/app.css'), path.join(DIST, 'app.css'));

// o painel (dentro de um quadro) usa o canal do jogo que está na página principal
fs.writeFileSync(path.join(DIST, 'socket.io/socket.io.js'), 'window.io = function (o) { return window.parent.__criarCanal(o); };\n');

// página principal = tela do jogo + menu do app
let html = pub('jogo.html');
html = html.replace('<script src="/socket.io/socket.io.js"></script>', '<script src="/app.js"></script>');
html = html.replace('</head>', '<link rel="stylesheet" href="/app.css">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">\n</head>');
html = html.replace('<script src="/jogo.js"></script>', `<script src="/jogo.js"></script>\n${fs.readFileSync(path.join(RAIZ, 'app/menu.html'), 'utf8')}\n<script src="/menu.js"></script>`);
html = html.replace('<title>Adedonha Ao Vivo — Tela do Jogo</title>', '<title>Adedonha Ao Vivo</title>');
fs.writeFileSync(path.join(DIST, 'index.html'), html);
console.log('Aplicativo montado em dist/');
