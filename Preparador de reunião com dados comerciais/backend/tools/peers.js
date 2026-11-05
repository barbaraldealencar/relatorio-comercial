// Compara preço líquido, desconto e prazo do cliente com peers anônimos do mesmo segmento.
import { carregarCliente, lerTabela, campo, arred } from '../lib/dados.js';

const mediana = arr => { const s = [...arr].sort((a, b) => a - b); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
const trimestreDe = d => `${d.getUTCFullYear()}-T${Math.ceil((d.getUTCMonth() + 1) / 3)}`;

export const definicao = {
  name: 'comparar_peers',
  description:
    'Compara o cliente com peers anônimos do mesmo segmento, grade a grade, no trimestre mais recente com benchmark: preço líquido (R$/kg), ' +
    'desconto e prazo de pagamento. Mostra a mediana, o mínimo e o máximo dos peers, a posição do cliente e o impacto mensal em R$ de alinhar o cliente à mediana. ' +
    'Também traz a evolução trimestral (cliente vs mediana). Gap positivo = o cliente paga MAIS que a mediana.',
  input_schema: {
    type: 'object',
    properties: { cliente: { type: 'string', description: 'Código do cliente (ex.: "mondial").' } },
    required: ['cliente'],
    additionalProperties: false,
  },
};

export async function executar({ cliente }) {
  const cfg = await carregarCliente(cliente);
  if (!cfg.base_peers) return { cliente: cfg.nome, erro: 'Nenhuma base de peers configurada para este cliente.' };
  const [bench, peers, pedidosRaw] = await Promise.all([
    lerTabela(cfg.base_peers, 'Benchmark'),
    lerTabela(cfg.base_peers, 'Peers').catch(() => []),
    lerTabela(cfg.base_historica, 'Pedidos'),
  ]);
  const pedidos = pedidosRaw.map(l => {
    const qtd = +campo(l, 'quantidade') || 0, tabela = +campo(l, 'preco tabela') || 0, desc = +campo(l, 'desconto') || 0;
    const data = campo(l, 'data pedido');
    return { sku: campo(l, 'sku'), tri: data instanceof Date ? trimestreDe(data) : null, qtd, bruto: qtd * tabela, valor: qtd * tabela * (1 - desc), prazo: +campo(l, 'prazo') || null };
  }).filter(p => p.tri);

  const linhas = bench.map(b => ({ peer: campo(b, 'peer'), sku: campo(b, 'sku'), tri: campo(b, 'trimestre'), vol: +campo(b, 'volume'), desc: +campo(b, 'desconto medio'), liquido: +campo(b, 'preco liquido'), prazo: +campo(b, 'prazo') }));
  const trimestres = [...new Set(linhas.map(l => l.tri))].sort();
  const ultimoTri = trimestres[trimestres.length - 1];

  const doCliente = (sku, tri) => {
    const ps = pedidos.filter(p => p.sku === sku && p.tri === tri);
    const qtd = ps.reduce((s, p) => s + p.qtd, 0);
    if (!qtd) return null;
    const valor = ps.reduce((s, p) => s + p.valor, 0), bruto = ps.reduce((s, p) => s + p.bruto, 0);
    return { volume_t: qtd / 1000, liquido: valor / qtd, desc: 1 - valor / bruto, prazo: mediana(ps.map(p => p.prazo).filter(Boolean)) };
  };

  const skus = [...new Set(linhas.map(l => l.sku))];
  const comparacao = skus.map(sku => {
    const ps = linhas.filter(l => l.sku === sku && l.tri === ultimoTri);
    const cli = doCliente(sku, ultimoTri);
    if (!cli || !ps.length) return { sku, observacao: 'sem dados suficientes no trimestre' };
    const medLiq = mediana(ps.map(p => p.liquido));
    const gap = cli.liquido - medLiq;
    const abaixo = ps.filter(p => p.liquido < cli.liquido).length;
    return {
      sku,
      cliente_preco_liquido_R$_kg: arred(cli.liquido),
      peers_preco_liquido_mediana_R$_kg: arred(medLiq),
      peers_preco_liquido_min_max_R$_kg: [arred(Math.min(...ps.map(p => p.liquido))), arred(Math.max(...ps.map(p => p.liquido)))],
      gap_vs_mediana_R$_kg: arred(gap, 3),
      gap_vs_mediana_pct: arred((cli.liquido / medLiq - 1) * 100, 1),
      posicao: `cliente paga mais que ${abaixo} de ${ps.length} peers`,
      cliente_desconto_pct: arred(cli.desc * 100, 1),
      peers_desconto_mediana_pct: arred(mediana(ps.map(p => p.desc)) * 100, 1),
      cliente_prazo_dias: cli.prazo,
      peers_prazo_mediana_dias: mediana(ps.map(p => p.prazo)),
      cliente_volume_trimestre_t: arred(cli.volume_t, 0),
      impacto_mensal_alinhar_a_mediana_R$: arred(-gap * cli.volume_t * 1000 / 3, 0),
      evolucao_trimestral: trimestres.map(tri => {
        const c = doCliente(sku, tri), m = mediana(linhas.filter(l => l.sku === sku && l.tri === tri).map(l => l.liquido));
        return { trimestre: tri, cliente_R$_kg: c ? arred(c.liquido) : null, mediana_peers_R$_kg: arred(m) };
      }),
    };
  });

  return {
    cliente: cfg.nome,
    trimestre_referencia: ultimoTri,
    leitura: 'impacto_mensal_alinhar_a_mediana_R$ > 0 significa que alinhar o cliente à mediana AUMENTARIA nossa receita (o cliente paga menos que os peers): oportunidade. < 0 significa que o cliente já paga acima da mediana: risco de perda para a concorrência.',
    peers: peers.map(p => ({ peer: campo(p, 'peer'), perfil: campo(p, 'perfil'), porte_relativo: campo(p, 'porte'), prazo_padrao_dias: campo(p, 'prazo') })),
    comparacao,
  };
}
