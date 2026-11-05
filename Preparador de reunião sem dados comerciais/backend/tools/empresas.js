// Resultados de empresas listadas (dados públicos reais): DRE trimestral da CVM (ITR) e cotação da ação (Yahoo Finance).
// Serve para ler demanda e margem do setor do cliente — ex.: fabricantes e varejistas de eletrodomésticos, brand owners de HPC.
import fs from 'node:fs/promises';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { arred, DADOS, normalizar } from '../lib/dados.js';

const CACHE = path.join(DADOS, 'cache');
const VALIDADE_MS = 7 * 24 * 3600 * 1000; // ITR é trimestral: baixar de novo uma vez por semana basta

async function baixarItr(ano) {
  const arq = path.join(CACHE, `itr_cia_aberta_${ano}.zip`);
  try {
    const st = await fs.stat(arq);
    if (Date.now() - st.mtimeMs < VALIDADE_MS) return arq;
  } catch { /* sem cache */ }
  const r = await fetch(`https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS/itr_cia_aberta_${ano}.zip`, { signal: AbortSignal.timeout(180000) });
  if (!r.ok) throw new Error(`CVM HTTP ${r.status} (${ano})`);
  await fs.mkdir(CACHE, { recursive: true });
  await fs.writeFile(arq, Buffer.from(await r.arrayBuffer()));
  return arq;
}

// Lê a DRE consolidada do ITR e devolve linhas das contas que interessam, só das empresas buscadas
async function dreDoAno(ano, buscas) {
  const zip = new AdmZip(await baixarItr(ano));
  const entrada = zip.getEntries().find(e => /DRE_con/i.test(e.entryName));
  if (!entrada) return [];
  const texto = new TextDecoder('latin1').decode(entrada.getData());
  const linhas = texto.split('\n');
  const cab = linhas[0].split(';');
  const idx = n => cab.indexOf(n);
  const [iNome, iCnpj, iOrdem, iIni, iFim, iConta, iValor, iEscala, iVersao] = ['DENOM_CIA', 'CNPJ_CIA', 'ORDEM_EXERC', 'DT_INI_EXERC', 'DT_FIM_EXERC', 'CD_CONTA', 'VL_CONTA', 'ESCALA_MOEDA', 'VERSAO'].map(idx);
  const alvos = buscas.map(normalizar);
  const out = [];
  for (let i = 1; i < linhas.length; i++) {
    const c = linhas[i].split(';');
    if (c.length < cab.length) continue;
    const conta = c[iConta];
    if (!['3.01', '3.03', '3.05', '3.11'].includes(conta)) continue;
    const nome = normalizar(c[iNome]);
    const alvo = alvos.find(a => nome.includes(a));
    if (!alvo) continue;
    out.push({ busca: alvo, empresa: c[iNome], cnpj: c[iCnpj], ordem: c[iOrdem], ini: c[iIni], fim: c[iFim], conta, valor: parseFloat(c[iValor]) * (c[iEscala] === 'MIL' ? 1000 : 1), versao: +c[iVersao] });
  }
  return out;
}

const mesesEntre = (ini, fim) => { const a = new Date(ini), b = new Date(fim); return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth() + 1; };
const trimestre = fim => `${fim.slice(0, 4)}-T${Math.ceil(+fim.slice(5, 7) / 3)}`;

async function cotacao(ticker) {
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1y&interval=1mo`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
    const res = (await r.json()).chart?.result?.[0];
    const fech = (res?.indicators?.quote?.[0]?.close || []).filter(x => x != null);
    if (!res || !fech.length) return null;
    return { ticker, preco: arred(res.meta.regularMarketPrice), moeda: res.meta.currency, var_12m_pct: arred((res.meta.regularMarketPrice / fech[0] - 1) * 100, 1) };
  } catch { return null; }
}

export const definicao = {
  name: 'resultados_empresas_listadas',
  description:
    'Resultados trimestrais REAIS de empresas listadas na B3 (formulário ITR da CVM): receita líquida, margem bruta, resultado operacional e lucro do último trimestre disponível, ' +
    'com a variação contra o mesmo trimestre do ano anterior, e a variação da ação em 12 meses. Use com as empresas listadas do perfil do setor do cliente ' +
    '(fabricantes, varejistas ou clientes finais) para ler demanda e pressão de margem. O cliente em si normalmente não é listado.',
  input_schema: {
    type: 'object',
    properties: {
      empresas: {
        type: 'array',
        items: { type: 'object', properties: { busca: { type: 'string', description: 'Parte do nome na CVM (ex.: "WHIRLPOOL", "MAGAZINE LUIZA").' }, ticker: { type: 'string', description: 'Código na B3 com .SA (ex.: "WHRL4.SA").' } }, required: ['busca'] },
      },
    },
    required: ['empresas'],
    additionalProperties: false,
  },
};

export async function executar({ empresas }) {
  const ano = new Date().getUTCFullYear();
  const buscas = empresas.map(e => e.busca);
  const [atual, anterior] = await Promise.all([dreDoAno(ano, buscas).catch(() => []), dreDoAno(ano - 1, buscas).catch(() => [])]);
  const todas = [...atual, ...anterior].filter(l => l.ordem.startsWith('Ú') || /ULTIMO/i.test(normalizar(l.ordem)));

  const resultado = await Promise.all(empresas.map(async e => {
    const alvo = normalizar(e.busca);
    const linhas = todas.filter(l => l.busca === alvo && mesesEntre(l.ini, l.fim) === 3); // só valores do trimestre (não o acumulado)
    if (!linhas.length) return { busca: e.busca, erro: 'empresa não encontrada nos ITR da CVM (confira o nome)', cotacao: e.ticker ? await cotacao(e.ticker) : null };
    // Por trimestre: a versão mais recente de cada conta
    const porTri = {};
    for (const l of linhas) {
      const t = trimestre(l.fim);
      const atualConta = porTri[t]?.[l.conta];
      if (!atualConta || l.versao > atualConta.versao) (porTri[t] ||= { empresa: l.empresa })[l.conta] = l;
    }
    const tris = Object.keys(porTri).sort();
    const ult = tris[tris.length - 1];
    const mesmoTriAnoAnterior = `${+ult.slice(0, 4) - 1}${ult.slice(4)}`;
    const v = (t, conta) => porTri[t]?.[conta]?.valor ?? null;
    const receita = v(ult, '3.01'), receitaAnt = v(mesmoTriAnoAnterior, '3.01');
    const bruto = v(ult, '3.03'), brutoAnt = v(mesmoTriAnoAnterior, '3.03');
    return {
      empresa: porTri[ult].empresa,
      trimestre: ult,
      receita_liquida_R$_mi: arred(receita / 1e6, 0),
      receita_var_aa_pct: receita && receitaAnt ? arred((receita / receitaAnt - 1) * 100, 1) : null,
      margem_bruta_pct: receita && bruto ? arred(bruto / receita * 100, 1) : null,
      margem_bruta_ano_anterior_pct: receitaAnt && brutoAnt ? arred(brutoAnt / receitaAnt * 100, 1) : null,
      resultado_operacional_R$_mi: arred(v(ult, '3.05') / 1e6, 0),
      lucro_liquido_R$_mi: arred(v(ult, '3.11') / 1e6, 0),
      historico_trimestral: tris.slice(-6).map(t => ({ trimestre: t, receita_R$_mi: arred(v(t, '3.01') / 1e6, 0), margem_bruta_pct: v(t, '3.01') && v(t, '3.03') ? arred(v(t, '3.03') / v(t, '3.01') * 100, 1) : null })),
      cotacao: e.ticker ? await cotacao(e.ticker) : null,
    };
  }));
  return { fonte: 'CVM — formulários ITR (DRE consolidada, valores do trimestre) e Yahoo Finance (cotação). Dados públicos reais.', empresas: resultado };
}
