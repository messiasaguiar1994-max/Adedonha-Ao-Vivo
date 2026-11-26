// No aplicativo, quem lê a live é o servidor no Render (pasta "servidor").
// O celular conversa com ele por WebSocket e recebe o chat e os presentes.
import { Emissor } from '../src/emissor.js';

function limparEndereco(s) {
  s = String(s || '').trim().replace(/\/+$/, '');
  if (s && !/^https?:\/\//i.test(s)) s = 'https://' + s;
  return s;
}

export class ConexoesApp extends Emissor {
  constructor(cfg) {
    super();
    this.cfg = cfg;
    this.ws = null;
    this.querConectado = false;
    this.falhas = 0;
    this.timer = null;
    this.tiktok = { status: 'desconectado', detalhe: 'Digite seu @ e toque em Conectar.' };
    this.contadores = { chat: 0, presentes: 0 };
  }

  get servidor() { return limparEndereco(this.cfg.app?.servidor); }

  status() {
    return {
      tiktok: { ...this.tiktok, usuario: this.cfg.tiktok.usuario },
      tikfinity: { status: 'desconectado', detalhe: 'Não usado no aplicativo.' },
      contadores: this.contadores,
    };
  }

  avisar(status, detalhe) {
    if (status) this.tiktok.status = status;
    if (detalhe !== undefined) this.tiktok.detalhe = detalhe;
    this.emit('status', this.status());
  }

  foto(url) {
    if (!url || !this.servidor) return url || '';
    return `${this.servidor}/foto?u=${encodeURIComponent(url)}`;
  }

  chat(user, texto, origem) {
    this.contadores.chat++;
    this.emit('chat', { user, texto: String(texto || ''), origem });
  }

  presente(user, presente, origem) {
    this.contadores.presentes++;
    this.emit('presente', { user, presente, origem });
  }

  conectarTikTok() {
    const usuario = String(this.cfg.tiktok.usuario || '').trim().replace(/^@/, '');
    if (!usuario) { this.avisar('erro', 'Coloque o seu @ do TikTok.'); return; }
    if (!this.servidor) { this.avisar('erro', 'Coloque o endereço do servidor (aba Conexão).'); return; }
    this.querConectado = true;
    this.falhas = 0;
    fetch(`${this.servidor}/status`, { cache: 'no-store' }).catch(() => {}); // acorda o servidor grátis
    this.abrir();
  }

  abrir() {
    clearTimeout(this.timer);
    if (this.ws) { try { this.ws.onclose = null; this.ws.close(); } catch { /* */ } }
    const url = this.servidor.replace(/^http/i, 'ws') + '/ws';
    this.avisar('conectando', this.falhas ? 'Acordando o servidor... (pode levar até 1 minuto)' : 'Ligando no servidor...');
    let ws;
    try { ws = new WebSocket(url); } catch { this.depois(); return; }
    this.ws = ws;
    ws.onopen = () => {
      this.falhas = 0;
      ws.send(JSON.stringify({ type: 'connect', username: String(this.cfg.tiktok.usuario || '').replace(/^@/, '').trim() }));
    };
    ws.onmessage = (e) => {
      let d;
      try { d = JSON.parse(e.data); } catch { return; }
      if (d.type === 'status') {
        const mapa = { connected: 'conectado', connecting: 'conectando', error: 'erro', offline: 'erro', idle: 'desconectado', ended: 'desconectado' };
        this.avisar(mapa[d.state] || d.state, d.msg || '');
      } else if (d.type === 'chat') {
        this.chat({ ...d.user, foto: this.foto(d.user.foto) }, d.texto, 'tiktok');
      } else if (d.type === 'gift') {
        this.presente({ ...d.user, foto: this.foto(d.user.foto) }, d.presente, 'tiktok');
      }
    };
    ws.onclose = () => {
      if (!this.querConectado) return;
      this.falhas++;
      this.avisar('conectando', this.falhas < 15 ? 'Acordando o servidor... (pode levar até 1 minuto)' : 'Servidor fora do ar. Confira o endereço na aba Conexão.');
      this.depois();
    };
    ws.onerror = () => {};
  }

  depois() {
    clearTimeout(this.timer);
    if (this.querConectado) this.timer = setTimeout(() => this.abrir(), 4000);
  }

  async desconectarTikTok() {
    this.querConectado = false;
    clearTimeout(this.timer);
    if (this.ws) {
      try { this.ws.send(JSON.stringify({ type: 'disconnect' })); } catch { /* */ }
      try { this.ws.onclose = null; this.ws.close(); } catch { /* */ }
    }
    this.ws = null;
    this.avisar('desconectado', 'Desconectado.');
  }

  conectarTikFinity() { this.emit('status', this.status()); }
  desconectarTikFinity() {}
}
