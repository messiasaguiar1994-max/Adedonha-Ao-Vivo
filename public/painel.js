// Painel do apresentador
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const socket = io({ query: { papel: 'painel' } });

  let cfg = null;
  let acoes = {};
  let E = null;
  let recebidoEm = 0;

  // ---------- abas ----------
  $$('.abas button').forEach((b) => b.onclick = () => {
    $$('.abas button').forEach((x) => x.classList.toggle('ativa', x === b));
    $$('.aba').forEach((a) => a.classList.toggle('ativa', a.id === `aba-${b.dataset.aba}`));
  });

  function toast(t, cor = '#1f9d55') {
    const el = $('#toast');
    el.textContent = t;
    el.style.background = cor;
    el.classList.add('mostrar');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove('mostrar'), 1600);
  }

  function acao(tipo, extra = {}) {
    socket.emit('acao', { tipo, ...extra }, (r) => { if (r && r.ok === false) toast('Não deu certo', '#d43a4f'); });
  }

  // botões com data-acao
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-acao]');
    if (!b) return;
    const extra = {};
    if (b.dataset.segundos) extra.segundos = Number(b.dataset.segundos);
    if (b.dataset.valor) extra.valor = Number(b.dataset.valor);
    acao(b.dataset.acao, extra);
  });
  $('#btPausa').onclick = (ev) => {
    ev.stopPropagation();
    acao(E && (E.fase === 'pausado' || ((E.fase === 'resultado' || E.fase === 'ranking') && !E.proximaMs)) ? 'continuar' : 'pausar');
  };
  $('#btPausa').removeAttribute('data-acao');
  $('#btReiniciar').onclick = () => { if (confirm('Reiniciar a partida? O placar de todos volta para zero.')) acao('reiniciar'); };
  $('#btFecharPainel').onclick = () => { try { window.parent.fecharPainel(); } catch { /* fora do app */ } };
  $('#btInicioApp').onclick = () => { try { window.parent.fecharPainel(); window.parent.abrirMenuApp(); } catch { /* fora do app */ } };
  $('#btPadrao').onclick = () => { if (confirm('Voltar TODAS as configurações ao padrão? (seu @ do TikTok é mantido)')) acao('config_padrao'); };

  // ---------- configurações ligadas aos campos (salva sozinho) ----------
  const pegar = (obj, caminho) => caminho.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  function montarParcial(caminho, valor) {
    const partes = caminho.split('.');
    const out = {};
    let o = out;
    partes.forEach((k, i) => { if (i === partes.length - 1) o[k] = valor; else { o[k] = {}; o = o[k]; } });
    return out;
  }
  function salvar(parcial) {
    socket.emit('acao', { tipo: 'config', cfg: parcial }, () => toast('Salvo ✓'));
  }
  $$('[data-cfg]').forEach((el) => {
    el.addEventListener('change', () => {
      const c = el.dataset.cfg;
      let v;
      if (el.type === 'checkbox') v = el.checked;
      else if (el.type === 'number' || el.type === 'range') v = Number(el.value);
      else if (el.dataset.tipo === 'lista') v = el.value.split(',').map((s) => s.trim()).filter(Boolean);
      else v = el.value;
      if (c === 'tiktok.usuario') v = String(v).trim().replace(/^@/, '').replace(/.*tiktok\.com\/@?/, '').replace(/\/.*$/, '');
      salvar(montarParcial(c, v));
    });
  });
  function preencherCampos() {
    $$('[data-cfg]').forEach((el) => {
      if (document.activeElement === el) return;
      const v = pegar(cfg, el.dataset.cfg);
      if (el.type === 'checkbox') el.checked = !!v;
      else if (el.dataset.tipo === 'lista') el.value = (v || []).join(', ');
      else el.value = v ?? '';
    });
    const dicas = {
      competitivo: 'Uma categoria e uma letra por rodada. Quem acerta ganha pontos; resposta que ninguém mais deu vale mais. Ranking acumula entre as rodadas.',
      sobrevivencia: 'Quem não acertar o mínimo de respostas perde uma vida. Sem vidas = eliminado. O último que sobrar é o campeão.',
      relampago: 'Rodadas curtinhas (ajuste o tempo em "Pontos e modos").',
      presente: 'Igual ao competitivo, mas os presentes sempre ativam eventos (aba Presentes).',
      desafio: 'Toda rodada vem com uma regra especial sorteada (palavras grandes valem dobro, rodada de ouro etc.).',
    };
    $('#dicaModo').textContent = dicas[cfg.modo] || '';
  }

  // ---------- categorias ----------
  function desenharCategorias() {
    $('#tabCategorias tbody').innerHTML = cfg.categorias.map((c, i) => `
      <tr data-i="${i}">
        <td><input type="checkbox" data-c="ativa" ${c.ativa ? 'checked' : ''}></td>
        <td>${c.tipo ? '<small class="dica">pergunta</small>' : `<input type="checkbox" data-c="livre" ${c.livre ? 'checked' : ''}>`}</td>
        <td><input type="text" data-c="nome" value="${esc(c.nome)}"></td>
        <td><input type="text" data-c="fala" value="${esc(c.fala || '')}" placeholder="automático"></td>
        <td><input type="text" data-c="apelidos" value="${esc((c.apelidos || []).join(', '))}"></td>
        <td><button class="mini perigo" data-rem="${i}">Remover</button></td>
      </tr>`).join('');
  }
  $('#tabCategorias').addEventListener('change', (ev) => {
    const tr = ev.target.closest('tr');
    if (!tr) return;
    const i = Number(tr.dataset.i);
    const campo = ev.target.dataset.c;
    const cats = structuredClone(cfg.categorias);
    if (campo === 'ativa') cats[i].ativa = ev.target.checked;
    if (campo === 'livre') cats[i].livre = ev.target.checked;
    if (campo === 'nome') cats[i].nome = ev.target.value.trim() || cats[i].nome;
    if (campo === 'fala') cats[i].fala = ev.target.value.trim();
    if (campo === 'apelidos') cats[i].apelidos = ev.target.value.split(',').map((s) => s.trim()).filter(Boolean);
    salvar({ categorias: cats });
  });
  $('#tabCategorias').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-rem]');
    if (!b) return;
    const cats = structuredClone(cfg.categorias);
    const c = cats[Number(b.dataset.rem)];
    if (!confirm(`Remover a categoria "${c.nome}"?`)) return;
    cats.splice(Number(b.dataset.rem), 1);
    salvar({ categorias: cats });
  });
  $('#btNovaCat').onclick = () => {
    const nome = prompt('Nome da nova categoria (ex.: Cor, Marca, Time de futebol):');
    if (!nome) return;
    const id = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_') + '_' + Date.now().toString(36).slice(-3);
    const apel = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/\s+/)[0];
    salvar({ categorias: [...cfg.categorias, { id, nome: nome.trim(), apelidos: [apel], ativa: true }] });
  };

  // ---------- regras de presentes ----------
  function desenharRegras() {
    const opcoes = Object.entries(acoes).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
    $('#tabRegras tbody').innerHTML = cfg.presentes.regras.map((r, i) => `
      <tr data-i="${i}">
        <td><input type="checkbox" data-r="ativa" ${r.ativa !== false ? 'checked' : ''}></td>
        <td><input type="text" data-r="presente" value="${esc(r.presente)}"></td>
        <td><input type="number" data-r="minDiamantes" value="${esc(r.minDiamantes ?? 0)}"></td>
        <td><select data-r="acao">${opcoes}</select></td>
        <td><input type="number" data-r="valor" value="${esc(r.valor ?? 0)}" title="segundos (mais tempo) ou multiplicador"></td>
        <td><input type="number" data-r="recarga" value="${esc(r.recarga ?? 0)}"></td>
        <td><button class="mini perigo" data-remr="${i}">Remover</button></td>
      </tr>`).join('');
    $$('#tabRegras tbody tr').forEach((tr) => { tr.querySelector('select').value = cfg.presentes.regras[Number(tr.dataset.i)].acao; });
    $('#listaPresentes').innerHTML = [...new Set(cfg.presentes.regras.map((r) => r.presente).filter((p) => p !== '*'))].map((p) => `<option value="${esc(p)}">`).join('');
  }
  $('#tabRegras').addEventListener('change', (ev) => {
    const tr = ev.target.closest('tr');
    if (!tr) return;
    const regras = structuredClone(cfg.presentes.regras);
    const r = regras[Number(tr.dataset.i)];
    const k = ev.target.dataset.r;
    r[k] = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.type === 'number' ? Number(ev.target.value) : ev.target.value.trim();
    salvar({ presentes: { regras } });
  });
  $('#tabRegras').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-remr]');
    if (!b) return;
    const regras = structuredClone(cfg.presentes.regras);
    regras.splice(Number(b.dataset.remr), 1);
    salvar({ presentes: { regras } });
  });
  function novaRegra(presente = 'Rose') {
    salvar({ presentes: { regras: [...cfg.presentes.regras, { presente, minDiamantes: 0, acao: 'mais_tempo', valor: 5, recarga: 0, ativa: true }] } });
  }
  $('#btNovaRegra').onclick = () => novaRegra('Nome do presente');
  $('#tabPresentes').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-criar]');
    if (b) { novaRegra(b.dataset.criar); toast('Regra criada — ajuste a ação na tabela acima'); }
  });

  // ---------- testes ----------
  $('#bots').oninput = (ev) => { $('#qtdBots').textContent = ev.target.value; };
  $('#bots').onchange = (ev) => acao('bots', { quantidade: Number(ev.target.value) });
  function enviarSim() {
    const texto = $('#simTexto').value.trim();
    if (!texto) return;
    acao('sim_chat', { usuario: $('#simUsuario').value.trim() || 'Visitante', texto });
    $('#simTexto').value = '';
  }
  $('#btSimChat').onclick = enviarSim;
  $('#simTexto').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') enviarSim(); });
  function desenharExemplos() {
    const L = (E && E.letra) || 'M';
    const ex = [`${L}acaco`, `${L}aria`, `${L}anaus`, '!iniciar', '!parar', '!letra', '!ranking'];
    const html = ex.map((t) => `<button data-ex="${esc(t)}">${esc(t)}</button>`).join('');
    if ($('#exemplosChat').dataset.h !== html) { $('#exemplosChat').innerHTML = html; $('#exemplosChat').dataset.h = html; }
  }
  $('#exemplosChat').addEventListener('click', (ev) => { const b = ev.target.closest('[data-ex]'); if (b) { $('#simTexto').value = b.dataset.ex; $('#simTexto').focus(); } });
  $('#btSimPresente').onclick = () => acao('sim_presente', { usuario: $('#simPresUsuario').value, presente: $('#simPresente').value, quantidade: Number($('#simQtd').value), diamantes: Number($('#simDiam').value) });

  // ---------- respostas ----------
  $('#tabRespostas').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-st]');
    if (!b) return;
    acao('status_resposta', { id: b.dataset.id, status: b.dataset.st, salvarDicionario: b.dataset.dic === '1' });
  });
  $('#soDuvidosas').onchange = () => desenharRespostas(true);
  let assinResp = '';
  function desenharRespostas(forcar) {
    const so = $('#soDuvidosas').checked;
    let lista = E.respostas || [];
    if (so) lista = lista.filter((r) => r.status === 'pendente' || (r.status === 'valida' && !r.verificada && !r.manual));
    const assin = JSON.stringify(lista.map((r) => [r.id, r.status, r.pontos, r.manual])) + so + E.fase;
    if (!forcar && assin === assinResp) return;
    assinResp = assin;
    const nomeCat = (id) => (E.categorias.find((c) => c.id === id) || { nome: id }).nome;
    $('#contResp').textContent = `(${(E.respostas || []).length})`;
    $('#tabRespostas tbody').innerHTML = lista.slice(0, 400).map((r) => {
      const st = r.status === 'invalida' ? `<span class="st invalida">✖ ${esc(r.motivo)}</span>`
        : r.status === 'pendente' ? '<span class="st pendente">⏳ pendente</span>'
        : r.verificada ? '<span class="st verif">✅ confirmada</span>'
        : `<span class="st valida">✔ ${r.manual ? 'aprovada' : 'não verificada'}</span>`;
      return `<tr><td>${esc(r.nome)}</td><td>${esc(nomeCat(r.catId))}</td><td><b>${esc(r.palavra)}</b></td><td>${st}${r.repetida ? ' <span class="st pendente">repetida</span>' : ''}</td><td>${['resultado', 'ranking', 'fim'].includes(E.fase) ? (r.pontos ?? '') : '—'}</td>
        <td style="white-space:nowrap"><button class="mini verde" data-st="valida" data-id="${esc(r.id)}" title="aprovar">✔</button>
        <button class="mini" data-st="valida" data-dic="1" data-id="${esc(r.id)}" title="aprovar e salvar no dicionário">📖</button>
        <button class="mini vermelho" data-st="invalida" data-id="${esc(r.id)}" title="recusar">✖</button></td></tr>`;
    }).join('') || '<tr><td colspan="6" class="dica">Nenhuma resposta ainda.</td></tr>';
  }

  // ---------- jogadores ----------
  $('#tabJogadores').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-j]');
    if (!b) return;
    let valor;
    if (b.dataset.j === 'pontos') { valor = prompt('Quantos pontos somar? (use negativo para tirar, ex.: -10)'); if (!valor) return; }
    if (b.dataset.j === 'remover' && !confirm('Remover este jogador do placar?')) return;
    acao('jogador', { id: b.dataset.id, acao: b.dataset.j, valor });
  });
  let assinJog = '';
  function desenharJogadores() {
    const js = E.jogadores || [];
    const assin = JSON.stringify(js.map((j) => [j.id, j.pontos, j.vidas, j.eliminado, j.banido, j.pontosRodada, j.acertos]));
    if (assin === assinJog) return;
    assinJog = assin;
    $('#contJog').textContent = `(${js.length})`;
    $('#tabJogadores tbody').innerHTML = js.map((j, i) => `
      <tr class="${j.eliminado || j.banido ? 'elim' : ''}">
        <td>${i + 1}</td>
        <td>${j.foto ? `<img class="av" src="${esc(j.foto)}" referrerpolicy="no-referrer">` : ''}${esc(j.nome)} <small class="dica">@${esc(j.id)}</small></td>
        <td><b>${j.pontos}</b></td><td>${j.pontosRodada || 0}</td><td>${j.acertos || 0}</td><td>${j.vidas}</td>
        <td>${j.banido ? '🚫 bloqueado' : j.eliminado ? '☠️ eliminado' : '✔'}</td>
        <td style="white-space:nowrap">
          <button class="mini" data-j="pontos" data-id="${esc(j.id)}">± pontos</button>
          ${j.eliminado ? `<button class="mini verde" data-j="reviver" data-id="${esc(j.id)}">Reviver</button>` : `<button class="mini" data-j="eliminar" data-id="${esc(j.id)}">Eliminar</button>`}
          ${j.banido ? `<button class="mini" data-j="desbanir" data-id="${esc(j.id)}">Desbloquear</button>` : `<button class="mini vermelho" data-j="banir" data-id="${esc(j.id)}">Bloquear</button>`}
          <button class="mini perigo" data-j="remover" data-id="${esc(j.id)}">Remover</button>
        </td></tr>`).join('') || '<tr><td colspan="8" class="dica">Ninguém jogou ainda.</td></tr>';
  }

  // ---------- desenho geral ----------
  const nomesFase = { espera: '⏳ Esperando', sorteio: '🎰 Sorteando letra', jogando: '▶ Valendo!', pausado: '⏸ Pausado', resultado: '📊 Resultado', ranking: '🏆 Ranking', fim: '👑 Fim (campeão)' };
  function desenhar() {
    if (!E) return;
    $('#stFase').textContent = `${nomesFase[E.fase] || E.fase} · Rodada ${E.rodada}`;
    $('#stLetra').textContent = `Letra: ${E.letra || '—'}`;
    const pausadoAuto = (E.fase === 'resultado' || E.fase === 'ranking') && !E.proximaMs;
    $('#btPausa').textContent = E.fase === 'pausado' || pausadoAuto ? '▶ Continuar' : '⏸ Pausar';
    desenharRespostas();
    desenharJogadores();
    desenharExemplos();

    $('#tabRejeitadas tbody').innerHTML = (E.rejeitadas || []).slice(0, 60).map((r) => `<tr><td>${new Date(r.t).toLocaleTimeString()}</td><td>${esc(r.nome)}</td><td>${esc(r.texto)}</td><td><span class="st invalida">${esc(r.motivo)}</span></td></tr>`).join('') || '<tr><td class="dica">Nada recusado.</td></tr>';

    $('#tabPresentes tbody').innerHTML = (E.ultimosPresentes || []).map((p) => `<tr><td>${new Date(p.t).toLocaleTimeString()}</td><td>${esc(p.nome)}</td><td><b>${esc(p.presente)}</b></td><td>${p.quantidade}</td><td>${p.diamantes || ''}</td><td>${esc((p.acoes || []).join(', ') || '— (sem regra)')}</td>
      <td>${cfg && !cfg.presentes.regras.some((r) => r.presente.toLowerCase() === String(p.presente).toLowerCase()) ? `<button class="mini verde" data-criar="${esc(p.presente)}">criar regra</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="dica">Nenhum presente ainda.</td></tr>';
  }

  // relógio do topo
  setInterval(() => {
    if (!E) return;
    let ms = E.restanteMs;
    if (E.fase === 'jogando') ms = Math.max(0, E.restanteMs - (performance.now() - recebidoEm));
    else if (E.proximaMs) ms = Math.max(0, E.proximaMs - (performance.now() - recebidoEm));
    $('#stTempo').textContent = E.fase === 'jogando' || E.fase === 'pausado' ? `⏱ ${Math.ceil(ms / 1000)}s` : E.proximaMs ? `próxima etapa em ${Math.ceil(ms / 1000)}s` : '⏱ —';
  }, 250);

  function desenharConexoes(s) {
    const cls = (st) => (st === 'conectado' ? 'ok' : st === 'erro' ? 'erro' : st === 'conectando' ? 'meio' : '');
    const t = $('#stConTikTok');
    t.className = `statusBox ${cls(s.tiktok.status)}`;
    t.textContent = `${s.tiktok.status.toUpperCase()} — ${s.tiktok.detalhe || ''}`;
    const f = $('#stConTikFinity');
    f.className = `statusBox ${cls(s.tikfinity.status)}`;
    f.textContent = `${s.tikfinity.status.toUpperCase()} — ${s.tikfinity.detalhe || ''}`;
    const top = $('#stTikTok');
    const ligado = s.tiktok.status === 'conectado' || s.tikfinity.status === 'conectado';
    top.className = `pill ${ligado ? 'ok' : s.tiktok.status === 'erro' ? 'erro' : ''}`;
    top.textContent = ligado ? `🟢 Live conectada · ${s.contadores.chat} msgs` : '⚪ Live não conectada';
  }

  // ---------- socket ----------
  socket.on('estado', (e) => { E = e; recebidoEm = performance.now(); desenhar(); });
  socket.on('conexoes', desenharConexoes);
  socket.on('config', (d) => {
    cfg = d.cfg;
    document.body.classList.toggle('app', d.modo === 'app');
    acoes = d.acoes;
    preencherCampos();
    desenharCategorias();
    desenharRegras();
    $('#listaDesafios').innerHTML = d.desafios.map((x) => `<li><b>${esc(x.nome)}</b>: ${esc(x.descricao)}</li>`).join('');
    if (d.modo === 'app') { if (E) desenhar(); return; }
    if (!$('#previa').getAttribute('src')) $('#previa').setAttribute('src', '/jogo');
    const base = `${location.protocol}//${location.hostname}:${d.porta}`;
    const local = `http://localhost:${d.porta}`;
    $('#urlJogo').textContent = `${local}/jogo`;
    $('#urlWebhookChat').textContent = `${local}/api/chat?usuario={usuario}&mensagem={mensagem}`;
    $('#urlWebhookPresente').textContent = `${local}/api/presente?usuario={usuario}&presente={nome do presente}&quantidade=1`;
    $('#enderecos').innerHTML = `
      Tela do jogo (live): <code>${local}/jogo</code><br>
      Tela com fundo transparente (para por em cima da câmera no OBS): <code>${local}/jogo?transparente=1</code><br>
      Este painel: <code>${local}/painel</code><br>
      ${(d.rede || []).map((ip) => `Painel pelo celular (mesmo Wi-Fi): <code>http://${ip}:${d.porta}/painel</code>`).join('<br>')}<br>
      <small>Você está acessando por: ${esc(base)}</small>`;
    if (E) desenhar();
  });
  socket.on('chat_bruto', (m) => {
    const box = $('#chatBruto');
    const d = document.createElement('div');
    d.innerHTML = `<b>${esc(m.nome)}:</b> ${esc(m.texto)}`;
    box.prepend(d);
    while (box.children.length > 60) box.lastChild.remove();
  });
  socket.on('disconnect', () => toast('Sem conexão com o jogo — a janela preta está aberta?', '#d43a4f'));
  // no aplicativo, quando o painel abre de novo, mostra os dados mais recentes
  window.addEventListener('focus', () => { if (E) desenhar(); });
})();
