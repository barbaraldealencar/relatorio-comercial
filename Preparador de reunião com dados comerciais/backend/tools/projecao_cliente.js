// Projeção dos próximos meses do cliente: volume, preço de tabela e faturamento em cenários de petróleo.
// Preço: a mesma lógica da fórmula contratual (tabela segue o Brent em R$ com 1 mês de defasagem, na elasticidade histórica de cada grade).
// Volume: sazonalidade (mesmo mês do ano anterior) × tendência dos últimos 12 meses.
import { arred, mesChave, campo } from '../lib/dados.js';
import { carregarHistorico, elasticidade, addMeses } from './cliente.js';
import { curvaBrent, projecaoEia, focusAnual } from './projecoes.js';

const soma = (arr, f) => arr.reduce((s, x) => s + (f(x) || 0), 0);

export const definicao = {
  name: 'projetar_cliente',
  description:
    'Projeta os próximos meses do cliente (padrão 3, máximo 6), grade a grade: volume esperado, preço de tabela pela fórmula (Brent em R$ com 1 mês de defasagem e elasticidade histórica) ' +
    'e faturamento, em cenários de petróleo. Sem cenários informados, usa: "curva_futura" (Brent da NYMEX), "eia" (projeção oficial), "alta" (+20% sobre a curva) e "baixa" (−20%), ' +
    'com o câmbio do Focus. Compara cada cenário com "tabela congelada" para mostrar quanto vale o repasse em R$ (útil para negociar escalonamento ou teto). ' +
    'Você pode passar cenários próprios (ex.: a projeção de um banco citada em notícia).',
  input_schema: {
    type: 'object',
    properties: {
      cliente: { type: 'string', description: 'Código do cliente (ex.: "mondial").' },
      meses: { type: 'integer', description: 'Horizonte em meses após a data-base (1 a 6, padrão 3).' },
      cenarios: {
        type: 'array',
        description: 'Opcional. Cenários próprios de petróleo e câmbio.',
        items: {
          type: 'object',
          properties: {
            nome: { type: 'string' },
            brent_usd_bbl: { type: 'array', items: { type: 'number' }, description: 'Brent médio (US$/bbl) de cada mês projetado, em ordem. Se tiver menos valores que meses, repete o último.' },
            dolar: { type: 'number', description: 'Câmbio R$/US$ (padrão: Focus do ano).' },
          },
          required: ['nome', 'brent_usd_bbl'],
          additionalProperties: false,
        },
      },
    },
    required: ['cliente'],
    additionalProperties: false,
  },
};

export async function executar({ cliente, meses = 3, cenarios }) {
  meses = Math.min(Math.max(1, meses | 0), 6);
  const h = await carregarHistorico(cliente);
  const { pedidos, produtos, tabelaPorSku, brentReais, dataBase } = h;
  const mesesProj = Array.from({ length: meses }, (_, i) => mesChave(addMeses(new Date(Date.UTC(dataBase.getUTCFullYear(), dataBase.getUTCMonth(), 1)), i + 1)));
  const ultimoMesRef = Object.keys(brentReais).sort().pop();
  const mesAnterior = k => mesChave(addMeses(new Date(k + '-01T00:00:00Z'), -1));

  // ---- Cenários padrão (dados reais de mercado) ----
  const avisos = [];
  let dolar = null;
  try { const f = await focusAnual(); dolar = f['Câmbio']?.[String(new Date().getUTCFullYear())]; } catch { avisos.push('Focus indisponível: câmbio do último mês da base usado.'); }
  const ultimoRef = h.refsRecentes[h.refsRecentes.length - 1];
  dolar ||= ultimoRef?.dolar || 5;
  if (cenarios?.length) {
    cenarios = cenarios.map(c => ({ ...c, dolar: c.dolar || dolar }));
  } else {
    cenarios = [];
    try {
      const curva = await curvaBrent();
      // Meses sem contrato próprio (já vencidos) usam o contrato mais próximo à frente.
      const preco = k => (curva.find(c => c.contrato >= k) ?? curva[curva.length - 1])['preco_US$_bbl'];
      const base = mesesProj.map(preco);
      cenarios.push({ nome: 'curva_futura', brent_usd_bbl: base, dolar });
      cenarios.push({ nome: 'alta (+20% sobre a curva)', brent_usd_bbl: base.map(x => x * 1.2), dolar });
      cenarios.push({ nome: 'baixa (−20% sobre a curva)', brent_usd_bbl: base.map(x => x * 0.8), dolar });
    } catch { avisos.push('Curva futura indisponível.'); }
    try {
      const eia = await projecaoEia();
      const b = mesesProj.map(k => eia.find(e => e.mes === k)?.['brent_US$_bbl']).filter(Boolean);
      if (b.length) cenarios.push({ nome: 'eia', brent_usd_bbl: b, dolar });
    } catch { avisos.push('Projeção da EIA indisponível.'); }
    if (!cenarios.length) {
      const b = ultimoRef?.['brent_US$_bbl'];
      cenarios.push({ nome: 'brent estável (último mês)', brent_usd_bbl: [b], dolar }, { nome: 'alta (+20%)', brent_usd_bbl: [b * 1.2], dolar }, { nome: 'baixa (−20%)', brent_usd_bbl: [b * 0.8], dolar });
      avisos.push('Sem fontes de mercado: cenários montados a partir do último Brent da base.');
    }
  }

  // ---- Volume esperado por grade e mês (independe do cenário) ----
  const u12 = p => p.data > addMeses(dataBase, -12) && p.data <= dataBase;
  const a12 = p => p.data > addMeses(dataBase, -24) && p.data <= addMeses(dataBase, -12);
  const u3 = p => p.data > addMeses(dataBase, -3) && p.data <= dataBase;
  const grades = produtos.map(prod => {
    const sku = campo(prod, 'sku');
    const ps = pedidos.filter(p => p.sku === sku);
    const tend = soma(ps.filter(a12), p => p.qtd) ? soma(ps.filter(u12), p => p.qtd) / soma(ps.filter(a12), p => p.qtd) : 1;
    const ps3 = ps.filter(u3);
    const desc = soma(ps3, p => p.qtd * p.tabela) ? 1 - soma(ps3, p => p.valor) / soma(ps3, p => p.qtd * p.tabela) : 0;
    const tab = tabelaPorSku[sku] || {};
    const ultimaTabela = tab[Object.keys(tab).sort().pop()];
    const vol = Object.fromEntries(mesesProj.map(k => {
      const [y, m] = k.split('-').map(Number);
      const mesmoMesAnoAnterior = soma(ps.filter(p => p.data.getUTCFullYear() === y - 1 && p.data.getUTCMonth() + 1 === m), p => p.qtd);
      return [k, mesmoMesAnoAnterior * tend];
    }));
    return { sku, el: elasticidade(tab, brentReais) ?? 0.4, desc, ultimaTabela, vol };
  });

  // ---- Simulação por cenário ----
  const simular = cen => {
    const br = { ...brentReais };
    mesesProj.forEach((k, i) => { const b = cen.brent_usd_bbl[Math.min(i, cen.brent_usd_bbl.length - 1)]; br[k] = b * (cen.dolar || 5); });
    const linhasMes = mesesProj.map(k => ({ mes: k, brent_US$_bbl: arred(br[k] / (cen.dolar || 5), 1), brent_R$_bbl: arred(br[k], 0), volume_t: 0, fat_bruto: 0, fat_liquido: 0, fat_liquido_tabela_congelada: 0 }));
    const porGrade = grades.map(g => {
      let tabela = g.ultimaTabela; const caminho = [];
      mesesProj.forEach((k, i) => {
        const m1 = mesAnterior(k), m2 = mesAnterior(m1);
        if (br[m1] && br[m2]) tabela = tabela * (1 + g.el * (br[m1] / br[m2] - 1));
        caminho.push(tabela);
        const v = g.vol[k], L = linhasMes[i];
        L.volume_t += v / 1000; L.fat_bruto += v * tabela; L.fat_liquido += v * tabela * (1 - g.desc); L.fat_liquido_tabela_congelada += v * g.ultimaTabela * (1 - g.desc);
      });
      return { sku: g.sku, tabela_atual_R$_kg: g.ultimaTabela, tabela_projetada_R$_kg: caminho.map(x => arred(x)), var_ultimo_mes_vs_atual_pct: arred((caminho[caminho.length - 1] / g.ultimaTabela - 1) * 100, 1), volume_projetado_t: mesesProj.map(k => arred(g.vol[k] / 1000, 0)) };
    });
    const tot = linhasMes.reduce((s, l) => s + l.fat_liquido, 0), totCong = linhasMes.reduce((s, l) => s + l.fat_liquido_tabela_congelada, 0);
    return {
      cenario: cen.nome,
      dolar_usado: cen.dolar,
      meses: linhasMes.map(l => ({ mes: l.mes, brent_US$_bbl: l.brent_US$_bbl, brent_R$_bbl: l.brent_R$_bbl, volume_t: arred(l.volume_t, 0), tabela_media_ponderada_R$_kg: arred(l.fat_bruto / (l.volume_t * 1000)), faturamento_liquido_R$: arred(l.fat_liquido, 0) })),
      faturamento_liquido_periodo_R$: arred(tot, 0),
      valor_do_repasse_vs_tabela_congelada_R$: arred(tot - totCong, 0),
      por_grade: porGrade,
    };
  };

  return {
    cliente: h.cfg.nome,
    dados_ficticios: !!h.cfg.dados_ficticios,
    data_base: dataBase.toISOString().slice(0, 10),
    ultimo_mes_com_brent_na_base: ultimoMesRef,
    meses_projetados: mesesProj,
    metodo: 'Tabela(m) = Tabela(m−1) × [1 + elasticidade da grade × variação do Brent em R$ de m−2 para m−1]. Volume = mesmo mês do ano anterior × (volume últimos 12m / 12m anteriores). Faturamento líquido aplica o desconto médio dos últimos 3 meses.',
    elasticidades: Object.fromEntries(grades.map(g => [g.sku, arred(g.el, 2)])),
    avisos,
    cenarios: cenarios.map(simular),
  };
}
