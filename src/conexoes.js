// Conexões que trazem chat e presentes da live para o jogo:
//  1) Direto no TikTok (biblioteca gratuita tiktok-live-connector, só precisa do seu @)
//  2) TikFinity (se você usa o TikFinity aberto no PC, ele repassa os eventos por WebSocket)
//  3) Webhook HTTP (qualquer programa pode chamar /api/chat e /api/presente)
//  4) Simulador do painel (para testar sem live)
import { EventEmitter } from 'node:events';
import WebSocket from 'ws';

// pega a URL de uma imagem em qualquer formato que o TikTok/TikFinity mandar
function urlImagem(img) {
  if (!img) return '';
  if (typeof img === 'string') return img;
  return img.url?.[0] || img.urlList?.[0] || img.mUrls?.[0] || img.url_list?.[0] || '';
}

// transforma o usuário (formato novo ou antigo) num formato único
export function lerUsuario(d) {
  const u = d.user || d;
  const id = u.uniqueId || d.uniqueId || u.userId || d.userId || u.nickname || 'anonimo';
  return {
    id: String(id).toLowerCase(),
    nome: u.nickname || d.nickname || u.uniqueId || d.uniqueId || 'Anônimo',
    foto: d.profilePictureUrl || u.profilePictureUrl || urlImagem(u.profilePicture) || urlImagem(u.avatarThumb) || '',
    moderador: !!(d.isModerator || u.isModerator || d.userIdentity?.isModeratorOfAnchor || u.userIdentity?.isModeratorOfAnchor),
  };
}

export function lerPresente(d) {
  const g = d.giftDetails || d.extendedGiftInfo || {};
  return {
    nome: g.giftName || d.giftName || g.name || `Presente ${d.giftId || ''}`.trim(),
    id: d.giftId || g.id,
    quantidade: Number(d.repeatCount || 1),
    diamantes: Number(g.diamondCount || d.diamondCount || 0),
    imagem: d.giftPictureUrl || urlImagem(g.giftImage) || urlImagem(g.icon) || '',
    tipo: Number(g.giftType ?? d.giftType ?? 0),
    fimSequencia: d.repeatEnd === undefined ? true : !!d.repeatEnd,
  };
}

// presentes em sequência (combo) chegam várias vezes; só contamos quando a sequência termina
function presenteFinal(p) {
  if (p.tipo === 1 && !p.fimSequencia) return false;
  return true;
}

export class Conexoes extends EventEmitter {
  constructor(cfg) {
    super();
    this.cfg = cfg;
    this.tiktok = { status: 'desconectado', detalhe: '', conexao: null, querConectado: false, tentativas: 0 };
    this.tikfinity = { status: 'desconectado', detalhe: '', ws: null, querConectado: false };
    this.contadores = { chat: 0, presentes: 0 };
  }

  status() {
    return {
      tiktok: { status: this.tiktok.status, detalhe: this.tiktok.detalhe, usuario: this.cfg.tiktok.usuario },
      tikfinity: { status: this.tikfinity.status, detalhe: this.tikfinity.detalhe },
      contadores: this.contadores,
    };
  }

  avisar() { this.emit('status', this.status()); }

  chat(user, texto, origem) {
    this.contadores.chat++;
    this.emit('chat', { user, texto: String(texto || ''), origem });
  }

  presente(user, presente, origem) {
    this.contadores.presentes++;
    this.emit('presente', { user, presente, origem });
  }

  // ---------------- TikTok direto ----------------
  async conectarTikTok() {
    const usuario = String(this.cfg.tiktok.usuario || '').trim().replace(/^@/, '');
    if (!usuario) { this.tiktok.status = 'erro'; this.tiktok.detalhe = 'Coloque seu @ do TikTok na aba Conexão.'; this.avisar(); return; }
    await this.desconectarTikTok(false);
    this.tiktok.querConectado = true;
    this.tiktok.status = 'conectando';
    this.tiktok.detalhe = `Conectando em @${usuario}...`;
    this.avisar();

    let lib;
    try {
      lib = await import('tiktok-live-connector');
    } catch (e) {
      this.tiktok.status = 'erro';
      this.tiktok.detalhe = 'Biblioteca tiktok-live-connector não instalada. Rode o INICIAR-JOGO.bat de novo.';
      this.avisar();
      return;
    }
    const { TikTokLiveConnection, WebcastEvent, ControlEvent } = lib;
    // enableExtendedGiftInfo fica desligado: a lista de presentes exige plano pago do Euler Stream
    const opcoes = { processInitialData: false };
    if (this.cfg.tiktok.chaveEuler) opcoes.signApiKey = this.cfg.tiktok.chaveEuler.trim();
    const con = new TikTokLiveConnection(usuario, opcoes);
    this.tiktok.conexao = con;

    con.on(WebcastEvent.CHAT, (d) => this.chat(lerUsuario(d), d.comment, 'tiktok'));
    con.on(WebcastEvent.GIFT, (d) => {
      const p = lerPresente(d);
      if (presenteFinal(p)) this.presente(lerUsuario(d), p, 'tiktok');
    });
    con.on(WebcastEvent.STREAM_END, () => {
      this.tiktok.status = 'desconectado';
      this.tiktok.detalhe = 'A live terminou.';
      this.tiktok.querConectado = false;
      this.avisar();
    });
    con.on(ControlEvent.DISCONNECTED, () => {
      if (this.tiktok.conexao !== con) return;
      this.tiktok.status = 'desconectado';
      this.tiktok.detalhe = 'Conexão caiu.';
      this.avisar();
      this.reconectarTikTok();
    });
    con.on(ControlEvent.ERROR, (e) => {
      console.error('[tiktok] erro:', e?.info || '', e?.exception?.message || '');
    });

    try {
      const estado = await con.connect();
      this.tiktok.status = 'conectado';
      this.tiktok.tentativas = 0;
      this.tiktok.detalhe = `Conectado na live de @${usuario} (sala ${estado.roomId}).`;
      console.log('[tiktok]', this.tiktok.detalhe);
    } catch (e) {
      const msg = String(e?.message || e);
      this.tiktok.status = 'erro';
      if (/offline|not live|UserOffline/i.test(msg + e?.name)) this.tiktok.detalhe = `@${usuario} não está ao vivo agora. Comece a live e clique em Conectar de novo.`;
      else if (/room ?id/i.test(msg)) this.tiktok.detalhe = `Não achei a live de @${usuario}. Confira se o @ está certo e se a live já está no ar.`;
      else if (/rate|limit|429|sign/i.test(msg)) this.tiktok.detalhe = `O servidor de assinatura recusou (limite grátis). Crie uma chave grátis em eulerstream.com e cole no campo "Chave Euler". Detalhe: ${msg.slice(0, 160)}`;
      else this.tiktok.detalhe = `Falhou: ${msg.slice(0, 200)}`;
      console.error('[tiktok]', this.tiktok.detalhe);
      this.reconectarTikTok();
    }
    this.avisar();
  }

  reconectarTikTok() {
    if (!this.tiktok.querConectado) return;
    this.tiktok.tentativas++;
    if (this.tiktok.tentativas > 20) { this.tiktok.detalhe += ' (parei de tentar; clique em Conectar)'; this.tiktok.querConectado = false; this.avisar(); return; }
    const espera = Math.min(60, 10 * this.tiktok.tentativas);
    this.tiktok.detalhe += ` Tentando de novo em ${espera}s...`;
    this.avisar();
    clearTimeout(this.tiktok.timer);
    this.tiktok.timer = setTimeout(() => { if (this.tiktok.querConectado) this.conectarTikTok(); }, espera * 1000);
  }

  async desconectarTikTok(manual = true) {
    clearTimeout(this.tiktok.timer);
    if (manual) { this.tiktok.querConectado = false; this.tiktok.tentativas = 0; }
    const con = this.tiktok.conexao;
    this.tiktok.conexao = null;
    if (con) { try { await con.disconnect(); } catch { /* ok */ } }
    if (manual) { this.tiktok.status = 'desconectado'; this.tiktok.detalhe = 'Desconectado.'; this.avisar(); }
  }

  // ---------------- TikFinity ----------------
  conectarTikFinity() {
    this.desconectarTikFinity(false);
    this.tikfinity.querConectado = true;
    const url = this.cfg.tikfinity.endereco || 'ws://localhost:21213/';
    this.tikfinity.status = 'conectando';
    this.tikfinity.detalhe = `Conectando em ${url}...`;
    this.avisar();
    let ws;
    try { ws = new WebSocket(url); } catch (e) { this.tikfinity.status = 'erro'; this.tikfinity.detalhe = e.message; this.avisar(); return; }
    this.tikfinity.ws = ws;
    ws.on('open', () => {
      this.tikfinity.status = 'conectado';
      this.tikfinity.detalhe = 'Recebendo eventos do TikFinity.';
      this.avisar();
    });
    ws.on('message', (buf) => {
      let msg;
      try { msg = JSON.parse(buf.toString()); } catch { return; }
      const ev = String(msg.event || msg.type || '').toLowerCase();
      const d = msg.data || msg;
      if (ev === 'chat' || ev === 'comment') this.chat(lerUsuario(d), d.comment || d.message || d.text, 'tikfinity');
      else if (ev === 'gift') {
        const p = lerPresente(d);
        if (presenteFinal(p)) this.presente(lerUsuario(d), p, 'tikfinity');
      }
    });
    ws.on('close', () => {
      if (this.tikfinity.ws !== ws) return;
      this.tikfinity.status = 'desconectado';
      this.tikfinity.detalhe = 'TikFinity fechado ou não encontrado. Tentando de novo em 10s...';
      this.avisar();
      if (this.tikfinity.querConectado) this.tikfinity.timer = setTimeout(() => this.tikfinity.querConectado && this.conectarTikFinity(), 10000);
    });
    ws.on('error', (e) => { this.tikfinity.detalhe = `Erro: ${e.message}`; });
  }

  desconectarTikFinity(manual = true) {
    clearTimeout(this.tikfinity.timer);
    if (manual) this.tikfinity.querConectado = false;
    const ws = this.tikfinity.ws;
    this.tikfinity.ws = null;
    if (ws) { try { ws.close(); } catch { /* ok */ } }
    if (manual) { this.tikfinity.status = 'desconectado'; this.tikfinity.detalhe = 'Desconectado.'; this.avisar(); }
  }
}
