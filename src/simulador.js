// Espectadores de teste (robôs) para ver o jogo funcionando sem live
import { palavrasDe, normalizar } from './dicionario.js';

const NOMES_BOT = ['Ana_Bia', 'joaozinho22', 'Mari.Souza', 'Pedrão', 'Lu_Gamer', 'Carlinha', 'Thiago_RJ', 'Duda', 'Rafa_SP', 'Gabi.oficial', 'Bruninho', 'Lari', 'Vini_BH', 'Juju', 'Felipe007', 'Paty', 'Leo_Nordeste', 'Nanda', 'Caio', 'Bela'];

export function criarSimulador(jogo, mandarChat) {
  const sim = {
    quantidade: 0,
    timer: null,
    configurar(n) {
      this.quantidade = Math.max(0, Math.min(20, Number(n) || 0));
      clearInterval(this.timer);
      if (this.quantidade > 0) this.timer = setInterval(() => this.passo(), 700);
    },
    passo() {
      if (jogo.fase !== 'jogando') return;
      if (Math.random() > 0.35 + this.quantidade * 0.03) return;
      const nome = NOMES_BOT[Math.floor(Math.random() * this.quantidade)];
      const cats = jogo.catAtual() ? [jogo.catAtual()] : [];
      if (!cats.length) return;
      const L = normalizar(jogo.letra);
      const escolher = (c) => {
        const opcoes = palavrasDe(c.id).filter((p) => normalizar(p).startsWith(L));
        if (Math.random() < 0.1) return 'Xablau'; // às vezes uma errada
        return opcoes.length ? opcoes[Math.floor(Math.random() * Math.min(opcoes.length, 4))] : null;
      };
      const formato = Math.random();
      let texto = '';
      if (formato < 0.5) {
        const partes = [];
        cats.forEach((c, i) => { if (Math.random() < 0.6) { const p = escolher(c); if (p) partes.push(`${i + 1} ${p}`); } });
        texto = partes.join(' ');
      } else if (formato < 0.8) {
        texto = cats.map((c) => escolher(c) || '').join(', ');
      } else {
        const c = cats[Math.floor(Math.random() * cats.length)];
        const p = escolher(c);
        texto = p ? `${c.nome.split(' ')[0]}: ${p}` : 'kkkkk que difícil';
      }
      if (Math.random() < 0.08) texto = 'boa noite live!!';
      if (texto) mandarChat({ id: nome.toLowerCase(), nome, foto: '' }, texto);
    },
  };
  return sim;
}
