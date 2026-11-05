// Gera o JSON do painel visual (versão só com informações públicas):
//   - "graficos": números tirados direto das fontes públicas (determinísticos)
//   - "insights": o modelo resume o briefing em blocos curtos (ferramenta publicar_painel)
//
// Uso isolado (a partir do último briefing salvo):  node agentes/gerar_painel.js --cliente mondial
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { RAIZ, carregarCliente, lerJson, arred } from '../lib/dados.js';
import * as macro from '../tools/macro.js';
import * as projecoes from '../tools/projecoes.js';
import * as comex from '../tools/comex.js';
import * as ibge from '../tools/ibge.js';
import * as empresas from '../tools/empresas.js';
import * as perfil from '../tools/perfil.js';
import * as importados from '../tools/importados.js';
import * as indicadoresMensais from '../tools/indicadores_mensais.js';
import { notasParaSegmento } from '../lib/notas.js';
import { exportarPainel } from '../scripts/exportar_painel.js';

const PASTA_RELATORIOS = path.resolve(RAIZ, '..', 'relatorios');

// ---------------------------------------------------------------------------
const textos = { type: 'array', items: { type: 'string' } };
// Bullets curtos: no máximo 3 por bloco, uma linha cada
const bullets = { type: 'array', maxItems: 3, items: { type: 'string' }, description: 'No máximo 3 bullets, uma linha cada (até ~15 palavras), sempre com número e fonte.' };
const manchetes = {
  type: 'array',
  items: { type: 'object', properties: { titulo: { type: 'string' }, veiculo: { type: 'string' }, data: { type: 'string' }, implicacao: { type: 'string' } }, required: ['titulo', 'veiculo', 'data', 'implicacao'] },
};
const blocoBase = (extra = {}, req = []) => ({
  type: 'object',
  properties: { mensagem: { type: 'string', description: 'Mensagem central do bloco em 1 frase curta.' }, insights: bullets, ...extra },
  required: ['mensagem', 'insights', ...req],
});

const PUBLICAR_PAINEL = {
  name: 'publicar_painel',
  description: 'Publica o conteúdo do painel visual (versão só com informações públicas, foco em PE e PP), em blocos. Seja objetivo: no máximo 3 bullets por bloco, uma linha cada, com número e fonte. Nada de dados comerciais internos. Informações de campo entram só no bloco campo, marcadas como não públicas e sem o cliente de origem.',
  input_schema: {
    type: 'object',
    properties: {
      postura_recomendada: { type: 'string' },
      mensagem_central: { type: 'string' },
      kpis: { type: 'array', maxItems: 4, description: '4 números-chave: preço de PE e PP importado, Brent, câmbio ou frete.', items: { type: 'object', properties: { rotulo: { type: 'string' }, valor: { type: 'string' }, detalhe: { type: 'string' }, tom: { type: 'string', enum: ['positivo', 'negativo', 'atencao', 'neutro'] } }, required: ['rotulo', 'valor', 'detalhe', 'tom'] } },
      resumo: { ...bullets, maxItems: 4, description: 'No máximo 4 bullets, uma linha cada. Inclua o frete internacional.' },
      insights_por_bloco: {
        type: 'array', maxItems: 8,
        description: 'Para a visão geral: um insight acionável por bloco (Macro, Resina, Setor, Cliente, Informações de campo, Projeções, Roteiro), uma linha cada, com número e o que fazer com ele na reunião.',
        items: { type: 'object', properties: { bloco: { type: 'string' }, insight: { type: 'string' } }, required: ['bloco', 'insight'] },
      },
      campo: {
        type: 'object', description: 'Informações de campo registradas pelos GCs (não públicas). Organize por tema; nunca cite o cliente de origem.',
        properties: {
          mensagem: { type: 'string' },
          itens: { type: 'array', maxItems: 5, items: { type: 'object', properties: { tema: { type: 'string' }, informacao: { type: 'string' }, data: { type: 'string' }, como_usar: { type: 'string' } }, required: ['tema', 'informacao', 'data', 'como_usar'] } },
        },
      },
      macro: blocoBase({ manchetes }, ['manchetes']),
      mercado: blocoBase(),
      setor: blocoBase({ demanda_3m: { type: 'string', enum: ['alta', 'estável', 'queda'] }, poder_barganha_cliente: { type: 'string', enum: ['alto', 'médio', 'baixo'] }, justificativa: { type: 'string' }, manchetes }, ['demanda_3m', 'poder_barganha_cliente', 'justificativa', 'manchetes']),
      cliente: blocoBase({ movimentos: { type: 'array', items: { type: 'object', properties: { data: { type: 'string' }, fato: { type: 'string' }, fonte: { type: 'string' }, implicacao: { type: 'string' } }, required: ['fato', 'fonte', 'implicacao'] } } }, ['movimentos']),
      projecoes: blocoBase({ implicacao_estrategica: { type: 'string' } }, ['implicacao_estrategica']),
      hipoteses: { type: 'array', items: { type: 'object', properties: { hipotese: { type: 'string' }, evidencia: { type: 'string' }, como_confirmar: { type: 'string' } }, required: ['hipotese', 'evidencia', 'como_confirmar'] } },
      roteiro: {
        type: 'object',
        properties: {
          objetivo: { type: 'string' },
          abertura: { type: 'string' },
          argumentos: { type: 'array', items: { type: 'object', properties: { argumento: { type: 'string' }, dado: { type: 'string' } }, required: ['argumento', 'dado'] } },
          perguntas_descoberta: bullets,
          objecoes: { type: 'array', items: { type: 'object', properties: { objecao: { type: 'string' }, resposta: { type: 'string' } }, required: ['objecao', 'resposta'] } },
        },
        required: ['objetivo', 'abertura', 'argumentos', 'perguntas_descoberta', 'objecoes'],
      },
      riscos: { type: 'array', items: { type: 'object', properties: { risco: { type: 'string' }, probabilidade: { type: 'string', enum: ['baixa', 'média', 'alta'] }, impacto: { type: 'string' }, mitigacao: { type: 'string' } }, required: ['risco', 'probabilidade', 'impacto', 'mitigacao'] } },
      proximos_passos: { type: 'array', items: { type: 'object', properties: { quando: { type: 'string', enum: ['antes', 'na reunião', 'depois'] }, acao: { type: 'string' } }, required: ['quando', 'acao'] } },
    },
    required: ['postura_recomendada', 'mensagem_central', 'kpis', 'resumo', 'macro', 'mercado', 'setor', 'cliente', 'projecoes', 'hipoteses', 'roteiro', 'riscos', 'proximos_passos'],
  },
};

async function extrairInsights(claude, MODELO, markdown) {
  const mensagens = [{
    role: 'user',
    content: `Abaixo está o briefing de uma reunião comercial preparado só com informações públicas. Transforme-o no conteúdo do painel chamando a ferramenta publicar_painel.\nRegras: no máximo 3 bullets por bloco, uma linha cada, com número e fonte; foco em PE e PP; nada que não esteja no briefing; nenhum dado comercial interno; informações de campo só no bloco campo, sem o cliente de origem; português do Brasil.\n\n<briefing>\n${markdown}\n</briefing>`,
  }];
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const resposta = await claude.messages.stream({ model: MODELO, max_tokens: 32000, tools: [PUBLICAR_PAINEL], messages: mensagens, thinking: { type: 'adaptive' }, output_config: { effort: 'medium' } }).finalMessage();
    if (resposta.stop_reason === 'refusal') throw new Error('O modelo recusou gerar o painel.');
    const chamada = resposta.content.find(b => b.type === 'tool_use' && b.name === 'publicar_painel');
    if (chamada?.input?.kpis) return chamada.input;
    mensagens.push({ role: 'assistant', content: resposta.content }, { role: 'user', content: 'Use a ferramenta publicar_painel para entregar o conteúdo.' });
  }
  throw new Error('O modelo não entregou o conteúdo do painel.');
}

// ---------------------------------------------------------------------------
// Dados dos gráficos (fontes públicas)
// ---------------------------------------------------------------------------
export async function dadosGraficos(idCliente) {
  const cfg = await carregarCliente(idCliente);
  const setor = await lerJson(`setores/${cfg.segmento}.json`).catch(() => ({}));
  const tentar = async (fn, padrao) => { try { return await fn(); } catch (e) { return { ...padrao, erro: e.message }; } };
  // Em sequência para o Comex (limite de consultas): os indicadores mensais aquecem o cache de PE/PP
  const resinas = cfg.resinas?.length ? cfg.resinas : ['3901', '3902'];
  const mensal = await tentar(() => indicadoresMensais.executar({ posicoes: resinas }), { variaveis: [] });
  const [mac, proj, brent, imp, ind, emp, perf, acab, notas] = await Promise.all([
    tentar(() => macro.executar(), {}),
    tentar(() => projecoes.executar(), {}),
    tentar(() => comex.brentMensal(), {}),
    tentar(() => comex.executar({ posicoes: ['3901', '3902'] }).then(r => ({ ...r, posicoes: r.posicoes.filter(p => resinas.includes(p.posicao)) })), { posicoes: [] }),
    tentar(() => ibge.executar({ series: setor.series_ibge || [] }), { series: [] }),
    tentar(() => empresas.executar({ empresas: setor.empresas_listadas || [] }), { empresas: [] }),
    tentar(() => perfil.executar({ cliente: idCliente }), {}),
    setor.linhas_importacao?.length ? tentar(() => importados.executar({ segmento: cfg.segmento }), {}) : null,
    notasParaSegmento(cfg.segmento).catch(() => []),
  ]);
  const mesesBrent = Object.keys(brent).filter(k => /^\d{4}-\d{2}$/.test(k)).sort().slice(-13);
  const papel = Object.fromEntries((setor.empresas_listadas || []).map(e => [e.busca.toUpperCase(), e.papel]));
  return {
    macro_tiles: { brent: mac.global?.brent, wti: mac.global?.wti, dolar: mac.brasil?.dolar_ptax, selic: mac.brasil?.selic_meta, ipca: mac.brasil?.ipca_12m },
    brent_historico: mesesBrent.map(m => ({ mes: m, brent: arred(brent[m], 2) })),
    brent_projecao: {
      curva_futura: (Array.isArray(proj.brent_curva_futura) ? proj.brent_curva_futura : []).map(c => ({ mes: c.contrato, valor: c['preco_US$_bbl'], desatualizado: !!c.aviso })),
      eia: (Array.isArray(proj.brent_wti_projecao_eia) ? proj.brent_wti_projecao_eia : []).map(e => ({ mes: e.mes, valor: e['brent_US$_bbl'] })),
    },
    focus: proj.focus,
    importacoes: (imp.posicoes || []).map(p => ({ ...p, serie_mensal: (p.serie_mensal || []).slice(-24) })),
    ibge: ind.series || [],
    importados_acabados: acab?.linhas ? { ultimo_mes: acab.ultimo_mes, acumulado_do_ano: acab.acumulado_do_ano, linhas: acab.linhas } : null,
    empresas: (emp.empresas || []).map(e => ({ ...e, papel: Object.entries(papel).find(([b]) => (e.empresa || e.busca || '').toUpperCase().includes(b))?.[1] || null })),
    perfil: { perfil_conhecido: perf.perfil_conhecido || cfg.perfil_publico || [], noticias: (perf.noticias_ultimos_30_dias || []).slice(0, 10) },
    macro_mensal: mensal.variaveis || [],
    notas_campo: notas,
  };
}

export async function gerarPainel({ claude, MODELO, idCliente, markdown, data, dataReuniao, insightsProntos }) {
  const cfg = await carregarCliente(idCliente);
  const [insights, graficos] = await Promise.all([insightsProntos || extrairInsights(claude, MODELO, markdown), dadosGraficos(idCliente)]);
  const painel = {
    meta: { cliente: cfg.nome, id: cfg.id, segmento: cfg.segmento, kam: cfg.kam, gerado_em: data, data_reuniao: dataReuniao || null, modelo: MODELO, dados_ficticios: false, versao: 'mercado' },
    insights,
    graficos,
  };
  const arquivo = path.join(PASTA_RELATORIOS, `painel_${cfg.id}_${data}.json`);
  await fs.writeFile(arquivo, JSON.stringify(painel, null, 2), 'utf8');
  const exportado = await exportarPainel(arquivo, { pdf: true }).catch(e => ({ avisoPdf: `Exportação falhou: ${e.message}` }));
  if (exportado.html) console.log(`\n  Para e-mail: ${exportado.html}`);
  if (exportado.pdf) console.log(`  PDF: ${exportado.pdf}`);
  if (exportado.avisoPdf) console.log(`  ${exportado.avisoPdf}`);
  return arquivo;
}

// Execução direta: usa o briefing .md mais recente do cliente
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.loadEnvFile(path.join(RAIZ, '.env')); } catch { /* usa variáveis do terminal */ }
  const { criarCliente, explicarErro, MODELO } = await import('../lib/claude.js');
  const { values: args } = parseArgs({ options: { cliente: { type: 'string', default: 'mondial' }, data: { type: 'string' } } });
  try {
    const cfg = await carregarCliente(args.cliente);
    const mds = (await fs.readdir(PASTA_RELATORIOS)).filter(f => f.startsWith(`briefing_${cfg.id}_`) && f.endsWith('.md') && !f.includes('_perguntas')).sort();
    if (!mds.length) throw new Error(`Nenhum briefing de ${cfg.nome} em relatorios/. Rode primeiro: npm run briefing -- --cliente ${cfg.id}`);
    const ultimo = mds[mds.length - 1];
    const data = ultimo.match(/_(\d{4}-\d{2}-\d{2})\.md$/)[1];
    console.log(`Gerando painel a partir de ${ultimo}...`);
    const arquivo = await gerarPainel({ claude: criarCliente(), MODELO, idCliente: cfg.id, markdown: await fs.readFile(path.join(PASTA_RELATORIOS, ultimo), 'utf8'), data, dataReuniao: args.data });
    console.log(`✔ Painel salvo em ${arquivo}\n  Para ver: npm run painel  (http://localhost:3001)`);
  } catch (e) {
    console.error(`Erro: ${explicarErro(e)}`);
    process.exit(1);
  }
}
