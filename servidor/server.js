// =============================================================
//  SERVIDOR DA ADEDONHA AO VIVO (Render, plano grátis)
//  Lê a live do TikTok e repassa os COMENTÁRIOS e PRESENTES
//  para o aplicativo do celular. O jogo em si roda no celular.
//  Endereços:  /status   /ws (eventos)   /foto?u=URL
// =============================================================
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';

const PORT = Number(process.env.PORT) || 8787;
const EULER = process.env.EULER_API_KEY || ''; // opcional: chave grátis do eulerstream.com
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };

const img = (i) => (i && ((Array.isArray(i.url) ? i.url[0] : typeof i.url === 'string' ? i.url : '') || i.urlList?.[0] || i.url_list?.[0] || i.mUrls?.[0])) || '';
function usuario(d) {
  const u = d.user || d;
  return {
    id: String(u.uniqueId || u.userId || u.nickname || 'anonimo').toLowerCase(),
    nome: u.nickname || u.uniqueId || 'Anônimo',
    foto: u.profilePictureUrl || img(u.profilePicture) || img(u.avatarThumb) || '',
    moderador: !!(d.userIdentity?.isModeratorOfAnchor || u.userIdentity?.isModeratorOfAnchor),
  };
}

// ---------- fotos (o celular às vezes não consegue abrir direto do TikTok) ----------
const fotos = new Map();
async function foto(res, u) {
  try {
    if (!/^https:\/\/[^/]*(tiktokcdn|ttwstatic|tiktok|byteimg|ibyteimg)[^/]*\//i.test(u)) throw new Error('url');
    let c = fotos.get(u);
    if (!c) {
      const r = await fetch(u);
      if (!r.ok) throw new Error('foto');
      c = { tipo: r.headers.get('content-type') || 'image/jpeg', buf: Buffer.from(await r.arrayBuffer()) };
      if (fotos.size > 400) fotos.clear();
      fotos.set(u, c);
    }
    res.writeHead(200, { 'Content-Type': c.tipo, 'Cache-Control': 'max-age=86400', ...CORS });
    res.end(c.buf);
  } catch { res.writeHead(404, CORS); res.end(); }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://x');
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  if (url.pathname === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
    return res.end(JSON.stringify({ ok: true, jogo: 'adedonha', usuario: atual, estado: ultimoStatus.state, mensagem: ultimoStatus.msg, comentariosRecebidos: comentarios, ultimoComentario, appsConectados: clientes.size }));
  }
  if (url.pathname === '/foto') return foto(res, url.searchParams.get('u') || '');
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', ...CORS });
  res.end('Servidor da Adedonha Ao Vivo ligado. Use o aplicativo no celular.');
});

// ---------- WebSocket com o aplicativo ----------
const wss = new WebSocketServer({ server, path: '/ws' });
const clientes = new Set();
let comentarios = 0;
let ultimoComentario = null;
let ultimoStatus = { type: 'status', state: 'idle', msg: 'Digite seu @ e toque em Conectar.' };
const enviar = (ws, obj) => { try { ws.send(JSON.stringify(obj)); } catch { /* */ } };
const todos = (obj) => { for (const c of clientes) enviar(c, obj); };
const status = (state, msg) => { ultimoStatus = { type: 'status', state, msg }; todos(ultimoStatus); console.log(`[${state}] ${msg}`); };

wss.on('connection', (ws) => {
  clientes.add(ws);
  enviar(ws, ultimoStatus);
  ws.on('message', (bruto) => {
    let m; try { m = JSON.parse(bruto); } catch { return; }
    if (m.type === 'connect' && m.username) ligarLive(String(m.username));
    if (m.type === 'disconnect') desligarLive();
  });
  ws.on('close', () => clientes.delete(ws));
});
// mantém as conexões vivas (o Render derruba conexão parada)
setInterval(() => { for (const c of clientes) { try { c.ping(); } catch { /* */ } } }, 25000);

// ---------- TikTok LIVE ----------
let con = null;
let atual = '';
let querLigado = false;
let tentativas = 0;
let timer = null;

async function desligarLive() {
  querLigado = false;
  clearTimeout(timer);
  if (con) { const c = con; con = null; try { await c.disconnect(); } catch { /* */ } }
  status('idle', 'Desconectado.');
}

async function ligarLive(nome) {
  nome = nome.replace(/^@/, '').trim().toLowerCase();
  if (!nome) return;
  if (nome === atual && con?.isConnected) { todos(ultimoStatus); return; }
  clearTimeout(timer);
  if (con) { const c = con; con = null; try { await c.disconnect(); } catch { /* */ } }
  atual = nome;
  querLigado = true;
  status('connecting', `Conectando na live de @${nome}...`);
  // sem enableExtendedGiftInfo: a lista de presentes exige plano pago do Euler Stream
  const c = new TikTokLiveConnection(nome, { processInitialData: false, ...(EULER ? { signApiKey: EULER } : {}) });
  con = c;

  const aoComentar = (d) => {
    const u = usuario(d);
    const texto = String(d.comment ?? d.content ?? '');
    comentarios++;
    ultimoComentario = { de: u.nome, texto, hora: new Date().toISOString() };
    console.log(`[chat] ${u.nome}: ${texto}`);
    todos({ type: 'chat', user: u, texto });
  };
  c.on(WebcastEvent.CHAT, aoComentar);
  c.on(WebcastEvent.GIFT, (d) => {
    const g = d.giftDetails || {};
    if (g.giftType === 1 && !d.repeatEnd) return; // sequência (combo) ainda em andamento
    todos({
      type: 'gift',
      user: usuario(d),
      presente: { nome: g.giftName || `Presente ${d.giftId || ''}`.trim(), quantidade: Number(d.repeatCount || 1), diamantes: Number(g.diamondCount || 0), imagem: img(g.giftImage) },
    });
  });
  c.on(WebcastEvent.STREAM_END, () => { querLigado = false; status('ended', 'A live terminou.'); });
  c.on(ControlEvent.DISCONNECTED, () => {
    if (con !== c) return;
    status('connecting', 'A conexão caiu. Reconectando...');
    tentarDeNovo();
  });
  c.on(ControlEvent.ERROR, (e) => console.error('[erro]', e?.info || '', e?.exception?.message || ''));

  try {
    const st = await c.connect();
    if (con !== c) return;
    tentativas = 0;
    status('connected', `Conectado na live de @${nome}!`);
    console.log('sala', st.roomId);
  } catch (e) {
    if (con !== c) return;
    const msg = String(e?.message || e);
    if (/offline|not live/i.test(msg + e?.name)) status('error', `@${nome} não está ao vivo agora. Comece a live e toque em Conectar.`);
    else if (/room ?id/i.test(msg)) status('error', `Não achei a live de @${nome}. Confira o @ e se a live já está no ar.`);
    else if (/rate|limit|429|sign/i.test(msg)) status('error', 'Limite grátis do servidor de assinatura. Coloque uma chave do eulerstream.com no Render (EULER_API_KEY).');
    else status('error', `Falhou: ${msg.slice(0, 160)}`);
    tentarDeNovo();
  }
}

function tentarDeNovo() {
  if (!querLigado) return;
  tentativas++;
  if (tentativas > 20) { querLigado = false; status('error', 'Parei de tentar. Toque em Conectar de novo.'); return; }
  const espera = Math.min(60, 10 * tentativas);
  clearTimeout(timer);
  timer = setTimeout(() => { if (querLigado && atual) { const n = atual; atual = ''; ligarLive(n); } }, espera * 1000);
}

server.listen(PORT, () => console.log(`Servidor da Adedonha na porta ${PORT}`));
