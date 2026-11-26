// "Central" do jogo: liga o motor, as conexões da live, o simulador e as telas (jogo e painel).
// É a mesma no PC (servidor.js, telas conversam por socket.io) e no aplicativo (tudo dentro do celular).
import { Jogo, ACOES_PRESENTE, DESAFIOS } from './game.js';
import { usarArmazenamento, adicionarAoDicionario } from './dicionario.js';
import { PADRAO, mesclar } from './padrao.js';
import { criarSimulador } from './simulador.js';

export function criarCentral({ cfg, salvarCfg, conexoes, armazenamento, extras = () => ({}) }) {
  usarArmazenamento(armazenamento);
  const jogo = new Jogo(cfg, armazenamento);
  const clientes = new Set();
  const para = (papel, ev, d) => { for (const c of clientes) if (!papel || c.papel === papel) c.enviar(ev, d); };

  conexoes.on('chat', ({ user, texto }) => {
    jogo.receberChat(user, texto);
    para('painel', 'chat_bruto', { nome: user.nome, texto, t: Date.now() });
  });
  conexoes.on('presente', ({ user, presente }) => jogo.receberPresente(user, presente));
  conexoes.on('status', (s) => para('painel', 'conexoes', s));

  // envia o estado no máximo ~8 vezes por segundo
  let ultimoEnvio = 0;
  let agendado = null;
  function enviarEstado() {
    const agora = Date.now();
    const esperar = 120 - (agora - ultimoEnvio);
    if (esperar > 0) { if (!agendado) agendado = setTimeout(() => { agendado = null; enviarEstado(); }, esperar); return; }
    ultimoEnvio = agora;
    if ([...clientes].some((c) => c.papel === 'tela')) para('tela', 'estado', jogo.estadoTela());
    if ([...clientes].some((c) => c.papel === 'painel')) para('painel', 'estado', jogo.estadoAdmin());
  }
  jogo.on('mudou', enviarEstado);
  jogo.on('evento', (ev) => para(null, 'evento', ev));

  const infoConfig = () => ({ cfg, acoes: ACOES_PRESENTE, desafios: DESAFIOS, ...extras() });

  function atualizarConfig(parcial) {
    const novo = mesclar(cfg, parcial);
    for (const k of Object.keys(novo)) cfg[k] = novo[k]; // mantém o mesmo objeto
    salvarCfg(cfg);
    para('painel', 'config', infoConfig());
    para('tela', 'efeitos', cfg.efeitos);
    jogo.mudou();
  }

  const simulador = criarSimulador(jogo, (user, texto) => conexoes.chat(user, texto, 'simulador'));

  async function acao(a) {
    switch (a.tipo) {
      case 'iniciar': jogo.pularParaProxima(); break;
      case 'encerrar': jogo.encerrarRodada(); break;
      case 'pausar': jogo.pausar(); break;
      case 'continuar': jogo.continuar(); break;
      case 'letra': if (!jogo.trocarLetra()) jogo.iniciarRodada(); break;
      case 'reiniciar': jogo.reiniciar(); break;
      case 'ranking': jogo.mostrarRanking(Number(a.segundos) || 10); break;
      case 'mais_tempo': jogo.adicionarTempo(Number(a.segundos) || 10); break;
      case 'eliminar_categoria': jogo.eliminarCategoria(a.catId); break;
      case 'desafio': if (!jogo.ativarDesafio(true)) jogo.pendentes.desafio = true; break;
      case 'multiplicador': jogo.multiplicador = Math.max(1, Number(a.valor) || 2); jogo.alerta('multiplicador', { valor: jogo.multiplicador }); jogo.mudou(); break;
      case 'proxima_relampago': jogo.pendentes.relampago = true; jogo.alerta('agendado', { texto: 'PRÓXIMA RODADA: RELÂMPAGO!' }); jogo.mudou(); break;
      case 'status_resposta': {
        const r = jogo.definirStatus(a.id, a.status);
        if (r && a.salvarDicionario && a.status === 'valida') adicionarAoDicionario(r.catId, r.palavra);
        break;
      }
      case 'jogador': jogo.acaoJogador(a.id, a.acao, a.valor); break;
      case 'config': atualizarConfig(a.cfg); break;
      case 'config_padrao': {
        const novo = structuredClone(PADRAO);
        novo.tiktok = cfg.tiktok; novo.tikfinity = cfg.tikfinity; novo.porta = cfg.porta; novo.app = cfg.app;
        atualizarConfig(novo);
        break;
      }
      case 'conectar_tiktok': conexoes.conectarTikTok(); break;
      case 'desconectar_tiktok': await conexoes.desconectarTikTok(); break;
      case 'conectar_tikfinity': conexoes.conectarTikFinity(); break;
      case 'desconectar_tikfinity': conexoes.desconectarTikFinity(); break;
      case 'sim_chat': conexoes.chat({ id: String(a.usuario || 'teste').toLowerCase(), nome: a.usuario || 'Teste', foto: '', simulador: true }, a.texto, 'simulador'); break;
      case 'sim_presente': conexoes.presente({ id: String(a.usuario || 'teste').toLowerCase(), nome: a.usuario || 'Teste', foto: '' }, { nome: a.presente || 'Rose', quantidade: Number(a.quantidade) || 1, diamantes: Number(a.diamantes) || 1, imagem: '' }, 'simulador'); break;
      case 'bots': simulador.configurar(Number(a.quantidade) || 0); break;
      default: return false;
    }
    return true;
  }

  return {
    jogo,
    simulador,
    acao,
    // conecta uma tela ou painel. cliente = { papel: 'tela'|'painel', enviar(evento, dados) }
    conectar(cliente) {
      clientes.add(cliente);
      if (cliente.papel === 'tela') {
        cliente.enviar('estado', jogo.estadoTela());
      } else {
        cliente.enviar('estado', jogo.estadoAdmin());
        cliente.enviar('conexoes', conexoes.status());
        cliente.enviar('config', infoConfig());
      }
      return {
        async receber(a, responder) {
          let ok = false;
          try { ok = cliente.papel === 'painel' ? await acao(a) : false; } catch (e) { console.error('[painel] erro na ação', a?.tipo, e); }
          if (typeof responder === 'function') responder({ ok });
        },
        sair() { clientes.delete(cliente); },
      };
    },
  };
}
