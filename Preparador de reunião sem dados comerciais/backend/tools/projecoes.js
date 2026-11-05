// Projeções de mercado REAIS, de fontes públicas:
//   - Curva futura do Brent (contratos mensais negociados na NYMEX, via Yahoo Finance)
//   - Projeção oficial da EIA (Short-Term Energy Outlook) para Brent e WTI
//   - Boletim Focus (Banco Central): IPCA, Selic, PIB e câmbio para 3 anos
import { arred } from '../lib/dados.js';
import { buscar } from './macro.js';

const CODIGOS_MES = 'FGHJKMNQUVXZ';
const chaveMes = (y, m) => `${y}-${String(m).padStart(2, '0')}`;

// Curva futura do Brent: preço de cada contrato mensal dos próximos ~15 meses.
export async function curvaBrent(mesesAFrente = 15) {
  const hoje = new Date();
  const pedidos = [];
  // O contrato de Brent do mês M vence no fim do mês M-2: em novembro, o primeiro contrato ativo é o de janeiro.
  // Começar em i = 2 evita usar um contrato vencido, cujo preço fica congelado no dia do vencimento.
  for (let i = 2; i <= mesesAFrente; i++) {
    const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + i, 1));
    const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
    const simbolo = `BZ${CODIGOS_MES[m - 1]}${String(y).slice(2)}.NYM`;
    pedidos.push((async () => {
      try {
        const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(simbolo)}?range=5d&interval=1d`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
        if (!r.ok) return null; // contrato já vencido ou sem negociação
        const meta = (await r.json()).chart?.result?.[0]?.meta;
        if (!meta?.regularMarketPrice) return null;
        const cotadoEm = new Date(meta.regularMarketTime * 1000);
        const item = { contrato: chaveMes(y, m), preco_US$_bbl: arred(meta.regularMarketPrice), cotado_em: cotadoEm.toISOString().slice(0, 10) };
        // Contratos longos às vezes ficam sem negócio por semanas: o preço fica velho e não deve ser usado como referência.
        if (Date.now() - cotadoEm.getTime() > 10 * 86400000) item.aviso = 'cotação desatualizada (sem negócios recentes) — baixa confiabilidade';
        return item;
      } catch { return null; }
    })());
  }
  const curva = (await Promise.all(pedidos)).filter(Boolean);
  if (!curva.length) throw new Error('curva futura indisponível');
  return curva;
}

// Projeção mensal da EIA (STEO) para Brent e WTI.
export async function projecaoEia(mesesAFrente = 15) {
  const hoje = new Date();
  const ini = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 2, 1));
  const fim = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + mesesAFrente, 1));
  const chave = process.env.EIA_API_KEY || 'DEMO_KEY';
  const url = `https://api.eia.gov/v2/steo/data/?api_key=${chave}&frequency=monthly&data[0]=value` +
    `&facets[seriesId][]=BREPUUS&facets[seriesId][]=WTIPUUS&start=${chaveMes(ini.getUTCFullYear(), ini.getUTCMonth() + 1)}` +
    `&end=${chaveMes(fim.getUTCFullYear(), fim.getUTCMonth() + 1)}&sort[0][column]=period&sort[0][direction]=asc`;
  const { response } = await (await buscar(url)).json();
  const porMes = {};
  for (const d of response?.data || []) (porMes[d.period] ||= { mes: d.period })[d.seriesId === 'BREPUUS' ? 'brent_US$_bbl' : 'wti_US$_bbl'] = +d.value;
  return Object.values(porMes);
}

// Medianas do Boletim Focus para o ano corrente e os dois seguintes.
export async function focusAnual() {
  const ano = new Date().getUTCFullYear();
  const filtro = encodeURIComponent(`(Indicador eq 'IPCA' or Indicador eq 'Selic' or Indicador eq 'PIB Total' or Indicador eq 'Câmbio') and baseCalculo eq 0`);
  const url = `https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?$top=80&$filter=${filtro}&$orderby=Data%20desc&$format=json&$select=Indicador,Data,DataReferencia,Mediana`;
  const { value } = await (await buscar(url)).json();
  const data = value[0]?.Data;
  const anos = [ano, ano + 1, ano + 2].map(String);
  const out = { data_pesquisa: data };
  for (const ind of ['IPCA', 'Selic', 'PIB Total', 'Câmbio']) {
    out[ind] = Object.fromEntries(anos.map(a => [a, arred(value.find(v => v.Data === data && v.Indicador === ind && v.DataReferencia === a)?.Mediana, 2)]));
  }
  return out;
}

function mediasTrimestrais(linhas, campoPreco, campoMes) {
  const acc = {};
  for (const l of linhas) {
    const [y, m] = l[campoMes].split('-').map(Number);
    const t = `${y}-T${Math.ceil(m / 3)}`;
    (acc[t] ||= []).push(l[campoPreco]);
  }
  return Object.fromEntries(Object.entries(acc).map(([t, v]) => [t, arred(v.reduce((s, x) => s + x, 0) / v.length, 1)]));
}

const tentar = async fn => { try { return await fn(); } catch (e) { return { erro: `indisponível no momento (${e.message})` }; } };

export const definicao = {
  name: 'projecoes_mercado',
  description:
    'Retorna projeções REAIS e atualizadas: (1) curva futura do Brent, com o preço de cada contrato mensal dos próximos ~15 meses (o que o mercado precifica hoje); ' +
    '(2) projeção oficial mensal da EIA (agência de energia dos EUA) para Brent e WTI; (3) medianas do Boletim Focus para IPCA, Selic, PIB e câmbio no ano corrente e nos dois seguintes. ' +
    'Traz também médias trimestrais do Brent pela curva e pela EIA, lado a lado. Use para a seção de projeções e para alimentar a ferramenta projetar_cliente.',
  input_schema: { type: 'object', properties: {}, additionalProperties: false },
};

export async function executar() {
  const [curva, eia, focus] = await Promise.all([tentar(() => curvaBrent()), tentar(() => projecaoEia()), tentar(focusAnual)]);
  return {
    fontes: 'Curva futura: contratos de Brent na NYMEX (Yahoo Finance). Projeção: EIA Short-Term Energy Outlook. Macro Brasil: Boletim Focus/BCB. Todos dados reais.',
    leitura:
      'A curva futura é o preço negociado hoje para entrega futura (inclui prêmio de risco; não é previsão pura). A EIA é a projeção de um órgão oficial. ' +
      'Curva descendente (backwardation) = o mercado espera alívio de preços; ascendente (contango) = o mercado espera alta ou sobra de oferta no curto prazo.',
    brent_curva_futura: curva,
    brent_wti_projecao_eia: eia,
    brent_medias_trimestrais: Array.isArray(curva) && Array.isArray(eia) ? {
      curva_futura: mediasTrimestrais(curva, 'preco_US$_bbl', 'contrato'),
      eia: mediasTrimestrais(eia.filter(e => e['brent_US$_bbl']), 'brent_US$_bbl', 'mes'),
    } : null,
    focus,
  };
}
