// Indicadores setoriais reais do IBGE (SIDRA): produção industrial (PIM-PF) e vendas do varejo (PMC).
import { arred } from '../lib/dados.js';
import { buscar } from './macro.js';

// Catálogo de séries: id → tabela, classificação e categoria do SIDRA
export const SERIES = {
  pim_industria_geral: { nome: 'Produção industrial — indústria geral', tabela: '8888', classe: '544', categoria: '129314', tipo: 'pim' },
  pim_plastico: { nome: 'Produção — produtos de material plástico (22.2)', tabela: '8885', classe: '542', categoria: '129227', tipo: 'pim' },
  pim_embalagens_plasticas: { nome: 'Produção — embalagens de material plástico (22.22)', tabela: '8885', classe: '542', categoria: '129229', tipo: 'pim' },
  pim_eletrodomesticos: { nome: 'Produção — eletrodomésticos (27.5)', tabela: '8885', classe: '542', categoria: '129258', tipo: 'pim' },
  pim_linha_branca: { nome: 'Produção — linha branca: fogões, refrigeradores e lavadoras (27.51)', tabela: '8885', classe: '542', categoria: '129259', tipo: 'pim' },
  pim_portateis: { nome: 'Produção — eletroportáteis e outros eletrodomésticos (27.59)', tabela: '8885', classe: '542', categoria: '129260', tipo: 'pim' },
  pim_bebidas: { nome: 'Produção — bebidas (11)', tabela: '8888', classe: '544', categoria: '129318', tipo: 'pim' },
  pim_bebidas_nao_alcoolicas: { nome: 'Produção — bebidas não alcoólicas: refrigerantes, águas, sucos (11.2)', tabela: '8885', classe: '542', categoria: '129193', tipo: 'pim' },
  pim_bebidas_alcoolicas: { nome: 'Produção — bebidas alcoólicas (11.1)', tabela: '8885', classe: '542', categoria: '129192', tipo: 'pim' },
  pim_oleos_refinados: { nome: 'Produção — óleos vegetais refinados (10.42)', tabela: '8885', classe: '542', categoria: '129183', tipo: 'pim' },
  pim_limpeza_cosmeticos: { nome: 'Produção — sabões, limpeza, cosméticos e higiene (20.6)', tabela: '8885', classe: '542', categoria: '129218', tipo: 'pim' },
  pim_defensivos: { nome: 'Produção — defensivos agrícolas e domissanitários (20.5)', tabela: '8885', classe: '542', categoria: '129217', tipo: 'pim' },
  pim_alimentos: { nome: 'Produção — produtos alimentícios (10)', tabela: '8888', classe: '544', categoria: '129317', tipo: 'pim' },
  pim_farmaceuticos: { nome: 'Produção — farmoquímicos e farmacêuticos (21)', tabela: '8888', classe: '544', categoria: '129330', tipo: 'pim' },
  varejo_eletrodomesticos: { nome: 'Vendas no varejo — eletrodomésticos (volume)', tabela: '8882', classe: '85', categoria: '31556', tipo: 'pmc' },
  varejo_moveis_eletro: { nome: 'Vendas no varejo — móveis e eletrodomésticos (volume)', tabela: '8882', classe: '85', categoria: '2759', tipo: 'pmc' },
  varejo_supermercados: { nome: 'Vendas no varejo — hiper e supermercados (volume)', tabela: '8882', classe: '85', categoria: '103154', tipo: 'pmc' },
  varejo_farma_cosmeticos: { nome: 'Vendas no varejo — farmácia, perfumaria e cosméticos (volume)', tabela: '8882', classe: '85', categoria: '103155', tipo: 'pmc' },
  varejo_combustiveis_lubrificantes: { nome: 'Vendas no varejo — combustíveis e lubrificantes (volume)', tabela: '8882', classe: '85', categoria: '90671', tipo: 'pmc' },
};

// Variáveis: índice, variação contra o mesmo mês do ano anterior e acumulado em 12 meses
const VARS = { pim: { indice: '12606', aa: '11602', ac12: '11604' }, pmc: { indice: '7169', aa: '11709', ac12: '11711' } };
let categoriaVolumePmc = null; // código do "índice de volume de vendas" na classificação 11046

async function obterCategoriaVolume() {
  if (categoriaVolumePmc) return categoriaVolumePmc;
  const meta = await (await buscar('https://servicodados.ibge.gov.br/api/v3/agregados/8882/metadados')).json();
  const tipos = meta.classificacoes.find(c => c.id === 11046);
  categoriaVolumePmc = String(tipos.categorias.find(c => /volume/i.test(c.nome))?.id);
  return categoriaVolumePmc;
}

async function serie(id) {
  const s = SERIES[id];
  const v = VARS[s.tipo];
  const extra = s.tipo === 'pmc' ? `/c11046/${await obterCategoriaVolume()}` : '';
  const url = `https://apisidra.ibge.gov.br/values/t/${s.tabela}/n1/all/v/${v.indice},${v.aa},${v.ac12}/p/last%2025${extra}/c${s.classe}/${s.categoria}?formato=json`;
  const linhas = (await (await buscar(url, { headers: { Accept: 'application/json' } })).json()).slice(1);
  const porMes = {};
  for (const l of linhas) {
    const mes = `${l.D3C.slice(0, 4)}-${l.D3C.slice(4, 6)}`;
    const valor = parseFloat(l.V); if (!isFinite(valor)) continue;
    const campo = l.D2C === v.indice ? 'indice' : l.D2C === v.aa ? 'var_aa_pct' : 'var_12m_pct';
    (porMes[mes] ||= { mes })[campo] = arred(valor, 1);
  }
  const meses = Object.values(porMes).sort((a, b) => a.mes.localeCompare(b.mes));
  const ult = meses[meses.length - 1] || {};
  return { id, nome: s.nome, ultimo_mes: ult.mes, var_aa_pct: ult.var_aa_pct, var_12m_pct: ult.var_12m_pct, serie: meses.slice(-24) };
}

export const definicao = {
  name: 'indicadores_ibge',
  description:
    'Indicadores setoriais REAIS do IBGE (SIDRA): produção industrial e vendas do varejo por atividade, com índice mensal, variação contra o mesmo mês do ano anterior ' +
    'e acumulado de 12 meses. Séries disponíveis: ' + Object.entries(SERIES).map(([k, s]) => `${k} (${s.nome})`).join('; ') + '.',
  input_schema: {
    type: 'object',
    properties: { series: { type: 'array', items: { type: 'string', enum: Object.keys(SERIES) }, description: 'Séries a consultar (use as do perfil do setor).' } },
    required: ['series'],
    additionalProperties: false,
  },
};

export async function executar({ series }) {
  const res = await Promise.all(series.filter(id => SERIES[id]).map(id => serie(id).catch(e => ({ id, nome: SERIES[id].nome, erro: `indisponível (${e.message})` }))));
  return { fonte: 'IBGE — PIM-PF (produção física industrial) e PMC (pesquisa mensal do comércio), dados oficiais', series: res };
}
