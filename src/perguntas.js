// Rodadas de pergunta: continhas de matemática e ditados populares.
// Nelas todo mundo tem a mesma resposta certa; ganha mais quem responde primeiro.
import { DITADOS } from './ditados.js';
import { normalizar } from './dicionario.js';

const sorteio = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pegar = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------- continhas (com ordem das operações: × e ÷ antes de + e -) ----------
function gerarConta() {
  const modelos = [
    () => { const a = sorteio(1, 20), b = sorteio(2, 9), c = sorteio(2, 9); return { t: `${a} + ${b} × ${c}`, r: a + b * c, f: `${a} mais ${b} vezes ${c}` }; },
    () => { const b = sorteio(2, 9), c = sorteio(2, 9), a = sorteio(b * c, b * c + 30); return { t: `${a} − ${b} × ${c}`, r: a - b * c, f: `${a} menos ${b} vezes ${c}` }; },
    () => { const a = sorteio(2, 9), b = sorteio(2, 9), c = sorteio(1, 20); return { t: `${a} × ${b} + ${c}`, r: a * b + c, f: `${a} vezes ${b} mais ${c}` }; },
    () => { const c = sorteio(2, 9), q = sorteio(2, 10), b = c * q, a = sorteio(1, 20); return { t: `${a} + ${b} ÷ ${c}`, r: a + q, f: `${a} mais ${b} dividido por ${c}` }; },
    () => { const c = sorteio(2, 9), q = sorteio(2, 10), b = c * q, a = sorteio(q, q + 20); return { t: `${a} − ${b} ÷ ${c}`, r: a - q, f: `${a} menos ${b} dividido por ${c}` }; },
    () => { const a = sorteio(2, 6), b = sorteio(2, 6), c = sorteio(2, 6), d = sorteio(2, 6); return { t: `${a} × ${b} + ${c} × ${d}`, r: a * b + c * d, f: `${a} vezes ${b} mais ${c} vezes ${d}` }; },
    () => { const a = sorteio(1, 15), b = sorteio(2, 8), c = sorteio(2, 8), d = sorteio(1, 10); return { t: `${a} + ${b} × ${c} − ${d}`, r: a + b * c - d, f: `${a} mais ${b} vezes ${c} menos ${d}` }; },
    () => { const a = sorteio(10, 40), b = sorteio(2, 8), c = sorteio(2, 5); return { t: `${a} − ${b} + ${c} × 2`, r: a - b + c * 2, f: `${a} menos ${b} mais ${c} vezes 2` }; },
  ];
  let x;
  do { x = pegar(modelos)(); } while (x.r < 0);
  return { tipo: 'conta', texto: `${x.t} = ?`, resposta: String(x.r), falar: `Quanto é ${x.f}?`, revelar: `${x.t} = ${x.r}` };
}

// ---------- ditados ----------
function gerarDitado(letra) {
  const comLetra = letra ? DITADOS.filter((d) => normalizar(d[0])[0] === normalizar(letra)) : [];
  const [inicio, fim] = pegar(comLetra.length ? comLetra : DITADOS);
  return { tipo: 'ditado', texto: `${inicio} ______`, resposta: fim, falar: `Complete o ditado: ${inicio}...`, revelar: `${inicio} ${fim.toUpperCase()}` };
}

export function novaPergunta(tipo, letra) {
  return tipo === 'conta' ? gerarConta() : gerarDitado(letra);
}

export function letraDaPergunta(p) {
  if (p.tipo === 'conta') return '=';
  return normalizar(p.texto)[0].toUpperCase();
}

// confere a resposta do chat
export function confereResposta(p, mensagem) {
  const msg = normalizar(mensagem);
  if (!msg) return { tentativa: false };
  if (p.tipo === 'conta') {
    const m = String(mensagem).match(/-?\d+/);
    if (!m) return { tentativa: false };
    // só conta como tentativa se a mensagem for curtinha (ex.: "21", "= 21", "é 21")
    if (msg.replace(/[\d\s=e-]/g, '').length > 6) return { tentativa: false };
    return { tentativa: true, certo: m[0] === p.resposta, palavra: m[0] };
  }
  const resp = normalizar(p.resposta);
  const palavras = msg.split(' ');
  if (palavras.length > 8) return { tentativa: false };
  const certo = msg === resp || msg.endsWith(' ' + resp) || (` ${msg} `).includes(` ${resp} `) || (resp.length >= 5 && distancia1(msg.split(' ').pop(), resp));
  return { tentativa: true, certo, palavra: String(mensagem).trim().slice(0, 40) };
}

function distancia1(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, erros = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++erros > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return erros + (a.length - i) + (b.length - j) <= 1;
}
