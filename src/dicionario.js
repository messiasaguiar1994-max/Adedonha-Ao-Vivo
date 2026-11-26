// Dicionário de apoio. Serve para marcar respostas como "confirmadas".
// Uma palavra que NÃO está aqui não é automaticamente errada: ela fica como
// "não verificada" (modo auto) ou "pendente" (modo dicionário) e você decide no painel.
// Palavras aprovadas com o botão 📖 do painel ficam guardadas no "dicionário extra".

import { NOMES_IBGE } from './nomes-ibge.js';

const L = (s) => s.split('|').map((x) => x.trim()).filter(Boolean);

const BASE = {
  nome: L(`Ana|Adriana|Alice|Amanda|Aline|Alessandra|Andreia|Antonia|Antônio|Arthur|Augusto|Alexandre|André|Anderson|Alan|Alberto|Abel|Abigail|Agatha|Ágata|Bruna|Beatriz|Bianca|Barbara|Bárbara|Benedito|Bernardo|Bruno|Benjamin|Breno|Brenda|Bento|Carla|Camila|Carolina|Cláudia|Claudia|Cristina|Cecília|Clara|Carlos|Caio|César|Cesar|Cláudio|Cristiano|Cauã|Daniela|Débora|Diana|Denise|Davi|Daniel|Diego|Douglas|Danilo|Diogo|Edson|Eduardo|Elias|Emanuel|Enzo|Erick|Elaine|Eliane|Elisa|Emily|Eva|Ester|Fernanda|Flávia|Fabiana|Francisca|Fátima|Fernando|Felipe|Fábio|Francisco|Fabrício|Gabriela|Giovana|Gisele|Glória|Gabriel|Guilherme|Gustavo|Gilberto|Geraldo|Heitor|Helena|Heloísa|Henrique|Hugo|Hélio|Igor|Isabela|Isabel|Iara|Ingrid|Isaac|Ivan|Ítalo|Joana|Júlia|Julia|Juliana|Jéssica|Josefa|João|José|Jorge|Júlio|Juliano|Jonas|Joaquim|Kátia|Karina|Kelly|Kauã|Kevin|Kaique|Larissa|Laura|Letícia|Luana|Lúcia|Luiza|Lívia|Lorena|Lucas|Luiz|Luís|Leonardo|Lauro|Leandro|Lorenzo|Maria|Mariana|Marcela|Márcia|Mônica|Manuela|Melissa|Marcos|Mateus|Matheus|Miguel|Marcelo|Mário|Murilo|Natália|Natalia|Nicole|Nathalia|Nádia|Nelson|Nicolas|Natan|Noah|Otávio|Oscar|Olga|Olívia|Patrícia|Paula|Priscila|Pietra|Paulo|Pedro|Pablo|Patrick|Quitéria|Quintino|Raquel|Renata|Rita|Rosa|Rafaela|Rebeca|Rafael|Ricardo|Rodrigo|Roberto|Renato|Rogério|Samuel|Sérgio|Silvio|Sandra|Sabrina|Simone|Sofia|Sophia|Sara|Tatiana|Tânia|Teresa|Thaís|Tiago|Thiago|Tomás|Túlio|Ubiratan|Úrsula|Ulisses|Valéria|Vanessa|Vitória|Vera|Vinícius|Vitor|Victor|Valter|Wagner|Wesley|Wilson|William|Xavier|Xuxa|Yasmin|Yuri|Zeca|Zélia|Zuleica`),
  animal: L(`abelha|águia|aguia|alce|anta|antílope|aranha|arara|ariranha|avestruz|baleia|barata|beija-flor|besouro|bezerro|bode|boi|borboleta|búfalo|burro|cabra|cachorro|cágado|calango|camaleão|camelo|camundongo|canguru|capivara|caracol|caranguejo|carneiro|castor|cavalo|cavalo-marinho|cegonha|centopeia|chimpanzé|chinchila|cigarra|cisne|coala|cobra|codorna|coelho|coruja|corvo|crocodilo|cupim|cutia|dálmata|dinossauro|doninha|dromedário|elefante|ema|enguia|escorpião|esquilo|estrela-do-mar|faisão|falcão|foca|formiga|furão|gafanhoto|gaivota|galinha|galo|gambá|ganso|garça|gato|gavião|gazela|girafa|golfinho|gorila|grilo|guaxinim|guepardo|gnu|hiena|hipopótamo|iguana|impala|jabuti|jacaré|jaguatirica|javali|jiboia|joaninha|jumento|kiwi|lagarta|lagartixa|lagarto|lagosta|lebre|leão|leopardo|lesma|libélula|lhama|lince|lobo|lontra|louva-a-deus|lula|macaco|marimbondo|mariposa|marmota|morcego|mosca|mosquito|mula|minhoca|mico|onça|orangotango|orca|ornitorrinco|ostra|ovelha|paca|panda|pantera|papagaio|pardal|pato|pavão|peixe|pelicano|perereca|periquito|peru|pica-pau|pinguim|piolho|piranha|polvo|pombo|porco|porco-espinho|preá|preguiça|pulga|puma|quati|quero-quero|rã|raposa|rato|rena|rinoceronte|robalo|rouxinol|sabiá|salamandra|salmão|sapo|sardinha|siri|suricato|sucuri|tamanduá|tartaruga|tatu|texugo|tigre|tilápia|toupeira|touro|tubarão|tucano|tuiuiú|urso|urubu|vaca|vaga-lume|veado|víbora|vespa|zebra|zangão`),
  cidade: L(`Aracaju|Belém|Belo Horizonte|Boa Vista|Brasília|Campo Grande|Cuiabá|Curitiba|Florianópolis|Fortaleza|Goiânia|João Pessoa|Macapá|Maceió|Manaus|Natal|Palmas|Porto Alegre|Porto Velho|Recife|Rio Branco|Rio de Janeiro|Salvador|São Luís|São Paulo|Teresina|Vitória|Anápolis|Aparecida|Americana|Araraquara|Arapiraca|Barueri|Bauru|Blumenau|Betim|Campinas|Campina Grande|Caruaru|Cascavel|Caxias do Sul|Contagem|Cabo Frio|Camaçari|Diadema|Divinópolis|Duque de Caxias|Dourados|Embu|Feira de Santana|Foz do Iguaçu|Franca|Guarulhos|Guarujá|Gramado|Governador Valadares|Hortolândia|Ilhéus|Ipatinga|Itabuna|Itajaí|Itu|Indaiatuba|Jundiaí|Joinville|Juiz de Fora|Juazeiro|Juazeiro do Norte|Jaboatão|Jacareí|Londrina|Limeira|Lages|Mossoró|Maringá|Montes Claros|Mogi das Cruzes|Marília|Niterói|Nova Iguaçu|Navegantes|Osasco|Olinda|Ouro Preto|Petrópolis|Piracicaba|Ponta Grossa|Pelotas|Petrolina|Paulista|Praia Grande|Parauapebas|Queimados|Quixadá|Ribeirão Preto|Rio Verde|Rondonópolis|Resende|Santos|Sorocaba|São José dos Campos|Santo André|São Bernardo do Campo|Serra|Santarém|Sobral|Sete Lagoas|Taubaté|Toledo|Teófilo Otoni|Uberlândia|Uberaba|Ubatuba|Uruguaiana|Valinhos|Vila Velha|Volta Redonda|Vitória da Conquista|Varginha|Xique-Xique|Xapuri|Xanxerê|Zé Doca|Amsterdã|Atenas|Barcelona|Berlim|Buenos Aires|Bogotá|Cairo|Chicago|Dubai|Dublin|Florença|Genebra|Havana|Hong Kong|Istambul|Jerusalém|Kyoto|Lisboa|Londres|Los Angeles|Lima|Madri|Miami|Milão|Moscou|Nova York|Nova Iorque|Nápoles|Orlando|Oslo|Paris|Porto|Pequim|Quito|Roma|Santiago|Seul|Tóquio|Toronto|Turim|Veneza|Viena|Varsóvia|Washington|Xangai|Zurique`),
  pais: L(`Afeganistão|África do Sul|Albânia|Alemanha|Andorra|Angola|Arábia Saudita|Argélia|Argentina|Armênia|Austrália|Áustria|Azerbaijão|Bahamas|Bangladesh|Barbados|Bélgica|Belize|Benin|Bielorrússia|Bolívia|Bósnia|Botsuana|Brasil|Bulgária|Burkina Faso|Burundi|Butão|Cabo Verde|Camarões|Camboja|Canadá|Catar|Cazaquistão|Chade|Chile|China|Chipre|Colômbia|Comores|Congo|Coreia do Sul|Coreia do Norte|Costa do Marfim|Costa Rica|Croácia|Cuba|Dinamarca|Djibuti|Dominica|Egito|El Salvador|Emirados Árabes|Equador|Eritreia|Escócia|Eslováquia|Eslovênia|Espanha|Estados Unidos|Estônia|Etiópia|Fiji|Filipinas|Finlândia|França|Gabão|Gâmbia|Gana|Geórgia|Granada|Grécia|Guatemala|Guiana|Guiné|Guiné-Bissau|Haiti|Holanda|Honduras|Hungria|Iêmen|Índia|Indonésia|Inglaterra|Irã|Iraque|Irlanda|Islândia|Israel|Itália|Jamaica|Japão|Jordânia|Kosovo|Kuwait|Laos|Lesoto|Letônia|Líbano|Libéria|Líbia|Liechtenstein|Lituânia|Luxemburgo|Macedônia|Madagascar|Malásia|Malawi|Maldivas|Mali|Malta|Marrocos|Maurício|Mauritânia|México|Mianmar|Moçambique|Moldávia|Mônaco|Mongólia|Montenegro|Namíbia|Nauru|Nepal|Nicarágua|Níger|Nigéria|Noruega|Nova Zelândia|Omã|Países Baixos|Palau|Palestina|Panamá|Paquistão|Paraguai|Peru|Polônia|Portugal|Quênia|Quirguistão|Reino Unido|República Dominicana|República Tcheca|Romênia|Ruanda|Rússia|Samoa|San Marino|Santa Lúcia|São Tomé e Príncipe|Senegal|Serra Leoa|Sérvia|Singapura|Síria|Somália|Sri Lanka|Suazilândia|Sudão|Suécia|Suíça|Suriname|Tailândia|Taiwan|Tanzânia|Tajiquistão|Timor-Leste|Togo|Tonga|Trinidad e Tobago|Tunísia|Turcomenistão|Turquia|Tuvalu|Ucrânia|Uganda|Uruguai|Uzbequistão|Vanuatu|Vaticano|Venezuela|Vietnã|Zâmbia|Zimbábue`),
  comida: L(`acarajé|açaí|almôndega|arroz|arroz doce|bacalhau|baião de dois|bife|biscoito|bolo|bolinho|brigadeiro|brownie|burrito|cachorro-quente|caldo|canjica|carne|churrasco|coxinha|cuscuz|cocada|croissant|chocolate|dobradinha|donut|doce de leite|empada|empadão|esfiha|espaguete|estrogonofe|escondidinho|farofa|feijão|feijoada|frango|filé|fondue|fricassê|galinhada|gelatina|guacamole|goiabada|hambúrguer|homus|iogurte|inhame|jabá|jiló|kibe|quibe|ketchup|lasanha|linguiça|lombo|macarrão|maionese|mandioca|manjar|moqueca|mousse|miojo|nhoque|nachos|omelete|ovo|ovo frito|panqueca|pamonha|pão|pão de queijo|pastel|pavê|picanha|pipoca|pizza|polenta|pudim|purê|paçoca|queijo|quindim|quiche|risoto|rabada|rocambole|rapadura|salada|salame|salsicha|sanduíche|sopa|sorvete|sushi|sarapatel|strogonoff|tapioca|torta|torrada|taco|tutu|tropeiro|uramaki|vatapá|vaca atolada|waffle|xinxim|xis|yakisoba|zabaione`),
  fruta: L(`abacate|abacaxi|açaí|acerola|ameixa|amora|araçá|banana|bacuri|bergamota|cacau|caju|cajá|caqui|carambola|cereja|coco|cupuaçu|damasco|figo|framboesa|fruta-do-conde|goiaba|graviola|groselha|guaraná|ingá|jabuticaba|jaca|jambo|jenipapo|kiwi|kinkan|laranja|lichia|lima|limão|maçã|mamão|manga|mangaba|maracujá|melancia|melão|mexerica|mirtilo|morango|nectarina|nêspera|noni|pequi|pera|pêra|pêssego|pitaya|pitanga|pinha|pomelo|romã|seriguela|siriguela|sapoti|tamarindo|tangerina|tâmara|toranja|umbu|uva|uvaia|umê|xixá|zimbro`),
  objeto: L(`abajur|agulha|almofada|anel|apito|aspirador|armário|bacia|balde|banco|bandeja|bateria|bicicleta|bola|bolsa|borracha|bota|brinco|caderno|cadeira|caixa|calculadora|cama|caneca|caneta|carteira|celular|chave|chaveiro|chinelo|colher|computador|copo|cortina|dado|dedal|desodorante|disco|dominó|escada|escova|espelho|esponja|estojo|faca|garfo|garrafa|geladeira|guarda-chuva|guitarra|grampeador|hidrante|hélice|ímã|isqueiro|impressora|jarra|janela|joia|jornal|lâmpada|lanterna|lápis|livro|lixeira|luva|martelo|mesa|mochila|moeda|mouse|notebook|navalha|óculos|ônibus|panela|pente|pincel|prato|pregador|quadro|quebra-cabeça|régua|relógio|rádio|rodo|sabonete|sacola|sapato|serrote|sofá|tesoura|tapete|teclado|telefone|televisão|tijolo|toalha|travesseiro|urna|ursinho|unha postiça|vaso|vassoura|vela|ventilador|violão|xícara|xilofone|xampu|zíper|zabumba`),
  profissao: L(`açougueiro|administrador|advogado|agricultor|alfaiate|arquiteto|astronauta|ator|atriz|atendente|babá|bailarina|bancário|barbeiro|bibliotecário|biólogo|bombeiro|borracheiro|cabeleireiro|caixa|camareira|caminhoneiro|cantor|carpinteiro|carteiro|chef|cientista|confeiteiro|contador|costureira|cozinheiro|dançarino|dentista|desenhista|designer|detetive|diarista|eletricista|empresário|encanador|enfermeiro|engenheiro|escritor|estilista|farmacêutico|faxineiro|feirante|fisioterapeuta|florista|fotógrafo|frentista|garçom|gari|geógrafo|gerente|guarda|guia|historiador|instrutor|influenciador|jardineiro|jornalista|juiz|jogador|lavrador|locutor|lixeiro|marceneiro|médico|mecânico|motorista|manicure|marinheiro|motoboy|músico|nutricionista|nadador|oftalmologista|operador|ourives|padeiro|pedreiro|pescador|pintor|piloto|policial|porteiro|professor|programador|psicólogo|publicitário|químico|quiropraxista|recepcionista|repórter|relojoeiro|sapateiro|secretário|segurança|soldado|sorveteiro|taxista|técnico|tradutor|torneiro|uber|urologista|vendedor|veterinário|vigilante|vaqueiro|vidraceiro|xerife|youtuber|zelador|zootecnista|zagueiro`),
  filme: L(`Avatar|Aladdin|Alien|Avengers|Vingadores|A Casa de Papel|Anne with an E|Barbie|Batman|Breaking Bad|Bridgerton|Bob Esponja|Black Mirror|Carros|Coringa|Coco|Cidade de Deus|Chaves|Chapolin|Cobra Kai|Dark|Divertida Mente|Dexter|Duna|Elite|Encanto|Enrolados|Friends|Frozen|Forrest Gump|Fuga das Galinhas|Game of Thrones|Grey's Anatomy|Gravidade|Gladiador|Harry Potter|House|Homem-Aranha|Homem de Ferro|Hulk|Interestelar|It|Irmão do Jorel|Jumanji|Jurassic Park|John Wick|Kung Fu Panda|Karate Kid|Lucifer|La Casa de Papel|Lilo e Stitch|Matrix|Moana|Minions|Mulan|Malhação|Narcos|Naruto|Nemo|O Rei Leão|Oppenheimer|Os Simpsons|O Auto da Compadecida|Pantera Negra|Piratas do Caribe|Peaky Blinders|Pokémon|Procurando Nemo|Quarteto Fantástico|Rocky|Ratatouille|Round 6|Rambo|Shrek|Stranger Things|Star Wars|Superman|Sherlock|Titanic|Toy Story|Tropa de Elite|The Walking Dead|The Office|Thor|Up|Uncharted|Vikings|Velozes e Furiosos|Wandinha|Wednesday|WALL-E|X-Men|Xuxa|Yellowstone|Zootopia|Zorro`),
  celebridade: L(`Anitta|Angélica|Ana Maria Braga|Ana Castela|Adele|Ariana Grande|Beyoncé|Bruna Marquezine|Bad Bunny|Belo|Bruno Mars|Caetano Veloso|Carlinhos Maia|Cristiano Ronaldo|Casimiro|Daniel|Drake|Dua Lipa|Eminem|Eliana|Elon Musk|Faustão|Felipe Neto|Fátima Bernardes|Gusttavo Lima|Gisele Bündchen|Gil do Vigor|Gilberto Gil|Hebe|Henrique e Juliano|Ivete Sangalo|IZA|Jojo Todynho|Juliette|Justin Bieber|Jorge Ben|Kim Kardashian|Katy Perry|Ludmilla|Luan Santana|Luciano Huck|Lady Gaga|Lionel Messi|Marília Mendonça|Maisa|Michael Jackson|Madonna|Mano Brown|Neymar|Nando Reis|Neto|Ozuna|Pelé|Pabllo Vittar|Paulo Gustavo|Preta Gil|Pocah|Rihanna|Roberto Carlos|Rodrigo Faro|Ratinho|Ronaldinho|Ronaldo|Sabrina Sato|Silvio Santos|Shakira|Simone|Simaria|Taylor Swift|Tatá Werneck|Tiririca|Thiaguinho|Usher|Virginia|Vini Jr|Whindersson Nunes|Wesley Safadão|Will Smith|Xuxa|Xamã|Yudi|Zeca Pagodinho|Zezé di Camargo`),
};

export function normalizar(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .replace(/[-']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

let armazenamento = { ler: (_k, p) => p, gravar: () => {} };
let conjuntos = {};

function montar() {
  const extra = armazenamento.ler('dicionario-extra', {}) || {};
  conjuntos = {};
  const ids = new Set([...Object.keys(BASE), ...Object.keys(extra)]);
  for (const id of ids) {
    conjuntos[id] = new Set([...(BASE[id] || []), ...(extra[id] || [])].map(normalizar));
  }
  // nomes de pessoas: lista do IBGE (milhares de nomes registrados no Brasil)
  for (const n of NOMES_IBGE.split('|')) conjuntos.nome.add(n);
}
montar();

export function usarArmazenamento(arm) {
  armazenamento = arm;
  montar();
}

export function estaNoDicionario(catId, palavra) {
  const set = conjuntos[catId];
  if (!set) return false;
  const n = normalizar(palavra);
  if (set.has(n)) return true;
  // tolera plural simples (macacos -> macaco)
  if (n.endsWith('s') && set.has(n.slice(0, -1))) return true;
  // nome composto (Maria Clara, Ana Júlia, João de Deus): todas as partes precisam ser nomes
  if (catId === 'nome' && n.includes(' ')) {
    const partes = n.split(' ').filter((p) => !['de', 'da', 'do', 'dos', 'das', 'e'].includes(p));
    return partes.length > 0 && partes.every((p) => set.has(p));
  }
  return false;
}

// confere se parece uma palavra de verdade (barra coisas como "Mdkdkdkd", "asdfgh")
export function pareceePalavra(palavra) {
  const n = normalizar(palavra).replace(/\s+/g, ' ');
  const letras = n.replace(/[^a-z]/g, '');
  if (letras.length < 2) return false;
  if (!/[aeiouy]/.test(letras)) return false;
  if (/[^aeiouy\s]{4,}/.test(n.replace(/[^a-z\s]/g, ''))) return false; // 4 consoantes seguidas
  if (/([a-z]{2})\1\1/.test(letras)) return false; // repetição tipo "dkdkdk"
  const vogais = (letras.match(/[aeiouy]/g) || []).length;
  return vogais / letras.length >= 0.2;
}

export function temDicionario(catId) {
  return !!conjuntos[catId] && conjuntos[catId].size > 0;
}

export function adicionarAoDicionario(catId, palavra) {
  const extra = armazenamento.ler('dicionario-extra', {}) || {};
  extra[catId] = extra[catId] || [];
  if (!extra[catId].some((p) => normalizar(p) === normalizar(palavra))) extra[catId].push(palavra);
  armazenamento.gravar('dicionario-extra', extra);
  montar();
}

// Lista usada pelo simulador (bots) para gerar respostas de teste
export function palavrasDe(catId) {
  return BASE[catId] || [];
}
