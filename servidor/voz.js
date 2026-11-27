// Voz natural (neural) grátis, usando o serviço "Ler em voz alta" do Microsoft Edge.
// É um serviço não oficial: se um dia parar, o jogo volta sozinho para a voz do celular.
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

export const VOZES = {
  'pt-BR-ThalitaMultilingualNeural': 'Thalita (jovem, doce)',
  'pt-BR-FranciscaNeural': 'Francisca (moça)',
  'pt-BR-AntonioNeural': 'Antônio (homem)',
};

const cache = new Map();
const escXml = (t) => String(t).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

async function sintetizar(texto, voz, tom, velocidade) {
  const tts = new MsEdgeTTS({ connectionTimeoutMs: 8000, synthesisTimeoutMs: 15000 });
  await tts.setMetadata(voz, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  return new Promise((ok, erro) => {
    const partes = [];
    const { audioStream } = tts.toStream(escXml(texto), { pitch: tom, rate: velocidade });
    audioStream.on('data', (d) => partes.push(d));
    audioStream.on('error', erro);
    audioStream.on('close', () => { try { tts.close(); } catch { /* */ } partes.length ? ok(Buffer.concat(partes)) : erro(new Error('sem áudio')); });
  });
}

// GET /voz?t=texto&v=voz&p=+12%&r=+0%
export async function rotaVoz(req, res) {
  const url = new URL(req.url, 'http://x');
  const texto = String(url.searchParams.get('t') || '').slice(0, 300).trim();
  const voz = VOZES[url.searchParams.get('v')] ? url.searchParams.get('v') : 'pt-BR-ThalitaMultilingualNeural';
  const limpa = (s, padrao) => (/^[+-]?\d{1,3}%$/.test(s || '') ? s : padrao);
  const tom = limpa(url.searchParams.get('p'), '+10%');
  const vel = limpa(url.searchParams.get('r'), '+0%');
  const cors = { 'Access-Control-Allow-Origin': '*' };
  if (!texto) { res.writeHead(400, cors); return res.end(); }
  const chave = `${voz}|${tom}|${vel}|${texto}`;
  try {
    let audio = cache.get(chave);
    if (!audio) {
      try { audio = await sintetizar(texto, voz, tom, vel); }
      catch (e) {
        // se essa voz não estiver disponível, tenta a Francisca
        if (voz === 'pt-BR-FranciscaNeural') throw e;
        console.error('[voz] tentando a Francisca:', e.message);
        audio = await sintetizar(texto, 'pt-BR-FranciscaNeural', tom, vel);
      }
      if (cache.size > 400) cache.delete(cache.keys().next().value);
      cache.set(chave, audio);
    }
    res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'max-age=86400', ...cors });
    res.end(audio);
  } catch (e) {
    console.error('[voz] falhou:', e.message);
    res.writeHead(502, cors);
    res.end();
  }
}
