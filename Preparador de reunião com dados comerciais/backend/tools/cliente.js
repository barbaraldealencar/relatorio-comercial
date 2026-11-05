// Análise quantitativa do histórico do cliente a partir da base Excel.
// Lê as colunas pelo nome do cabeçalho e recalcula tudo a partir dos dados de entrada (não depende das fórmulas da planilha).
import { carregarCliente, lerTabela, lerChaveValor, campo, arred, mesChave, dataIso } from '../lib/dados.js';

const soma = (arr, f) => arr.reduce((s, x) => s + (f(x) || 0), 0);
const media = arr => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null;
const pct = (a, b) => (b ? arred((a / b - 1) * 100, 1) : null);
export const addMeses = (d, n) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate()));

function lerPedidos(linhas) {
  return linhas.map(l => {
    const qtd = +campo(l, 'quantidade') || 0;
    const tabela = +campo(l, 'preco tabela') || 0;
    const desc = +campo(l, 'desconto') || 0;
    const data = campo(l, 'data pedido');
    const prazo = +campo(l, 'prazo') || 0;
    return {
      data, sku: campo(l, 'sku'), qtd, tabela, desc, liquido: tabela * (1 - desc), valor: qtd * tabela * (1 - desc),
      prazo, venc: data instanceof Date ? new Date(data.getTime() + prazo * 86400000) : null,
      pag: campo(l, 'data pagamento') || null, prevista: campo(l, 'entrega prevista') || null, real: campo(l, 'entrega real') || null,
      obs: campo(l, 'observacao') || '', planta: campo(l, 'planta') || '',
    };
  }).filter(p => p.data instanceof Date && p.sku);
}

// Elasticidade histórica: quanto a tabela variou (%) para cada 1% de variação do Brent em R$ no mês anterior.
export function elasticidade(tabelaPorMes, brentReaisPorMes) {
  const meses = Object.keys(tabelaPorMes).sort();
  const xs = [], ys = [];
  for (let i = 2; i < meses.length; i++) {
    const [m0, m1, m2] = [meses[i - 2], meses[i - 1], meses[i]];
    if (!brentReaisPorMes[m0] || !brentReaisPorMes[m1]) continue;
    xs.push(brentReaisPorMes[m1] / brentReaisPorMes[m0] - 1);
    ys.push(tabelaPorMes[m2] / tabelaPorMes[m1] - 1);
  }
  if (xs.length < 6) return null;
  const mx = media(xs), my = media(ys);
  const cov = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0), vx = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  return vx ? cov / vx : null;
}

export const definicao = {
  name: 'analisar_cliente',
  description:
    'Analisa o histórico quantitativo do cliente a partir da base Excel. Retorna: cadastro e condições comerciais; faturamento e volume por ano; ' +
    'para cada grade, volume (3m, 12m, a/a), preço líquido, desconto, share of wallet e previsão sazonal do próximo mês; preço de tabela vs petróleo em reais, ' +
    'com a elasticidade histórica e uma estimativa do reajuste do próximo mês pela fórmula; financeiro (títulos em aberto, vencidos, atrasos, limite); ' +
    'entregas e ocorrências de qualidade; últimas interações registradas. Use como base para a análise do cliente.',
  input_schema: {
    type: 'object',
    properties: { cliente: { type: 'string', description: 'Código do cliente (ex.: "mondial").' } },
    required: ['cliente'],
    additionalProperties: false,
  },
};

// Lê a base do cliente e organiza pedidos, tabela de preços e referências de mercado (usado também pela projeção).
export async function carregarHistorico(cliente) {
  const cfg = await carregarCliente(cliente);
  const arq = cfg.base_historica;
  const [leiame, cadastro, pedidosRaw, produtos, histPrecos, refs, share, interacoes] = await Promise.all([
    lerChaveValor(arq, 'Leia-me'),
    lerChaveValor(arq, 'Cadastro_Cliente'),
    lerTabela(arq, 'Pedidos'),
    lerTabela(arq, 'Produtos'),
    lerTabela(arq, 'Historico_Precos'),
    lerTabela(arq, 'Referencias_Mercado').catch(() => []),
    lerTabela(arq, 'Share_of_Wallet').catch(() => []),
    lerTabela(arq, 'Interacoes').catch(() => []),
  ]);
  const pedidos = lerPedidos(pedidosRaw);
  const dataBase = leiame['Data-base dos dados'] instanceof Date ? leiame['Data-base dos dados'] : new Date(Math.max(...pedidos.map(p => p.data)));

  const colMes = histPrecos.length ? Object.keys(histPrecos[0])[0] : null;
  const tabelaPorSku = {};
  for (const linha of histPrecos) {
    const d = linha[colMes]; if (!(d instanceof Date)) continue;
    for (const [k, v] of Object.entries(linha)) if (k !== colMes && typeof v === 'number') (tabelaPorSku[k] ||= {})[mesChave(d)] = v;
  }
  const brentReais = {}; const refsRecentes = [];
  for (const r of refs) {
    const d = campo(r, 'mes'); if (!(d instanceof Date)) continue;
    const b = +campo(r, 'brent'), fx = +campo(r, 'dolar');
    brentReais[mesChave(d)] = b * fx;
    refsRecentes.push({ mes: mesChave(d), brent_US$_bbl: arred(b), dolar: arred(fx, 4), brent_R$_bbl: arred(b * fx), nafta_US$_t: campo(r, 'nafta'), pp_asia_US$_t: campo(r, 'pp asia'), ps_asia_US$_t: campo(r, 'ps asia'), ...(campo(r, 'pead eua') ? { pead_eua_US$_t: campo(r, 'pead eua') } : {}) });
  }
  return { cfg, leiame, cadastro, pedidos, produtos, tabelaPorSku, brentReais, refsRecentes, share, interacoes, dataBase };
}

export async function executar({ cliente }) {
  const { cfg, cadastro, pedidos, produtos, tabelaPorSku, brentReais, refsRecentes, share, interacoes, dataBase } = await carregarHistorico(cliente);
  const ultimoMes = mesChave(dataBase);
  const proximoMes = mesChave(addMeses(dataBase, 1));
  const desde = (meses) => addMeses(dataBase, -meses);
  const entre = (p, ini, fim) => p.data > ini && p.data <= fim;

  // ---- Visão anual ----
  const anos = [...new Set(pedidos.map(p => p.data.getUTCFullYear()))].sort();
  const anual = anos.map(ano => {
    const ps = pedidos.filter(p => p.data.getUTCFullYear() === ano);
    const fat = soma(ps, p => p.valor), vol = soma(ps, p => p.qtd), bruto = soma(ps, p => p.qtd * p.tabela);
    return { ano, faturamento_R$: arred(fat, 0), volume_t: arred(vol / 1000, 0), preco_liquido_medio_R$_kg: arred(fat / vol), desconto_medio_ponderado_pct: arred((1 - fat / bruto) * 100, 1), meses_com_dados: new Set(ps.map(p => mesChave(p.data))).size };
  });

  // ---- Por grade ----
  const shareMap = Object.fromEntries(share.map(s => [campo(s, 'sku'), s]));
  const grades = produtos.map(prod => {
    const sku = campo(prod, 'sku');
    const ps = pedidos.filter(p => p.sku === sku);
    const u3 = ps.filter(p => entre(p, desde(3), dataBase));
    const u12 = ps.filter(p => entre(p, desde(12), dataBase));
    const a12 = ps.filter(p => entre(p, desde(24), desde(12)));
    const volU12 = soma(u12, p => p.qtd), volA12 = soma(a12, p => p.qtd);
    const tab = tabelaPorSku[sku] || {};
    const mesesTab = Object.keys(tab).sort();
    const tabelaAtual = tab[mesesTab[mesesTab.length - 1]];
    const tab3 = tab[mesChave(desde(3))], tab12 = tab[mesChave(desde(12))];
    const el = elasticidade(tab, brentReais);
    const varBrentUltimoMes = brentReais[ultimoMes] && brentReais[mesChave(desde(1))] ? brentReais[ultimoMes] / brentReais[mesChave(desde(1))] - 1 : null;
    // Previsão sazonal: volume do mesmo mês no ano anterior × crescimento a/a dos últimos 12 meses.
    const [py, pm] = proximoMes.split('-').map(Number);
    const volMesAnoAnterior = soma(ps.filter(p => p.data.getUTCFullYear() === py - 1 && p.data.getUTCMonth() + 1 === pm), p => p.qtd);
    const crescimento = volA12 ? volU12 / volA12 : 1;
    const sw = shareMap[sku];
    return {
      sku, descricao: campo(prod, 'descricao'), familia: campo(prod, 'familia'), aplicacao: campo(prod, 'aplicacao'),
      volume_ultimos_3m_t: arred(soma(u3, p => p.qtd) / 1000, 0),
      volume_ultimos_12m_t: arred(volU12 / 1000, 0),
      volume_12m_anteriores_t: arred(volA12 / 1000, 0),
      variacao_volume_aa_pct: pct(volU12, volA12),
      faturamento_ultimos_12m_R$: arred(soma(u12, p => p.valor), 0),
      preco_tabela_atual_R$_kg: tabelaAtual,
      preco_tabela_var_3m_pct: pct(tabelaAtual, tab3),
      preco_tabela_var_12m_pct: pct(tabelaAtual, tab12),
      preco_liquido_medio_3m_R$_kg: arred(soma(u3, p => p.valor) / soma(u3, p => p.qtd)),
      desconto_medio_3m_pct: arred((1 - soma(u3, p => p.valor) / soma(u3, p => p.qtd * p.tabela)) * 100, 1),
      desconto_medio_12m_anteriores_pct: arred((1 - soma(a12, p => p.valor) / soma(a12, p => p.qtd * p.tabela)) * 100, 1),
      elasticidade_tabela_vs_brent_reais: arred(el, 2),
      reajuste_estimado_proximo_mes_pct: el !== null && varBrentUltimoMes !== null ? arred(el * varBrentUltimoMes * 100, 1) : null,
      previsao_volume_proximo_mes_t: volMesAnoAnterior ? arred(volMesAnoAnterior * crescimento / 1000, 0) : null,
      share_of_wallet_pct: sw ? arred((campo(sw, 'nosso volume') ?? volU12) / campo(sw, 'consumo') * 100, 1) : null,
      consumo_estimado_cliente_t_ano: sw ? arred(campo(sw, 'consumo') / 1000, 0) : null,
      principal_concorrente: sw ? campo(sw, 'principal concorrente') : null,
    };
  });

  // ---- Financeiro ----
  const naoPagos = pedidos.filter(p => !p.pag && p.venc);
  const vencidos = naoPagos.filter(p => p.venc < dataBase);
  const pagos12 = pedidos.filter(p => p.pag && entre(p, desde(12), dataBase));
  const pagosAnt = pedidos.filter(p => p.pag && entre(p, desde(24), desde(12)));
  const atrasos = ps => ps.map(p => Math.max(0, Math.round((p.pag - p.venc) / 86400000)));
  const at12 = atrasos(pagos12), atAnt = atrasos(pagosAnt);
  const aberto = soma(naoPagos, p => p.valor);
  const limite = +Object.entries(cadastro).find(([k]) => /limite/i.test(k))?.[1] || null;
  const financeiro = {
    prazo_pagamento_atual_dias: pedidos[pedidos.length - 1]?.prazo,
    titulos_em_aberto_R$: arred(aberto, 0),
    titulos_vencidos_R$: arred(soma(vencidos, p => p.valor), 0),
    titulos_vencidos_qtd: vencidos.length,
    limite_credito_R$: limite,
    utilizacao_limite_pct: limite ? arred(aberto / limite * 100, 1) : null,
    pct_pagamentos_com_atraso_12m: arred(at12.filter(x => x > 0).length / (at12.length || 1) * 100, 1),
    pct_pagamentos_com_atraso_12m_anteriores: arred(atAnt.filter(x => x > 0).length / (atAnt.length || 1) * 100, 1),
    atraso_medio_quando_atrasa_12m_dias: arred(media(at12.filter(x => x > 0)), 1),
    custo_financeiro_estimado_do_prazo: 'calcule com a Selic: valor mensal × (Selic/360 × dias de prazo)',
  };

  // ---- Entregas e qualidade ----
  const ent12 = pedidos.filter(p => p.real && p.prevista && entre(p, desde(12), dataBase));
  const entregas = {
    pct_no_prazo_12m: arred(ent12.filter(p => p.real <= p.prevista).length / (ent12.length || 1) * 100, 1),
    ocorrencias_ultimos_24m: pedidos.filter(p => p.obs && entre(p, desde(24), dataBase)).map(p => ({ data: dataIso(p.data), sku: p.sku, ocorrencia: p.obs }))
      .filter((o, i, arr) => arr.findIndex(x => x.ocorrencia === o.ocorrencia && x.data.slice(0, 7) === o.data.slice(0, 7)) === i),
  };

  // ---- Totais recentes ----
  const u12 = pedidos.filter(p => entre(p, desde(12), dataBase)), a12 = pedidos.filter(p => entre(p, desde(24), desde(12)));
  const u3 = pedidos.filter(p => entre(p, desde(3), dataBase));

  return {
    cliente: cfg.nome,
    dados_ficticios: !!cfg.dados_ficticios,
    data_base: dataIso(dataBase),
    mes_da_proxima_negociacao: proximoMes,
    cadastro: Object.fromEntries(Object.entries(cadastro).filter(([k]) => k !== 'Cadastro do Cliente').map(([k, v]) => [k, v instanceof Date ? dataIso(v) : v])),
    totais: {
      faturamento_ultimos_12m_R$: arred(soma(u12, p => p.valor), 0),
      faturamento_12m_anteriores_R$: arred(soma(a12, p => p.valor), 0),
      variacao_faturamento_aa_pct: pct(soma(u12, p => p.valor), soma(a12, p => p.valor)),
      volume_ultimos_12m_t: arred(soma(u12, p => p.qtd) / 1000, 0),
      variacao_volume_aa_pct: pct(soma(u12, p => p.qtd), soma(a12, p => p.qtd)),
      faturamento_medio_mensal_ultimos_3m_R$: arred(soma(u3, p => p.valor) / 3, 0),
    },
    anual,
    grades,
    referencias_mercado_ultimos_13m: refsRecentes.slice(-13),
    financeiro,
    entregas,
    ultimas_interacoes: interacoes.slice(-8).reverse().map(i => ({ data: dataIso(campo(i, 'data')), tipo: campo(i, 'tipo'), resumo: campo(i, 'resumo') })),
  };
}
