// Gera o JSON do painel visual a partir de um briefing:
//   - "graficos": dados numéricos tirados direto das ferramentas (determinísticos, sem passar pelo modelo)
//   - "insights": o modelo resume o briefing em blocos curtos e estruturados (ferramenta publicar_painel)
//
// Uso isolado (a partir do último briefing salvo):
//   node agentes/gerar_painel.js --cliente mondial
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { RAIZ, carregarCliente, arred, mesChave } from '../lib/dados.js';
import * as macro from '../tools/macro.js';
import * as projecoes from '../tools/projecoes.js';
import * as cliente from '../tools/cliente.js';
import * as peers from '../tools/peers.js';
import * as projCliente from '../tools/projecao_cliente.js';
import { exportarPainel } from '../scripts/exportar_painel.js';

const PASTA_RELATORIOS = path.resolve(RAIZ, '..', 'relatorios');

// ---------------------------------------------------------------------------
// Ferramenta que o modelo usa para entregar os insights estruturados
// ---------------------------------------------------------------------------
const textos = { type: 'array', items: { type: 'string' } };
const manchetes = {
  type: 'array',
  items: {
    type: 'object',
    properties: { titulo: { type: 'string' }, veiculo: { type: 'string' }, data: { type: 'string' }, implicacao: { type: 'string', description: 'O "e daí?" para a negociação, em 1 frase.' } },
    required: ['titulo', 'veiculo', 'data', 'implicacao'],
  },
};
const blocoBase = (extra = {}, req = []) => ({
  type: 'object',
  properties: { mensagem: { type: 'string', description: 'A mensagem central do bloco em 1 frase (máx. ~25 palavras).' }, insights: { ...textos, description: '3 a 5 insights objetivos, cada um com um número.' }, ...extra },
  required: ['mensagem', 'insights', ...req],
});

const PUBLICAR_PAINEL = {
  name: 'publicar_painel',
  description: 'Publica o conteúdo do painel visual da reunião, organizado em blocos. Frases curtas, objetivas, com números e unidades. Não invente nada que não esteja no briefing.',
  input_schema: {
    type: 'object',
    properties: {
      postura_recomendada: { type: 'string', description: 'A postura para a reunião em 1 frase.' },
      mensagem_central: { type: 'string', description: 'A ideia mais importante do briefing em 1 frase.' },
      kpis: {
        type: 'array', description: '4 a 6 números-chave para o topo do painel.',
        items: { type: 'object', properties: { rotulo: { type: 'string' }, valor: { type: 'string' }, detalhe: { type: 'string' }, tom: { type: 'string', enum: ['positivo', 'negativo', 'atencao', 'neutro'] } }, required: ['rotulo', 'valor', 'detalhe', 'tom'] },
      },
      resumo: textos,
      macro: blocoBase({ manchetes }, ['manchetes']),
      setor: blocoBase({
        demanda_3m: { type: 'string', enum: ['alta', 'estável', 'queda'] },
        poder_barganha_cliente: { type: 'string', enum: ['alto', 'médio', 'baixo'] },
        justificativa: { type: 'string' },
        manchetes,
      }, ['demanda_3m', 'poder_barganha_cliente', 'justificativa', 'manchetes']),
      cliente: blocoBase({ alertas: textos }, ['alertas']),
      peers: blocoBase(),
      projecoes: blocoBase({ ja_definido: { type: 'string', description: 'O que já está definido (não depende de projeção).' }, incerto: { type: 'string' }, implicacao_estrategica: { type: 'string' } }, ['ja_definido', 'incerto', 'implicacao_estrategica']),
      relacionamento: {
        type: 'object',
        properties: {
          mensagem: { type: 'string' },
          tom_atual: { type: 'string', enum: ['positivo', 'neutro', 'tenso'] },
          linha_do_tempo: { type: 'array', items: { type: 'object', properties: { data: { type: 'string', description: 'AAAA-MM-DD' }, evento: { type: 'string' }, tom: { type: 'string', enum: ['positivo', 'neutro', 'negativo'] } }, required: ['data', 'evento', 'tom'] } },
          pendencias: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, responsavel: { type: 'string', enum: ['nós', 'cliente'] }, situacao: { type: 'string', enum: ['atrasada', 'em aberto', 'concluída'] }, desde: { type: 'string' } }, required: ['item', 'responsavel', 'situacao'] } },
        },
        required: ['mensagem', 'tom_atual', 'linha_do_tempo', 'pendencias'],
      },
      oportunidades: {
        type: 'array',
        items: { type: 'object', properties: { titulo: { type: 'string' }, evidencia: { type: 'string' }, valor_mensal_reais: { type: 'number', description: 'Estimativa em R$/mês (número). Use 0 se não houver.' }, valor_texto: { type: 'string', description: 'Como apresentar o valor (ex.: "R$ 3,0 mi no mês").' }, dificuldade: { type: 'string', enum: ['baixa', 'média', 'alta'] }, proposta: { type: 'string' } }, required: ['titulo', 'evidencia', 'valor_mensal_reais', 'valor_texto', 'dificuldade', 'proposta'] },
      },
      roteiro: {
        type: 'object',
        properties: {
          objetivo: { type: 'string' },
          walk_away: textos,
          abertura: { type: 'string' },
          argumentos: { type: 'array', items: { type: 'object', properties: { argumento: { type: 'string' }, dado: { type: 'string' } }, required: ['argumento', 'dado'] } },
          objecoes: { type: 'array', items: { type: 'object', properties: { objecao: { type: 'string' }, resposta: { type: 'string' } }, required: ['objecao', 'resposta'] } },
          concessoes: { type: 'array', items: { type: 'object', properties: { damos: { type: 'string' }, recebemos: { type: 'string' } }, required: ['damos', 'recebemos'] } },
          perguntas: textos,
        },
        required: ['objetivo', 'walk_away', 'abertura', 'argumentos', 'objecoes', 'concessoes', 'perguntas'],
      },
      riscos: { type: 'array', items: { type: 'object', properties: { risco: { type: 'string' }, probabilidade: { type: 'string', enum: ['baixa', 'média', 'alta'] }, impacto: { type: 'string' }, mitigacao: { type: 'string' } }, required: ['risco', 'probabilidade', 'impacto', 'mitigacao'] } },
      proximos_passos: { type: 'array', items: { type: 'object', properties: { quando: { type: 'string', enum: ['antes', 'na reunião', 'depois'] }, acao: { type: 'string' } }, required: ['quando', 'acao'] } },
    },
    required: ['postura_recomendada', 'mensagem_central', 'kpis', 'resumo', 'macro', 'setor', 'cliente', 'peers', 'projecoes', 'relacionamento', 'oportunidades', 'roteiro', 'riscos', 'proximos_passos'],
  },
};

async function extrairInsights(claude, MODELO, markdown) {
  const mensagens = [{
    role: 'user',
    content: `Abaixo está o briefing de uma reunião comercial. Transforme-o no conteúdo do painel visual chamando a ferramenta publicar_painel.\n` +
      `Regras: frases curtas e objetivas (uma ideia por frase), sempre com o número que sustenta; nada que não esteja no briefing; português do Brasil.\n\n<briefing>\n${markdown}\n</briefing>`,
  }];
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const resposta = await claude.messages.stream({
      model: MODELO,
      max_tokens: 32000,
      tools: [PUBLICAR_PAINEL],
      messages: mensagens,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
    }).finalMessage();
    if (resposta.stop_reason === 'refusal') throw new Error('O modelo recusou gerar o painel.');
    const chamada = resposta.content.find(b => b.type === 'tool_use' && b.name === 'publicar_painel');
    if (chamada && typeof chamada.input === 'object' && chamada.input.kpis) return chamada.input;
    mensagens.push({ role: 'assistant', content: resposta.content }, { role: 'user', content: 'Use a ferramenta publicar_painel para entregar o conteúdo.' });
  }
  throw new Error('O modelo não entregou o conteúdo do painel.');
}

// ---------------------------------------------------------------------------
// Dados dos gráficos (determinísticos)
// ---------------------------------------------------------------------------
export async function dadosGraficos(idCliente, cenariosExtras = []) {
  const [mac, proj, cli, prs, hist] = await Promise.all([
    macro.executar(),
    projecoes.executar(),
    cliente.executar({ cliente: idCliente }),
    peers.executar({ cliente: idCliente }),
    cliente.carregarHistorico(idCliente),
  ]);
  const projPadrao = await projCliente.executar({ cliente: idCliente, meses: 3 });
  let cenarios = projPadrao.cenarios;
  if (cenariosExtras.length) {
    const extra = await projCliente.executar({ cliente: idCliente, meses: 3, cenarios: cenariosExtras });
    const nomes = new Set(cenarios.map(c => c.cenario));
    cenarios = [...cenarios, ...extra.cenarios.filter(c => !nomes.has(c.cenario))];
  }

  // Tabela média ponderada (pesos = volume 12m de cada grade) vs Brent em R$, últimos 13 meses
  const pesos = Object.fromEntries(cli.grades.map(g => [g.sku, g.volume_ultimos_12m_t || 0]));
  const somaPesos = Object.values(pesos).reduce((s, x) => s + x, 0) || 1;
  const meses13 = cli.referencias_mercado_ultimos_13m.map(r => r.mes);
  const tabelaMedia = meses13.map(m => {
    let s = 0, w = 0;
    for (const [sku, p] of Object.entries(pesos)) { const v = hist.tabelaPorSku[sku]?.[m]; if (v) { s += v * p; w += p; } }
    return w ? s / w : null;
  });
  const brentR = cli.referencias_mercado_ultimos_13m.map(r => r['brent_R$_bbl']);
  const indice = arr => arr.map(v => (v && arr[0] ? arred(v / arr[0] * 100, 1) : null));

  // Histórico de volume mensal (t) por grade, para ver se estamos ganhando ou perdendo volume
  const mesesVol = [...new Set(hist.pedidos.map(p => mesChave(p.data)))].sort();
  const volPorSku = {};
  for (const p of hist.pedidos) { const arr = (volPorSku[p.sku] ||= Object.fromEntries(mesesVol.map(m => [m, 0]))); arr[mesChave(p.data)] += p.qtd / 1000; }
  const historicoVolume = {
    meses: mesesVol,
    data_base: hist.dataBase.toISOString().slice(0, 10),
    por_grade: Object.fromEntries(Object.entries(volPorSku).map(([sku, arr]) => [sku, mesesVol.map(m => arred(arr[m], 1))])),
    total: mesesVol.map(m => arred(Object.values(volPorSku).reduce((s, arr) => s + arr[m], 0), 1)),
  };

  return {
    macro_tiles: {
      brent: mac.global.brent, wti: mac.global.wti, dolar: mac.brasil.dolar_ptax, selic: mac.brasil.selic_meta, ipca: mac.brasil.ipca_12m,
    },
    brent_historico: cli.referencias_mercado_ultimos_13m.map(r => ({ mes: r.mes, brent: r['brent_US$_bbl'], dolar: r.dolar })),
    tabela_vs_brent: { meses: meses13, tabela_media_R$_kg: tabelaMedia.map(v => arred(v)), brent_R$_bbl: brentR, indice_tabela: indice(tabelaMedia), indice_brent_reais: indice(brentR) },
    brent_projecao: {
      curva_futura: (Array.isArray(proj.brent_curva_futura) ? proj.brent_curva_futura : []).map(c => ({ mes: c.contrato, valor: c['preco_US$_bbl'], desatualizado: !!c.aviso })),
      eia: (Array.isArray(proj.brent_wti_projecao_eia) ? proj.brent_wti_projecao_eia : []).map(e => ({ mes: e.mes, valor: e['brent_US$_bbl'] })),
    },
    focus: proj.focus,
    cliente_totais: cli.totais,
    financeiro: cli.financeiro,
    entregas_no_prazo_pct: cli.entregas.pct_no_prazo_12m,
    grades: cli.grades.map(g => ({
      sku: g.sku, descricao: g.descricao, volume_12m_t: g.volume_ultimos_12m_t, variacao_aa_pct: g.variacao_volume_aa_pct,
      share_pct: g.share_of_wallet_pct, reajuste_proximo_mes_pct: g.reajuste_estimado_proximo_mes_pct, desconto_3m_pct: g.desconto_medio_3m_pct,
      tabela_atual: g['preco_tabela_atual_R$_kg'], concorrente: g.principal_concorrente,
    })),
    peers: { trimestre: prs.trimestre_referencia, comparacao: prs.comparacao.filter(c => c.gap_vs_mediana_pct !== undefined) },
    cenarios: cenarios.map(c => ({ cenario: c.cenario, meses: c.meses, faturamento_periodo: c['faturamento_liquido_periodo_R$'], valor_repasse: c['valor_do_repasse_vs_tabela_congelada_R$'] })),
    historico_volume: historicoVolume,
  };
}

// ---------------------------------------------------------------------------
export async function gerarPainel({ claude, MODELO, idCliente, markdown, data, dataReuniao, cenariosExtras = [] }) {
  const cfg = await carregarCliente(idCliente);
  const [insights, graficos] = await Promise.all([extrairInsights(claude, MODELO, markdown), dadosGraficos(idCliente, cenariosExtras)]);
  const painel = {
    meta: { cliente: cfg.nome, id: cfg.id, segmento: cfg.segmento, kam: cfg.kam, gerado_em: data, data_reuniao: dataReuniao || null, modelo: MODELO, dados_ficticios: !!cfg.dados_ficticios },
    insights,
    graficos,
  };
  const arquivo = path.join(PASTA_RELATORIOS, `painel_${cfg.id}_${data}.json`);
  await fs.writeFile(arquivo, JSON.stringify(painel, null, 2), 'utf8');
  // Versões para enviar por e-mail: HTML único (abre offline) e PDF
  const exportado = await exportarPainel(arquivo, { pdf: true }).catch(e => ({ avisoPdf: `Exportação falhou: ${e.message}` }));
  if (exportado.html) console.log(`
  Para e-mail: ${exportado.html}`);
  if (exportado.pdf) console.log(`  PDF: ${exportado.pdf}`);
  if (exportado.avisoPdf) console.log(`  ${exportado.avisoPdf}`);
  return arquivo;
}

// Execução direta: usa o briefing .md mais recente do cliente
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.loadEnvFile(path.join(RAIZ, '.env')); } catch { /* usa variáveis do terminal */ }
  const { criarCliente, explicarErro, MODELO } = await import('../lib/claude.js');
  const { values: args } = parseArgs({ options: { cliente: { type: 'string', default: 'mondial' }, data: { type: 'string' }, 'so-graficos': { type: 'boolean', default: false } } });
  try {
    const cfg = await carregarCliente(args.cliente);
    if (args['so-graficos']) {
      // Atualiza só os dados dos gráficos do painel mais recente (sem chamar o modelo; mantém os textos e os cenários extras)
      const jsons = (await fs.readdir(PASTA_RELATORIOS)).filter(f => f.startsWith(`painel_${cfg.id}_`) && f.endsWith('.json')).sort();
      if (!jsons.length) throw new Error(`Nenhum painel de ${cfg.nome} para atualizar.`);
      const arquivo = path.join(PASTA_RELATORIOS, jsons[jsons.length - 1]);
      const painel = JSON.parse(await fs.readFile(arquivo, 'utf8'));
      const novos = await dadosGraficos(cfg.id);
      const nomes = new Set(novos.cenarios.map(c => c.cenario));
      novos.cenarios.push(...(painel.graficos.cenarios || []).filter(c => !nomes.has(c.cenario)));
      painel.graficos = novos;
      await fs.writeFile(arquivo, JSON.stringify(painel, null, 2), 'utf8');
      await exportarPainel(arquivo, { pdf: true });
      console.log(`✔ Gráficos atualizados em ${arquivo}`);
      process.exit(0);
    }
    const mds = (await fs.readdir(PASTA_RELATORIOS)).filter(f => f.startsWith(`briefing_${cfg.id}_`) && f.endsWith('.md') && !f.includes('_perguntas')).sort();
    if (!mds.length) throw new Error(`Nenhum briefing de ${cfg.nome} em relatorios/. Rode primeiro: npm run briefing -- --cliente ${cfg.id}`);
    const ultimo = mds[mds.length - 1];
    const data = ultimo.match(/_(\d{4}-\d{2}-\d{2})\.md$/)[1];
    console.log(`Gerando painel a partir de ${ultimo}...`);
    const arquivo = await gerarPainel({ claude: criarCliente(), MODELO, idCliente: cfg.id, markdown: await fs.readFile(path.join(PASTA_RELATORIOS, ultimo), 'utf8'), data, dataReuniao: args.data });
    console.log(`✔ Painel salvo em ${arquivo}\n  Para ver: npm run painel  (e abra http://localhost:3000)`);
  } catch (e) {
    console.error(`Erro: ${explicarErro(e)}`);
    process.exit(1);
  }
}
