// Sons gerados pelo próprio navegador (não precisa de arquivos de áudio)
window.Sons = (() => {
  let ctx = null;
  let volume = 0.6;
  let ligado = true;

  function contexto() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    return ctx;
  }

  function nota(freq, dur = 0.15, tipo = 'sine', vol = 0.3, atraso = 0, deslize = 0) {
    if (!ligado) return;
    const c = contexto();
    if (!c || c.state !== 'running') return;
    const t0 = c.currentTime + atraso;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t0);
    if (deslize) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + deslize), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol * volume, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  const sons = {
    tique: () => nota(880, 0.06, 'square', 0.12),
    tiqueUrgente: () => { nota(1200, 0.08, 'square', 0.22); nota(600, 0.08, 'square', 0.12, 0.09); },
    giro: () => nota(300 + Math.random() * 500, 0.05, 'triangle', 0.15),
    pousar: () => { [523, 659, 784, 1046].forEach((f, i) => nota(f, 0.25, 'triangle', 0.3, i * 0.08)); },
    valendo: () => { nota(392, 0.15, 'sawtooth', 0.2); nota(784, 0.35, 'sawtooth', 0.25, 0.15); },
    resposta: () => nota(660 + Math.random() * 200, 0.09, 'sine', 0.25, 0, 300),
    stop: () => { nota(220, 0.6, 'sawtooth', 0.35, 0, -120); nota(110, 0.7, 'square', 0.25, 0.05, -50); },
    presente: () => { [988, 1319, 1568, 1976].forEach((f, i) => nota(f, 0.3, 'sine', 0.25, i * 0.07)); },
    alerta: () => { nota(500, 0.25, 'triangle', 0.3, 0, 600); nota(1000, 0.2, 'sine', 0.2, 0.2); },
    ruim: () => nota(200, 0.4, 'sawtooth', 0.25, 0, -100),
    campeao: () => { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => nota(f, 0.3, 'triangle', 0.3, i * 0.16)); },
  };

  function tocar(nome) { try { sons[nome] && sons[nome](); } catch (e) { /* ignora */ } }

  function desbloquear() {
    const c = contexto();
    if (c && c.state !== 'running') c.resume();
  }

  return {
    tocar,
    desbloquear,
    configurar(opc) { ligado = !!opc.sons; volume = Number(opc.volume ?? 0.6); },
    bloqueado() { const c = contexto(); return !!c && c.state !== 'running'; },
  };
})();

// ---------------- Música de fundo (gerada pelo próprio jogo, sem arquivo) ----------------
// A música é "gravada" uma vez na memória (32 segundos) e depois toca em loop perfeito,
// sem depender de temporizadores — assim ela não engasga no meio da live.
window.Musica = (() => {
  let ctx = null;
  let buffer = null;
  let fonte = null;
  let ganho = null;
  let volume = 0.3;
  let ligada = false;
  let gerando = null;
  // suas músicas (arquivos enviados no painel)
  let lista = [];
  let faixa = 0;
  let audio = null;
  let abaixada = false;

  function contexto() {
    if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (C) ctx = new C(); }
    return ctx;
  }

  async function gerar() {
    const BPM = 124;
    const batida = 60 / BPM;
    const compassos = 16;
    const dur = compassos * 4 * batida;
    const taxa = 44100;
    const O = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const oc = new O(2, Math.ceil(dur * taxa), taxa);
    const mestre = oc.createGain();
    mestre.gain.value = 0.8;
    const comp = oc.createDynamicsCompressor();
    mestre.connect(comp).connect(oc.destination);

    const ruido = oc.createBuffer(1, taxa, taxa);
    const d = ruido.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    const f = (m) => 440 * Math.pow(2, (m - 69) / 12);
    function tom(t, freq, len, tipo, vol, corte = 4000, ataque = 0.005) {
      const o = oc.createOscillator(); o.type = tipo; o.frequency.value = freq;
      const fl = oc.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = corte;
      const g = oc.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + ataque);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(fl).connect(g).connect(mestre);
      o.start(t); o.stop(t + len + 0.05);
    }
    function bumbo(t) {
      const o = oc.createOscillator(); const g = oc.createGain();
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.25);
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g).connect(mestre); o.start(t); o.stop(t + 0.35);
    }
    function barulho(t, len, vol, tipo, freq) {
      const s = oc.createBufferSource(); s.buffer = ruido;
      const fl = oc.createBiquadFilter(); fl.type = tipo; fl.frequency.value = freq;
      const g = oc.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
      s.connect(fl).connect(g).connect(mestre); s.start(t, Math.random() * 0.5); s.stop(t + len + 0.02);
    }

    // progressão alegre: C  Am  F  G  (em Dó maior)
    const acordes = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];
    const baixos = [36, 33, 29, 31];
    const melodia = [
      [72, 0, 74, 76, 0, 79, 76, 0], [76, 0, 74, 72, 0, 69, 72, 0], [69, 0, 72, 74, 0, 77, 76, 74], [74, 0, 71, 74, 0, 79, 0, 0],
      [79, 0, 77, 76, 0, 74, 76, 0], [76, 0, 72, 69, 0, 72, 74, 0], [77, 0, 76, 74, 0, 72, 74, 0], [74, 76, 74, 71, 0, 67, 0, 0],
    ];
    for (let c = 0; c < compassos; c++) {
      const t0 = c * 4 * batida;
      const i = c % 4;
      const parte = Math.floor(c / 4); // 0: entrada, 1-3: completa
      for (let b = 0; b < 4; b++) {
        const t = t0 + b * batida;
        bumbo(t);
        if (b === 1 || b === 3) barulho(t, 0.18, 0.35, 'bandpass', 1800);
        barulho(t + batida / 2, 0.05, 0.12, 'highpass', 7000);
        barulho(t, 0.04, 0.06, 'highpass', 9000);
        // baixo saltitante
        const raiz = baixos[i];
        tom(t, f(raiz), batida * 0.45, 'triangle', 0.45, 900);
        tom(t + batida / 2, f(raiz + 12), batida * 0.35, 'triangle', 0.3, 900);
        // acordes no contratempo
        if (parte > 0) for (const n of acordes[i]) tom(t + batida / 2, f(n), batida * 0.3, 'sawtooth', 0.045, 2200);
      }
      // melodia (a partir da 2ª parte)
      if (parte > 0) {
        const mel = melodia[(c - 4 + 8) % 8];
        mel.forEach((n, k) => { if (n) tom(t0 + k * batida / 2, f(n), batida * 0.42, 'square', 0.05, 2600); });
      }
      // virada de bateria no fim de cada parte
      if (i === 3) for (let k = 0; k < 4; k++) barulho(t0 + 3 * batida + k * batida / 4, 0.08, 0.25, 'bandpass', 1500 + k * 300);
    }
    return oc.startRendering();
  }

  function tocarArquivo() {
    if (!lista.length) return;
    if (!audio) {
      audio = new Audio();
      audio.preload = 'auto';
      audio.addEventListener('ended', () => { faixa = (faixa + 1) % lista.length; tocarArquivo(); });
      audio.addEventListener('error', () => { faixa = (faixa + 1) % lista.length; setTimeout(tocarArquivo, 500); });
    }
    const m = lista[faixa % lista.length];
    if (audio.dataset.id !== m.id) { audio.src = m.url; audio.dataset.id = m.id; }
    audio.volume = Math.max(0, Math.min(1, abaixada ? volume * 0.25 : volume));
    const p = audio.play();
    if (p && p.catch) p.catch(() => { /* toca no próximo toque na tela */ });
  }

  function pararArquivo() { if (audio) { audio.pause(); } }

  async function ligar() {
    if (lista.length) { desligarGerada(); tocarArquivo(); return; }
    pararArquivo();
    const c = contexto();
    if (!c) return;
    if (c.state !== 'running') { try { await c.resume(); } catch { /* */ } }
    if (!buffer) { if (!gerando) gerando = gerar(); buffer = await gerando; }
    if (!ligada || fonte) return;
    ganho = c.createGain();
    ganho.gain.value = volume;
    ganho.connect(c.destination);
    fonte = c.createBufferSource();
    fonte.buffer = buffer;
    fonte.loop = true;
    fonte.connect(ganho);
    fonte.start();
  }

  function desligar() { pararArquivo(); desligarGerada(); }

  function desligarGerada() {
    if (fonte) { try { fonte.stop(); } catch { /* */ } fonte.disconnect(); fonte = null; }
  }

  return {
    // recebe a lista de músicas enviadas no painel (vazia = usa a música do próprio jogo)
    usarArquivos(musicas) {
      const antes = lista.map((m) => m.id).join();
      lista = (musicas || []).filter((m) => m.url);
      if (lista.map((m) => m.id).join() === antes) return;
      faixa = Math.floor(Math.random() * Math.max(1, lista.length));
      if (audio) audio.dataset.id = '';
      if (ligada) ligar();
    },
    configurar(opc) {
      volume = Number(opc.volumeMusica ?? 0.3);
      if (ganho && ctx) ganho.gain.setTargetAtTime(volume, ctx.currentTime, 0.1);
      if (audio) audio.volume = Math.max(0, Math.min(1, abaixada ? volume * 0.25 : volume));
      const quer = !!opc.musica;
      if (quer && !ligada) { ligada = true; ligar(); }
      else if (!quer && ligada) { ligada = false; desligar(); }
    },
    tentarDeNovo() { if (ligada) { if (lista.length) { if (!audio || audio.paused) tocarArquivo(); } else if (!fonte) ligar(); } },
    tocando() { return lista.length ? !!audio && !audio.paused : !!fonte; },
    gerarPrevia: () => gerar(),
    // abaixa a música enquanto a voz fala
    abaixar(sim) {
      abaixada = sim;
      if (ganho && ctx) ganho.gain.setTargetAtTime(sim ? volume * 0.25 : volume, ctx.currentTime, 0.15);
      if (audio) audio.volume = Math.max(0, Math.min(1, sim ? volume * 0.25 : volume));
    },
  };
})();

// ---------------- Voz do apresentador ----------------
// No aplicativo usa a voz do próprio celular (Android). No PC usa a voz do navegador.
window.Voz = (() => {
  let ligada = true;
  let vozPT = null;
  function escolherVoz() {
    if (!window.speechSynthesis) return;
    const vs = speechSynthesis.getVoices();
    vozPT = vs.find((v) => /pt[-_]BR/i.test(v.lang) && /google|natural|online/i.test(v.name)) || vs.find((v) => /pt[-_]BR/i.test(v.lang)) || vs.find((v) => /^pt/i.test(v.lang)) || null;
  }
  if (window.speechSynthesis) { escolherVoz(); speechSynthesis.onvoiceschanged = escolherVoz; }

  // fila: uma frase espera a outra terminar (nada é cortado no meio)
  let fila = Promise.resolve();
  function falar(texto) {
    if (!ligada || !texto) return fila;
    fila = fila.then(() => falarAgora(texto));
    return fila;
  }

  async function falarAgora(texto) {
    Musica.abaixar(true);
    window.dispatchEvent(new Event('voz-inicio'));
    try {
      if (window.__falarNativo) {
        await window.__falarNativo(texto);
      } else if (window.speechSynthesis) {
        await new Promise((ok) => {
          const u = new SpeechSynthesisUtterance(texto);
          u.lang = 'pt-BR';
          if (vozPT) u.voice = vozPT;
          u.rate = 1.05;
          u.onend = ok; u.onerror = ok;
          speechSynthesis.speak(u);
          setTimeout(ok, 9000);
        });
      }
    } catch { /* sem voz disponível */ }
    window.dispatchEvent(new Event('voz-fim'));
    Musica.abaixar(false);
  }
  return { falar, configurar(opc) { ligada = opc.voz !== false; } };
})();
