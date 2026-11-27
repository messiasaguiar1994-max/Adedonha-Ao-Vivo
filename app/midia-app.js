// No aplicativo, suas músicas e o fundo ficam guardados no próprio celular (IndexedDB).
const BANCO = 'adedonha-midia';
let db = null;
const urls = new Map();

function abrir() {
  if (db) return Promise.resolve(db);
  return new Promise((ok, erro) => {
    const r = indexedDB.open(BANCO, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('arquivos', { keyPath: 'id' });
    r.onsuccess = () => { db = r.result; ok(db); };
    r.onerror = () => erro(r.error);
  });
}

function loja(modo) { return db.transaction('arquivos', modo).objectStore('arquivos'); }
const pedido = (r) => new Promise((ok, erro) => { r.onsuccess = () => ok(r.result); r.onerror = () => erro(r.error); });

function avisar() { window.dispatchEvent(new Event('midia-mudou')); }

export const MidiaApp = {
  async listar() {
    await abrir();
    const todos = await pedido(loja('readonly').getAll());
    const comUrl = todos.map((m) => {
      if (!urls.has(m.id)) urls.set(m.id, URL.createObjectURL(m.blob));
      return { id: m.id, tipo: m.tipo, nome: m.nome, mime: m.mime, url: urls.get(m.id) };
    });
    return { musicas: comUrl.filter((m) => m.tipo === 'musica'), fundo: comUrl.find((m) => m.tipo === 'fundo') || null };
  },
  async adicionar(tipo, arquivo) {
    await abrir();
    if (tipo === 'fundo') {
      const todos = await pedido(loja('readonly').getAll());
      for (const m of todos.filter((x) => x.tipo === 'fundo')) await this.remover(m.id, false);
    }
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await pedido(loja('readwrite').put({ id, tipo, nome: arquivo.name || 'arquivo', mime: arquivo.type || '', blob: arquivo }));
    avisar();
  },
  async remover(id, aviso = true) {
    await abrir();
    await pedido(loja('readwrite').delete(id));
    if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
    if (aviso) avisar();
  },
};
