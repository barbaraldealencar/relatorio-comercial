// Indicadores macroeconômicos reais de fontes públicas, sem chave de API:
//   Banco Central (SGS e Focus/Olinda) para o Brasil; FRED (Fed de St. Louis) para petróleo e EUA.
import { arred } from '../lib/dados.js';

export async function buscar(url, opcoes = {}) {
  let ultimoErro;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      const r = await fetch(url, { ...opcoes, signal: AbortSignal.timeout(20000) });
      if (r.ok) return r;
      ultimoErro = new Error(`HTTP ${r.status}`);
    } catch (e) { ultimoErro = e; }
    await new Promise(res => setTimeout(res, 800 * (tentativa + 1)));
  }
  throw ultimoErro;
}

// Série do SGS/BCB desde N dias atrás → [{data: Date, valor}]
// (o endpoint "ultimos/N" aceita no máximo 20 registros em séries diárias, por isso usamos dataInicial)
async function sgs(codigo, dias = 400) {
  const ini = new Date(Date.now() - dias * 86400000);
  const dataInicial = `${String(ini.getUTCDate()).padStart(2, '0')}/${String(ini.getUTCMonth() + 1).padStart(2, '0')}/${ini.getUTCFullYear()}`;
  const r = await buscar(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados?formato=json&dataInicial=${dataInicial}`, { headers: { Accept: 'application/json' } });
  const arr = await r.json();
  if (!Array.isArray(arr)) throw new Error('resposta inesperada do SGS');
  return arr.map(({ data, valor }) => { const [d, m, y] = data.split('/'); return { data: new Date(Date.UTC(+y, +m - 1, +d)), valor: parseFloat(valor) }; }).filter(x => x.data.getTime() <= Date.now() && isFinite(x.valor));
}

// Série diária do FRED (CSV público) → [{data: Date, valor}]
async function fred(id) {
  const r = await buscar(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  return (await r.text()).trim().split('\n').slice(1).map(l => { const [d, v] = l.split(','); return { data: new Date(d + 'T00:00:00Z'), valor: parseFloat(v) }; }).filter(x => isFinite(x.valor));
}

// Último valor e variações em relação a N dias atrás.
function resumir(serie, { casas = 2, variacoes = { '1m': 30, '3m': 91, '12m': 365 }, unidade } = {}) {
  if (!serie.length) return { erro: 'série vazia' };
  const ultimo = serie[serie.length - 1];
  const out = { ultimo: arred(ultimo.valor, casas), data: ultimo.data.toISOString().slice(0, 10) };
  if (unidade) out.unidade = unidade;
  for (const [nome, dias] of Object.entries(variacoes)) {
    const alvo = ultimo.data.getTime() - dias * 86400000;
    const anterior = [...serie].reverse().find(x => x.data.getTime() <= alvo);
    if (anterior) out[`var_${nome}_%`] = arred((ultimo.valor / anterior.valor - 1) * 100, 1);
  }
  return out;
}

async function focus() {
  const ano = new Date().getUTCFullYear();
  const filtro = encodeURIComponent(`(Indicador eq 'IPCA' or Indicador eq 'Selic' or Indicador eq 'PIB Total' or Indicador eq 'Câmbio') and baseCalculo eq 0`);
  const url = `https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?$top=60&$filter=${filtro}&$orderby=Data%20desc&$format=json&$select=Indicador,Data,DataReferencia,Mediana`;
  const { value } = await (await buscar(url)).json();
  const dataMaisRecente = value[0]?.Data;
  const out = { data_pesquisa: dataMaisRecente };
  for (const v of value.filter(v => v.Data === dataMaisRecente && [String(ano), String(ano + 1)].includes(v.DataReferencia))) {
    out[`${v.Indicador} ${v.DataReferencia}`] = arred(v.Mediana, 2);
  }
  return out;
}

const tentar = async (fn) => { try { return await fn(); } catch (e) { return { erro: `indisponível no momento (${e.message})` }; } };

export const definicao = {
  name: 'indicadores_macro',
  description:
    'Retorna indicadores macro REAIS e atualizados: Brasil (Selic, IPCA 12 meses, dólar PTAX, expectativas do Boletim Focus) ' +
    'e global (petróleo Brent e WTI, juros do Fed, Treasury de 10 anos, índice do dólar). Inclui o último valor e as variações de 1, 3 e 12 meses. ' +
    'Use no início da análise macro.',
  input_schema: { type: 'object', properties: {}, additionalProperties: false },
};

export async function executar() {
  const [selic, ipca, ptax, focusExp, brent, wti, fedFunds, ust10, dolarGlobal] = await Promise.all([
    tentar(async () => resumir(await sgs(432, 400), { unidade: '% a.a.', variacoes: { '3m': 91, '12m': 365 } })),
    tentar(async () => resumir(await sgs(13522, 120), { unidade: '% em 12 meses', variacoes: {} })),
    tentar(async () => resumir(await sgs(1, 400), { casas: 4, unidade: 'R$/US$' })),
    tentar(focus),
    tentar(async () => resumir(await fred('DCOILBRENTEU'), { unidade: 'US$/barril' })),
    tentar(async () => resumir(await fred('DCOILWTICO'), { unidade: 'US$/barril' })),
    tentar(async () => resumir(await fred('DFF'), { unidade: '% a.a.', variacoes: { '12m': 365 } })),
    tentar(async () => resumir(await fred('DGS10'), { unidade: '% a.a.', variacoes: { '3m': 91 } })),
    tentar(async () => resumir(await fred('DTWEXBGS'), { unidade: 'índice', variacoes: { '1m': 30, '12m': 365 } })),
  ]);
  return {
    fontes: 'Banco Central do Brasil (SGS e Focus) e FRED / Federal Reserve Bank of St. Louis — dados reais',
    brasil: { selic_meta: selic, ipca_12m: ipca, dolar_ptax: ptax, focus_medianas: focusExp },
    global: { brent: brent, wti: wti, fed_funds: fedFunds, treasury_10a: ust10, dolar_global_DTWEXBGS: dolarGlobal },
  };
}
