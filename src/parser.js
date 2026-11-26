// Lê uma mensagem do chat e descobre quais respostas (categoria -> palavra) ela contém.
//
// Formatos aceitos (as categorias da rodada aparecem numeradas na tela):
//   1 Maria 2 Macaco 3 Manaus          (número + resposta)
//   1-Maria 2.Macaco 3:Manaus
//   Maria, Macaco, Manaus              (na ordem das categorias, separadas por vírgula ; / |)
//   Maria Macaco Manaus                (palavras soltas na ordem, todas com a letra da rodada)
//   animal: macaco  cidade: manaus     (nome da categoria + dois pontos)
//   animal macaco                      (nome da categoria + resposta)
import { normalizar } from './dicionario.js';

function limpar(txt) {
  return String(txt || '')
    // remove emojis e símbolos estranhos, mantém letras (com acento), números e pontuação simples
    .replace(/[^\p{L}\p{N}\s,;|/:=.\-'()]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function limparPalavra(p) {
  return String(p || '')
    .replace(/^[\s\-.:=)(]+|[\s\-.:=)(,;]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
}

// procura categoria pelo nome/apelido no começo do texto
function categoriaPorNome(texto, categorias) {
  const n = normalizar(texto);
  let melhor = null;
  for (const c of categorias) {
    const nomes = [c.nome, ...(c.apelidos || [])].map(normalizar).filter(Boolean);
    for (const a of nomes) {
      if (n === a || n.startsWith(a + ' ')) {
        if (!melhor || a.length > melhor.alias.length) melhor = { cat: c, alias: a };
      }
    }
  }
  return melhor;
}

// remove do texto original as N primeiras "palavras normalizadas" (o apelido)
function tirarPrefixo(textoOriginal, alias) {
  const qtd = alias.split(' ').length;
  const partes = textoOriginal.trim().split(/\s+/);
  return partes.slice(qtd).join(' ');
}

export function interpretarMensagem(mensagem, categorias, letra) {
  const txt = limpar(mensagem);
  if (!txt) return [];
  const n = categorias.length;
  const L = normalizar(letra);
  const saida = [];
  const usadas = new Set();
  const add = (cat, palavra) => {
    const p = limparPalavra(palavra);
    if (!cat || !p || usadas.has(cat.id)) return;
    usadas.add(cat.id);
    saida.push({ catId: cat.id, palavra: p });
  };

  // 1) "categoria: palavra" (um ou vários)
  if (/[:=]/.test(txt) && !/^\d/.test(txt)) {
    const pedacos = txt.split(/[,;|/]/);
    let achou = false;
    for (const ped of pedacos) {
      const m = ped.match(/^\s*([^:=]+?)\s*[:=]\s*(.+)$/);
      if (m) {
        const c = categoriaPorNome(m[1], categorias);
        if (c && normalizar(m[1]) === c.alias && !/[:=]/.test(m[2])) { add(c.cat, m[2]); achou = true; }
      }
    }
    // vários "cat: palavra" sem vírgula: "animal: macaco cidade: manaus"
    if (!achou) {
      const re = /([\p{L}]+)\s*[:=]\s*([^:=]+?)(?=\s+[\p{L}]+\s*[:=]|$)/gu;
      let m;
      while ((m = re.exec(txt))) {
        const c = categoriaPorNome(m[1], categorias);
        if (c && normalizar(m[1]) === c.alias) { add(c.cat, m[2]); achou = true; }
      }
    }
    if (achou) return saida;
  }

  // 2) números: "1 maria 2 macaco" / "1-maria,2-macaco"
  const tokens = txt.replace(/[,;|/]/g, ' ').split(/\s+/);
  const temNumero = tokens.some((t) => /^\d{1,2}[\-.:)=]?/.test(t) && Number(t.match(/^\d{1,2}/)[0]) >= 1 && Number(t.match(/^\d{1,2}/)[0]) <= n);
  if (temNumero && /^\s*\d/.test(txt)) {
    let atual = null;
    let buf = [];
    const fechar = () => { if (atual) add(categorias[atual - 1], buf.join(' ')); buf = []; };
    for (const t of tokens) {
      const m = t.match(/^(\d{1,2})[\-.:)=]?(.*)$/);
      if (m && Number(m[1]) >= 1 && Number(m[1]) <= n) {
        fechar();
        atual = Number(m[1]);
        if (m[2]) buf.push(m[2]);
      } else if (atual) {
        buf.push(t);
      }
    }
    fechar();
    if (saida.length) return saida;
  }

  // 3) separado por vírgula/ponto e vírgula/barra: na ordem das categorias
  if (/[,;|/]/.test(txt)) {
    const pedacos = txt.split(/[,;|/]/);
    pedacos.forEach((ped, i) => {
      const p = ped.trim();
      if (!p) return;
      const c = categoriaPorNome(p, categorias);
      if (c && normalizar(p) !== c.alias) add(c.cat, tirarPrefixo(p, c.alias));
      else if (i < n) add(categorias[i], p);
    });
    if (saida.length) return saida;
  }

  // 4) "animal macaco"
  const c = categoriaPorNome(txt, categorias);
  if (c && normalizar(txt) !== c.alias) {
    const resto = tirarPrefixo(txt, c.alias);
    if (normalizar(resto).startsWith(L)) { add(c.cat, resto); return saida; }
  }

  // 5) palavras soltas na ordem: "Maria Macaco Manaus" (todas começando com a letra)
  const palavras = txt.split(/\s+/);
  if (palavras.length >= 2 && palavras.length <= n && palavras.every((p) => normalizar(p).startsWith(L))) {
    palavras.forEach((p, i) => add(categorias[i], p));
    return saida;
  }
  // rodada com uma única categoria: qualquer palavra com a letra vale
  if (n === 1 && palavras.length <= 4 && normalizar(txt).startsWith(L)) {
    add(categorias[0], txt);
  }
  return saida;
}

// Comandos de controle (só dono da live / moderadores configurados)
export const COMANDOS = {
  '!iniciar': 'iniciar',
  '!começar': 'iniciar',
  '!comecar': 'iniciar',
  '!parar': 'encerrar',
  '!stop': 'encerrar',
  '!encerrar': 'encerrar',
  '!letra': 'sortearLetra',
  '!reiniciar': 'reiniciar',
  '!ranking': 'ranking',
  '!pausar': 'pausar',
  '!continuar': 'continuar',
  '!proxima': 'proxima',
  '!próxima': 'proxima',
};

export function lerComando(mensagem) {
  const t = String(mensagem || '').trim().toLowerCase().split(/\s+/)[0];
  return COMANDOS[t] || null;
}
