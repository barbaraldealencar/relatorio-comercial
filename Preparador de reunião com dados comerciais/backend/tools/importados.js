// Importação de produtos acabados do segmento do cliente (Comex Stat / MDIC — dados públicos reais):
// unidades, peso e valor FOB por linha de produto (ex.: refrigeradores, lavadoras, air fryers, ventiladores)
// e a participação da China. Mostra a pressão de importados sobre a produção nacional do cliente.
import fs from 'node:fs/promises';
import path from 'node:path';
import { arred, DADOS, lerJson } from '../lib/dados.js';

const URL_COMEX = 'https://api-comexstat.mdic.gov.br/general?language=pt';
const chaveMes = d => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const pausa = ms => new Promise(r => setTimeout(r, ms));

// Consulta com cache diário em disco e nova tentativa no limite de consultas (HTTP 429)
async function consultar(nomeCache, body) {
  const arq = path.join(DADOS, 'cache', `${nomeCache}_${new Date().toISOString().slice(0, 10)}.json`);
  try { return JSON.parse(await fs.readFile(arq, 'utf8')); } catch { /* sem cache */ }
  let lista = null, ultimoErro;
  for (const espera of [0, 5000, 15000, 30000]) {
    if (espera) await pausa(espera);
    try {
      const r = await fetch(URL_COMEX, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(45000) });
      if (r.ok) { lista = (await r.json()).data?.list || []; break; }
      ultimoErro = new Error(`HTTP ${r.status}`);
      if (r.status !== 429 && r.status < 500) break;
    } catch (e) { ultimoErro = e; }
  }
  if (!lista) throw new Error(`Comex Stat indisponível (${ultimoErro?.message})`);
  await fs.mkdir(path.dirname(arq), { recursive: true }).catch(() => {});
  await fs.writeFile(arq, JSON.stringify(lista)).catch(() => {});
  return lista;
}

async function linhasDoSegmento(segmento) {
  const perfil = await lerJson(`setores/${segmento}.json`);
  if (!perfil.linhas_importacao?.length) throw new Error(`o segmento ${segmento} não tem linhas de produto acabado cadastradas`);
  return perfil.linhas_importacao;
}

export const definicao = {
  name: 'importacao_produtos_acabados',
  description:
    'Dados públicos reais do Comex Stat (MDIC): importação brasileira de PRODUTOS ACABADOS do segmento do cliente, por linha de produto ' +
    '(ex.: eletroportáteis → refrigeradores, lavadoras, micro-ondas, ar-condicionado, ventiladores, air fryers/fornos, liquidificadores, cafeteiras, cuidados pessoais). ' +
    'Mês a mês: unidades, valor FOB e preço médio por unidade; acumulado do ano e 12 meses contra o período anterior; participação da China. ' +
    'Importado crescendo = concorrência para a produção nacional do cliente (e para a resina que ele compra); preço do importado caindo = pressão sobre o preço dele no varejo.',
  input_schema: {
    type: 'object',
    properties: {
      segmento: { type: 'string', description: 'Segmento do cliente (arquivo em dados/setores/), ex.: "eletroportateis".' },
      meses: { type: 'integer', description: 'Meses de histórico mensal (padrão 24, máximo 36).' },
    },
    required: ['segmento'],
    additionalProperties: false,
  },
};

export async function executar({ segmento, meses = 24 }) {
  meses = Math.min(Math.max(12, meses | 0), 36);
  const linhas = await linhasDoSegmento(segmento);
  const sh6 = [...new Set(linhas.flatMap(l => l.sh6))];
  const linhaDe = Object.fromEntries(linhas.flatMap(l => l.sh6.map(c => [c, l.linha])));

  const fim = new Date();
  // Mês mais recente com dado: o Comex publica o mês anterior no início do mês seguinte
  const anoAtual = fim.getUTCFullYear();
  const ini = new Date(Date.UTC(anoAtual, fim.getUTCMonth() - meses - 12, 1)); // +12 meses para comparar 12m contra 12m
  const brutas = [];
  // A API aplica o mesmo intervalo de meses a cada ano; por isso, ano a ano e em sequência
  for (let y = ini.getUTCFullYear(); y <= anoAtual; y++) {
    if (brutas.length) await pausa(1500);
    brutas.push(...await consultar(`acabados_${segmento}_${y}`, {
      flow: 'import', monthDetail: true,
      period: { from: `${y}-01`, to: y === anoAtual ? chaveMes(fim) : `${y}-12` },
      filters: [{ filter: 'subHeading', values: sh6 }],
      details: ['ncm'], metrics: ['metricFOB', 'metricKG', 'metricStatistic'],
    }));
  }
  await pausa(1500);
  // Origem no acumulado do ano atual (participação da China)
  const porPais = await consultar(`acabados_${segmento}_paises_${anoAtual}`, {
    flow: 'import', monthDetail: false,
    period: { from: `${anoAtual}-01`, to: chaveMes(fim) },
    filters: [{ filter: 'subHeading', values: sh6 }],
    details: ['subHeading', 'country'], metrics: ['metricFOB'],
  });

  // Agrega NCM → linha, por mês
  const porLinha = {};
  for (const l of brutas) {
    const linha = linhaDe[String(l.coNcm).slice(0, 6)];
    if (!linha) continue;
    const mes = `${l.year}-${l.monthNumber}`;
    const m = ((porLinha[linha] ||= {})[mes] ||= { mes, unidades: 0, fob_US$: 0, kg: 0 });
    m.unidades += +l.metricStatistic || 0; m['fob_US$'] += +l.metricFOB || 0; m.kg += +l.metricKG || 0;
  }
  const ultimoMes = brutas.map(l => `${l.year}-${l.monthNumber}`).sort().pop();
  const [ua, um] = ultimoMes.split('-').map(Number);
  const mesesAte = (n, desloc = 0) => Array.from({ length: n }, (_, i) => chaveMes(new Date(Date.UTC(ua, um - 1 - desloc - i, 1))));
  const soma = (serie, lista, campo) => lista.reduce((t, k) => t + (serie[k]?.[campo] || 0), 0);
  const varPct = (a, b) => (a && b ? arred((a / b - 1) * 100, 1) : null);
  const ytd = Array.from({ length: um }, (_, i) => `${ua}-${String(i + 1).padStart(2, '0')}`);
  const ytdAnt = ytd.map(k => `${ua - 1}${k.slice(4)}`);

  const fobPais = {};
  for (const l of porPais) {
    const linha = linhaDe[String(l.subHeadingCode)];
    if (!linha) continue;
    const p = (fobPais[linha] ||= { total: 0, china: 0 });
    p.total += +l.metricFOB || 0;
    if (/^china$/i.test(l.country)) p.china += +l.metricFOB || 0;
  }

  const resultado = linhas.map(def => {
    const s = porLinha[def.linha] || {};
    const u12 = soma(s, mesesAte(12), 'unidades'), u12a = soma(s, mesesAte(12, 12), 'unidades');
    const uy = soma(s, ytd, 'unidades'), uya = soma(s, ytdAnt, 'unidades');
    const fy = soma(s, ytd, 'fob_US$'), fya = soma(s, ytdAnt, 'fob_US$');
    const china = fobPais[def.linha];
    return {
      grupo: def.grupo, linha: def.linha, produtos_sh6: def.sh6, relevancia_para_resina: def.resina,
      unidades_ano_ate_mes: Math.round(uy), unidades_ano_var_pct: varPct(uy, uya),
      unidades_12m: Math.round(u12), unidades_12m_var_pct: varPct(u12, u12a),
      fob_ano_US$_mi: arred(fy / 1e6, 1), fob_ano_var_pct: varPct(fy, fya),
      preco_medio_US$_un: uy ? arred(fy / uy, 1) : null, preco_medio_var_pct: varPct(uy && fy / uy, uya && fya / uya),
      participacao_china_pct: china?.total ? arred(china.china / china.total * 100, 0) : null,
      serie_mensal: mesesAte(meses).reverse().map(k => ({ mes: k, unidades: Math.round(s[k]?.unidades || 0), 'fob_US$_mi': arred((s[k]?.['fob_US$'] || 0) / 1e6, 2) })),
    };
  });
  return {
    fonte: 'Comex Stat (MDIC) — importações brasileiras de produtos acabados por NCM, dados oficiais. Unidades = quantidade estatística; valor FOB (sem frete, impostos e margem).',
    ultimo_mes: ultimoMes,
    acumulado_do_ano: `jan–${String(um).padStart(2, '0')}/${ua} contra o mesmo período de ${ua - 1}`,
    leitura: 'Unidades importadas crescendo = mais concorrência para quem fabrica no Brasil (menos produção local, menos resina). Preço médio do importado caindo = pressão sobre o preço de prateleira do cliente.',
    linhas: resultado,
  };
}
