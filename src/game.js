// Motor da Adedonha: fases da rodada, respostas, pontuação, modos, presentes e comandos.
import { Emissor } from './emissor.js';
import { interpretarMensagem, lerComando } from './parser.js';
import { normalizar, estaNoDicionario, temDicionario } from './dicionario.js';

const sortear = (arr) => arr[Math.floor(Math.random() * arr.length)];
const embaralhar = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const DESAFIOS = [
  { id: 'longas', nome: 'PALAVRAS GRANDES', descricao: 'Respostas com 7 letras ou mais valem o DOBRO' },
  { id: 'sem_repetir', nome: 'NADA DE COPIAR', descricao: 'Respostas repetidas valem ZERO' },
  { id: 'triplo', nome: 'RODADA DE OURO', descricao: 'Todas as respostas valem TRIPLO' },
  { id: 'velocidade', nome: 'VELOCIDADE', descricao: 'Os 3 primeiros de cada categoria ganham +5' },
  { id: 'raras', nome: 'SÓ VOCÊ SABE', descricao: 'Resposta que ninguém mais deu vale o DOBRO' },
];

export const ACOES_PRESENTE = {
  mais_tempo: 'Adicionar segundos ao cronômetro',
  trocar_letra: 'Trocar a letra da rodada',
  trocar_categoria: 'Trocar a categoria da rodada',
  desafio: 'Ativar um desafio na rodada',
  pontos_dobro_jogador: 'Vantagem: pontos em dobro para quem enviou (na rodada)',
  multiplicador: 'Multiplicador de pontos para todos na rodada',
  proxima_relampago: 'Próxima rodada vira relâmpago',
  efeito_visual: 'Só efeito visual (festa na tela)',
};

export class Jogo extends Emissor {
  constructor(cfg, armazenamento) {
    super();
    this.cfg = cfg;
    this.arm = armazenamento || { ler: (_k, p) => p, gravar: () => {} };
    this.jogadores = new Map();
    this.fase = 'espera'; // espera | sorteio | jogando | pausado | resultado | ranking | fim
    this.rodada = 0;
    this.letra = '';
    this.letrasUsadas = [];
    this.categorias = [];
    this.respostas = []; // respostas da rodada atual
    this.rejeitadas = []; // mensagens recusadas na rodada (fora do tempo, repetidas etc.)
    this.feed = [];
    this.fimEm = 0;
    this.restanteMs = 0;
    this.tempoTotal = 0;
    this.proximaEm = 0;
    this.inicioRodada = 0;
    this.desafio = null;
    this.catOuro = null;
    this.multiplicador = 1;
    this.relampagoRodada = false;
    this.pendentes = { multiplicador: 1, desafio: false, relampago: false };
    this.resultado = null;
    this.vencedor = null;
    this.mostrarRankingAte = 0;
    this.ultimosPresentes = [];
    this.recargas = new Map();
    this.historico = [];
    this._sujo = true;
    this.carregarPartida();
    this.timer = setInterval(() => this.tick(), 200);
  }

  // ---------- utilidades ----------
  agora() { return Date.now(); }
  mudou() { this._sujo = true; }
  alerta(tipo, dados = {}) { this.emit('evento', { tipo, ...dados }); }
  modo() { return this.cfg.modo; }
  presentesLigados() { return this.cfg.presentes.ativo || this.cfg.modo === 'presente'; }

  jogador(user) {
    const id = String(user.id || user.nome).toLowerCase();
    let j = this.jogadores.get(id);
    if (!j) {
      j = { id, nome: user.nome || id, foto: user.foto || '', pontos: 0, pontosRodada: 0, vidas: this.cfg.sobrevivencia.vidas, eliminado: false, rodadas: 0, acertos: 0, dobro: false, banido: false, entrouNaRodada: this.rodada };
      this.jogadores.set(id, j);
    } else {
      if (user.nome) j.nome = user.nome;
      if (user.foto) j.foto = user.foto;
    }
    return j;
  }

  addFeed(item) {
    this.feed.unshift({ ...item, t: this.agora() });
    if (this.feed.length > 40) this.feed.length = 40;
  }

  rejeitar(user, texto, motivo) {
    this.rejeitadas.unshift({ nome: user.nome, texto: String(texto).slice(0, 120), motivo, t: this.agora() });
    if (this.rejeitadas.length > 200) this.rejeitadas.length = 200;
    this.mudou();
  }

  // ---------- fluxo da rodada ----------
  sortearLetraNova() {
    const letras = (this.cfg.letras || 'ABCDEFGHIJLMNOPRSTUV').toUpperCase().replace(/[^A-Z]/g, '').split('');
    const evitar = new Set(this.letrasUsadas.slice(-Math.min(6, Math.max(0, letras.length - 1))));
    const opcoes = letras.filter((l) => !evitar.has(l) && l !== this.letra);
    const l = sortear(opcoes.length ? opcoes : letras);
    this.letrasUsadas.push(l);
    if (this.letrasUsadas.length > 30) this.letrasUsadas.shift();
    return l;
  }

  iniciarRodada() {
    if (this.fase === 'jogando' || this.fase === 'pausado' || this.fase === 'sorteio') return;
    if (this.fase === 'fim') this.reiniciar(false);
    const ativas = this.cfg.categorias.filter((c) => c.ativa);
    if (!ativas.length) { this.alerta('aviso', { texto: 'Nenhuma categoria ativa!' }); return; }

    this.relampagoRodada = this.cfg.modo === 'relampago' || this.pendentes.relampago;
    this.pendentes.relampago = false;
    const qtd = 1; // uma categoria por rodada
    const semRepetir = ativas.length > 1 ? ativas.filter((c) => c.id !== this.ultimaCat) : ativas;
    this.categorias = embaralhar(semRepetir).slice(0, qtd)
      .map((c) => ({ id: c.id, nome: c.nome, apelidos: c.apelidos || [], eliminada: false }));
    this.ultimaCat = this.categorias[0].id;
    this.tempoTotal = (this.relampagoRodada ? this.cfg.relampago.tempo : this.cfg.tempoRodada) * 1000;

    this.rodada += 1;
    this.respostas = [];
    this.rejeitadas = [];
    this.resultado = null;
    this.vencedor = null;
    this.multiplicador = this.pendentes.multiplicador || 1;
    this.pendentes.multiplicador = 1;
    this.desafio = null;
    this.catOuro = null;
    if (this.cfg.modo === 'desafio' || this.pendentes.desafio) this.ativarDesafio(false);
    this.pendentes.desafio = false;
    for (const j of this.jogadores.values()) { j.pontosRodada = 0; j.dobro = false; }

    this.letra = this.sortearLetraNova();
    this.fase = 'sorteio';
    this.proximaEm = this.agora() + 3800;
    this.alerta('sorteio', { letra: this.letra });
    this.mudou();
  }

  comecarCronometro() {
    this.fase = 'jogando';
    this.inicioRodada = this.agora();
    this.fimEm = this.agora() + this.tempoTotal;
    this.proximaEm = 0;
    this.alerta('valendo', { letra: this.letra, relampago: this.relampagoRodada });
    this.mudou();
  }

  pausar() {
    if (this.fase === 'jogando') {
      this.restanteMs = Math.max(0, this.fimEm - this.agora());
      this.fase = 'pausado';
      this.alerta('pausa', {});
      this.mudou();
    } else if ((this.fase === 'resultado' || this.fase === 'ranking') && this.proximaEm) {
      this.restanteMs = Math.max(0, this.proximaEm - this.agora());
      this.proximaEm = 0;
      this.faseAntesPausa = this.fase;
      this.mudou();
    }
  }

  continuar() {
    if (this.fase === 'pausado') {
      this.fase = 'jogando';
      this.fimEm = this.agora() + this.restanteMs;
      this.alerta('continuar', {});
      this.mudou();
    } else if ((this.fase === 'resultado' || this.fase === 'ranking') && !this.proximaEm) {
      this.proximaEm = this.agora() + Math.max(2000, this.restanteMs || 3000);
      this.mudou();
    }
  }

  encerrarRodada() {
    if (this.fase === 'sorteio') this.comecarCronometro();
    if (this.fase !== 'jogando' && this.fase !== 'pausado') return;
    this.fase = 'resultado';
    this.fimEm = this.agora();
    this.calcularResultado(true);
    this.aplicarSobrevivencia();
    this.historico.unshift({ rodada: this.rodada, letra: this.letra, jogadores: this.resultado.participantes });
    this.alerta('stop', {});
    this.proximaEm = this.agora() + this.cfg.tempoResultado * 1000;
    this.salvarPartida();
    this.mudou();
  }

  proximaFase() {
    if (this.fase === 'resultado') {
      if (this.vencedor) { this.fase = 'fim'; this.proximaEm = 0; this.alerta('campeao', { jogador: this.vencedor }); }
      else { this.fase = 'ranking'; this.proximaEm = this.agora() + this.cfg.tempoRanking * 1000; }
    } else if (this.fase === 'ranking') {
      if (this.cfg.rodadaAutomatica) { this.fase = 'espera'; this.iniciarRodada(); }
      else { this.fase = 'espera'; this.proximaEm = 0; }
    }
    this.mudou();
  }

  tick() {
    const t = this.agora();
    if (this.fase === 'sorteio' && this.proximaEm && t >= this.proximaEm) this.comecarCronometro();
    else if (this.fase === 'jogando') {
      const rest = this.fimEm - t;
      const seg = Math.ceil(rest / 1000);
      if (seg !== this._ultimoSeg) { this._ultimoSeg = seg; this.mudou(); }
      if (rest <= 0) this.encerrarRodada();
    } else if ((this.fase === 'resultado' || this.fase === 'ranking') && this.proximaEm && t >= this.proximaEm) {
      this.proximaFase();
    }
    if (this.mostrarRankingAte && t > this.mostrarRankingAte) { this.mostrarRankingAte = 0; this.mudou(); }
    if (this._sujo) { this._sujo = false; this.emit('mudou'); }
  }

  pularParaProxima() {
    if (this.fase === 'resultado' || this.fase === 'ranking') {
      this.fase = 'espera';
      this.proximaEm = 0;
      this.iniciarRodada();
    } else if (this.fase === 'espera' || this.fase === 'fim') this.iniciarRodada();
  }

  reiniciar(avisar = true) {
    this.jogadores.clear();
    this.rodada = 0;
    this.fase = 'espera';
    this.respostas = [];
    this.rejeitadas = [];
    this.feed = [];
    this.resultado = null;
    this.vencedor = null;
    this.letra = '';
    this.categorias = [];
    this.desafio = null;
    this.multiplicador = 1;
    this.pendentes = { multiplicador: 1, desafio: false, relampago: false };
    this.historico = [];
    this.proximaEm = 0;
    this.salvarPartida();
    if (avisar) this.alerta('reiniciado', {});
    this.mudou();
  }

  mostrarRanking(segundos = 10) {
    this.mostrarRankingAte = this.agora() + segundos * 1000;
    this.mudou();
  }

  // ---------- mensagens do chat ----------
  receberChat(user, texto) {
    // comandos de controle
    const cmd = lerComando(texto);
    if (cmd) {
      if (this.podeComandar(user)) { this.executarComando(cmd); return { comando: cmd }; }
      return { ignorado: 'comando sem permissão' };
    }
    if (this.fase === 'sorteio') return null;

    const atual = this.catAtual();
    if (!atual) return null;
    const ativas = [atual];
    const achados = interpretarMensagem(texto, ativas, this.letra || 'A');
    if (!achados.length) return null; // conversa normal do chat

    if (this.fase !== 'jogando') {
      if (this.fase === 'pausado') { this.rejeitar(user, texto, 'cronômetro pausado'); return null; }
      if (this.letra) this.rejeitar(user, texto, 'fora do tempo');
      return null;
    }

    const idUser = String(user.id || user.nome).toLowerCase();
    const novo = !this.jogadores.has(idUser);
    if (this.cfg.modo === 'sobrevivencia' && this.cfg.sobrevivencia.entradaSoNaPrimeira && this.rodada > 1) {
      const existente = this.jogadores.get(idUser);
      if (novo || (existente.rodadas === 0 && existente.entrouNaRodada > 1)) {
        this.rejeitar(user, texto, 'entrou depois da 1ª rodada (sobrevivência)');
        return null;
      }
    }
    const j = this.jogador(user);
    if (j.banido) { this.rejeitar(user, texto, 'jogador bloqueado'); return null; }
    if (this.cfg.modo === 'sobrevivencia' && j.eliminado) { this.rejeitar(user, texto, 'eliminado (sobrevivência)'); return null; }

    const novas = [];
    for (const a of achados) {
      const cat = this.categorias.find((c) => c.id === a.catId);
      // cada pessoa vale com UMA resposta por rodada; tentativas não reconhecidas não travam
      if (this.respostas.some((r) => r.jogadorId === j.id && r.catId === a.catId && r.status === 'valida')) {
        this.rejeitar(user, `${cat.nome}: ${a.palavra}`, 'já tem resposta certa nesta rodada');
        continue;
      }
      const r = this.validar(j, cat, a.palavra);
      if (r.status === 'valida') this.respostas = this.respostas.filter((x) => !(x.jogadorId === j.id && x.catId === a.catId));
      else {
        const igual = this.respostas.find((x) => x.jogadorId === j.id && x.catId === a.catId && x.norm === r.norm);
        if (igual) continue;
      }
      this.respostas.push(r);
      novas.push(r);
    }
    const certas = novas.filter((r) => r.status === 'valida');
    if (novas.length) this.mudou();
    if (certas.length) {
      this.addFeed({ tipo: 'resposta', nome: j.nome, foto: j.foto, itens: certas.map((r) => ({ cat: this.nomeCat(r.catId), palavra: r.palavra, status: r.status })) });
      this.alerta('resposta', { nome: j.nome, foto: j.foto, itens: certas.map((r) => ({ catId: r.catId, cat: this.nomeCat(r.catId), palavra: r.palavra, status: r.status })) });
      this.mudou();
    }
    return { respostas: novas.length };
  }

  nomeCat(id) {
    return (this.categorias.find((c) => c.id === id) || this.cfg.categorias.find((c) => c.id === id) || { nome: id }).nome;
  }

  validar(j, cat, palavra) {
    const v = this.cfg.validacao;
    const norm = normalizar(palavra);
    const r = {
      id: `${this.rodada}-${j.id}-${cat.id}`,
      jogadorId: j.id, nome: j.nome, foto: j.foto, catId: cat.id, palavra, norm,
      letra: this.letra, ms: this.agora() - this.inicioRodada,
      status: 'valida', motivo: '', verificada: false, manual: false, pontos: 0,
    };
    const semEspaco = norm.replace(/\s/g, '');
    const proibidas = (v.palavrasProibidas || []).map(normalizar).filter(Boolean);
    if (!norm || !/^[a-z]/.test(norm)) { r.status = 'invalida'; r.motivo = 'não é palavra'; }
    else if (norm[0] !== normalizar(this.letra)) { r.status = 'invalida'; r.motivo = `não começa com ${this.letra}`; }
    else if (semEspaco.length < v.tamanhoMinimo) { r.status = 'invalida'; r.motivo = 'muito curta'; }
    else if (proibidas.some((p) => norm === p || norm.includes(p))) { r.status = 'invalida'; r.motivo = 'palavra proibida'; }
    else if (/(.)\1\1\1/.test(semEspaco)) { r.status = 'invalida'; r.motivo = 'parece spam'; }
    else if (estaNoDicionario(cat.id, palavra)) { r.verificada = true; }
    else if (v.modo === 'dicionario' && temDicionario(cat.id)) { r.status = 'pendente'; r.motivo = 'não reconhecida (aprove no painel)'; }
    else { r.motivo = temDicionario(cat.id) ? 'não está no dicionário' : ''; }
    return r;
  }

  // ação do painel: aprovar/recusar resposta
  definirStatus(respostaId, status) {
    const r = this.respostas.find((x) => x.id === respostaId);
    if (!r) return null;
    r.status = status;
    r.manual = true;
    r.motivo = status === 'invalida' ? 'recusada pelo apresentador' : 'aprovada pelo apresentador';
    if (this.fase === 'resultado' || this.fase === 'ranking' || this.fase === 'fim') this.calcularResultado(false);
    this.mudou();
    return r;
  }

  // ---------- pontuação ----------
  calcularResultado(primeiraVez) {
    const P = this.cfg.pontos;
    const catsValidas = this.categorias.filter((c) => !c.eliminada);
    const porCat = {};
    for (const c of catsValidas) porCat[c.id] = [];
    for (const r of this.respostas) {
      r.pontos = 0; r.repetida = false; r.unica = false; r.primeiro = false;
      if (!porCat[r.catId]) { if (r.status !== 'invalida') r.motivo = 'categoria eliminada'; continue; }
      porCat[r.catId].push(r);
    }

    const pontosJog = new Map();
    const somar = (id, v) => pontosJog.set(id, (pontosJog.get(id) || 0) + v);
    const participantes = new Set(this.respostas.map((r) => r.jogadorId));

    for (const c of catsValidas) {
      const lista = porCat[c.id];
      const validas = lista.filter((r) => r.status === 'valida').sort((a, b) => a.ms - b.ms);
      const contagem = {};
      for (const r of validas) contagem[r.norm] = (contagem[r.norm] || 0) + 1;
      validas.forEach((r, i) => {
        r.repetida = contagem[r.norm] > 1;
        r.unica = !r.repetida;
        let pts = r.repetida ? P.repetida : P.valida + P.bonusUnica;
        if (this.desafio?.id === 'sem_repetir' && r.repetida) pts = 0;
        if (i === 0 && P.primeiro) { r.primeiro = true; pts += P.primeiro; }
        if (this.desafio?.id === 'longas' && r.norm.replace(/\s/g, '').length >= 7) pts *= 2;
        if (this.desafio?.id === 'triplo') pts *= 3;
        if (this.desafio?.id === 'raras' && r.unica) pts *= 2;
        if (this.desafio?.id === 'velocidade' && i < 3) pts += 5;
        r.pontos = pts;
        somar(r.jogadorId, pts);
      });
      for (const r of lista) if (r.status === 'invalida') { r.pontos = P.invalida; somar(r.jogadorId, P.invalida); }
    }

    // bônus por completar
    const completos = [];
    for (const id of participantes) {
      const ok = catsValidas.every((c) => this.respostas.some((r) => r.jogadorId === id && r.catId === c.id && r.status === 'valida'));
      if (ok && catsValidas.length > 1) {
        completos.push(id);
        somar(id, P.completou);
      }
    }

    // multiplicadores
    const rodadaPts = {};
    for (const id of participantes) {
      const j = this.jogadores.get(id);
      let pts = pontosJog.get(id) || 0;
      if (pts > 0) {
        pts = Math.round(pts * (this.multiplicador || 1));
        if (j?.dobro) pts *= 2;
      }
      rodadaPts[id] = pts;
    }

    // aplica no placar geral (recalcula diferença se o apresentador mudou algo depois)
    const anterior = this.resultado?.rodadaPts || {};
    for (const id of new Set([...Object.keys(anterior), ...Object.keys(rodadaPts)])) {
      const j = this.jogadores.get(id);
      if (!j) continue;
      const delta = (rodadaPts[id] || 0) - (anterior[id] || 0);
      j.pontos += delta;
      j.pontosRodada = rodadaPts[id] || 0;
      if (primeiraVez) j.rodadas += 1;
    }
    if (primeiraVez) {
      for (const r of this.respostas) if (r.status === 'valida') { const j = this.jogadores.get(r.jogadorId); if (j) j.acertos += 1; }
    }

    const topRodada = Object.entries(rodadaPts)
      .map(([id, pts]) => ({ id, pts, nome: this.jogadores.get(id)?.nome, foto: this.jogadores.get(id)?.foto }))
      .sort((a, b) => b.pts - a.pts)
      .slice(0, 5);

    this.resultado = {
      rodadaPts,
      completos,
      topRodada,
      participantes: participantes.size,
      categorias: catsValidas.map((c) => ({
        id: c.id, nome: c.nome, ouro: this.catOuro === c.id,
        respostas: porCat[c.id].map((r) => ({ id: r.id, nome: r.nome, foto: r.foto, palavra: r.palavra, status: r.status, unica: r.unica, repetida: r.repetida, primeiro: r.primeiro, pontos: r.pontos })),
      })),
    };
  }

  aplicarSobrevivencia() {
    if (this.cfg.modo !== 'sobrevivencia') return;
    const S = this.cfg.sobrevivencia;
    const vivos = [...this.jogadores.values()].filter((j) => !j.eliminado && !j.banido && (j.rodadas > 0 || this.respostas.some((r) => r.jogadorId === j.id)));
    const eliminadosAgora = [];
    for (const j of vivos) {
      const acertos = this.respostas.filter((r) => r.jogadorId === j.id && r.status === 'valida' && this.categorias.find((c) => c.id === r.catId && !c.eliminada)).length;
      if (acertos < S.minimoAcertos) {
        j.vidas -= 1;
        if (j.vidas <= 0) { j.eliminado = true; eliminadosAgora.push(j); }
      }
    }
    if (eliminadosAgora.length) this.alerta('eliminados', { nomes: eliminadosAgora.map((j) => j.nome) });
    const restantes = vivos.filter((j) => !j.eliminado);
    if (this.rodada >= 2 && restantes.length === 1 && vivos.length > 1) this.vencedor = this.publico(restantes[0]);
    else if (restantes.length === 0 && vivos.length > 0) {
      const melhor = [...vivos].sort((a, b) => (b.pontosRodada - a.pontosRodada) || (b.pontos - a.pontos))[0];
      melhor.eliminado = false; melhor.vidas = 1;
      this.vencedor = this.publico(melhor);
    }
  }

  // ---------- desafios e presentes ----------
  ativarDesafio(avisar = true) {
    if (this.desafio) return false;
    this.desafio = sortear(DESAFIOS);
    if (avisar) this.alerta('desafio', { desafio: this.desafio, catOuro: this.catOuro ? this.nomeCat(this.catOuro) : null });
    this.mudou();
    return true;
  }

  trocarLetra() {
    if (this.fase !== 'jogando' && this.fase !== 'pausado' && this.fase !== 'sorteio') return false;
    this.letra = this.sortearLetraNova();
    this.alerta('nova_letra', { letra: this.letra });
    this.mudou();
    return true;
  }

  // troca a categoria da rodada; quem já respondeu a anterior continua valendo
  trocarCategoria() {
    if (this.fase !== 'jogando' && this.fase !== 'pausado') return false;
    const atual = this.catAtual();
    const ativas = this.cfg.categorias.filter((c) => c.ativa && !this.categorias.some((x) => x.id === c.id));
    if (!ativas.length) return false;
    const nova = sortear(ativas);
    if (atual) atual.trocada = true;
    this.categorias.push({ id: nova.id, nome: nova.nome, apelidos: nova.apelidos || [], eliminada: false });
    this.ultimaCat = nova.id;
    this.alerta('nova_categoria', { cat: nova.nome });
    this.mudou();
    return true;
  }

  catAtual() {
    const ativas = this.categorias.filter((c) => !c.eliminada && !c.trocada);
    return ativas[ativas.length - 1] || null;
  }

  adicionarTempo(seg) {
    if (this.fase === 'jogando') this.fimEm += seg * 1000;
    else if (this.fase === 'pausado') this.restanteMs += seg * 1000;
    else return false;
    this.tempoTotal += seg * 1000;
    this.alerta('mais_tempo', { segundos: seg });
    this.mudou();
    return true;
  }

  receberPresente(user, presente) {
    // presente: { nome, quantidade, diamantes (por unidade), imagem }
    const registro = { nome: user.nome, foto: user.foto, presente: presente.nome, quantidade: presente.quantidade, diamantes: presente.diamantes, imagem: presente.imagem, t: this.agora(), acoes: [] };
    this.ultimosPresentes.unshift(registro);
    if (this.ultimosPresentes.length > 60) this.ultimosPresentes.length = 60;

    const j = this.jogador(user);
    j.presentes = (j.presentes || 0) + (presente.diamantes || 0) * (presente.quantidade || 1);

    if (!this.presentesLigados()) { this.mudou(); return registro; }

    const nomeP = normalizar(presente.nome);
    const regras = (this.cfg.presentes.regras || []).filter((rg) => rg.ativa !== false && (
      normalizar(rg.presente) === nomeP || (rg.presente === '*' && (presente.diamantes || 0) >= (rg.minDiamantes || 0))
    ));
    // a regra com nome específico tem prioridade sobre '*'
    const especificas = regras.filter((r) => r.presente !== '*');
    const usar = especificas.length ? especificas : regras.slice(0, 1);

    for (const rg of usar) {
      const chave = `${rg.presente}|${rg.acao}`;
      const ultima = this.recargas.get(chave) || 0;
      if (rg.recarga && this.agora() - ultima < rg.recarga * 1000) { registro.acoes.push(`${rg.acao} (em recarga)`); continue; }
      const qtd = Math.max(1, presente.quantidade || 1);
      let ok = false;
      switch (rg.acao) {
        case 'mais_tempo': ok = this.adicionarTempo((Number(rg.valor) || 5) * Math.min(qtd, 20)); break;
        case 'trocar_letra': ok = this.trocarLetra(); break;
        case 'trocar_categoria':
        case 'eliminar_categoria': ok = this.trocarCategoria(); break;
        case 'desafio':
          if (this.fase === 'jogando' || this.fase === 'pausado') ok = this.ativarDesafio(true);
          else { this.pendentes.desafio = true; ok = true; this.alerta('agendado', { texto: 'DESAFIO NA PRÓXIMA RODADA!' }); }
          break;
        case 'pontos_dobro_jogador':
          if (this.fase === 'jogando' || this.fase === 'pausado' || this.fase === 'sorteio') { j.dobro = true; ok = true; this.alerta('vantagem', { nome: j.nome, foto: j.foto }); }
          break;
        case 'multiplicador': {
          const m = Math.max(2, Number(rg.valor) || 2);
          if (this.fase === 'jogando' || this.fase === 'pausado' || this.fase === 'sorteio') { this.multiplicador = Math.max(this.multiplicador, m); }
          else this.pendentes.multiplicador = Math.max(this.pendentes.multiplicador, m);
          ok = true;
          this.alerta('multiplicador', { valor: m });
          break;
        }
        case 'proxima_relampago': this.pendentes.relampago = true; ok = true; this.alerta('agendado', { texto: 'PRÓXIMA RODADA: RELÂMPAGO!' }); break;
        case 'efeito_visual': ok = true; break;
        default: break;
      }
      if (ok) { this.recargas.set(chave, this.agora()); registro.acoes.push(rg.acao); }
      else registro.acoes.push(`${rg.acao} (sem efeito agora)`);
    }
    this.alerta('presente', { nome: user.nome, foto: user.foto, presente: presente.nome, imagem: presente.imagem, quantidade: presente.quantidade, acoes: registro.acoes });
    this.mudou();
    return registro;
  }

  // ---------- comandos ----------
  podeComandar(user) {
    if (user.simulador || user.admin) return true;
    if (!this.cfg.comandosChat.ativo) return false;
    const id = String(user.id || '').toLowerCase().replace(/^@/, '');
    const dono = String(this.cfg.tiktok.usuario || '').toLowerCase().replace(/^@/, '');
    const mods = (this.cfg.comandosChat.moderadores || []).map((m) => String(m).toLowerCase().replace(/^@/, '').trim());
    return (dono && id === dono) || mods.includes(id) || !!user.moderador;
  }

  executarComando(cmd) {
    switch (cmd) {
      case 'iniciar': this.pularParaProxima(); break;
      case 'encerrar': this.encerrarRodada(); break;
      case 'sortearLetra':
        if (!this.trocarLetra()) this.iniciarRodada();
        break;
      case 'reiniciar': this.reiniciar(); break;
      case 'ranking': this.mostrarRanking(10); break;
      case 'pausar': this.pausar(); break;
      case 'continuar': this.continuar(); break;
      case 'proxima': this.pularParaProxima(); break;
      default: break;
    }
  }

  // ---------- jogadores (painel) ----------
  acaoJogador(id, acao, valor) {
    const j = this.jogadores.get(id);
    if (!j) return;
    if (acao === 'eliminar') j.eliminado = true;
    if (acao === 'reviver') { j.eliminado = false; j.vidas = Math.max(1, this.cfg.sobrevivencia.vidas); }
    if (acao === 'banir') j.banido = true;
    if (acao === 'desbanir') j.banido = false;
    if (acao === 'pontos') j.pontos += Number(valor) || 0;
    if (acao === 'remover') this.jogadores.delete(id);
    this.mudou();
  }

  // ---------- estado para as telas ----------
  publico(j) {
    return { id: j.id, nome: j.nome, foto: j.foto, pontos: j.pontos, pontosRodada: j.pontosRodada, vidas: j.vidas, eliminado: j.eliminado };
  }

  ranking(n = 10) {
    return [...this.jogadores.values()]
      .filter((j) => !j.banido && (j.rodadas > 0 || j.pontos !== 0))
      .sort((a, b) => b.pontos - a.pontos || b.acertos - a.acertos)
      .slice(0, n)
      .map((j) => this.publico(j));
  }

  // respostas certas da rodada (as mais recentes primeiro) com marcação de única/repetida
  paredeRespostas() {
    const validas = this.respostas.filter((r) => r.status === 'valida');
    const cont = {};
    for (const r of validas) cont[r.norm] = (cont[r.norm] || 0) + 1;
    return validas.slice(-18).reverse().map((r) => ({ nome: r.nome, foto: r.foto, palavra: r.palavra, unica: cont[r.norm] === 1 }));
  }

  tempoRestante() {
    if (this.fase === 'jogando') return Math.max(0, this.fimEm - this.agora());
    if (this.fase === 'pausado') return this.restanteMs;
    if (this.fase === 'sorteio') return this.tempoTotal;
    return 0;
  }

  estadoTela() {
    const contagem = {};
    const ultimas = {};
    for (const r of this.respostas) {
      contagem[r.catId] = (contagem[r.catId] || 0) + 1;
      if (r.status !== 'invalida') (ultimas[r.catId] = ultimas[r.catId] || []).unshift({ nome: r.nome, palavra: r.palavra, foto: r.foto });
    }
    const vivos = [...this.jogadores.values()].filter((j) => !j.eliminado && !j.banido && j.rodadas + (this.respostas.some((r) => r.jogadorId === j.id) ? 1 : 0) > 0).length;
    return {
      fase: this.fase,
      rodada: this.rodada,
      letra: this.letra,
      modo: this.cfg.modo,
      relampago: this.relampagoRodada,
      categoria: this.catAtual() ? { id: this.catAtual().id, nome: this.catAtual().nome } : null,
      parede: this.paredeRespostas(),
      categorias: this.categorias.map((c, i) => ({ id: c.id, nome: c.nome, num: i + 1, eliminada: c.eliminada, ouro: this.catOuro === c.id, total: contagem[c.id] || 0, ultimas: (ultimas[c.id] || []).slice(0, 3) })),
      restanteMs: this.tempoRestante(),
      tempoTotal: this.tempoTotal,
      proximaMs: this.proximaEm ? Math.max(0, this.proximaEm - this.agora()) : 0,
      desafio: this.desafio,
      multiplicador: this.multiplicador,
      feed: this.feed.slice(0, 8),
      ranking: this.ranking(10),
      resultado: this.resultado ? { ...this.resultado, rodadaPts: undefined } : null,
      vencedor: this.vencedor,
      mostrarRanking: !!this.mostrarRankingAte,
      jogadoresRodada: new Set(this.respostas.map((r) => r.jogadorId)).size,
      vivos,
      efeitos: this.cfg.efeitos,
      pendentes: this.pendentes,
    };
  }

  estadoAdmin() {
    return {
      ...this.estadoTela(),
      respostas: [...this.respostas].reverse(),
      rejeitadas: this.rejeitadas.slice(0, 100),
      jogadores: [...this.jogadores.values()].sort((a, b) => b.pontos - a.pontos),
      ultimosPresentes: this.ultimosPresentes.slice(0, 30),
    };
  }

  // ---------- salvar/carregar placar ----------
  salvarPartida() {
    this.arm.gravar('partida', { rodada: this.rodada, jogadores: [...this.jogadores.values()], letrasUsadas: this.letrasUsadas });
  }

  carregarPartida() {
    const d = this.arm.ler('partida', null);
    if (!d) return;
    this.rodada = d.rodada || 0;
    this.letrasUsadas = d.letrasUsadas || [];
    for (const j of d.jogadores || []) this.jogadores.set(j.id, j);
    if (this.jogadores.size) console.log(`[partida] placar anterior carregado (${this.jogadores.size} jogadores, rodada ${this.rodada}).`);
  }
}
