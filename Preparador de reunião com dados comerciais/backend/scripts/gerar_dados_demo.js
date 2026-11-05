// Gera as bases de demonstração (FICTÍCIAS) de um cliente, a partir da configuração em clientes_demo.js:
//   dados/clientes/base_cliente_<cliente>.xlsx  — histórico do cliente
//   dados/peers/base_peers_<segmento>.xlsx      — benchmarks anônimos de peers do segmento
// Brent (FRED) e dólar PTAX (Banco Central) são reais quando há internet; o resto é inventado.
// Rodar: npm run gerar-dados-demo -- --cliente globalpack
import ExcelJS from 'exceljs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { CONFIGS } from './clientes_demo.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values: ARGS } = parseArgs({ options: { cliente: { type: 'string', default: 'mondial' } } });
const C = CONFIGS[ARGS.cliente];
if (!C) { console.error(`Cliente "${ARGS.cliente}" sem configuração em scripts/clientes_demo.js. Disponíveis: ${Object.keys(CONFIGS).join(', ')}`); process.exit(1); }
const OUT_CLIENTE = path.join(RAIZ, 'dados', C.arquivoCliente);
const OUT_PEERS = path.join(RAIZ, 'dados', C.arquivoPeers);

// ---------- RNG determinístico ----------
let seed = C.seed;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const between = (a, b) => a + (b - a) * rnd();
const intBetween = (a, b) => Math.floor(between(a, b + 1));
const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const D = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const addDays = (dt, n) => new Date(dt.getTime() + n * 86400000);
const r2 = x => Math.round(x * 100) / 100;

const DATA_BASE = D(2026, 9, 30);
const MESES = [];
for (let y = 2023; y <= 2026; y++) for (let m = 1; m <= 12; m++) { if (y === 2026 && m > 9) break; MESES.push([y, m]); }
const chave = (y, m) => `${y}-${String(m).padStart(2, '0')}`;

// ---------- Referências de mercado (reais quando possível) ----------
async function brentMensal() {
  try {
    const r = await fetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id=DCOILBRENTEU', { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const linhas = (await r.text()).trim().split('\n').slice(1);
    const acc = {};
    for (const l of linhas) {
      const [d, v] = l.split(',');
      const val = parseFloat(v); if (!isFinite(val)) continue;
      const k = d.slice(0, 7); (acc[k] ||= []).push(val);
    }
    const out = {}; for (const [k, a] of Object.entries(acc)) out[k] = a.reduce((s, x) => s + x, 0) / a.length;
    return { serie: out, fonte: 'FRED (DCOILBRENTEU) — média mensal, dado real' };
  } catch { return null; }
}
async function ptaxMensal() {
  try {
    const r = await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.3698/dados?formato=json&dataInicial=01/01/2023', { headers: { Accept: 'application/json' } });
    const arr = await r.json();
    const out = {}; for (const { data, valor } of arr) { const [, mm, yy] = data.split('/'); out[`${yy}-${mm}`] = parseFloat(valor); }
    return { serie: out, fonte: 'Banco Central — SGS 3698 (dólar venda, média mensal), dado real' };
  } catch { return null; }
}

// ---------- Produtos (grades de resina do cliente) ----------
const PRODUTOS = C.produtos;
const SKUS = PRODUTOS.map(p => p[0]);

// ---------- Estilo ----------
const FONT = { name: 'Arial', size: 10 };
const BLUE = { name: 'Arial', size: 10, color: { argb: 'FF0000FF' } };
const HDR_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
const HDR_FONT = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
const SEC_FONT = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1F3864' } };
const TITLE_FONT = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1F3864' } };
const BRL = '"R$" #,##0.00;("R$" #,##0.00);-';
const BRL0 = '"R$" #,##0;("R$" #,##0);-';
const NUM0 = '#,##0;(#,##0);-';
const PCT = '0.0%;(0.0%);-';
const DATE = 'dd/mm/yyyy';
const MES = 'mmm/yyyy';

function header(ws, row, values, startCol = 1) {
  values.forEach((v, i) => {
    const c = ws.getCell(row, startCol + i);
    c.value = v; c.font = HDR_FONT; c.fill = HDR_FILL;
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  ws.getRow(row).height = 30;
}

async function main() {
  // ----- Mercado -----
  const brent = await brentMensal();
  const ptax = await ptaxMensal();
  const ref = MESES.map(([y, m], i) => {
    const k = chave(y, m);
    const b = brent?.serie[k] ?? (82 + 6 * Math.sin(i / 4) + gauss() * 3);
    const fx = ptax?.serie[k] ?? (5.0 + 0.3 * Math.sin(i / 7) + gauss() * 0.05);
    const nafta = b * 7.5 + 40 + gauss() * 15;          // USD/t (fictício, derivado do Brent)
    const ppAsia = nafta * 1.35 + 180 + gauss() * 20;   // USD/t (fictício)
    const psAsia = nafta * 1.55 + 260 + gauss() * 25;   // USD/t (fictício)
    const peadEua = nafta * 1.05 + 150;                  // USD/t (fictício: PE americano de etano, mais barato)
    return { y, m, b: r2(b), fx: Math.round(fx * 10000) / 10000, nafta: Math.round(nafta), ppAsia: Math.round(ppAsia), psAsia: Math.round(psAsia), peadEua: Math.round(peadEua) };
  });

  // ----- Preço de tabela: segue petróleo em reais (com 1 mês de defasagem) + inflação de custos fixos -----
  const precos = {};
  for (const p of PRODUTOS) {
    const [sku, , , , , , base, , , , , sens] = p;
    const b0 = ref[0].b * ref[0].fx;
    let ultimo = base; const arr = [];
    MESES.forEach((_, i) => {
      const j = Math.max(0, i - 1);
      const custoPetro = (ref[j].b * ref[j].fx) / b0;
      const inflacao = Math.pow(1.045, i / 12);
      const alvo = base * (sens * custoPetro + (1 - sens) * inflacao);
      // repasse parcial e suavizado (negociação), com ruído pequeno
      ultimo = ultimo + 0.6 * (alvo - ultimo) + gauss() * 0.04;
      arr.push(r2(ultimo));
    });
    precos[sku] = arr;
  }

  // ----- Pedidos -----
  const pedidos = [];
  MESES.forEach(([y, m], mi) => {
    for (const p of PRODUTOS) {
      const [sku, , , , loteMin, lead, , volBase, nPed, saz, cresc] = p;
      const anos = y - 2023 + (m - 1) / 12;
      let vol = volBase * saz[m - 1] * Math.pow(1 + cresc, anos) * (1 + gauss() * 0.08);
      vol *= C.ajusteVolume?.(sku, y, m) ?? 1;
      for (let k = 0; k < nPed; k++) {
        let qtd = vol / nPed * between(0.85, 1.15);
        qtd = Math.max(loteMin, Math.round(qtd / 2500) * 2500);
        const dia = nPed === 1 ? intBetween(3, 25) : (k === 0 ? intBetween(2, 12) : intBetween(15, 26));
        const data = D(y, m, dia);
        const preco = precos[sku][mi];
        const media = volBase / nPed;
        let desc = qtd >= media * 1.25 ? 0.05 : qtd >= media * 0.95 ? 0.03 : 0.015;
        desc += C.descontoExtra?.(y, m) ?? 0;
        const prazo = C.prazo(y, m);
        const venc = addDays(data, prazo);
        let pag = null;
        if (venc <= DATA_BASE) {
          const r = rnd();
          if (r < C.perfilPagamento[0]) pag = addDays(venc, -intBetween(0, 2));
          else if (r < C.perfilPagamento[1]) pag = addDays(venc, intBetween(1, 12));
          else pag = addDays(venc, intBetween(13, 35));
          if (pag > DATA_BASE) pag = (rnd() < 0.5) ? null : DATA_BASE;
        }
        const prevista = addDays(data, lead);
        let real = null, atrasoExtra = 0;
        const faixaAtraso = C.atrasoExtra?.(sku, y, m);
        if (faixaAtraso) atrasoExtra = intBetween(...faixaAtraso);
        if (prevista <= DATA_BASE || atrasoExtra) {
          const delta = (rnd() < 0.9 ? -intBetween(0, 2) : intBetween(2, 8)) + atrasoExtra;
          real = addDays(prevista, delta);
          if (real > DATA_BASE) real = null;
        }
        let obs = C.observacao?.(sku, y, m, atrasoExtra > 0) || '';
        if (!obs && rnd() < 0.015) obs = 'Entrega parcial em 2 carretas';
        pedidos.push({ data, sku, qtd, preco, desc, prazo, pag, prevista, real, obs, planta: C.planta(rnd()) });
      }
    }
  });
  pedidos.sort((a, b) => a.data - b.data || a.sku.localeCompare(b.sku));
  const seq = {};
  pedidos.forEach(p => { const y = p.data.getUTCFullYear(); seq[y] = (seq[y] || 0) + 1; p.num = `PV-${y}-${String(seq[y]).padStart(4, '0')}`; });

  await gerarBaseCliente({ ref, brent, ptax, precos, pedidos });
  await gerarBasePeers({ precos, pedidos });
}

async function gerarBaseCliente({ ref, brent, ptax, precos, pedidos }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Projeto Aula IA Insper';
  wb.calcProperties.fullCalcOnLoad = true;

  // ===== Leia-me =====
  const lm = wb.addWorksheet('Leia-me', { properties: { tabColor: { argb: 'FF1F3864' } } });
  lm.columns = [{ width: 28 }, { width: 110 }];
  lm.getCell('A1').value = `Base de Dados Demo — Cliente ${C.nome} (resinas)`; lm.getCell('A1').font = TITLE_FONT;
  lm.getCell('A2').value = 'ATENÇÃO: dados FICTÍCIOS para fins didáticos (exceto Brent e dólar na aba Referencias_Mercado, quando indicado). Não representam relações comerciais reais.';
  lm.getCell('A2').font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFC00000' } };
  const lmRows = [
    ['Data-base dos dados', DATA_BASE],
    ['Período coberto', 'Jan/2023 a Set/2026 (45 meses)'],
    ['Perspectiva', `Somos um produtor/distribuidor (fictício) de resinas petroquímicas; ${C.nome} é o CLIENTE que compra de nós.`],
    [],
    ['ABA', 'CONTEÚDO'],
    ['Cadastro_Cliente', 'Perfil do cliente, condições comerciais, limite de crédito e contatos (fictícios).'],
    ['Produtos', `Grades de resina vendidas a ${C.nome}, aplicação, lote mínimo, lead time e preço de tabela atual (R$/kg).`],
    ['Referencias_Mercado', 'Brent (USD/bbl), dólar (R$/USD) e referências internacionais de nafta, PP, PS e PEAD (USD/t), mês a mês.'],
    ['Historico_Precos', 'Preço de tabela mensal por grade (R$/kg). Acompanha o custo do petróleo em reais com 1 mês de defasagem e repasse parcial.'],
    ['Pedidos', 'Histórico transacional (1 linha por pedido): quantidade (kg), preço, desconto, valor, prazo, pagamento e entrega.'],
    ['Share_of_Wallet', `Consumo estimado de cada resina no cliente e a nossa participação nos últimos 12 meses.`],
    ['Interacoes', 'Registro de relacionamento: negociações, reclamações, visitas técnicas e reuniões.'],
    ['Resumo', 'Indicadores calculados por fórmula a partir de Pedidos.'],
    [],
    ['PARA TROCAR POR DADOS REAIS', 'Mantenha os nomes das abas e os cabeçalhos. O agente lê as colunas pelo nome do cabeçalho, então a ordem pode mudar.'],
    [],
    ['LEGENDA DE CORES', ''],
    ['Texto azul', 'Dado de entrada (valor digitado / gerado).'],
    ['Texto preto', 'Fórmula — não editar.'],
  ];
  lmRows.forEach((r, i) => {
    const row = lm.getRow(3 + i);
    r.forEach((v, j) => { const c = row.getCell(j + 1); c.value = v; c.font = FONT; c.alignment = { wrapText: true, vertical: 'top' }; });
    if (['ABA', 'LEGENDA DE CORES', 'PARA TROCAR POR DADOS REAIS'].includes(r[0])) { row.getCell(1).font = SEC_FONT; row.getCell(2).font = SEC_FONT; }
  });
  lm.getCell('B3').numFmt = DATE; lm.getCell('B3').font = BLUE; lm.getCell('B3').alignment = { horizontal: 'left' };
  lm.getCell('A20').font = BLUE; lm.getCell('B20').font = BLUE;
  const DB_REF = "'Leia-me'!$B$3";

  // ===== Cadastro =====
  const cad = wb.addWorksheet('Cadastro_Cliente');
  cad.columns = [{ width: 32 }, { width: 80 }];
  cad.getCell('A1').value = 'Cadastro do Cliente'; cad.getCell('A1').font = TITLE_FONT;
  const cadRows = C.cadastro(D);
  cadRows.forEach((r, i) => {
    const a = cad.getCell(3 + i, 1), b = cad.getCell(3 + i, 2);
    a.value = r[0]; a.font = { ...FONT, bold: true };
    b.value = r[1]; b.font = (r[1] && r[1].formula) ? FONT : BLUE; b.alignment = { horizontal: 'left', wrapText: true };
  });
  cad.getCell('B9').numFmt = DATE; cad.getCell('B16').numFmt = BRL0; cad.getCell('B17').numFmt = BRL0; cad.getCell('B18').numFmt = PCT;

  // ===== Produtos =====
  const NM = MESES.length, lastHistRow = NM + 1;
  const lastCol = String.fromCharCode(65 + SKUS.length); // B..I
  const prod = wb.addWorksheet('Produtos');
  prod.columns = [12, 36, 16, 8, 46, 12, 14, 18].map(w => ({ width: w }));
  header(prod, 1, ['SKU', 'Descrição', 'Família', 'Unidade', `Aplicação na ${C.nome}`, 'Lote mínimo (kg)', 'Lead time padrão (dias)', 'Preço tabela atual (R$/kg)']);
  PRODUTOS.forEach((p, i) => {
    const r = i + 2;
    [p[0], p[1], p[2], 'kg', p[3], p[4], p[5]].forEach((v, j) => { const c = prod.getCell(r, j + 1); c.value = v; c.font = BLUE; });
    prod.getCell(r, 6).numFmt = NUM0;
    const c = prod.getCell(r, 8);
    c.value = { formula: `INDEX(Historico_Precos!$B$${lastHistRow}:$${lastCol}$${lastHistRow},1,MATCH(A${r},Historico_Precos!$B$1:$${lastCol}$1,0))` };
    c.font = FONT; c.numFmt = BRL;
  });
  prod.views = [{ state: 'frozen', ySplit: 1 }];
  prod.autoFilter = 'A1:H1';
  const PR = `Produtos!$A$2:$A$${PRODUTOS.length + 1}`;
  const prodRange = col => `Produtos!$${col}$2:$${col}$${PRODUTOS.length + 1}`;

  // ===== Referências de mercado =====
  const rm = wb.addWorksheet('Referencias_Mercado');
  rm.columns = [12, 14, 12, 16, 16, 16, 18, 18].map(w => ({ width: w }));
  header(rm, 1, ['Mês', 'Brent (USD/bbl)', 'Dólar (R$/USD)', 'Nafta ARA (USD/t)', 'PP Ásia CFR (USD/t)', 'PS Ásia CFR (USD/t)', 'PEAD EUA Golfo FOB (USD/t)', 'Brent em R$ (R$/bbl)']);
  ref.forEach((x, i) => {
    const r = i + 2;
    const vals = [D(x.y, x.m, 1), x.b, x.fx, x.nafta, x.ppAsia, x.psAsia, x.peadEua];
    const fmts = [MES, '#,##0.00', '0.0000', NUM0, NUM0, NUM0, NUM0];
    vals.forEach((v, j) => { const c = rm.getCell(r, j + 1); c.value = v; c.font = BLUE; c.numFmt = fmts[j]; });
    const c = rm.getCell(r, 8); c.value = { formula: `B${r}*C${r}` }; c.font = FONT; c.numFmt = '#,##0.00';
  });
  rm.getCell(NM + 3, 1).value = `Fontes: Brent — ${brent?.fonte ?? 'FICTÍCIO (sem internet na geração)'}; Dólar — ${ptax?.fonte ?? 'FICTÍCIO (sem internet na geração)'}; Nafta, PP Ásia, PS Ásia e PEAD EUA — FICTÍCIOS (derivados do Brent).`;
  rm.getCell(NM + 3, 1).font = { ...FONT, italic: true };
  rm.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];

  // ===== Histórico de preços =====
  const hp = wb.addWorksheet('Historico_Precos');
  hp.columns = [{ width: 12 }, ...SKUS.map(() => ({ width: 12 }))];
  header(hp, 1, ['Mês', ...SKUS]);
  MESES.forEach(([y, m], i) => {
    const r = i + 2;
    const c = hp.getCell(r, 1); c.value = D(y, m, 1); c.numFmt = MES; c.font = BLUE;
    SKUS.forEach((s, j) => { const cc = hp.getCell(r, j + 2); cc.value = precos[s][i]; cc.numFmt = BRL; cc.font = BLUE; });
  });
  hp.getCell(NM + 3, 1).value = 'Preço de tabela em R$/kg, sem impostos, CIF. Reajuste mensal por fórmula contratual (petróleo em R$ com 1 mês de defasagem + custos fixos).';
  hp.getCell(NM + 3, 1).font = { ...FONT, italic: true };
  hp.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];

  // ===== Pedidos =====
  const pd = wb.addWorksheet('Pedidos');
  const pdCols = [
    ['Nº Pedido', 14], ['Data Pedido', 12], ['Ano', 7], ['Mês', 6], ['SKU', 11], ['Descrição', 34], ['Família', 15], ['Planta Destino', 24],
    ['Quantidade (kg)', 13], ['Preço Tabela (R$/kg)', 12], ['Desconto %', 10], ['Preço Líquido (R$/kg)', 12], ['Valor Total (R$)', 16],
    ['Prazo Pgto (dias)', 10], ['Vencimento', 12], ['Data Pagamento', 12], ['Dias Atraso', 9], ['Status Pagamento', 16],
    ['Entrega Prevista', 12], ['Entrega Real', 12], ['Status Entrega', 13], ['Observação', 50],
  ];
  pd.columns = pdCols.map(c => ({ width: c[1] }));
  header(pd, 1, pdCols.map(c => c[0]));
  pedidos.forEach((p, i) => {
    const r = i + 2, row = pd.getRow(r);
    const set = (col, v, fmt, blue) => { const c = row.getCell(col); c.value = v; c.font = blue ? BLUE : FONT; if (fmt) c.numFmt = fmt; };
    set(1, p.num, null, true);
    set(2, p.data, DATE, true);
    set(3, { formula: `YEAR(B${r})` }, '0');
    set(4, { formula: `MONTH(B${r})` }, '0');
    set(5, p.sku, null, true);
    set(6, { formula: `INDEX(${prodRange('B')},MATCH(E${r},${PR},0))` });
    set(7, { formula: `INDEX(${prodRange('C')},MATCH(E${r},${PR},0))` });
    set(8, p.planta, null, true);
    set(9, p.qtd, NUM0, true);
    set(10, p.preco, BRL, true);
    set(11, p.desc, '0.0%', true);
    set(12, { formula: `J${r}*(1-K${r})` }, BRL);
    set(13, { formula: `I${r}*L${r}` }, BRL);
    set(14, p.prazo, '0', true);
    set(15, { formula: `B${r}+N${r}` }, DATE);
    set(16, p.pag, DATE, true);
    set(17, { formula: `IF(P${r}="","",MAX(0,P${r}-O${r}))` }, '0');
    set(18, { formula: `IF(P${r}="",IF(${DB_REF}>O${r},"Vencido","A vencer"),IF(Q${r}>0,"Pago com atraso","Pago em dia"))` });
    set(19, p.prevista, DATE, true);
    set(20, p.real, DATE, true);
    set(21, { formula: `IF(T${r}="","Em trânsito",IF(T${r}<=S${r},"No prazo","Atrasada"))` });
    set(22, p.obs, null, true);
  });
  const LR = pedidos.length + 1;
  pd.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
  pd.autoFilter = 'A1:V1';
  const rg = col => `Pedidos!$${col}$2:$${col}$${LR}`;

  // ===== Share of wallet =====
  const CONSUMO_ANUAL_T = C.consumoAnualT;
  const CONCORRENTE = C.concorrente;
  const sw = wb.addWorksheet('Share_of_Wallet');
  sw.columns = [12, 34, 20, 20, 14, 32].map(w => ({ width: w }));
  header(sw, 1, ['SKU', 'Descrição', `Consumo estimado ${C.nome} (kg/ano)`, 'Nosso volume últimos 12m (kg)', 'Share of wallet', 'Principal concorrente']);
  SKUS.forEach((s, i) => {
    const r = i + 2;
    sw.getCell(r, 1).value = s; sw.getCell(r, 1).font = BLUE;
    sw.getCell(r, 2).value = { formula: `INDEX(${prodRange('B')},MATCH(A${r},${PR},0))` }; sw.getCell(r, 2).font = FONT;
    sw.getCell(r, 3).value = CONSUMO_ANUAL_T[s] * 1000; sw.getCell(r, 3).font = BLUE; sw.getCell(r, 3).numFmt = NUM0;
    sw.getCell(r, 4).value = { formula: `SUMIFS(${rg('I')},${rg('E')},A${r},${rg('B')},">"&EDATE(${DB_REF},-12))` }; sw.getCell(r, 4).font = FONT; sw.getCell(r, 4).numFmt = NUM0;
    sw.getCell(r, 5).value = { formula: `IFERROR(D${r}/C${r},0)` }; sw.getCell(r, 5).font = FONT; sw.getCell(r, 5).numFmt = PCT;
    sw.getCell(r, 6).value = CONCORRENTE[s]; sw.getCell(r, 6).font = BLUE;
  });
  sw.getCell(SKUS.length + 3, 1).value = 'Consumo estimado: levantamento do KAM com base em visitas e capacidade das linhas (fictício).';
  sw.getCell(SKUS.length + 3, 1).font = { ...FONT, italic: true };

  // ===== Interações =====
  const it = wb.addWorksheet('Interacoes');
  it.columns = [12, 26, 22, 26, 100].map(w => ({ width: w }));
  header(it, 1, ['Data', 'Tipo', 'Nosso responsável', `Contato ${C.nome}`, 'Resumo']);
  const INTER = C.interacoes(D);
  INTER.forEach((r, i) => r.forEach((v, j) => { const c = it.getCell(i + 2, j + 1); c.value = v; c.font = BLUE; c.alignment = { wrapText: true, vertical: 'top' }; if (j === 0) c.numFmt = DATE; }));
  it.views = [{ state: 'frozen', ySplit: 1 }];
  it.autoFilter = 'A1:E1';

  // ===== Resumo =====
  const rs = wb.addWorksheet('Resumo', { properties: { tabColor: { argb: 'FF2E75B6' } } });
  rs.columns = [{ width: 30 }, { width: 18 }, ...Array(6).fill({ width: 17 })];
  rs.getCell('A1').value = `Resumo do Cliente — ${C.nome} (dados fictícios)`; rs.getCell('A1').font = TITLE_FONT;
  rs.getCell('A2').value = 'Tudo calculado por fórmula a partir da aba Pedidos. 2026 vai só até setembro.'; rs.getCell('A2').font = { ...FONT, italic: true };
  const ANOS = [2023, 2024, 2025, 2026];
  const f = (cell, formula, fmt, bold) => { const c = rs.getCell(cell); c.value = { formula }; c.font = bold ? { ...FONT, bold: true } : FONT; if (fmt) c.numFmt = fmt; };
  const lbl = (cell, v, font = FONT) => { const c = rs.getCell(cell); c.value = v; c.font = font; };
  const col = j => String.fromCharCode(66 + j);

  lbl('A4', '1. Visão anual', SEC_FONT);
  header(rs, 5, ['Ano', 'Faturamento (R$)', 'Volume (t)', 'Nº Pedidos', 'Preço líquido médio (R$/kg)', 'Desconto médio ponderado', 'Var. faturamento a/a']);
  ANOS.forEach((y, i) => {
    const r = 6 + i;
    rs.getCell(`A${r}`).value = y; rs.getCell(`A${r}`).font = BLUE;
    f(`B${r}`, `SUMIFS(${rg('M')},${rg('C')},A${r})`, BRL0);
    f(`C${r}`, `SUMIFS(${rg('I')},${rg('C')},A${r})/1000`, NUM0);
    f(`D${r}`, `COUNTIFS(${rg('C')},A${r})`, NUM0);
    f(`E${r}`, `IFERROR(B${r}/(C${r}*1000),0)`, BRL);
    f(`F${r}`, `IFERROR(1-B${r}/SUMPRODUCT((${rg('C')}=A${r})*${rg('I')}*${rg('J')}),0)`, PCT);
    if (i > 0) f(`G${r}`, `IFERROR(B${r}/B${r - 1}-1,0)`, PCT); else lbl(`G${r}`, '-');
  });
  lbl('A10', 'Total', { ...FONT, bold: true });
  f('B10', 'SUM(B6:B9)', BRL0, true); f('C10', 'SUM(C6:C9)', NUM0, true); f('D10', 'SUM(D6:D9)', NUM0, true);
  f('E10', 'IFERROR(B10/(C10*1000),0)', BRL, true);
  f('F10', `IFERROR(1-B10/SUMPRODUCT(${rg('I')},${rg('J')}),0)`, PCT, true);
  lbl('A11', 'Obs.: a variação de 2026 compara jan–set/2026 com o ano cheio de 2025.', { ...FONT, italic: true, size: 9 });

  const FAMS = [...new Set(PRODUTOS.map(p => p[2]))];
  lbl('A13', '2. Faturamento por família (R$)', SEC_FONT);
  header(rs, 14, ['Família', ...ANOS.map(String), 'Total', '% do total']);
  FAMS.forEach((fam, i) => {
    const r = 15 + i;
    rs.getCell(`A${r}`).value = fam; rs.getCell(`A${r}`).font = BLUE;
    ANOS.forEach((y, j) => f(`${col(j)}${r}`, `SUMIFS(${rg('M')},${rg('G')},$A${r},${rg('C')},${y})`, BRL0));
    f(`F${r}`, `SUM(B${r}:E${r})`, BRL0, true);
    f(`G${r}`, `IFERROR(F${r}/$F$${15 + FAMS.length},0)`, PCT);
  });
  const totFam = 15 + FAMS.length;
  lbl(`A${totFam}`, 'Total', { ...FONT, bold: true });
  ['B', 'C', 'D', 'E', 'F'].forEach(c => f(`${c}${totFam}`, `SUM(${c}15:${c}${totFam - 1})`, BRL0, true));
  f(`G${totFam}`, `IFERROR(F${totFam}/$F$${totFam},0)`, PCT, true);

  const s3 = totFam + 2;
  lbl(`A${s3}`, '3. Preço líquido médio realizado por grade (R$/kg)', SEC_FONT);
  header(rs, s3 + 1, ['SKU', ...ANOS.map(String), 'Var. 2023→2026']);
  SKUS.forEach((sku, i) => {
    const r = s3 + 2 + i;
    rs.getCell(`A${r}`).value = sku; rs.getCell(`A${r}`).font = BLUE;
    ANOS.forEach((y, j) => f(`${col(j)}${r}`, `IFERROR(SUMIFS(${rg('M')},${rg('E')},$A${r},${rg('C')},${y})/SUMIFS(${rg('I')},${rg('E')},$A${r},${rg('C')},${y}),0)`, BRL));
    f(`F${r}`, `IFERROR(E${r}/B${r}-1,0)`, PCT);
  });

  const s4 = s3 + 2 + SKUS.length + 1;
  lbl(`A${s4}`, '4. Volume por grade (t)', SEC_FONT);
  header(rs, s4 + 1, ['SKU', ...ANOS.map(String), 'Total']);
  SKUS.forEach((sku, i) => {
    const r = s4 + 2 + i;
    rs.getCell(`A${r}`).value = sku; rs.getCell(`A${r}`).font = BLUE;
    ANOS.forEach((y, j) => f(`${col(j)}${r}`, `SUMIFS(${rg('I')},${rg('E')},$A${r},${rg('C')},${y})/1000`, NUM0));
    f(`F${r}`, `SUM(B${r}:E${r})`, NUM0, true);
  });

  const s5 = s4 + 2 + SKUS.length + 1;
  lbl(`A${s5}`, '5. Crédito e entrega (na data-base)', SEC_FONT);
  header(rs, s5 + 1, ['Indicador', '', 'Valor']);
  const KPIS = [
    ['Títulos a vencer (R$)', `SUMIFS(${rg('M')},${rg('R')},"A vencer")`, BRL0],
    ['Títulos vencidos em aberto (R$)', `SUMIFS(${rg('M')},${rg('R')},"Vencido")`, BRL0],
    ['% pedidos pagos com atraso', `IFERROR(COUNTIFS(${rg('R')},"Pago com atraso")/(COUNTIFS(${rg('R')},"Pago com atraso")+COUNTIFS(${rg('R')},"Pago em dia")),0)`, PCT],
    ['Atraso médio quando atrasa (dias)', `IFERROR(AVERAGEIF(${rg('Q')},">0"),0)`, '0.0'],
    ['% entregas no prazo', `IFERROR(COUNTIFS(${rg('U')},"No prazo")/(COUNTIFS(${rg('U')},"No prazo")+COUNTIFS(${rg('U')},"Atrasada")),0)`, PCT],
    ['Pedidos em trânsito', `COUNTIFS(${rg('U')},"Em trânsito")`, NUM0],
  ];
  KPIS.forEach((k, i) => { const r = s5 + 2 + i; lbl(`A${r}`, k[0]); f(`C${r}`, k[1], k[2]); });
  cad.getCell('B17').value = { formula: `Resumo!$C$${s5 + 2}+Resumo!$C$${s5 + 3}` }; cad.getCell('B17').font = FONT;
  rs.views = [{ state: 'frozen', ySplit: 2 }];

  wb.eachSheet(ws => ws.eachRow(row => row.eachCell(c => { if (!c.font || !c.font.name) c.font = FONT; })));
  await wb.xlsx.writeFile(OUT_CLIENTE);
  console.log(`OK ${OUT_CLIENTE} — ${pedidos.length} pedidos, Brent: ${brent ? 'real' : 'fictício'}, dólar: ${ptax ? 'real' : 'fictício'}`);
}

// Benchmarks de peers: preço líquido, desconto e prazo por grade e trimestre (anônimos, fictícios).
async function gerarBasePeers({ precos, pedidos }) {
  const PEERS = C.peers;
  // Prêmio/desconto específico por grade vs o cliente (para criar oportunidades e ameaças plausíveis)
  const AJUSTE_GRADE = C.ajusteGrade;
  const TRIS = [[2025, 4], [2026, 1], [2026, 2], [2026, 3]];
  const idxMes = (y, m) => MESES.findIndex(([yy, mm]) => yy === y && mm === m);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Projeto Aula IA Insper';
  const lm = wb.addWorksheet('Leia-me');
  lm.columns = [{ width: 24 }, { width: 100 }];
  lm.getCell('A1').value = `Benchmark de Peers — Segmento ${C.segmentoNome}`; lm.getCell('A1').font = TITLE_FONT;
  const info = [
    ['Aviso', 'Dados FICTÍCIOS e ANONIMIZADOS. Na vida real, use apenas dados agregados da própria carteira, nunca dados identificáveis de outros clientes.'],
    ['Segmento', C.segmento],
    ['Unidade', 'Volume em toneladas; preços em R$/kg líquidos de desconto, sem impostos, CIF.'],
    ['Aba Peers', 'Perfil de cada peer.'],
    ['Aba Benchmark', 'Uma linha por peer × grade × trimestre: volume, preço de tabela médio, desconto médio, preço líquido e prazo de pagamento.'],
  ];
  info.forEach((r, i) => { lm.getCell(3 + i, 1).value = r[0]; lm.getCell(3 + i, 1).font = { ...FONT, bold: true }; lm.getCell(3 + i, 2).value = r[1]; lm.getCell(3 + i, 2).font = FONT; lm.getCell(3 + i, 2).alignment = { wrapText: true }; });

  const pe = wb.addWorksheet('Peers');
  pe.columns = [10, 44, 22, 18].map(w => ({ width: w }));
  header(pe, 1, ['Peer', 'Perfil', 'Porte relativo ao cliente', 'Prazo padrão (dias)']);
  PEERS.forEach((p, i) => { [p[0], p[1], p[2], p[4]].forEach((v, j) => { const c = pe.getCell(i + 2, j + 1); c.value = v; c.font = BLUE; if (j === 2) c.numFmt = '0.00"x"'; }); });

  const bm = wb.addWorksheet('Benchmark');
  bm.columns = [10, 11, 11, 13, 16, 12, 16, 12].map(w => ({ width: w }));
  header(bm, 1, ['Peer', 'SKU', 'Trimestre', 'Volume (t)', 'Preço Tabela Médio (R$/kg)', 'Desconto Médio', 'Preço Líquido (R$/kg)', 'Prazo (dias)']);
  let r = 2;
  for (const [peer, , porte, descBase, prazo] of PEERS) {
    for (const sku of SKUS) {
      if ((C.peersNaoCompram?.[peer] || []).includes(sku)) continue; // não compram essa grade
      for (const [y, t] of TRIS) {
        const meses = [1, 2, 3].map(k => idxMes(y, (t - 1) * 3 + k));
        const tabela = meses.reduce((s, i) => s + precos[sku][i], 0) / 3;
        const volCliente = pedidos.filter(p => p.sku === sku && p.data.getUTCFullYear() === y && Math.ceil((p.data.getUTCMonth() + 1) / 3) === t).reduce((s, p) => s + p.qtd, 0) / 1000;
        const vol = Math.round(volCliente * porte * between(0.8, 1.2));
        const desc = Math.max(0, descBase + gauss() * 0.004 - (porte < 0.5 ? 0.005 : 0));
        const liquido = tabela * (1 + AJUSTE_GRADE[sku] + gauss() * 0.006) * (1 - desc);
        const vals = [peer, sku, `${y}-T${t}`, vol, r2(tabela), Math.round(desc * 1000) / 1000, r2(liquido), prazo];
        const fmts = [null, null, null, NUM0, BRL, PCT, BRL, '0'];
        vals.forEach((v, j) => { const c = bm.getCell(r, j + 1); c.value = v; c.font = BLUE; if (fmts[j]) c.numFmt = fmts[j]; });
        r++;
      }
    }
  }
  bm.views = [{ state: 'frozen', ySplit: 1 }];
  bm.autoFilter = 'A1:H1';
  await wb.xlsx.writeFile(OUT_PEERS);
  console.log(`OK ${OUT_PEERS} — ${r - 2} linhas de benchmark`);
}

main().catch(e => { console.error(e); process.exit(1); });
