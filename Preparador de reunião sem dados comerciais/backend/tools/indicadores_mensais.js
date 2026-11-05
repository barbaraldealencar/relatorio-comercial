// Painel macro mensal: Brent, câmbio, frete internacional e referências internacionais de PE e PP.
// Para cada variável: os últimos 12 meses, o mês n, o mês n-1 e a variação entre os dois.
// Brent e câmbio têm dado diário: o mês corrente entra como PARCIAL (média até o último dia com cotação).
// Frete e resinas vêm do Comex, que publica o mês anterior só no início do mês seguinte.
import { arred } from '../lib/dados.js';
import { buscar } from './macro.js';
import * as comex from './comex.js';

const MESES = 12;
// Últimos 12 meses de cotações diárias, para os gráficos de Brent e câmbio
const ultimoAno = (diaria, casas) => {
  const corte = new Date(); corte.setUTCFullYear(corte.getUTCFullYear() - 1);
  const ini = corte.toISOString().slice(0, 10);
  return (diaria || []).filter(x => x.data >= ini).map(x => ({ data: x.data, valor: arred(x.valor, casas) }));
};
const chaveMes = d => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const isoDeBr = s => { const [d, m, y] = s.split('/'); return `${y}-${m}-${d}`; };

async function sgs(codigo, dataInicial) {
  const r = await buscar(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados?formato=json&dataInicial=${dataInicial}`, { headers: { Accept: 'application/json' } });
  return (await r.json()).map(({ data, valor }) => ({ data: isoDeBr(data), valor: parseFloat(valor) })).filter(x => isFinite(x.valor));
}

// Dólar PTAX: média mensal dos meses fechados (SGS 3698) + mês corrente parcial pela PTAX diária (SGS 1)
async function cambioMensal() {
  const ini = new Date(); ini.setUTCMonth(ini.getUTCMonth() - 16);
  const mesAtual = chaveMes(new Date());
  const [mensal, diario] = await Promise.all([
    sgs(3698, `01/${String(ini.getUTCMonth() + 1).padStart(2, '0')}/${ini.getUTCFullYear()}`),
    sgs(1, `01/${String(ini.getUTCMonth() + 1).padStart(2, '0')}/${ini.getUTCFullYear()}`),
  ]);
  const medias = Object.fromEntries(mensal.map(x => [x.data.slice(0, 7), x.valor]));
  const doMes = diario.filter(x => x.data.startsWith(mesAtual));
  if (doMes.length && !medias[mesAtual]) medias[mesAtual] = doMes.reduce((s, x) => s + x.valor, 0) / doMes.length;
  Object.defineProperty(medias, 'ultimoDia', { value: diario[diario.length - 1] || null, enumerable: false });
  Object.defineProperty(medias, 'diaria', { value: diario, enumerable: false });
  return medias;
}

// Série a partir de {mes: valor}: últimos 12 meses, mês n, n-1 e variação.
// "parcialAte" marca o mês n como parcial (média até essa data).
function serie(nome, porMes, casas, parcialAte = null) {
  const meses = Object.keys(porMes).filter(k => /^\d{4}-\d{2}$/.test(k) && isFinite(porMes[k]) && porMes[k] !== null).sort().slice(-MESES);
  const pontos = meses.map(mes => ({ mes, valor: arred(porMes[mes], casas) }));
  const n = pontos[pontos.length - 1], n1 = pontos[pontos.length - 2];
  if (n && parcialAte && parcialAte.startsWith(n.mes)) Object.assign(n, { parcial: true, ate: parcialAte });
  return {
    nome, serie: pontos, n: n || null, n_1: n1 || null,
    var_abs: n && n1 ? arred(n.valor - n1.valor, casas) : null,
    var_pct: n && n1 && n1.valor ? arred((n.valor / n1.valor - 1) * 100, 1) : null,
  };
}

export const definicao = {
  name: 'indicadores_mensais',
  description:
    'Painel macro mensal com dados públicos reais, para o bloco de macro e o resumo: Brent (US$/bbl, média do mês), câmbio (R$/US$, PTAX média do mês), ' +
    'frete internacional da importação de PE e PP (US$/t, Comex Stat) e referências internacionais de resina (preço FOB de importação de PE e PP, US$/t). ' +
    'Para cada variável traz os últimos 12 meses, o mês n, o mês n-1 e a variação absoluta e percentual. Brent e câmbio incluem o mês corrente como parcial ' +
    '(campo "parcial" e "ate") e o último dia com cotação; frete e resinas param no último mês publicado pelo Comex.',
  input_schema: {
    type: 'object',
    properties: { posicoes: { type: 'array', items: { type: 'string', enum: ['3901', '3902'] }, description: 'Resina do cliente: 3901 (PE) ou 3902 (PP). Cada cliente usa uma resina só.' } },
    additionalProperties: false,
  },
};

const NOMES = { '3901': 'PE', '3902': 'PP' };

export async function executar({ posicoes = ['3901', '3902'] } = {}) {
  const tentar = async fn => { try { return await fn(); } catch (e) { return { erro: e.message }; } };
  const [brent, cambio, imp] = await Promise.all([tentar(comex.brentMensal), tentar(cambioMensal), tentar(() => comex.executar({ posicoes: ['3901', '3902'], meses: 14 }))]);
  const deResina = campo => Object.fromEntries((imp.posicoes || []).map(p => [p.posicao, Object.fromEntries((p.serie_mensal || []).map(m => [m.mes, m[campo]]))]));
  const frete = deResina('frete_US$_t'), preco = deResina('preco_US$_t'), fretePct = deResina('frete_pct_cif');
  const notaComex = 'o mês seguinte sai no início do próximo mês';
  const variaveis = [
    { id: 'brent', nome: 'Brent', unidade: 'US$/bbl', fonte: 'FRED (ou Yahoo Finance), média mensal', series: brent.erro ? [] : [serie('Brent', brent, 2, brent.ultimoDia?.data)], ultimo_dia: brent.ultimoDia || null, serie_diaria: brent.erro ? [] : ultimoAno(brent.diaria, 2), erro: brent.erro },
    { id: 'cambio', nome: 'Câmbio', unidade: 'R$/US$', fonte: 'Banco Central, PTAX média mensal', series: cambio.erro ? [] : [serie('Dólar PTAX', cambio, 4, cambio.ultimoDia?.data)], ultimo_dia: cambio.ultimoDia || null, serie_diaria: cambio.erro ? [] : ultimoAno(cambio.diaria, 4), erro: cambio.erro },
    { id: 'frete', nome: 'Frete internacional', unidade: 'US$/t', fonte: `Comex Stat: frete pago na importação ÷ toneladas (${notaComex})`, series: imp.erro ? [] : posicoes.map(p => serie(NOMES[p], frete[p] || {}, 0)), erro: imp.erro,
      peso_no_preco_pct: imp.erro ? null : Object.fromEntries(posicoes.map(p => [NOMES[p], serie(NOMES[p], fretePct[p] || {}, 1).n])) },
    { id: 'resinas', nome: 'Referência de preço da resina', unidade: 'US$/t', fonte: `Preço FOB médio das importações brasileiras (Comex Stat/MDIC, NCM ${posicoes.join(' e ')}) — não é cotação de agência (ICIS, Platts); ${notaComex}`, series: imp.erro ? [] : posicoes.map(p => serie(NOMES[p], preco[p] || {}, 0)), erro: imp.erro },
  ];
  return {
    leitura: 'Frete e câmbio entram no custo do importado que chega ao Brasil (preço CIF em reais): frete subindo ou real desvalorizando encarecem o importado e dão espaço ao preço local.',
    variaveis,
  };
}
