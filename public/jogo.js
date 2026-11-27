// Tela do jogo (a que aparece na live)
(() => {
  const $ = (s) => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  if (params.get('transparente') === '1') document.body.classList.add('transparente');

  // ---------- encaixa o palco 1080x1920 em qualquer janela ----------
  const palco = $('#palco');
  function ajustar() {
    const s = Math.min(innerWidth / 1080, innerHeight / 1920);
    palco.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  addEventListener('resize', ajustar);
  ajustar();

  // ---------- logo e fundo animado ----------
  const cores = ['#ffd23f', '#ff3d9a', '#2ee6ff', '#3ddc84', '#ff9f1c', '#ffffff', '#ffd23f', '#ff3d9a'];
  $('#logo').innerHTML = 'ADEDONHA'.split('').map((l, i) => `<span style="color:${cores[i]};animation-delay:${i * 0.12}s">${l}</span>`).join('');
  const voando = $('#letrasVoando');
  const ABC = 'ABCDEFGHIJLMNOPRSTUVZ';
  for (let i = 0; i < 22; i++) {
    const s = document.createElement('span');
    s.textContent = ABC[Math.floor(Math.random() * ABC.length)];
    s.style.left = `${Math.random() * 100}%`;
    s.style.fontSize = `${80 + Math.random() * 180}px`;
    s.style.animationDuration = `${14 + Math.random() * 18}s`;
    s.style.animationDelay = `${-Math.random() * 30}s`;
    voando.appendChild(s);
  }

  // ---------- utilidades ----------
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let efeitos = { sons: true, volume: 0.6, animacoes: true, confete: true, fotoPerfil: true, voz: true, musica: true, volumeMusica: 0.3 };
  function avatar(nome, foto, cls = '') {
    const ini = esc(String(nome || '?').replace(/[^\p{L}\p{N}]/gu, '').slice(0, 1).toUpperCase() || '?');
    if (foto && efeitos.fotoPerfil) return `<span class="av ${cls}"><img src="${esc(foto)}" referrerpolicy="no-referrer" onerror="this.parentNode.textContent='${ini}'"></span>`;
    return `<span class="av ${cls}">${ini}</span>`;
  }
  function telaAtiva(id) {
    document.querySelectorAll('.tela').forEach((t) => t.classList.toggle('ativa', t.id === id));
  }
  function aplicarEfeitos(e) {
    efeitos = { ...efeitos, ...e };
    Sons.configurar(efeitos);
    Voz.configurar(efeitos);
    Musica.configurar(efeitos);
    window.dispatchEvent(new CustomEvent('efeitos-jogo', { detail: efeitos }));
    if (typeof aplicarFundo === 'function' && ultimaMidia) aplicarFundo(ultimaMidia.fundo);
    document.body.classList.toggle('semAnimacao', !efeitos.animacoes);
  }

  // ---------- som ----------
  const botaoSom = $('#ativarSom');
  botaoSom.onclick = () => { Sons.desbloquear(); botaoSom.style.display = 'none'; };
  document.addEventListener('click', () => { Sons.desbloquear(); Musica.tentarDeNovo(); });
  setTimeout(() => { Sons.desbloquear(); if (efeitos.sons && Sons.bloqueado() && !navigator.userAgent.includes('OBS')) botaoSom.style.display = 'block'; }, 1500);

  // ---------- conexão ----------
  const socket = io({ query: { papel: 'tela' } });
  let E = null; // último estado
  let recebidoEm = 0;
  socket.on('connect', () => { $('#semConexao').style.display = 'none'; });
  socket.on('disconnect', () => { $('#semConexao').style.display = 'block'; });
  socket.on('efeitos', aplicarEfeitos);
  socket.on('estado', (e) => {
    const anterior = E;
    E = e;
    recebidoEm = performance.now();
    if (e.efeitos) aplicarEfeitos(e.efeitos);
    desenhar(anterior);
  });
  socket.on('evento', tratarEvento);

  // ---------- suas músicas e fundo (enviados no painel) ----------
  let fundoAtual = '';
  function aplicarFundo(f) {
    const caixa = $('#fundoMidia');
    const chave = f ? f.id : '';
    if (chave !== fundoAtual) {
      fundoAtual = chave;
      if (!f) caixa.innerHTML = '';
      else if (/^video\//.test(f.mime || '') || /\.(mp4|webm|mov|m4v)$/i.test(f.nome || '')) caixa.innerHTML = `<video src="${esc(f.url)}" autoplay muted loop playsinline></video><div class="veu"></div>`;
      else caixa.innerHTML = `<img src="${esc(f.url)}" alt=""><div class="veu"></div>`;
    }
    document.body.classList.toggle('comFundo', !!f && params.get('transparente') !== '1');
    const veu = caixa.querySelector('.veu');
    if (veu) veu.style.opacity = String(efeitos.escurecerFundo ?? 0.35);
  }
  let ultimaMidia = { musicas: [], fundo: null };
  function aplicarMidia(m) { ultimaMidia = m || { musicas: [], fundo: null }; Musica.usarArquivos(ultimaMidia.musicas); aplicarFundo(ultimaMidia.fundo); }
  async function carregarMidia() {
    try { aplicarMidia(window.__midiaApp ? await window.__midiaApp.listar() : await (await fetch('/api/midia')).json()); } catch { /* sem mídia */ }
  }
  socket.on('midia', aplicarMidia);
  window.addEventListener('midia-mudou', carregarMidia);
  carregarMidia();

  // ---------- desenho ----------
  let girando = false;
  let assinaturaCats = '';
  const totaisAntes = {};
  const feedVisto = new Set();

  function textoModo(e) {
    const m = { competitivo: '', sobrevivencia: '☠ SOBREVIVÊNCIA', relampago: '⚡ RELÂMPAGO', presente: '', desafio: '🎯 DESAFIO' }[e.modo] || '';
    return e.relampago && e.modo !== 'relampago' ? '⚡ RELÂMPAGO' : m;
  }

  function desenhar(anterior) {
    const e = E;
    document.body.className = document.body.className.replace(/\bfase-\S+/g, '').trim() + ` fase-${e.mostrarRanking ? 'ranking' : e.fase}`;
    $('#txtRodada').textContent = e.rodada ? `RODADA ${e.rodada}` : 'PREPARANDO';
    $('#txtModo').textContent = textoModo(e);

    // letra
    const elLetra = $('#letra');
    if (e.fase === 'sorteio') { if (!girando) comecarGiro(); }
    else {
      if (girando) pararGiro(e.letra);
      else if (e.letra && elLetra.textContent !== e.letra && ['jogando', 'pausado'].includes(e.fase)) { elLetra.textContent = e.letra; pulsar(elLetra, 'pousou'); }
      else if (!e.letra) elLetra.textContent = '?';
      else if (['resultado', 'ranking', 'fim'].includes(e.fase)) elLetra.textContent = e.letra;
    }

    // faixas
    const fx = [];
    if (e.desafio) fx.push(`<div class="faixa desafio">🎯 ${esc(e.desafio.nome)} <small>${esc(e.desafio.descricao)}</small></div>`);
    if (e.multiplicador > 1) fx.push(`<div class="faixa mult">✖${e.multiplicador} PONTOS</div>`);
    if (e.relampago && ['sorteio', 'jogando', 'pausado'].includes(e.fase)) fx.push('<div class="faixa relampago">⚡ RODADA RELÂMPAGO</div>');
    if (e.modo === 'sobrevivencia' && e.rodada > 0) fx.push(`<div class="faixa vivos">❤️ ${e.vivos} na disputa</div>`);
    if (['jogando', 'pausado'].includes(e.fase) && e.jogadoresRodada) fx.push(`<div class="faixa vivos">👥 ${e.jogadoresRodada} jogando</div>`);
    const htmlFx = fx.join('');
    if ($('#faixas').dataset.h !== htmlFx) { $('#faixas').innerHTML = htmlFx; $('#faixas').dataset.h = htmlFx; }

    // telas
    if (e.mostrarRanking) { telaAtiva('telaRanking'); desenharRanking(e); }
    else if (e.fase === 'espera') { telaAtiva('telaEspera'); desenharEspera(e); }
    else if (['sorteio', 'jogando', 'pausado'].includes(e.fase)) { telaAtiva('telaJogo'); desenharRodada(e); }
    else if (e.fase === 'resultado') { telaAtiva('telaResultado'); if (!anterior || anterior.fase !== 'resultado' || JSON.stringify(anterior.resultado) !== JSON.stringify(e.resultado)) desenharResultado(e); }
    else if (e.fase === 'ranking') { telaAtiva('telaRanking'); if (!anterior || anterior.fase !== 'ranking') desenharRanking(e); }
    else if (e.fase === 'fim') { telaAtiva('telaFim'); desenharCampeao(e); }

    desenharRankingVivo(e);
  }

  let catMostrada = '';
  function desenharRodada(e) {
    const nome = e.fase === 'sorteio' ? '???' : (e.categoria ? e.categoria.nome : '—');
    const el = $('#nomeCategoria');
    if (nome !== catMostrada) {
      catMostrada = nome;
      el.textContent = nome.toUpperCase();
      const tam = nome.length > 14 ? 70 : nome.length > 10 ? 86 : 104;
      el.style.fontSize = `${tam}px`;
      if (nome !== '???') pulsar(el, 'pousou');
    }
    const tipo = e.categoria && e.categoria.tipo;
    $('#rotuloLetra').textContent = tipo === 'conta' ? 'CONTA' : 'LETRA';
    const pg = $('#pergunta');
    const txtP = e.fase !== 'sorteio' && e.categoria && e.categoria.pergunta ? e.categoria.pergunta : '';
    const htmlP = esc(txtP).replace(/_{3,}/, '<span class="lacuna">______</span>');
    if (pg.dataset.h !== htmlP) { pg.innerHTML = htmlP; pg.dataset.h = htmlP; pg.className = `${tipo || ''} ${txtP ? 'ativo' : ''}`; }
    const n = e.parede.length;
    $('#contRespostas').textContent = e.fase === 'sorteio' ? '' : n ? `✅ ${n} ${n === 1 ? 'acertou' : 'acertaram'}` : '';
    $('#parede').style.maxHeight = txtP ? '780px' : '';
    // cartões: foto, nome e embaixo (pequeno) a palavra que a pessoa comentou; quem mandou presente fica maior
    const lista = [...e.parede].sort((a, b) => (b.destaque ? 1 : 0) - (a.destaque ? 1 : 0)).slice(0, 20);
    const html = lista.map((r) => `<div class="carta ${r.unica ? 'unica' : ''} ${r.destaque ? 'destaque' : ''}">${avatar(r.nome, r.foto)}<div class="cNome">${esc(r.nome)}</div><div class="cPal">${esc(r.palavra)}</div></div>`).join('');
    const p = $('#parede');
    if (p.dataset.h !== html) { p.innerHTML = html; p.dataset.h = html; }
  }

  function desenharRankingVivo(e) {
    const html = e.ranking.length
      ? e.ranking.slice(0, e.ranking.slice(0, 5).some((j) => j.destaque) ? 4 : 5).map((j, i) => `<div class="linhaRank ${i === 0 ? 'top1' : ''} ${j.destaque ? 'destaque' : ''}"><div class="pos">${i + 1}</div>${avatar(j.nome, j.foto)}<div class="nome">${esc(j.nome)}</div><div class="pts">${j.pontos}</div></div>`).join('')
      : '<div class="vazioRV">Placar zerado</div>';
    const el = $('#listaRV');
    if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; }
  }

  function desenharResultado(e) {
    const r = e.resultado;
    if (!r) return;
    const medalhas = ['🥇', '🥈', '🥉'];
    const top = r.topRodada.filter((t) => t.pts > 0).slice(0, 3);
    const ordem = top.length === 3 ? [top[1], top[0], top[2]] : top;
    $('#podioRodada').innerHTML = ordem.length
      ? ordem.map((t, i) => {
        const pos = top.indexOf(t);
        return `<div class="pod ${pos === 0 ? 'p1' : ''} ${t.destaque ? 'destaque' : ''}" style="animation-delay:${i * 0.15}s">${avatar(t.nome, t.foto)}<div class="nome">${medalhas[pos]} ${esc(t.nome)}</div><div class="pts">+${t.pts}</div></div>`;
      }).join('')
      : '<div class="vazio">Ninguém pontuou nesta rodada 😅</div>';
    // resposta certa (continha/ditado)
    const perg = r.categorias.map((c) => c.pergunta).filter(Boolean).pop();
    $('#respostaCerta').innerHTML = perg ? `<div class="resposta-certa">✅ ${esc(perg.revelar)}</div>` : '';
    // todo mundo que acertou: foto, nome, palavra e pontos
    const todos = r.categorias.flatMap((c) => c.respostas.filter((x) => x.status === 'valida').map((x) => ({ ...x, pergunta: !!c.pergunta })))
      .sort((a, b) => b.pontos - a.pontos);
    const n = todos.length;
    const tam = n <= 8 ? 'g' : n <= 18 ? 'm' : n <= 30 ? 'p' : 'pp';
    const mostrar = todos.slice(0, n > 41 ? 40 : 41); // o que cabe na tela; o resto vira "+N"
    const resto = n - mostrar.length;
    $('#todosVotos').className = `votos-${tam}`;
    $('#todosVotos').innerHTML = n
      ? mostrar.map((x, k) => `<div class="voto ${x.unica ? 'unica' : ''} ${x.destaque ? 'destaque' : ''}" style="animation-delay:${0.2 + Math.min(k, 30) * 0.03}s">${avatar(x.nome, x.foto)}<div class="vNome">${esc(x.nome)}</div><div class="vPal">${x.pergunta ? `${x.ordem || k + 1}º lugar` : esc(x.palavra)}</div><div class="vPts">+${x.pontos}</div></div>`).join('') + (resto > 0 ? `<div class="voto mais">+${resto}</div>` : '')
      : '<div class="vazio">Ninguém acertou nesta rodada 😅</div>';
    // top 3 do ranking geral
    const med = ['🥇', '🥈', '🥉'];
    $('#top3Geral').innerHTML = e.ranking.length ? `<div class="t3titulo">🏆 RANKING GERAL</div><div class="t3lista">${e.ranking.slice(0, 3).map((j, i) => `<div class="t3 ${j.destaque ? 'destaque' : ''}"><span class="med">${med[i]}</span>${avatar(j.nome, j.foto)}<span class="n">${esc(j.nome)}</span><span class="p">${j.pontos}</span></div>`).join('')}</div>` : '';
  }

  function desenharRanking(e) {
    const html = e.ranking.length
      ? e.ranking.map((j, i) => `<div class="linhaRank ${i === 0 ? 'top1' : ''} ${j.eliminado ? 'elim' : ''} ${j.destaque ? 'destaque' : ''}" style="animation-delay:${i * 0.07}s">
          <div class="pos">${i + 1}</div>${avatar(j.nome, j.foto)}<div class="nome">${esc(j.nome)}</div>
          ${e.modo === 'sobrevivencia' ? `<div class="vidas">${j.eliminado ? '☠️' : '❤️'.repeat(Math.max(0, Math.min(5, j.vidas)))}</div>` : ''}
          <div class="pts">${j.pontos}</div></div>`).join('')
      : '<div class="cartaoGrande"><div class="textoMedio">Placar zerado</div></div>';
    const el = $('#listaRanking');
    if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; }
  }

  function desenharCampeao(e) {
    const v = e.vencedor;
    if (!v) return;
    const html = `${avatar(v.nome, v.foto)}<div class="nome">${esc(v.nome)}</div><div class="pts">${v.pontos} pontos</div>`;
    if ($('#campeao').dataset.h !== html) { $('#campeao').innerHTML = html; $('#campeao').dataset.h = html; }
  }

  function desenharEspera() { /* só o PREPARE-SE; o ranking fica no quadro de baixo */ }


  function pulsar(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  // ---------- roleta da letra ----------
  let giroTimer = null;
  function comecarGiro() {
    girando = true;
    const el = $('#letra');
    el.classList.add('girando');
    clearInterval(giroTimer);
    giroTimer = setInterval(() => { el.textContent = ABC[Math.floor(Math.random() * ABC.length)]; Sons.tocar('giro'); }, 90);
  }
  function pararGiro(letra) {
    girando = false;
    clearInterval(giroTimer);
    const el = $('#letra');
    el.classList.remove('girando');
    el.textContent = letra || '?';
    pulsar(el, 'pousou');
    Sons.tocar('pousar');
  }

  // ---------- cronômetro (atualiza suave) ----------
  let ultimoSegundo = null;
  function loop() {
    requestAnimationFrame(loop);
    if (!E) return;
    const rel = $('#relogio');
    let rest = E.restanteMs;
    if (E.fase === 'jogando') rest = Math.max(0, E.restanteMs - (performance.now() - recebidoEm));
    const ativo = ['jogando', 'pausado', 'sorteio'].includes(E.fase);
    const seg = ativo ? Math.ceil(rest / 1000) : null;
    $('#segundos').textContent = ativo ? (E.fase === 'pausado' ? '⏸' : seg) : (E.fase === 'resultado' || E.fase === 'ranking' ? 'STOP' : '--');
    $('#segundos').style.fontSize = ativo && E.fase !== 'pausado' ? '' : '84px';
    const frac = ativo && E.tempoTotal ? Math.max(0, Math.min(1, rest / E.tempoTotal)) : 0;
    $('#arco').style.strokeDashoffset = String(553 * (1 - frac));
    rel.classList.toggle('urgente', E.fase === 'jogando' && seg <= 10);
    rel.classList.toggle('pausado', E.fase === 'pausado');
    rel.classList.toggle('parado', !ativo || E.fase === 'pausado');
    if (E.fase === 'jogando' && seg !== ultimoSegundo) {
      if (seg <= 5 && seg > 0) Sons.tocar('tiqueUrgente');
      else if (seg <= 10 && seg > 0) Sons.tocar('tique');
    }
    ultimoSegundo = seg;
  }
  requestAnimationFrame(loop);

  // ---------- alertas ----------
  function alerta(html, cor = 'amarelo', ms = 2600, extra = '') {
    const d = document.createElement('div');
    d.className = `alerta ${cor} ${extra}`;
    d.innerHTML = html;
    $('#alertas').appendChild(d);
    setTimeout(() => d.remove(), ms);
    while ($('#alertas').children.length > 3) $('#alertas').firstChild.remove();
  }

  // ---------- frases da voz ----------
  const FRASE = { time: 'um time de futebol', planta: 'uma planta', nome: 'um nome', animal: 'um animal', cidade: 'uma cidade', pais: 'um país', comida: 'uma comida', fruta: 'uma fruta', objeto: 'um objeto', profissao: 'uma profissão', filme: 'um filme ou série', celebridade: 'uma celebridade' };
  const fraseCat = (ev) => ev.fala || FRASE[ev.catId] || `categoria ${ev.categoria || ''}`;
  const nomeFalado = (n) => String(n || '').replace(/[_.]/g, ' ').replace(/[^\p{L}\s]/gu, '').trim().split(/\s+/)[0] || '';

  function tratarEvento(ev) {
    window.dispatchEvent(new CustomEvent('jogo-evento', { detail: ev }));
    switch (ev.tipo) {
      case 'valendo': Voz.falar(ev.pergunta ? `${ev.pergunta.falar} Valendo!` : `${fraseCat(ev)} que comece com a letra ${ev.letra}... Valendo!`); alerta(ev.relampago ? '⚡ VALENDO! ⚡<small>Rodada relâmpago</small>' : 'VALENDO!', 'verde', 1800); Sons.tocar('valendo'); break;
      case 'resposta': Sons.tocar('resposta'); break;
      case 'stop': alerta('STOP!', 'vermelho', 2200, 'gigante'); Sons.tocar('stop'); setTimeout(() => Voz.falar('Stop! Acabou o tempo.'), 600); break;
      case 'melhor_rodada': if (ev.nome) setTimeout(() => Voz.falar(`Quem mais pontuou nessa rodada foi ${nomeFalado(ev.nome)}!`), 3500); break;
      case 'mais_tempo': alerta(`⏱ +${ev.segundos} SEGUNDOS!`, 'ciano'); Sons.tocar('alerta'); break;
      case 'desafio_voz': break;
      case 'nova_letra': alerta(`🔄 LETRA NOVA: ${esc(ev.letra)}`, 'rosa'); Sons.tocar('pousar'); { const el = $('#letra'); el.textContent = ev.letra; pulsar(el, 'pousou'); } Voz.falar(`Mudou a letra! Agora com a letra ${ev.letra}.`); break;
      case 'teste_voz': Voz.falar('Oi, gente! Bora jogar Adedonha? Uma fruta que comece com a letra M... Valendo!'); break;
      case 'nova_pergunta': alerta('🔄 NOVA PERGUNTA', 'rosa'); Sons.tocar('pousar'); { const el = $('#letra'); el.textContent = ev.letra; pulsar(el, 'pousou'); } Voz.falar(`Mudou! ${ev.falar}`); break;
      case 'resposta_certa': setTimeout(() => Voz.falar(ev.qual === 'conta' ? `A resposta é ${ev.resposta}!` : ev.revelar), 1800); break;
      case 'nova_categoria': alerta(`🔄 NOVA CATEGORIA<small>${esc(ev.cat)}</small>`, 'rosa'); Sons.tocar('pousar'); Voz.falar(`Mudou a categoria! Agora vale ${fraseCat(ev)} com a letra ${ev.letra}.`); break;
      case 'categoria_eliminada': alerta(`💥 SAIU: ${esc(ev.cat)}`, 'vermelho'); Sons.tocar('ruim'); break;
      case 'desafio': Voz.falar(`Desafio: ${ev.desafio.descricao}`); alerta(`🎯 ${esc(ev.desafio.nome)}<small>${esc(ev.desafio.descricao)}${ev.catOuro ? ' — ' + esc(ev.catOuro) : ''}</small>`, 'rosa', 3400); Sons.tocar('alerta'); break;
      case 'multiplicador': alerta(`✖${ev.valor} PONTOS!`, 'amarelo'); Sons.tocar('alerta'); confete(80); break;
      case 'agendado': alerta(esc(ev.texto), 'ciano', 2600); break;
      // presentes: a tela NÃO mostra quem mandou nem agradece (evita associar presente a recompensa).
      // Só o efeito do jogo aparece (ex.: +5 segundos), como um acontecimento normal da rodada.
      case 'eliminados': alerta(`☠️ ELIMINADOS<small>${ev.nomes.slice(0, 6).map(esc).join(', ')}${ev.nomes.length > 6 ? '...' : ''}</small>`, 'vermelho', 3400); Sons.tocar('ruim'); break;
      case 'campeao': Sons.tocar('campeao'); confete(250); Voz.falar(`Temos um campeão: ${nomeFalado(ev.jogador && ev.jogador.nome)}!`); break;
      case 'pausa': alerta('⏸ PAUSA', 'ciano', 1600); break;
      case 'continuar': alerta('▶ CONTINUANDO!', 'verde', 1400); break;
      case 'reiniciado': alerta('🔁 NOVA PARTIDA!', 'amarelo'); break;
      case 'aviso': alerta(esc(ev.texto), 'vermelho'); break;
      default: break;
    }
  }

  // ---------- confete ----------
  const cv = $('#confete');
  const cx = cv.getContext('2d');
  let pedacos = [];
  function confete(qtd) {
    if (!efeitos.confete) return;
    for (let i = 0; i < qtd; i++) {
      pedacos.push({ x: 540 + (Math.random() - 0.5) * 300, y: 900, vx: (Math.random() - 0.5) * 28, vy: -Math.random() * 30 - 10, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4, c: cores[i % cores.length], w: 14 + Math.random() * 14, h: 8 + Math.random() * 10, vida: 160 });
    }
  }
  (function anima() {
    requestAnimationFrame(anima);
    if (!pedacos.length) return;
    cx.clearRect(0, 0, 1080, 1920);
    for (const p of pedacos) {
      p.vy += 0.7; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.vida--;
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillStyle = p.c; cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); cx.restore();
    }
    pedacos = pedacos.filter((p) => p.vida > 0 && p.y < 2000);
    if (!pedacos.length) cx.clearRect(0, 0, 1080, 1920);
  })();
})();
