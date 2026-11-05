// Busca manchetes recentes no Google News (RSS público, sem chave de API).

const ENTIDADES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ' };
const decodificar = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, m => ENTIDADES[m]).replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).trim();
const tag = (xml, nome) => { const m = xml.match(new RegExp(`<${nome}[^>]*>([\\s\\S]*?)</${nome}>`)); return m ? decodificar(m[1]) : null; };

export const definicao = {
  name: 'buscar_noticias',
  description:
    'Busca manchetes recentes no Google News (Brasil, português ou inglês). Retorna título, veículo, data e link. ' +
    'Use várias consultas curtas e específicas (ex.: "petróleo Brent OPEP", "polipropileno preço Ásia", "Copom Selic", "air fryer vendas"). ' +
    'Só traz manchetes, não o texto completo: trate cada manchete como um sinal e cite o veículo e a data.',
  input_schema: {
    type: 'object',
    properties: {
      consulta: { type: 'string', description: 'Termos de busca, como se digitados no Google News.' },
      dias: { type: 'integer', description: 'Janela de tempo em dias (padrão 7, máximo 30).' },
      idioma: { type: 'string', enum: ['pt', 'en'], description: 'pt = notícias do Brasil; en = imprensa internacional (padrão pt).' },
      limite: { type: 'integer', description: 'Máximo de manchetes (padrão 8, máximo 15).' },
    },
    required: ['consulta'],
    additionalProperties: false,
  },
};

export async function executar({ consulta, dias = 7, idioma = 'pt', limite = 8 }) {
  dias = Math.min(Math.max(1, dias | 0), 30);
  limite = Math.min(Math.max(1, limite | 0), 15);
  const loc = idioma === 'en' ? 'hl=en-US&gl=US&ceid=US:en' : 'hl=pt-BR&gl=BR&ceid=BR:pt-419';
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${consulta} when:${dias}d`)}&${loc}`;
  const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
  if (!resp.ok) throw new Error(`Google News respondeu HTTP ${resp.status}`);
  const xml = await resp.text();
  const itens = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, limite).map(([, it]) => {
    const fonte = tag(it, 'source');
    let titulo = tag(it, 'title') ?? '';
    if (fonte && titulo.endsWith(` - ${fonte}`)) titulo = titulo.slice(0, -(fonte.length + 3));
    const pub = tag(it, 'pubDate');
    return { titulo, veiculo: fonte, data: pub ? new Date(pub).toISOString().slice(0, 10) : null, link: tag(it, 'link') };
  });
  return { consulta, janela_dias: dias, idioma, total: itens.length, manchetes: itens };
}
