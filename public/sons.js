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
