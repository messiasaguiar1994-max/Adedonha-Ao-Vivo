// Apresentadora 3D da Adedonha.
// - Fica pequena em cima do quadro da letra, dançando e acenando.
// - Cresce só enquanto a voz fala; depois volta para o cantinho.
// - Quando alguém segue a live, passa um balão com a foto da pessoa e ela voa 1 segundo segurando o barbante.
// Este arquivo é empacotado (npm run build) em public/apresentadora.js.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const LARGURA = 1080;
const ALTURA = 1920;

// posições na tela do jogo (em pixels do palco 1080x1920); y = onde ficam os pés
const POSES = {
  canto: { x: 250, y: 272, altura: 300 },   // em cima do quadro da letra
  grande: { x: 810, y: 1080, altura: 860 }, // falando
};

// trechos da animação original (segundos)
const TRECHOS = {
  danca: [5.5, 10.2],  // mãos na cintura, balançando
  fala: [1.5, 5.0],    // "paz e amor" e joinha
};

const params = new URLSearchParams(location.search);

function iniciar() {
  const palco = document.getElementById('palco');
  if (!palco || params.get('apresentadora') === '0') return;

  const canvas = document.createElement('canvas');
  canvas.id = 'apresentadoraCanvas';
  Object.assign(canvas.style, { position: 'absolute', left: '0', top: '0', width: `${LARGURA}px`, height: `${ALTURA}px`, zIndex: '15', pointerEvents: 'none' });
  palco.appendChild(canvas);

  const camadaBaloes = document.createElement('div');
  camadaBaloes.id = 'baloes';
  Object.assign(camadaBaloes.style, { position: 'absolute', inset: '0', zIndex: '14', pointerEvents: 'none', overflow: 'hidden' });
  palco.appendChild(camadaBaloes);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch (e) {
    console.warn('[apresentadora] sem WebGL', e);
    canvas.remove();
    return;
  }
  renderer.setPixelRatio(1);
  renderer.setSize(LARGURA / 2, ALTURA / 2, false); // metade da resolução: leve no celular
  renderer.setClearColor(0x000000, 0);

  const cena = new THREE.Scene();
  // câmera "plana": 1 unidade = 1 pixel do palco (y para baixo é negativo)
  const camera = new THREE.OrthographicCamera(0, LARGURA, 0, -ALTURA, -5000, 5000);
  cena.add(new THREE.HemisphereLight(0xffffff, 0x666666, 2.2));

  const estado = {
    pronta: false,
    ligada: true,
    falando: false,
    fimFala: 0,
    voando: null, // { posicao(): {x,y}, ate }
    x: POSES.canto.x, y: POSES.canto.y, altura: POSES.canto.altura,
    t: 0,
    tempoAnim: TRECHOS.danca[0],
    trecho: 'danca',
  };

  let modelo; let acao; let mixer; let ossos = {};
  let alturaModelo = 1; let baseModelo = 0;
  const caminhoModelo = (document.querySelector('script[src*="apresentadora.js"]')?.getAttribute('src') || '/apresentadora.js').replace(/apresentadora\.js.*$/, 'modelos/apresentadora.glb');

  new GLTFLoader().load(caminhoModelo, (gltf) => {
    modelo = gltf.scene;
    modelo.traverse((o) => {
      if (o.isMesh) { o.frustumCulled = false; if (o.morphTargetInfluences) o.morphTargetInfluences.fill(0); }
      if (o.isBone) ossos[o.name] = o;
    });
    const raiz = new THREE.Group();
    raiz.add(modelo);
    cena.add(raiz);
    mixer = new THREE.AnimationMixer(modelo);
    const clip = gltf.animations[0];
    acao = mixer.clipAction(clip);
    acao.play();
    acao.paused = true;
    // mede o tamanho numa pose em pé
    acao.time = 0.9; mixer.update(0); modelo.updateMatrixWorld(true);
    const caixa = new THREE.Box3().setFromObject(modelo, true);
    alturaModelo = caixa.max.y - caixa.min.y;
    baseModelo = caixa.min.y;
    modelo.position.x = -(caixa.min.x + caixa.max.x) / 2;
    modelo.position.z = -(caixa.min.z + caixa.max.z) / 2;
    estado.raiz = raiz;
    estado.pronta = true;
  }, undefined, (e) => console.warn('[apresentadora] não carregou o modelo', e));

  // ----- ligação com o jogo -----
  window.addEventListener('voz-inicio', () => { estado.falando = true; });
  window.addEventListener('voz-fim', () => { estado.falando = false; estado.fimFala = performance.now(); });
  window.addEventListener('efeitos-jogo', (ev) => {
    estado.ligada = ev.detail?.apresentadora !== false;
    canvas.style.display = estado.ligada ? '' : 'none';
  });
  window.addEventListener('jogo-evento', (ev) => {
    const e = ev.detail || {};
    if (e.tipo === 'seguidor') soltarBalao(e);
  });

  // ----- balão de quem segue -----
  const fila = [];
  let balaoAtivo = false;
  function soltarBalao(p) {
    fila.push(p);
    if (fila.length > 8) fila.shift();
    if (!balaoAtivo) proximoBalao();
  }
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cores = ['#ff3d9a', '#2ee6ff', '#ffd23f', '#3ddc84', '#ff9f1c', '#9b5cff'];
  function proximoBalao() {
    const p = fila.shift();
    if (!p) { balaoAtivo = false; return; }
    balaoAtivo = true;
    const cor = cores[Math.floor(Math.random() * cores.length)];
    const el = document.createElement('div');
    const ini = esc(String(p.nome || '?').replace(/[^\p{L}\p{N}]/gu, '').slice(0, 1).toUpperCase() || '?');
    el.innerHTML = `
      <div style="width:230px;height:280px;border-radius:50% 50% 48% 48%;background:radial-gradient(circle at 32% 28%,#ffffffaa,${cor} 45%,${cor});box-shadow:inset -14px -18px 0 rgba(0,0,0,.15),0 10px 30px rgba(0,0,0,.35);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;position:relative">
        <div style="width:140px;height:140px;border-radius:50%;overflow:hidden;border:6px solid #fff;background:#4b1aa8;color:#fff;font:800 64px 'Baloo 2',Arial;display:flex;align-items:center;justify-content:center">
          ${p.foto ? `<img src="${esc(p.foto)}" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover" onerror="this.parentNode.textContent='${ini}'">` : ini}
        </div>
        <div style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:800 28px 'Baloo 2',Arial;color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.45)">${esc(p.nome || '')}</div>
        <div style="position:absolute;bottom:-14px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:16px solid transparent;border-right:16px solid transparent;border-top:20px solid ${cor}"></div>
      </div>
      <div style="width:4px;height:260px;margin:8px auto 0;background:linear-gradient(#fff,#ccc)"></div>`;
    Object.assign(el.style, { position: 'absolute', left: '0', top: '0', width: '230px', willChange: 'transform' });
    camadaBaloes.appendChild(el);
    const inicio = performance.now();
    const dur = 7000;
    const x0 = 120 + Math.random() * 200;
    const x1 = 650 + Math.random() * 250;
    const pos = (agora) => {
      const k = Math.min(1, (agora - inicio) / dur);
      const x = x0 + (x1 - x0) * k + Math.sin(k * Math.PI * 3) * 50;
      const y = ALTURA + 100 - (ALTURA + 700) * k;
      return { x, y, k };
    };
    let pegou = false;
    function quadro() {
      const agora = performance.now();
      const p2 = pos(agora);
      el.style.transform = `translate(${p2.x}px, ${p2.y}px) rotate(${Math.sin(agora / 400) * 6}deg)`;
      // no meio do caminho ela segura o barbante e voa junto por ~1 segundo
      if (!pegou && p2.y < 1250 && estado.pronta && estado.ligada && !estado.falando) {
        pegou = true;
        estado.voando = { posicao: () => { const q = pos(performance.now()); return { x: q.x + 115, y: q.y + 280 + 268 + 130 }; }, ate: agora + 1100 };
      }
      if (p2.k < 1) requestAnimationFrame(quadro);
      else { el.remove(); proximoBalao(); }
    }
    requestAnimationFrame(quadro);
  }

  // ----- animação -----
  let ultimo = performance.now();
  const alvo = { x: POSES.canto.x, y: POSES.canto.y, altura: POSES.canto.altura };
  function quadro() {
    requestAnimationFrame(quadro);
    const agora = performance.now();
    const dt = Math.min(0.1, (agora - ultimo) / 1000);
    ultimo = agora;
    if (!estado.pronta || !estado.ligada) return;
    estado.t += dt;

    const grande = estado.falando || agora - estado.fimFala < 500;
    const voando = estado.voando && agora < estado.voando.ate;
    if (!voando) estado.voando = null;

    // trecho da animação: falando = gestos; parada = dancinha
    const trecho = grande ? 'fala' : 'danca';
    if (trecho !== estado.trecho) { estado.trecho = trecho; estado.tempoAnim = TRECHOS[trecho][0]; }
    const [ini, fim] = TRECHOS[trecho];
    estado.tempoAnim += dt * (grande ? 1 : 0.9);
    if (estado.tempoAnim > fim) estado.tempoAnim = ini + (estado.tempoAnim - fim);
    acao.time = estado.tempoAnim;
    mixer.update(0);

    // aceno com a mão direita (a cada ~7 s, por ~2,5 s) quando está no cantinho
    const ciclo = estado.t % 7;
    let aceno = !grande && ciclo > 4.5 ? Math.min(1, (ciclo - 4.5) * 3, (7 - ciclo) * 3) : 0;
    if (voando) aceno = 1; // segurando o barbante com a mão para cima
    if (aceno > 0 && ossos.ArmR_023) {
      ossos.ArmR_023.rotation.z += 2.2 * aceno;
      if (!voando && ossos.ArmR002_025) ossos.ArmR002_025.rotation.z += (Math.sin(estado.t * 10) * 0.6 - 0.1) * aceno;
    }
    // balanço de dança
    if (!grande && ossos.Spine_01) {
      ossos.Spine_01.rotation.z += Math.sin(estado.t * 4.2) * 0.12;
    }

    // posição na tela (desliza suave entre cantinho, grande e voando)
    if (voando) {
      const p = estado.voando.posicao();
      alvo.x = p.x; alvo.y = p.y; alvo.altura = POSES.canto.altura * 1.15;
    } else {
      const pose = grande ? POSES.grande : POSES.canto;
      alvo.x = pose.x; alvo.y = pose.y; alvo.altura = pose.altura;
    }
    const suave = 1 - Math.pow(0.0005, dt * (voando ? 3 : 1));
    estado.x += (alvo.x - estado.x) * suave;
    estado.y += (alvo.y - estado.y) * suave;
    estado.altura += (alvo.altura - estado.altura) * suave;
    const pulinho = !grande && !voando ? Math.abs(Math.sin(estado.t * 4.2)) * 10 : 0;

    const esc = estado.altura / alturaModelo;
    estado.raiz.scale.setScalar(esc);
    estado.raiz.position.set(estado.x, -(estado.y - pulinho) - baseModelo * esc, 0);
    estado.raiz.rotation.y = grande ? -0.25 : Math.sin(estado.t * 1.3) * 0.25;
    renderer.render(cena, camera);
  }
  requestAnimationFrame(quadro);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
else iniciar();
