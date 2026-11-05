// Importação de resinas (Comex Stat / MDIC — dados públicos reais): volume e preço médio FOB mês a mês,
// e a sensibilidade do preço de importação ao Brent, para projetar o preço de mercado sem dados internos.
import fs from 'node:fs/promises';
import path from 'node:path';
import { arred, DADOS } from '../lib/dados.js';
import { copiaMaisRecente } from '../lib/cache_comex.js';
import { buscar } from './macro.js';
import { curvaBrent } from './projecoes.js';

// Foco do produto: só PE e PP
export const POSICOES = {
  '3901': 'Polietilenos (PE: PEAD, PEBD, PELBD)',
  '3902': 'Polipropileno (PP) e copolímeros',
};

const chaveMes = d => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

// A API aplica o mesmo intervalo de meses a cada ano do período; por isso consultamos ano a ano.
async function serieComex(posicoes, meses) {
  const fim = new Date();
  const ini = new Date(Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth() - meses, 1));
  const anos = [];
  for (let y = ini.getUTCFullYear(); y <= fim.getUTCFullYear(); y++) anos.push(y);
  // Em sequência e com pausa: a API recusa muitas consultas simultâneas (HTTP 429)
  const listas = [];
  for (const y of anos) {
    if (listas.length) await new Promise(r => setTimeout(r, 1500));
    listas.push(await consultaAno(y));
  }
  async function consultaAno(y) {
    // Cache em disco por dia (anos fechados mudam pouco; evita o limite de consultas da API)
    const arqCache = path.join(DADOS, 'cache', `comex2_${[...posicoes].sort().join('-')}_${y}_${new Date().toISOString().slice(0, 10)}.json`);
    try { return JSON.parse(await fs.readFile(arqCache, 'utf8')); } catch { /* sem cache */ }
    const body = {
      flow: 'import', monthDetail: true,
      period: { from: `${y}-01`, to: y === fim.getUTCFullYear() ? chaveMes(fim) : `${y}-12` },
      filters: [{ filter: 'heading', values: posicoes }],
      details: ['heading'], metrics: ['metricFOB', 'metricKG', 'metricFreight', 'metricInsurance'],
    };
    let lista = null, ultimoErro;
    for (const espera of [0, 5000, 15000, 30000]) {
      if (espera) await new Promise(r => setTimeout(r, espera));
      try {
        const r = await fetch('https://api-comexstat.mdic.gov.br/general?language=pt', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
        if (r.ok) { lista = (await r.json()).data?.list || []; break; }
        ultimoErro = new Error(`HTTP ${r.status}`);
        if (r.status !== 429 && r.status < 500) break;
      } catch (e) { ultimoErro = e; }
    }
    if (!lista) {
      const reserva = await copiaMaisRecente(`comex2_${[...posicoes].sort().join('-')}_${y}`);
      if (reserva) return reserva;
      throw new Error(`Comex Stat indisponível (${ultimoErro?.message})`);
    }
    await fs.mkdir(path.dirname(arqCache), { recursive: true }).catch(() => {});
    await fs.writeFile(arqCache, JSON.stringify(lista)).catch(() => {});
    return lista;
  }
  const minimo = chaveMes(ini);
  const porPosicao = {};
  for (const l of listas.flat().filter(l => `${l.year}-${l.monthNumber}` >= minimo)) {
    const mes = `${l.year}-${l.monthNumber}`;
    const kg = +l.metricKG, fob = +l.metricFOB, frete = +l.metricFreight || 0, seguro = +l.metricInsurance || 0;
    (porPosicao[l.headingCode] ||= []).push({
      mes, volume_t: arred(kg / 1000, 0), preco_US$_t: kg ? arred(fob / kg * 1000, 0) : null,
      // Frete internacional pago na importação (CIF = FOB + frete + seguro)
      frete_US$_t: kg ? arred(frete / kg * 1000, 0) : null,
      frete_pct_cif: fob ? arred(frete / (fob + frete + seguro) * 100, 1) : null,
    });
  }
  for (const k of Object.keys(porPosicao)) porPosicao[k].sort((a, b) => a.mes.localeCompare(b.mes));
  return porPosicao;
}

// Brent mensal (média dos dias): FRED, com o Yahoo Finance (contrato contínuo BZ=F) como reserva
export async function brentMensal() {
  const acc = {};
  let ultima = null; // último dia com cotação: {data, valor}
  const diaria = []; // cotações diárias [{data, valor}]
  try {
    const r = await buscar('https://fred.stlouisfed.org/graph/fredgraph.csv?id=DCOILBRENTEU', { headers: { 'User-Agent': 'Mozilla/5.0' } });
    for (const l of (await r.text()).trim().split('\n').slice(1)) {
      const [d, v] = l.split(','); const x = parseFloat(v); if (!isFinite(x)) continue;
      (acc[d.slice(0, 7)] ||= []).push(x);
      ultima = { data: d, valor: x };
      diaria.push(ultima);
    }
  } catch {
    const r = await buscar('https://query1.finance.yahoo.com/v8/finance/chart/BZ=F?range=2y&interval=1d', { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const res = (await r.json()).chart.result[0];
    res.timestamp.forEach((t, i) => { const x = res.indicators.quote[0].close[i]; if (isFinite(x) && x) { const d = new Date(t * 1000).toISOString().slice(0, 10); (acc[d.slice(0, 7)] ||= []).push(x); ultima = { data: d, valor: x }; diaria.push(ultima); } });
  }
  const medias = Object.fromEntries(Object.entries(acc).map(([k, a]) => [k, a.reduce((s, x) => s + x, 0) / a.length]));
  // Não enumerável: quem percorre as médias mês a mês não vê este campo
  Object.defineProperty(medias, 'ultimoDia', { value: ultima, enumerable: false });
  Object.defineProperty(medias, 'diaria', { value: diaria, enumerable: false });
  return medias;
}

const mesAnterior = (k, n = 1) => { const [y, m] = k.split('-').map(Number); return chaveMes(new Date(Date.UTC(y, m - 1 - n, 1))); };

// Elasticidade: variação % do preço de importação em 3 meses vs variação % do Brent em 3 meses,
// com a defasagem (1 a 3 meses) que melhor explica o preço. Contratos de importação reagem com atraso.
function elasticidade(serie, brent) {
  let melhor = null;
  for (const lag of [1, 2, 3]) {
    const r = regressao(serie, brent, lag);
    if (r && (!melhor || r.correlacao > melhor.correlacao)) melhor = { ...r, lag };
  }
  return melhor && melhor.correlacao > 0.2 ? melhor : null;
}

function regressao(serie, brent, lag) {
  const xs = [], ys = [];
  for (let i = 3; i < serie.length; i++) {
    const a = serie[i - 3], b = serie[i];
    const b1 = brent[mesAnterior(b.mes, lag)], b0 = brent[mesAnterior(a.mes, lag)];
    if (!a['preco_US$_t'] || !b['preco_US$_t'] || !b1 || !b0) continue;
    xs.push(b1 / b0 - 1); ys.push(b['preco_US$_t'] / a['preco_US$_t'] - 1);
  }
  if (xs.length < 8) return null;
  const mx = xs.reduce((s, x) => s + x, 0) / xs.length, my = ys.reduce((s, y) => s + y, 0) / ys.length;
  const cov = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0), vx = xs.reduce((s, x) => s + (x - mx) ** 2, 0), vy = ys.reduce((s, y) => s + (y - my) ** 2, 0);
  if (!vx || !vy) return null;
  return { beta: Math.max(0, Math.min(1.2, cov / vx)), correlacao: cov / Math.sqrt(vx * vy) };
}

export const definicao = {
  name: 'importacoes_resinas',
  description:
    'Dados públicos reais do Comex Stat (MDIC): importação brasileira de PE (3901) e PP (3902), ' +
    'mês a mês: volume (t), preço médio FOB (US$/t) e frete internacional pago (US$/t e % do preço CIF). Calcula variações (3 e 12 meses), a sensibilidade do preço de importação ao Brent e uma projeção do preço ' +
    'para os próximos 3 meses pela curva futura do Brent. É a melhor referência pública de preço de mercado e da pressão de importados.',
  input_schema: {
    type: 'object',
    properties: {
      posicoes: { type: 'array', items: { type: 'string', enum: Object.keys(POSICOES) }, description: 'Posições SH4: 3901 (PE) e 3902 (PP). Padrão: as duas.' },
      meses: { type: 'integer', description: 'Meses de histórico (padrão 30, máximo 48).' },
    },
    additionalProperties: false,
  },
};

export async function executar({ posicoes = ['3901', '3902'], meses = 30 } = {}) {
  meses = Math.min(Math.max(12, meses | 0), 48);
  const [series, brent] = await Promise.all([serieComex(posicoes, meses), brentMensal()]);
  let curva = null;
  try { curva = await curvaBrent(); } catch { /* sem curva: sem projeção */ }

  const resultado = posicoes.map(p => {
    const s = series[p] || [];
    if (!s.length) return { posicao: p, descricao: POSICOES[p], erro: 'sem dados' };
    const ult = s[s.length - 1];
    const de = n => s[s.length - 1 - n];
    const varPct = (a, b) => (a && b ? arred((a / b - 1) * 100, 1) : null);
    const vol12 = s.slice(-12).reduce((t, x) => t + x.volume_t, 0), volAnt = s.slice(-24, -12).reduce((t, x) => t + x.volume_t, 0);
    const ajuste = elasticidade(s, brent);
    const el = ajuste?.beta ?? null;
    // Projeção: preço do último mês × (1 + elasticidade × variação do Brent mensal → contrato futuro)
    let projecao = null;
    if (el !== null && curva?.length) {
      const brentUlt = brent[mesAnterior(ult.mes, ajuste.lag - 1)] ?? brent[mesAnterior(ult.mes)];
      const futuro = curva[0]['preco_US$_bbl'];
      if (brentUlt) {
        const varBrent = futuro / brentUlt - 1;
        projecao = { brent_ultimo_mes_US$: arred(brentUlt, 1), brent_futuro_proximo_US$: futuro, variacao_preco_projetada_pct: arred(el * varBrent * 100, 1), preco_projetado_US$_t: arred(ult['preco_US$_t'] * (1 + el * varBrent), 0) };
      }
    }
    return {
      posicao: p, descricao: POSICOES[p], ultimo_mes: ult.mes,
      preco_ultimo_US$_t: ult['preco_US$_t'], preco_var_3m_pct: varPct(ult['preco_US$_t'], de(3)?.['preco_US$_t']), preco_var_12m_pct: varPct(ult['preco_US$_t'], de(12)?.['preco_US$_t']),
      volume_ultimo_t: ult.volume_t, volume_12m_t: vol12, volume_12m_var_pct: varPct(vol12, volAnt),
      elasticidade_preco_vs_brent: arred(el, 2),
      defasagem_meses: ajuste?.lag ?? null,
      correlacao_com_brent: arred(ajuste?.correlacao, 2),
      projecao_proximos_meses: projecao,
      serie_mensal: s,
    };
  });
  return {
    fonte: 'Comex Stat (MDIC) — importações brasileiras, dados oficiais. Preço = valor FOB / peso líquido (não inclui frete, seguro, impostos e margem do distribuidor).',
    leitura: 'Preço de importação subindo = mais espaço para repasse do produtor nacional; volume importado subindo = mais concorrência de importados.',
    posicoes: resultado,
  };
}
