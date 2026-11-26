// Configurações no PC: lê/grava data/config.json
import fs from 'node:fs';
import path from 'node:path';
import { PADRAO, mesclar } from './padrao.js';

export { PADRAO };
const PASTA_DADOS = path.resolve('data');
const ARQ_CONFIG = path.join(PASTA_DADOS, 'config.json');

export function carregarConfig() {
  try {
    if (fs.existsSync(ARQ_CONFIG)) return mesclar(structuredClone(PADRAO), JSON.parse(fs.readFileSync(ARQ_CONFIG, 'utf8')));
  } catch (e) {
    console.error('[config] arquivo config.json com erro, usando padrão:', e.message);
  }
  return structuredClone(PADRAO);
}

export function salvarConfig(cfg) {
  fs.mkdirSync(PASTA_DADOS, { recursive: true });
  fs.writeFileSync(ARQ_CONFIG, JSON.stringify(cfg, null, 2), 'utf8');
}

// guarda pequenos arquivos (placar, dicionário extra) na pasta data
export const armazenamentoPC = {
  ler(chave, padrao) {
    try {
      const f = path.join(PASTA_DADOS, `${chave}.json`);
      if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
    } catch { /* arquivo com erro */ }
    return padrao;
  },
  gravar(chave, valor) {
    try {
      fs.mkdirSync(PASTA_DADOS, { recursive: true });
      fs.writeFileSync(path.join(PASTA_DADOS, `${chave}.json`), JSON.stringify(valor, null, 2), 'utf8');
    } catch (e) { console.error('[dados] não consegui salvar', chave, e.message); }
  },
};
