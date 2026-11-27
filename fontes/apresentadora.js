// Apresentadora 3D da Adedonha: a menina ("normal girl", de Ser/msmangekyou49 no Sketchfab), com esqueleto e danças do Mixamo.
// - Fica pequena em cima do quadro da letra, dançando e acenando.
// - Cresce só enquanto a voz fala (gesticulando e mexendo a boca); depois volta para o cantinho.
// - Quando alguém segue a live, passa um balão com a foto da pessoa e ela segura o barbante e voa 1 segundo.
// Este arquivo é empacotado (npm run build) em public/apresentadora.js.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const LARGURA = 1080;
const ALTURA = 1920;

// posições na tela do jogo (em pixels do palco 1080x1920); y = onde ficam os pés
const POSES = {
  canto: { x: 250, y: 268, altura: 250 },   // em cima do quadro da letra
  grande: { x: 860, y: 1890, altura: 660 }, // falando
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
  cena.add(new THREE.HemisphereLight(0xffffff, 0x777777, 2.0));
  const sol = new THREE.DirectionalLight(0xffffff, 1.1); sol.position.set(300, 400, 1000); cena.add(sol);

  const estado = {
    pronta: false,
    ligada: true,
    falando: false,
    fimFala: 0,
    voando: null, // { posicao(): {x,y}, ate }
    x: POSES.canto.x, y: POSES.canto.y, altura: POSES.canto.altura,
    t: 0,
  };

  let alturaModelo = 1; let baseModelo = 0;
  const caminhoModelo = (document.querySelector('script[src*="apresentadora.js"]')?.getAttribute('src') || '/apresentadora.js').replace(/apresentadora\.js.*$/, 'modelos/menina.glb');
  const ossos = {};
  let mixer = null; const acoes = {}; let rosto = null; let iBoca = -1;
  let atual = null; let trocaEm = 0; let lado = -1;

  function tocar(nome, fade = 0.45) {
    const a = acoes[nome];
    if (!a || atual === a) return;
    a.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (atual) atual.fadeOut(fade);
    atual = a;
    trocaEm = performance.now() + a.getClip().duration * 1000 * (nome.startsWith('danca') ? 1 : 2);
  }

  new GLTFLoader().load(caminhoModelo, (gltf) => {
    const modelo = gltf.scene;
    modelo.traverse((o) => {
      if (o.isBone) ossos[o.name.replace('mixamorig', '')] = o;
      if (o.isMesh) {
        o.frustumCulled = false;
        if (o.morphTargetDictionary && o.morphTargetDictionary.boca !== undefined) { rosto = o; iBoca = o.morphTargetDictionary.boca; }
      }
    });
    const raiz = new THREE.Group();
    raiz.add(modelo);
    cena.add(raiz);
    mixer = new THREE.AnimationMixer(modelo);
    for (const c of gltf.animations) { const a = mixer.clipAction(c); a.setLoop(THREE.LoopRepeat); acoes[c.name] = a; }
    // mede a altura em pé (pose da fala) para encaixar no quadro da letra
    const medir = acoes.fala2 || Object.values(acoes)[0];
    medir.play(); mixer.update(0); modelo.updateMatrixWorld(true);
    const caixa = new THREE.Box3();
    modelo.traverse((o) => { if (o.isSkinnedMesh) { o.computeBoundingBox(); caixa.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
    medir.stop();
    alturaModelo = (caixa.max.y - caixa.min.y) || 1;
    baseModelo = caixa.min.y;
    modelo.position.x = -(caixa.min.x + caixa.max.x) / 2;
    modelo.position.z = -(caixa.min.z + caixa.max.z) / 2;
    if (ossos.RightHand) { modelo.updateMatrixWorld(true); lado = Math.sign(ossos.RightHand.getWorldPosition(new THREE.Vector3()).x - ossos.Hips.getWorldPosition(new THREE.Vector3()).x) || -1; }
    tocar('danca1', 0);
    estado.raiz = raiz;
    estado.modelo = modelo;
    estado.pronta = true;
    window.__apresentadora = { ossos, acoes, estado };
  }, undefined, (e) => console.warn('[apresentadora] não carregou o modelo', e));

  // gira um osso para que ele aponte numa direção (relativa ao corpo dela), misturando com a animação
  const _a = new THREE.Vector3(); const _b = new THREE.Vector3(); const _q = new THREE.Quaternion(); const _qw = new THREE.Quaternion(); const _qp = new THREE.Quaternion(); const _qr = new THREE.Quaternion();
  function apontar(osso, filho, dir, peso) {
    if (!osso || !filho || peso <= 0) return;
    osso.updateWorldMatrix(true, false); filho.updateWorldMatrix(false, false);
    osso.getWorldPosition(_a); filho.getWorldPosition(_b);
    const agoraDir = _b.sub(_a).normalize();
    estado.modelo.getWorldQuaternion(_qr);
    const alvoDir = dir.clone().normalize().applyQuaternion(_qr);
    _q.setFromUnitVectors(agoraDir, alvoDir);
    osso.getWorldQuaternion(_qw);
    osso.parent.getWorldQuaternion(_qp).invert();
    const novo = _qp.multiply(_q).multiply(_qw);
    osso.quaternion.slerp(novo, Math.min(1, peso));
    osso.updateWorldMatrix(false, true);
  }

  // ----- ligação com o jogo -----
  window.addEventListener('voz-inicio', () => { estado.falando = true; });
  window.addEventListener('voz-fim', () => { estado.falando = false; estado.fimFala = performance.now(); });
  window.addEventListener('efeitos-jogo', (ev) => {
    estado.ligada = ev.detail?.apresentadora !== false;
    canvas.style.display = estado.ligada ? '' : 'none';
  });
  // nos anúncios do jogo ela "fala" (cresce e mexe a boca), mesmo se a voz demorar ou falhar
  const FALAS = { valendo: 4500, stop: 2500, resposta_certa: 3500, melhor_rodada: 6000, nova_letra: 3000, nova_categoria: 3500, nova_pergunta: 3500, desafio: 4000, campeao: 4000, teste_voz: 6000 };
  window.addEventListener('jogo-evento', (ev) => {
    const e = ev.detail || {};
    if (e.tipo === 'seguidor') soltarBalao(e);
    if (FALAS[e.tipo] && estado.ligada) estado.falaAte = Math.max(estado.falaAte || 0, performance.now() + FALAS[e.tipo]);
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
        estado.voando = { posicao: () => { const q = pos(performance.now()); return { x: q.x + 115, y: q.y + 470 }; }, ate: agora + 1100 };
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

    const anunciando = agora < (estado.falaAte || 0);
    const grande = estado.falando || anunciando || agora - estado.fimFala < 500;
    const voando = estado.voando && agora < estado.voando.ate;
    if (!voando) estado.voando = null;

    const t = estado.t;
    // corpo: dança pequena no quadro, gesticula falando (alterna os 2 movimentos de cada)
    if (grande && !voando) { if (!atual || !atual.getClip().name.startsWith('fala') || agora > trocaEm) tocar(atual && atual.getClip().name === 'fala1' ? 'fala2' : 'fala1', 0.35); }
    else if (!atual || !atual.getClip().name.startsWith('danca') || agora > trocaEm) tocar(atual && atual.getClip().name === 'danca1' ? 'danca2' : 'danca1');
    mixer.update(dt);
    estado.modelo.updateMatrixWorld(true);

    // boca: abre com o volume da voz (voz natural) ou num "tagarelar" quando é a voz do celular
    let boca = 0;
    if (estado.falando || anunciando) {
      const nivel = typeof window.__nivelVoz === 'function' ? window.__nivelVoz() : null;
      boca = nivel != null ? Math.min(1, nivel * 1.4) : Math.max(0, Math.sin(t * 17) * 0.6 + Math.sin(t * 7.3) * 0.4);
    }
    estado.boca = (estado.boca || 0) + (boca - (estado.boca || 0)) * Math.min(1, dt * 18);
    if (rosto) rosto.morphTargetInfluences[iBoca] = estado.boca * 0.85;

    // braço direito: aceno a cada ~7 s quando está dançando; erguido segurando o barbante quando voa
    const ciclo = t % 7;
    const aceno = !grande && !voando && ciclo > 4.5 ? Math.min(1, (ciclo - 4.5) * 3, (7 - ciclo) * 3) : 0;
    estado.segura = (estado.segura || 0) + ((voando ? 1 : 0) - (estado.segura || 0)) * Math.min(1, dt * 10);
    if (aceno > 0) {
      apontar(ossos.RightArm, ossos.RightForeArm, new THREE.Vector3(lado * 0.75, 0.65, 0.2), aceno);
      apontar(ossos.RightForeArm, ossos.RightHand, new THREE.Vector3(lado * (0.15 + Math.sin(t * 10) * 0.45), 1, 0.25), aceno);
    }
    if (estado.segura > 0.01) {
      apontar(ossos.RightArm, ossos.RightForeArm, new THREE.Vector3(lado * 0.12, 1, 0.05), estado.segura);
      apontar(ossos.RightForeArm, ossos.RightHand, new THREE.Vector3(lado * 0.05, 1, 0.05), estado.segura);
      // pernas balançando no ar
      apontar(ossos.LeftUpLeg, ossos.LeftLeg, new THREE.Vector3(0.1 + Math.sin(t * 9) * 0.25, -1, 0.2), estado.segura * 0.8);
      apontar(ossos.RightUpLeg, ossos.RightLeg, new THREE.Vector3(-0.1 - Math.sin(t * 9) * 0.25, -1, 0.2), estado.segura * 0.8);
    }

    // posição na tela (desliza suave entre cantinho, grande e voando)
    if (voando) {
      const p = estado.voando.posicao();
      alvo.altura = POSES.canto.altura * 1.1;
      // onde está a mão agora em relação aos pés → coloca a mão no barbante
      let dx = 0; let dy = alvo.altura * 1.2;
      if (ossos.RightHand) { ossos.RightHand.getWorldPosition(_a); dx = _a.x - estado.raiz.position.x; dy = (_a.y - estado.raiz.position.y) - baseModelo * estado.raiz.scale.x; }
      alvo.x = p.x - dx; alvo.y = p.y + dy;
    } else {
      const pose = grande ? POSES.grande : POSES.canto;
      alvo.x = pose.x; alvo.y = pose.y; alvo.altura = pose.altura;
    }
    const suave = 1 - Math.pow(0.0005, dt * (voando ? 3 : 1));
    estado.x += (alvo.x - estado.x) * suave;
    estado.y += (alvo.y - estado.y) * suave;
    estado.altura += (alvo.altura - estado.altura) * suave;
    const pulinho = 0;

    const esc = estado.altura / alturaModelo;
    estado.raiz.scale.setScalar(esc);
    estado.raiz.position.set(estado.x, -(estado.y - pulinho) - baseModelo * esc, 0);
    estado.raiz.rotation.y = voando ? 0 : grande ? -0.35 + Math.sin(estado.t * 0.9) * 0.1 : Math.sin(estado.t * 0.7) * 0.3;
    renderer.render(cena, camera);
  }
  requestAnimationFrame(quadro);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
else iniciar();
