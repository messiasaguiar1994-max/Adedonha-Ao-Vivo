// Aplicativo: o jogo inteiro roda dentro do celular.
// A tela do jogo e o painel usam o mesmo código do PC; aqui trocamos o socket.io
// por um "canal" interno que fala direto com a central do jogo.
import { criarCentral } from '../src/central.js';
import { PADRAO, mesclar, migrar } from '../src/padrao.js';
import { ConexoesApp } from './conexoes-app.js';
import { MidiaApp } from './midia-app.js';

window.__midiaApp = MidiaApp;
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

// voz do próprio celular (Android); no navegador fica a voz do navegador
if (Capacitor.isNativePlatform()) {
  window.__falarNativo = (texto) => TextToSpeech.speak({ text: texto, lang: 'pt-BR', rate: 1.0, pitch: 1.2, volume: 1.0, category: 'playback' });
}

const PREFIXO = 'adedonha:';
const armazenamento = {
  ler(chave, padrao) {
    try { const v = localStorage.getItem(PREFIXO + chave); return v ? JSON.parse(v) : padrao; } catch { return padrao; }
  },
  gravar(chave, valor) {
    try { localStorage.setItem(PREFIXO + chave, JSON.stringify(valor)); } catch { /* cheio */ }
  },
};

const salvo = armazenamento.ler('config', {}) || {};
const cfg = migrar(mesclar(structuredClone(PADRAO), { versaoConfig: 1, ...salvo }));
if (!Object.keys(salvo).length) cfg.versaoConfig = 2;
const conexoes = new ConexoesApp(cfg);
const central = criarCentral({
  cfg,
  salvarCfg: (c) => armazenamento.gravar('config', c),
  conexoes,
  armazenamento,
  extras: () => ({ modo: 'app' }),
});
window.__central = central;
window.__cfg = cfg;
// endereço do servidor para a voz natural
window.__servidorVoz = () => String(cfg.app?.servidor || '').trim().replace(/\/+$/, '').replace(/^(?!https?:\/\/)/, 'https://');
window.__conexoes = conexoes;

// imita o io() do socket.io
window.__criarCanal = (opcoes) => {
  const papel = opcoes?.query?.papel === 'painel' ? 'painel' : 'tela';
  const ouvintes = {};
  const canal = {
    on(ev, fn) {
      (ouvintes[ev] = ouvintes[ev] || []).push(fn);
      if (ev === 'connect') setTimeout(fn, 0);
      return canal;
    },
    emit(ev, dados, responder) { if (ev === 'acao') ligacao.receber(dados, responder); },
  };
  const ligacao = central.conectar({
    papel,
    enviar: (ev, d) => setTimeout(() => (ouvintes[ev] || []).forEach((f) => f(d)), 0),
  });
  return canal;
};
window.io = window.__criarCanal;
