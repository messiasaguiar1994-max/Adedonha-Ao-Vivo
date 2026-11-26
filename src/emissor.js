// EventEmitter simples que funciona tanto no PC (Node) quanto no celular (navegador)
export class Emissor {
  constructor() { this._ouvintes = {}; }
  on(ev, fn) { (this._ouvintes[ev] = this._ouvintes[ev] || []).push(fn); return this; }
  off(ev, fn) { this._ouvintes[ev] = (this._ouvintes[ev] || []).filter((f) => f !== fn); return this; }
  emit(ev, ...args) {
    for (const fn of [...(this._ouvintes[ev] || [])]) {
      try { fn(...args); } catch (e) { console.error(`[evento ${ev}]`, e); }
    }
    return true;
  }
}
