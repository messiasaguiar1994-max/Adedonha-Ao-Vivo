// Servidor local do jogo (PC). Abre:
//   Tela do jogo (para a live):  http://localhost:3000/jogo
//   Painel do apresentador:      http://localhost:3000/painel
import express from 'express';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { Server } from 'socket.io';
import { carregarConfig, salvarConfig, armazenamentoPC } from './src/config.js';
import { criarCentral } from './src/central.js';
import { Conexoes } from './src/conexoes.js';
import { rotaVoz } from './servidor/voz.js';
import fs from 'node:fs';

const cfg = carregarConfig();
salvarConfig(cfg);
const conexoes = new Conexoes(cfg);
const central = criarCentral({
  cfg,
  salvarCfg: salvarConfig,
  conexoes,
  armazenamento: armazenamentoPC,
  extras: () => ({ modo: 'pc', rede: enderecosRede(), porta: cfg.porta }),
});
const { jogo } = central;

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
const publico = path.resolve('public');
app.get('/', (_req, res) => res.sendFile(path.join(publico, 'index.html')));
app.get(['/jogo', '/overlay'], (_req, res) => res.sendFile(path.join(publico, 'jogo.html')));
app.get(['/painel', '/admin'], (_req, res) => res.sendFile(path.join(publico, 'painel.html')));
app.use(express.static(publico));

// ---------- suas músicas e imagem/vídeo de fundo (ficam na pasta data/midia) ----------
const PASTA_MIDIA = path.resolve('data', 'midia');
const ARQ_MIDIA = path.resolve('data', 'midia.json');
fs.mkdirSync(PASTA_MIDIA, { recursive: true });
const lerMidia = () => { try { return JSON.parse(fs.readFileSync(ARQ_MIDIA, 'utf8')); } catch { return []; } };
const gravarMidia = (l) => fs.writeFileSync(ARQ_MIDIA, JSON.stringify(l, null, 2));
function listaMidia() {
  const l = lerMidia().filter((m) => fs.existsSync(path.join(PASTA_MIDIA, m.arquivo)));
  const comUrl = l.map((m) => ({ id: m.id, tipo: m.tipo, nome: m.nome, mime: m.mime, url: `/midia/${encodeURIComponent(m.arquivo)}` }));
  return { musicas: comUrl.filter((m) => m.tipo === 'musica'), fundo: comUrl.find((m) => m.tipo === 'fundo') || null };
}
app.use('/midia', express.static(PASTA_MIDIA));
app.get('/api/midia', (_req, res) => res.json(listaMidia()));
app.post('/api/midia', express.raw({ type: '*/*', limit: '300mb' }), (req, res) => {
  const tipo = req.query.tipo === 'fundo' ? 'fundo' : 'musica';
  const nome = String(req.query.nome || 'arquivo').slice(0, 120);
  const mime = String(req.headers['content-type'] || '');
  const ext = (nome.match(/\.[a-z0-9]{2,5}$/i) || [''])[0].toLowerCase();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const arquivo = `${id}${ext}`;
  fs.writeFileSync(path.join(PASTA_MIDIA, arquivo), req.body);
  let l = lerMidia();
  if (tipo === 'fundo') { for (const m of l.filter((x) => x.tipo === 'fundo')) { try { fs.unlinkSync(path.join(PASTA_MIDIA, m.arquivo)); } catch { /* */ } } l = l.filter((x) => x.tipo !== 'fundo'); }
  l.push({ id, tipo, nome, mime, arquivo });
  gravarMidia(l);
  io.emit('midia', listaMidia());
  res.json({ ok: true });
});
app.delete('/api/midia/:id', (req, res) => {
  const l = lerMidia();
  const m = l.find((x) => x.id === req.params.id);
  if (m) { try { fs.unlinkSync(path.join(PASTA_MIDIA, m.arquivo)); } catch { /* */ } }
  gravarMidia(l.filter((x) => x.id !== req.params.id));
  io.emit('midia', listaMidia());
  res.json({ ok: true });
});

// ---------- Webhooks (para TikFinity, Streamer.bot ou qualquer programa) ----------
// /api/chat?usuario=fulano&mensagem=1 Maria 2 Macaco
// /api/presente?usuario=fulano&presente=Rose&quantidade=1&diamantes=1
const param = (req, ...nomes) => {
  for (const n of nomes) {
    const v = req.body?.[n] ?? req.query?.[n];
    if (v !== undefined && v !== '') return String(v);
  }
  return '';
};
app.all('/api/chat', (req, res) => {
  const usuario = param(req, 'usuario', 'uniqueId', 'username', 'user');
  const mensagem = param(req, 'mensagem', 'comment', 'message', 'texto');
  if (!usuario || !mensagem) return res.status(400).json({ ok: false, erro: 'informe usuario e mensagem' });
  conexoes.chat({ id: usuario.toLowerCase(), nome: param(req, 'nome', 'nickname') || usuario, foto: param(req, 'foto', 'profilePictureUrl') }, mensagem, 'webhook');
  res.json({ ok: true });
});
app.all('/api/presente', (req, res) => {
  const usuario = param(req, 'usuario', 'uniqueId', 'username', 'user');
  const presente = param(req, 'presente', 'giftName', 'gift');
  if (!usuario || !presente) return res.status(400).json({ ok: false, erro: 'informe usuario e presente' });
  conexoes.presente(
    { id: usuario.toLowerCase(), nome: param(req, 'nome', 'nickname') || usuario, foto: param(req, 'foto', 'profilePictureUrl') },
    { nome: presente, quantidade: Number(param(req, 'quantidade', 'repeatCount', 'count')) || 1, diamantes: Number(param(req, 'diamantes', 'diamondCount', 'coins')) || 0, imagem: param(req, 'imagem', 'giftPictureUrl') },
    'webhook',
  );
  res.json({ ok: true });
});
app.all('/api/comando/:cmd', (req, res) => {
  jogo.executarComando(req.params.cmd);
  res.json({ ok: true });
});
app.get('/voz', (req, res) => rotaVoz(req, res));
app.get('/api/estado', (_req, res) => res.json(jogo.estadoTela()));

// ---------- tempo real ----------
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
io.on('connection', (sock) => {
  const papel = sock.handshake.query.papel === 'painel' ? 'painel' : 'tela';
  const ligacao = central.conectar({ papel, enviar: (ev, d) => sock.emit(ev, d) });
  sock.on('acao', (a, responder) => ligacao.receber(a, responder));
  sock.on('disconnect', () => ligacao.sair());
});
conexoes.on('presente', ({ user, presente, origem }) => console.log(`[presente] ${user.nome} enviou ${presente.nome} x${presente.quantidade} (${origem})`));

function enderecosRede() {
  const ips = [];
  for (const lista of Object.values(os.networkInterfaces())) {
    for (const i of lista || []) if (i.family === 'IPv4' && !i.internal) ips.push(i.address);
  }
  return ips;
}

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n  A porta ${cfg.porta} já está em uso. O jogo provavelmente já está aberto em outra janela.\n  Feche a outra janela preta do jogo e tente de novo.\n`);
    process.exit(1);
  }
  throw e;
});

server.listen(cfg.porta, '0.0.0.0', () => {
  const p = cfg.porta;
  console.log('\n  ===============================================');
  console.log('   ADEDONHA AO VIVO - servidor ligado!');
  console.log('  ===============================================');
  console.log(`   Tela do jogo (live):  http://localhost:${p}/jogo`);
  console.log(`   Painel de controle:   http://localhost:${p}/painel`);
  for (const ip of enderecosRede()) console.log(`   Painel pelo celular:  http://${ip}:${p}/painel  (mesmo Wi-Fi)`);
  console.log('\n   NÃO feche esta janela enquanto estiver jogando.\n');
  if (cfg.tiktok.conectarAoIniciar && cfg.tiktok.usuario) conexoes.conectarTikTok();
  if (cfg.tikfinity.ativo) conexoes.conectarTikFinity();
});

process.on('SIGINT', () => { jogo.salvarPartida(); process.exit(0); });
