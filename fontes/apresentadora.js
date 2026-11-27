// Apresentador 3D da Adedonha: o passarinho (Cartoon Bird, de assetfactory no Sketchfab).
// O modelo não tem esqueleto: separamos bico, asas e olhos por código e animamos cada peça.
// - Fica pequeno em cima do quadro da letra, dançando e acenando com a asa.
// - Cresce só enquanto a voz fala; depois volta para o cantinho.
// - Quando alguém segue a live, passa um balão com a foto da pessoa e ela voa 1 segundo segurando o barbante.
// Este arquivo é empacotado (npm run build) em public/apresentadora.js.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const LARGURA = 1080;
const ALTURA = 1920;

// posições na tela do jogo (em pixels do palco 1080x1920); y = onde ficam os pés
const POSES = {
  canto: { x: 250, y: 268, altura: 230 },   // em cima do quadro da letra
  grande: { x: 800, y: 1040, altura: 640 }, // falando
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
  };

  const pecas = { asaE: null, asaD: null, bicoCima: null, bicoBaixo: null, olhos: [], corpo: null };
  let alturaModelo = 1; let baseModelo = 0;
  const caminhoModelo = (document.querySelector('script[src*="apresentadora.js"]')?.getAttribute('src') || '/apresentadora.js').replace(/apresentadora\.js.*$/, 'modelos/passarinho.glb');

  // separa a malha em "ilhas" (peças soltas) e agrupa em corpo, asas, bico e olhos
  function separarPecas(malha) {
    const geo = malha.geometry;
    const pos = geo.attributes.position;
    const idx = geo.index ? geo.index.array : [...Array(pos.count).keys()];
    const pai = new Int32Array(pos.count).map((_, i) => i);
    const raizDe = (x) => { while (pai[x] !== x) { pai[x] = pai[pai[x]]; x = pai[x]; } return x; };
    for (let i = 0; i < idx.length; i += 3) {
      const a = raizDe(idx[i]); const b = raizDe(idx[i + 1]); const c = raizDe(idx[i + 2]);
      pai[a] = c; pai[b] = c;
    }
    const ilhas = new Map();
    for (let i = 0; i < idx.length; i += 3) {
      const r = raizDe(idx[i]);
      if (!ilhas.has(r)) ilhas.set(r, { tris: [], min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] });
      const ilha = ilhas.get(r);
      for (let k = 0; k < 3; k++) {
        const v = idx[i + k];
        ilha.tris.push(v);
        for (let e = 0; e < 3; e++) { const val = pos.array[v * 3 + e]; if (val < ilha.min[e]) ilha.min[e] = val; if (val > ilha.max[e]) ilha.max[e] = val; }
      }
    }
    // no arquivo: x = lados, y = para trás (bico em y negativo), z = para cima
    const grupos = { corpo: [], asaE: [], asaD: [], bicoCima: [], bicoBaixo: [], olhos: [] };
    const bico = [];
    for (const ilha of ilhas.values()) {
      const c = [0, 1, 2].map((e) => (ilha.min[e] + ilha.max[e]) / 2);
      if (c[0] > 0.16 && c[2] < -0.38 && c[2] > -0.75) grupos.asaD.push(ilha);
      else if (c[0] < -0.16 && c[2] < -0.38 && c[2] > -0.75) grupos.asaE.push(ilha);
      else if (c[1] < -0.12 && Math.abs(c[0]) < 0.12 && c[2] < -0.22 && c[2] > -0.42) bico.push({ ilha, z: c[2] });
      else if (Math.abs(c[0]) > 0.05 && Math.abs(c[0]) < 0.24 && c[2] > -0.33 && c[2] < -0.1 && c[1] < 0.02) grupos.olhos.push(ilha);
      else grupos.corpo.push(ilha);
    }
    if (bico.length) {
      const zm = bico.reduce((s2, b2) => s2 + b2.z, 0) / bico.length;
      for (const b2 of bico) (b2.z >= zm ? grupos.bicoCima : grupos.bicoBaixo).push(b2.ilha);
    }
    const criar = (lista, pivo) => {
      if (!lista.length) return null;
      const g2 = new THREE.BufferGeometry();
      for (const nome of Object.keys(geo.attributes)) g2.setAttribute(nome, geo.attributes[nome]);
      g2.setIndex(lista.flatMap((i2) => i2.tris));
      const m = new THREE.Mesh(g2, malha.material);
      m.frustumCulled = false;
      const p2 = new THREE.Group();
      p2.position.set(...pivo);
      m.position.set(-pivo[0], -pivo[1], -pivo[2]);
      p2.add(m);
      malha.parent.add(p2);
      return p2;
    };
    const centroDe = (lista) => { const mn = [1e9, 1e9, 1e9]; const mx = [-1e9, -1e9, -1e9]; for (const i2 of lista) for (let e = 0; e < 3; e++) { mn[e] = Math.min(mn[e], i2.min[e]); mx[e] = Math.max(mx[e], i2.max[e]); } return { mn, mx }; };
    const ombro = (lista, lado) => { if (!lista.length) return [0, 0, 0]; const { mn, mx } = centroDe(lista); return [lado < 0 ? mx[0] : mn[0], (mn[1] + mx[1]) / 2, mx[2]]; };
    const dobra = (lista) => { if (!lista.length) return [0, 0, 0]; const { mn, mx } = centroDe(lista); return [0, mx[1], (mn[2] + mx[2]) / 2]; };
    pecas.corpo = criar(grupos.corpo, [0, 0, 0]);
    pecas.asaE = criar(grupos.asaE, ombro(grupos.asaE, -1));
    pecas.asaD = criar(grupos.asaD, ombro(grupos.asaD, 1));
    pecas.bicoCima = criar(grupos.bicoCima, dobra(grupos.bicoCima));
    pecas.bicoBaixo = criar(grupos.bicoBaixo, dobra(grupos.bicoBaixo));
    pecas.olhos = grupos.olhos.map((ilha) => { const { mn, mx } = centroDe([ilha]); return criar([ilha], [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2]); });
    malha.visible = false;
  }

  new GLTFLoader().load(caminhoModelo, (gltf) => {
    const modelo = gltf.scene;
    let malha = null;
    modelo.traverse((o) => { if (o.isMesh && !malha) malha = o; });
    if (malha) separarPecas(malha);
    const raiz = new THREE.Group();
    raiz.add(modelo);
    cena.add(raiz);
    modelo.updateMatrixWorld(true);
    const caixa = new THREE.Box3().setFromObject(modelo);
    alturaModelo = caixa.max.y - caixa.min.y;
    baseModelo = caixa.min.y;
    modelo.position.x = -(caixa.min.x + caixa.max.x) / 2;
    modelo.position.z = -(caixa.min.z + caixa.max.z) / 2;
    estado.raiz = raiz;
    estado.pronta = true;
    window.__passarinho = { pecas, estado };
  }, undefined, (e) => console.warn('[apresentador] não carregou o modelo', e));

  // ----- ligação com o jogo -----
  window.addEventListener('voz-inicio', () => { estado.falando = true; });
  window.addEventListener('voz-fim', () => { estado.falando = false; estado.fimFala = performance.now(); });
  window.addEventListener('efeitos-jogo', (ev) => {
    estado.ligada = ev.detail?.apresentadora !== false;
    canvas.style.display = estado.ligada ? '' : 'none';
  });
  // nos anúncios do jogo ele "fala" (cresce e mexe o bico), mesmo se a voz demorar ou falhar
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

    const anunciando = agora < (estado.falaAte || 0);
    const grande = estado.falando || anunciando || agora - estado.fimFala < 500;
    const voando = estado.voando && agora < estado.voando.ate;
    if (!voando) estado.voando = null;

    const t = estado.t;
    // bico: abre com o volume da voz (voz natural) ou num "tagarelar" quando é a voz do celular
    let boca = 0;
    if (estado.falando || anunciando) {
      const nivel = typeof window.__nivelVoz === 'function' ? window.__nivelVoz() : null;
      boca = nivel != null ? Math.min(1, nivel * 1.4) : Math.max(0, Math.sin(t * 17) * 0.6 + Math.sin(t * 7.3) * 0.4);
    }
    estado.boca = (estado.boca || 0) + (boca - (estado.boca || 0)) * Math.min(1, dt * 18);
    if (pecas.bicoBaixo) pecas.bicoBaixo.rotation.x = -estado.boca * 0.55;
    if (pecas.bicoCima) pecas.bicoCima.rotation.x = estado.boca * 0.12;

    // asas: batem devagar dançando, gesticulam falando, batem rápido voando; aceno a cada ~7 s
    const ciclo = t % 7;
    const aceno = !grande && !voando && ciclo > 4.5 ? Math.min(1, (ciclo - 4.5) * 3, (7 - ciclo) * 3) : 0;
    let abreE; let abreD;
    if (voando) { abreE = abreD = 0.6 + Math.sin(t * 28) * 0.6; }
    else if (grande) { abreE = 0.25 + Math.sin(t * 3.1) * 0.25; abreD = 0.25 + Math.sin(t * 3.1 + 1.5) * 0.25; }
    else { abreE = 0.15 + Math.sin(t * 8.4) * 0.15; abreD = 0.15 + Math.sin(t * 8.4) * 0.15; }
    abreD = abreD * (1 - aceno) + (1.6 + Math.sin(t * 12) * 0.35) * aceno; // levanta a asa e balança
    if (pecas.asaE) pecas.asaE.rotation.y = -abreE;
    if (pecas.asaD) pecas.asaD.rotation.y = abreD;

    // piscar
    const piscando = (t % 3.3) < 0.12;
    for (const o of pecas.olhos) if (o) o.scale.z = piscando ? 0.15 : 1;

    // corpo: balanço da dancinha
    if (pecas.corpo) pecas.corpo.rotation.y = grande ? 0 : Math.sin(t * 4.2) * 0.08;

    // posição na tela (desliza suave entre cantinho, grande e voando)
    if (voando) {
      const p = estado.voando.posicao();
      alvo.x = p.x; alvo.y = p.y + 40; alvo.altura = POSES.canto.altura * 1.1;
    } else {
      const pose = grande ? POSES.grande : POSES.canto;
      alvo.x = pose.x; alvo.y = pose.y; alvo.altura = pose.altura;
    }
    const suave = 1 - Math.pow(0.0005, dt * (voando ? 3 : 1));
    estado.x += (alvo.x - estado.x) * suave;
    estado.y += (alvo.y - estado.y) * suave;
    estado.altura += (alvo.altura - estado.altura) * suave;
    const pulinho = !grande && !voando ? Math.abs(Math.sin(estado.t * 4.2)) * 14 : 0;

    const esc = estado.altura / alturaModelo;
    estado.raiz.scale.setScalar(esc);
    estado.raiz.position.set(estado.x, -(estado.y - pulinho) - baseModelo * esc, 0);
    estado.raiz.rotation.y = grande ? -0.3 + Math.sin(estado.t * 0.9) * 0.12 : Math.sin(estado.t * 1.3) * 0.35;
    estado.raiz.rotation.z = !grande && !voando ? Math.sin(estado.t * 4.2) * 0.06 : 0;
    renderer.render(cena, camera);
  }
  requestAnimationFrame(quadro);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
else iniciar();
