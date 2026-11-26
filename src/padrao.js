// Configurações padrão do jogo (usadas no PC e no aplicativo)
export const PADRAO = {
  porta: 3000,

  // ---- Aplicativo do celular ----
  app: {
    // endereço do servidor na internet (Render) que lê a live para o aplicativo
    servidor: 'https://adedonha-ao-vivo.onrender.com',
  },

  // ---- Conexão com a live ----
  tiktok: {
    usuario: '',            // seu @ do TikTok (sem @)
    conectarAoIniciar: false,
    chaveEuler: '',         // opcional: chave grátis do eulerstream.com se a conexão falhar por limite
  },
  tikfinity: {
    ativo: false,
    endereco: 'ws://localhost:21213/',
  },
  comandosChat: {
    ativo: true,
    // quem pode usar !iniciar, !parar etc. (além do dono da live)
    moderadores: [],
  },

  // ---- Rodada ----
  tempoRodada: 60,           // segundos
  tempoResultado: 15,        // segundos mostrando o resultado
  tempoRanking: 8,           // segundos mostrando o ranking entre rodadas
  rodadaAutomatica: true,    // começa a próxima rodada sozinha
  versaoConfig: 2,
  letras: 'ABCDEFGHIJLMNOPRSTUV',
  modo: 'competitivo',       // competitivo | sobrevivencia | relampago | presente | desafio

  categorias: [
    { id: 'nome', nome: 'Nome', apelidos: ['nome', 'nomes', 'pessoa'], ativa: true },
    { id: 'animal', nome: 'Animal', apelidos: ['animal', 'animais', 'bicho'], ativa: true },
    { id: 'cidade', nome: 'Cidade', apelidos: ['cidade', 'cid', 'cep'], ativa: true },
    { id: 'pais', nome: 'País', apelidos: ['pais', 'país', 'paises'], ativa: true },
    { id: 'comida', nome: 'Comida', apelidos: ['comida', 'comidas', 'prato'], ativa: true },
    { id: 'fruta', nome: 'Fruta', apelidos: ['fruta', 'frutas', 'fruto'], ativa: true },
    { id: 'objeto', nome: 'Objeto', apelidos: ['objeto', 'objetos', 'obj', 'coisa'], ativa: true },
    { id: 'profissao', nome: 'Profissão', apelidos: ['profissao', 'profissão', 'prof', 'trabalho'], ativa: true },
    { id: 'filme', nome: 'Filme ou série', apelidos: ['filme', 'serie', 'série', 'filmes', 'fs'], ativa: true },
    { id: 'celebridade', nome: 'Celebridade', apelidos: ['celebridade', 'famoso', 'famosa', 'celeb'], ativa: true },
  ],

  // ---- Validação ----
  validacao: {
    tamanhoMinimo: 2,
    // 'auto' = aceita palavras que começam com a letra (você pode recusar no painel)
    // 'dicionario' = só aceita sozinho o que estiver no dicionário; o resto fica "pendente" até você aprovar
    modo: 'dicionario',
    palavrasProibidas: [],
  },

  // ---- Pontuação ----
  pontos: {
    valida: 10,
    bonusUnica: 5,        // ninguém mais deu a mesma resposta
    repetida: 5,          // mesma resposta de outra pessoa (coloque 0 para zerar)
    invalida: 0,
    completou: 10,        // respondeu todas as categorias da rodada
    primeiro: 3,          // primeiro a responder certo cada categoria
  },

  // ---- Sobrevivência ----
  sobrevivencia: {
    vidas: 2,
    minimoAcertos: 1,     // menos acertos que isso na rodada = perde 1 vida
    entradaSoNaPrimeira: true,
  },

  // ---- Relâmpago ----
  relampago: { tempo: 30 },

  // ---- Presentes ----
  presentes: {
    ativo: true,
    // Cada regra: presente (nome em inglês como o TikTok manda, ou * = qualquer),
    // minDiamantes (para '*'), acao, valor, recarga (segundos entre ativações)
    regras: [
      { presente: 'Rose', acao: 'mais_tempo', valor: 5, recarga: 0, ativa: true },
      { presente: 'Finger Heart', acao: 'mais_tempo', valor: 10, recarga: 0, ativa: true },
      { presente: 'Doughnut', acao: 'trocar_letra', valor: 0, recarga: 20, ativa: true },
      { presente: 'Hand Hearts', acao: 'trocar_categoria', valor: 0, recarga: 20, ativa: true },
      { presente: 'Confetti', acao: 'desafio', valor: 0, recarga: 30, ativa: true },
      { presente: 'Perfume', acao: 'pontos_dobro_jogador', valor: 0, recarga: 0, ativa: true },
      { presente: 'Galaxy', acao: 'multiplicador', valor: 2, recarga: 60, ativa: true },
      { presente: '*', minDiamantes: 500, acao: 'proxima_relampago', valor: 0, recarga: 60, ativa: false },
    ],
  },

  // ---- Tela ----
  efeitos: {
    sons: true,
    volume: 0.6,
    animacoes: true,
    confete: true,
    fotoPerfil: true,
  },
};

export function mesclar(base, extra) {
  if (Array.isArray(base)) return Array.isArray(extra) ? extra : base;
  if (base && typeof base === 'object') {
    const out = { ...base };
    if (extra && typeof extra === 'object') {
      for (const k of Object.keys(extra)) out[k] = k in base ? mesclar(base[k], extra[k]) : extra[k];
    }
    return out;
  }
  return extra === undefined ? base : extra;
}


// atualiza configurações salvas de versões antigas (uma categoria por rodada)
export function migrar(cfg) {
  if ((cfg.versaoConfig || 1) < 2) {
    cfg.versaoConfig = 2;
    cfg.validacao.modo = 'dicionario';
    if (cfg.tempoRodada > 60) cfg.tempoRodada = 60;
    for (const r of cfg.presentes?.regras || []) if (r.acao === 'eliminar_categoria') r.acao = 'trocar_categoria';
  }
  return cfg;
}
