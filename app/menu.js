// Tela inicial do aplicativo e abertura do painel
(() => {
  const $ = (s) => document.querySelector(s);
  const central = window.__central;
  const cfg = window.__cfg;
  const acao = (tipo, extra = {}) => central.acao({ tipo, ...extra });

  const menu = $('#menuApp');
  const painel = $('#painelApp');
  $('#mUsuario').value = cfg.tiktok.usuario || '';
  $('#mServidor').value = cfg.app.servidor || '';

  // status da conexão no menu
  central.conectar({
    papel: 'painel',
    enviar(ev, d) {
      if (ev !== 'conexoes') return;
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
  function abrirMenu() { menu.classList.remove('escondido'); }

  $('#mConectar').onclick = () => {
    if (!salvarCampos()) { $('#mUsuario').focus(); $('#mStatus').textContent = 'Digite o seu @ do TikTok.'; return; }
    acao('bots', { quantidade: 0 });
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

  // tocar 3 vezes rápido na tela do jogo abre o painel
  let toques = [];
  document.getElementById('palco').addEventListener('pointerdown', () => {
    const agora = Date.now();
    toques = toques.filter((t) => agora - t < 700);
    toques.push(agora);
    if (toques.length >= 3) { toques = []; abrirPainel(); }
  });
})();
