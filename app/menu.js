// Tela inicial do aplicativo e abertura do painel
(() => {
  const $ = (s) => document.querySelector(s);
  const central = window.__central;
  const cfg = window.__cfg;
  const acao = (tipo, extra = {}) => central.acao({ tipo, ...extra });

  const ROBOS = new Set(['ana_bia', 'joaozinho22', 'mari.souza', 'pedrão', 'lu_gamer', 'carlinha', 'thiago_rj', 'duda', 'rafa_sp', 'gabi.oficial', 'bruninho', 'lari', 'vini_bh', 'juju', 'felipe007', 'paty', 'leo_nordeste', 'nanda', 'caio', 'bela']);
  const menu = $('#menuApp');
  const painel = $('#painelApp');
  $('#mUsuario').value = cfg.tiktok.usuario || '';
  $('#mServidor').value = cfg.app.servidor || '';

  // últimos comentários recebidos (para conferir se a live está chegando)
  let ultimos = [];
  let totalChat = 0;
  const escH = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function mostrarChat() {
    const el = $('#mChat');
    if (!ultimos.length) { el.innerHTML = window.__conexoes.tiktok.status === 'conectado' ? '💬 Nenhum comentário chegou ainda.' : ''; return; }
    el.innerHTML = `💬 Comentários que chegaram: ${totalChat}<br>` + ultimos.map((m) => `<b>${escH(m.nome)}:</b> ${escH(m.texto)}`).join('<br>');
  }

  // status da conexão no menu
  central.conectar({
    papel: 'painel',
    enviar(ev, d) {
      if (ev === 'chat_bruto') { totalChat++; ultimos.unshift(d); ultimos = ultimos.slice(0, 3); mostrarChat(); return; }
      if (ev !== 'conexoes') return;
      mostrarChat();
      const t = d.tiktok;
      const el = $('#mStatus');
      el.className = `mStatus ${t.status}`;
      el.textContent = t.detalhe || t.status;
    },
  });

  function salvarCampos() {
    const usuario = $('#mUsuario').value.trim().replace(/^@/, '').replace(/.*tiktok\.com\/@?/, '').replace(/\/.*$/, '');
    const servidor = $('#mServidor').value.trim();
    acao('config', { cfg: { tiktok: { usuario }, app: { servidor } } });
    return usuario;
  }

  function fecharMenu() { menu.classList.add('escondido'); }
  function abrirMenu() { menu.classList.remove('escondido'); mostrarChat(); }

  $('#mConectar').onclick = () => {
    if (!salvarCampos()) { $('#mUsuario').focus(); $('#mStatus').textContent = 'Digite o seu @ do TikTok.'; return; }
    // saindo do teste: tira os robôs do placar
    if (central.simulador.quantidade > 0 || [...central.jogo.jogadores.keys()].some((id) => ROBOS.has(id))) acao('reiniciar');
    acao('bots', { quantidade: 0 });
    totalChat = 0; ultimos = [];
    acao('conectar_tiktok');
    if (['espera', 'fim'].includes(central.jogo.fase)) acao('iniciar');
    fecharMenu();
  };
  $('#mTestar').onclick = () => {
    salvarCampos();
    acao('bots', { quantidade: 8 });
    if (['espera', 'fim'].includes(central.jogo.fase)) acao('iniciar');
    fecharMenu();
  };
  $('#mPainel').onclick = () => { salvarCampos(); abrirPainel(); };
  $('#mVoltar').onclick = fecharMenu;

  // ---------- painel por cima do jogo ----------
  function abrirPainel() {
    if (!painel.querySelector('iframe')) {
      const f = document.createElement('iframe');
      f.src = 'painel.html';
      painel.appendChild(f);
    }
    painel.classList.add('aberto');
    history.pushState({ painel: true }, '');
  }
  window.fecharPainel = () => {
    painel.classList.remove('aberto');
    if (history.state && history.state.painel) history.back();
  };
  window.addEventListener('popstate', () => {
    painel.classList.remove('aberto');
    $('#mUsuario').value = cfg.tiktok.usuario || '';
  });
  window.abrirMenuApp = abrirMenu;
  $('#btMenuJogo').onclick = (ev) => { ev.stopPropagation(); abrirMenu(); };

  // tocar 3 vezes rápido na tela do jogo abre o painel
  let toques = [];
  document.getElementById('palco').addEventListener('pointerdown', () => {
    const agora = Date.now();
    toques = toques.filter((t) => agora - t < 700);
    toques.push(agora);
    if (toques.length >= 3) { toques = []; abrirPainel(); }
  });
})();
