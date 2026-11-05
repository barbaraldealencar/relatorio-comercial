// Configuração dos clientes de demonstração (dados FICTÍCIOS) usados por gerar_dados_demo.js.
// Cada cliente define seus produtos (grades de resina), sazonalidade, eventos da história comercial,
// cadastro, interações e o grupo de peers do segmento.
//
// Linha de produto: [sku, descrição, família, aplicação no cliente, lote mínimo kg, lead time dias,
//                    preço base jan/23 R$/kg, volume mensal base kg, pedidos/mês, sazonalidade (12 meses),
//                    crescimento a/a, sensibilidade ao petróleo]

// ---------- Sazonalidades ----------
const FAN = [0.9, 0.8, 0.6, 0.5, 0.5, 0.7, 1.1, 1.3, 1.5, 1.6, 1.3, 1.0];          // ventiladores (pico jul-nov)
const AF = [0.8, 0.8, 0.9, 0.9, 1.0, 1.1, 1.2, 1.4, 1.4, 1.3, 0.9, 0.7];           // air fryer (Black Friday/Natal)
const FLAT = [0.9, 0.9, 1.0, 1.0, 1.0, 1.0, 1.0, 1.1, 1.1, 1.1, 1.0, 0.9];
const MIX = FAN.map((v, i) => (v + AF[i] + FLAT[i]) / 3);
const LIMPEZA = [1.0, 0.95, 1.0, 0.95, 0.95, 0.9, 0.95, 1.0, 1.05, 1.1, 1.1, 1.05];
const AGRO = [0.7, 0.7, 0.8, 0.8, 0.9, 1.1, 1.3, 1.4, 1.4, 1.2, 0.9, 0.7];         // bombonas para a safra de verão
const HPC = [0.9, 0.9, 0.95, 0.95, 1.0, 1.0, 1.0, 1.05, 1.1, 1.15, 1.1, 0.9];      // higiene e cosméticos (pico no 4º tri)

export const CONFIGS = {
  // =====================================================================
  mondial: {
    nome: 'Mondial',
    seed: 20261008,
    arquivoCliente: 'clientes/base_cliente_mondial.xlsx',
    arquivoPeers: 'peers/base_peers_eletroportateis.xlsx',
    segmento: 'eletroportateis',
    segmentoNome: 'Eletroportáteis',
    produtos: [
      ['PP-H125', 'PP homopolímero injeção IF 25', 'Polipropileno', 'Carcaças, bases e acessórios (todas as linhas)', 25000, 10, 8.90, 900000, 2, MIX, 0.04, 0.60],
      ['PP-C110', 'PP copolímero heterofásico IF 10', 'Polipropileno', 'Bases e pés de ventilador, peças com impacto', 25000, 12, 9.40, 350000, 2, FAN, 0.00, 0.60],
      ['PP-R250', 'PP random clarificado IF 25', 'Polipropileno', 'Copos de liquidificador e jarras', 12500, 12, 9.90, 180000, 1, FLAT, 0.02, 0.55],
      ['PP-T20', 'Composto PP com 20% de talco', 'Compostos', 'Carcaças de air fryer (resistência térmica)', 12500, 15, 10.60, 260000, 1, AF, 0.15, 0.45],
      ['HIPS-450', 'Poliestireno alto impacto (HIPS)', 'Estirênicos', 'Gabinetes, painéis e hélices de ventilador', 12500, 12, 10.20, 220000, 1, FAN, -0.03, 0.65],
      ['GPPS-525', 'Poliestireno cristal (GPPS)', 'Estirênicos', 'Peças transparentes e tampas', 12500, 12, 9.60, 90000, 1, FLAT, 0.00, 0.65],
      ['ABS-750', 'ABS natural para injeção', 'Estirênicos', 'Painéis premium e air fryer digital', 10000, 20, 13.40, 120000, 1, AF, 0.10, 0.50],
      ['PEBD-F23', 'PEBD para filme de embalagem', 'Polietilenos', 'Filmes e sacos de embalagem', 10000, 10, 9.10, 70000, 1, AF, 0.05, 0.55],
    ],
    // ABS: perda de volume para importado a partir de jun/2026
    ajusteVolume: (sku, y, m) => (sku === 'ABS-750' && (y > 2026 || (y === 2026 && m >= 6)) ? 0.7 : 1),
    descontoExtra: y => (y >= 2025 ? 0.01 : 0), // acordo anual 2025 (+1 p.p.)
    prazo: (y, m) => (y > 2024 || (y === 2024 && m >= 7) ? 60 : 45),
    perfilPagamento: [0.80, 0.95], // fração em dia; fração até atraso curto
    atrasoExtra: (sku, y, m) => (sku.startsWith('PP-') && y === 2025 && m >= 2 && m <= 3 ? [5, 15] : null),
    observacao: (sku, y, m, atraso) => {
      if (sku === 'HIPS-450' && y === 2024 && m === 6) return 'RNC-2024-017: pontos pretos/contaminação — 3,2 t devolvidas';
      if (atraso) return 'Atraso por parada programada de fornecedor de propeno';
      if (sku === 'ABS-750' && y === 2025 && m === 9) return 'Pedido emergencial — Black Friday';
      return null;
    },
    planta: r => (r < 0.72 ? 'Conceição do Jacuípe-BA' : 'Manaus-AM'),
    cadastro: D => [
      ['Cliente', 'Mondial (dados fictícios para demonstração)'],
      ['Código interno', 'CLI-000127'],
      ['CNPJ', '00.000.000/0001-00 (fictício)'],
      ['Segmento', 'eletroportateis'],
      ['Descrição do negócio', 'Fabricante de eletroportáteis: ventiladores, air fryers, liquidificadores, cuidados pessoais'],
      ['Plantas de entrega', 'Conceição do Jacuípe-BA (principal) | Manaus-AM'],
      ['Cliente desde', D(2017, 4, 1)],
      ['Classificação', 'A — Cliente estratégico'],
      ['Key Account Manager', 'Ana Ribeiro'],
      ['Contato compras (cliente)', 'Carlos Menezes — Gerente de Suprimentos — carlos.menezes@exemplo.com'],
      ['Contato qualidade (cliente)', 'Juliana Prado — Coordenadora de Qualidade de Fornecedores — juliana.prado@exemplo.com'],
      ['Contato financeiro (cliente)', 'Roberto Lima — Contas a Pagar — roberto.lima@exemplo.com'],
      ['Prazo de pagamento atual (dias)', 60],
      ['Limite de crédito (R$)', 80000000],
      ['Títulos em aberto (R$)', null],
      ['Utilização do limite', { formula: 'IFERROR(B17/B16,0)' }],
      ['Contrato vigente', 'Fornecimento anual 2026 — vigência 01/01/2026 a 31/12/2026; reajuste mensal por fórmula (petróleo + câmbio)'],
      ['Incoterm', 'CIF (frete por conta do fornecedor)'],
      ['Concorrentes no cliente', 'Petroquímica nacional B (PP), importadores asiáticos (ABS, HIPS), trading coreana (PP compostos)'],
      ['Observações', 'Sazonalidade forte: ventilação concentra compras de jul a nov; air fryer de ago a out (Black Friday / Natal).'],
    ],
    consumoAnualT: { 'PP-H125': 16500, 'PP-C110': 7800, 'PP-R250': 2800, 'PP-T20': 6200, 'HIPS-450': 4300, 'GPPS-525': 1500, 'ABS-750': 2900, 'PEBD-F23': 1400 },
    concorrente: { 'PP-H125': 'Petroquímica nacional B', 'PP-C110': 'Petroquímica nacional B', 'PP-R250': 'Importado (Oriente Médio)', 'PP-T20': 'Trading coreana (compostos)', 'HIPS-450': 'Importado Ásia', 'GPPS-525': 'Importado Ásia', 'ABS-750': 'Importado Ásia (Coreia/Taiwan)', 'PEBD-F23': 'Distribuidor regional' },
    interacoes: D => [
      [D(2023, 1, 18), 'Reunião de planejamento', 'Ana Ribeiro', 'Carlos Menezes', 'Forecast 2023: Mondial projeta crescimento de air fryer e estabilidade em ventilação. Pede previsibilidade de preço.'],
      [D(2023, 6, 6), 'Visita técnica', 'Marcos Tavares (Assist. Técnica)', 'Juliana Prado', 'Homologação do composto PP-T20 para a nova air fryer 5 L. Aprovado após teste térmico.'],
      [D(2023, 11, 9), 'Pesquisa de satisfação', 'Ana Ribeiro', 'Carlos Menezes', 'Nota 8,5/10. Melhorar comunicação antecipada de reajustes.'],
      [D(2024, 3, 12), 'Negociação comercial', 'Ana Ribeiro', 'Carlos Menezes', 'Cliente pede fórmula de preço transparente. Acordada fórmula mensal: Brent em R$ (defasagem 1 mês) + componente fixo.'],
      [D(2024, 6, 19), 'Reclamação de qualidade', 'Marcos Tavares (Assist. Técnica)', 'Juliana Prado', 'RNC-2024-017: pontos pretos em lote de HIPS-450; 3,2 t devolvidas. Ação corretiva na extrusora e filtro de tela.'],
      [D(2024, 6, 28), 'Negociação comercial', 'Ana Ribeiro', 'Roberto Lima', 'Prazo estendido de 45 para 60 dias a partir de jul/2024, em troca de volume mínimo anual de PP.'],
      [D(2024, 12, 3), 'Reunião de planejamento', 'Ana Ribeiro', 'Carlos Menezes', 'Acordo anual 2025: +1 p.p. de desconto em todos os pedidos, com meta de volume em PP-T20 e ABS.'],
      [D(2025, 1, 21), 'Alerta de fornecimento', 'Paula Nunes (Supply)', 'Carlos Menezes', 'Aviso de parada programada do fornecedor de propeno em fev-mar/2025. Risco de atraso em grades de PP.'],
      [D(2025, 4, 10), 'Reclamação de entrega', 'Paula Nunes (Supply)', 'Carlos Menezes', 'Insatisfação com atrasos de PP no 1º tri. Plano: estoque de segurança de 2 semanas em Camaçari.'],
      [D(2025, 7, 30), 'Reunião de planejamento', 'Ana Ribeiro', 'Carlos Menezes', 'Black Friday 2025: Mondial pede reforço de 20% em PP-T20 e ABS entre ago e out.'],
      [D(2025, 11, 27), 'Pesquisa de satisfação', 'Ana Ribeiro', 'Carlos Menezes', 'Nota 7,8/10. Qualidade bem avaliada; preço de ABS considerado alto frente a importados.'],
      [D(2025, 12, 10), 'Renovação de contrato', 'Ana Ribeiro', 'Carlos Menezes', 'Contrato 2026 renovado com fórmula mensal, prazo de 60 dias e desconto por volume mantidos.'],
      [D(2026, 3, 18), 'Negociação de preço', 'Ana Ribeiro', 'Carlos Menezes', 'Mondial questiona velocidade do repasse do petróleo; pede teto trimestral de reajuste. Ficamos de avaliar.'],
      [D(2026, 6, 4), 'Alerta comercial', 'Ana Ribeiro', 'Carlos Menezes', 'Mondial passou a comprar parte do ABS de importador asiático (~30% do volume) por preço ~7% menor.'],
      [D(2026, 8, 19), 'Reunião mensal', 'Ana Ribeiro', 'Carlos Menezes', 'Ver ata 2026-08-19. Pressão por desconto adicional em PP; RFQ 2027 para ABS e HIPS com asiáticos.'],
      [D(2026, 9, 22), 'Reunião mensal', 'Ana Ribeiro', 'Carlos Menezes', 'Ver ata 2026-09-22. Forecast Q4 e pedido de proposta 2027 até 15/11.'],
    ],
    peers: [
      ['Peer A', 'Eletroportáteis — grande porte (SP)', 1.10, 0.025, 45],
      ['Peer B', 'Linha branca + portáteis (Sul)', 1.40, 0.035, 45],
      ['Peer C', 'Eletroportáteis — médio porte (MG)', 0.45, 0.010, 30],
      ['Peer D', 'Utilidades domésticas plásticas (SP)', 0.60, 0.015, 35],
      ['Peer E', 'Montadora de portáteis (Manaus)', 0.35, 0.020, 45],
    ],
    peersNaoCompram: { 'Peer C': ['PEBD-F23', 'GPPS-525'], 'Peer E': ['PEBD-F23', 'GPPS-525'] },
    // Prêmio/desconto do preço dos peers vs o cliente, por grade (cria oportunidades e ameaças plausíveis)
    ajusteGrade: { 'PP-H125': 0.015, 'PP-C110': 0.02, 'PP-R250': 0.0, 'PP-T20': 0.01, 'HIPS-450': 0.025, 'GPPS-525': 0.01, 'ABS-750': -0.06, 'PEBD-F23': 0.0 },
  },

  // =====================================================================
  globalpack: {
    nome: 'Globalpack',
    seed: 20261021,
    arquivoCliente: 'clientes/base_cliente_globalpack.xlsx',
    arquivoPeers: 'peers/base_peers_embalagens_sopro.xlsx',
    segmento: 'embalagens_sopro',
    segmentoNome: 'Embalagens plásticas sopradas',
    produtos: [
      ['PEAD-S5502', 'PEAD sopro IF 0,35 (frascos até 5 L)', 'Polietileno alta densidade', 'Frascos de limpeza, lubrificantes e alimentos (EBM)', 25000, 10, 8.60, 850000, 2, LIMPEZA, 0.02, 0.50],
      ['PEAD-HMW', 'PEAD alta massa molar (bombonas 20-50 L)', 'Polietileno alta densidade', 'Bombonas para agroquímicos e químicos', 25000, 12, 9.20, 420000, 2, AGRO, 0.04, 0.50],
      ['PEAD-FARMA', 'PEAD sopro grau farmacêutico', 'Polietileno alta densidade', 'Frascos farmacêuticos (IBM)', 12500, 15, 9.80, 90000, 1, FLAT, 0.06, 0.45],
      ['PEAD-PCR', 'PEAD reciclado pós-consumo (PCR), grau sopro', 'Reciclados', 'Frascos de limpeza com conteúdo reciclado', 10000, 15, 7.40, 45000, 1, LIMPEZA, 0.45, 0.20],
      ['PEBD-S20', 'PEBD sopro (frascos squeeze)', 'Polietileno baixa densidade', 'Frascos flexíveis de cosméticos e higiene', 10000, 10, 9.30, 140000, 1, HPC, 0.03, 0.50],
      ['PP-RS30', 'PP random clarificado para sopro (IBM)', 'Polipropileno', 'Frascos transparentes de higiene e farma', 12500, 12, 9.90, 180000, 1, HPC, 0.05, 0.55],
      ['PP-H-T25', 'PP homopolímero injeção (tampas e potes)', 'Polipropileno', 'Tampas, sobretampas e potes', 25000, 10, 8.90, 260000, 2, FLAT, 0.03, 0.60],
    ],
    // Perdas: ~35% do PEAD-HMW para PE americano a partir de mar/2026; leve perda de PEAD-S5502 para a nacional B no 2º semestre
    ajusteVolume: (sku, y, m) => {
      if (sku === 'PEAD-HMW' && (y > 2026 || (y === 2026 && m >= 3))) return 0.65;
      if (sku === 'PEAD-S5502' && y === 2026 && m >= 6) return 0.9;
      return 1;
    },
    descontoExtra: y => (y >= 2026 ? 0.005 : 0), // contrato 2026: +0,5 p.p.
    prazo: () => 45,
    perfilPagamento: [0.90, 0.98],
    atrasoExtra: (sku, y, m) => (/^PE/.test(sku) && sku !== 'PEAD-PCR' && y === 2025 && m >= 8 && m <= 9 ? [5, 12] : null),
    observacao: (sku, y, m, atraso) => {
      if (sku === 'PEAD-HMW' && y === 2025 && m === 11) return 'RNC-2025-031: stress cracking (ESCR) em bombonas de 20 L — 4,8 t devolvidas';
      if (sku === 'PEAD-PCR' && y === 2026 && m === 4) return 'Lote de PCR com odor acima do limite — reprocessado';
      if (atraso) return 'Atraso por parada não programada do fornecedor de eteno';
      return null;
    },
    planta: r => (r < 0.6 ? 'Vinhedo-SP' : r < 0.85 ? 'Unidade Nordeste' : 'Unidade Sul'),
    cadastro: D => [
      ['Cliente', 'Globalpack (dados comerciais fictícios para demonstração)'],
      ['Código interno', 'CLI-000214'],
      ['CNPJ', '00.000.000/0002-00 (fictício)'],
      ['Segmento', 'embalagens_sopro'],
      ['Descrição do negócio', 'Fabricante de embalagens plásticas sopradas (extrusão-sopro, injeção-sopro e sopro de PET): frascos, bombonas, potes e preformas para alimentos e bebidas, higiene e cosméticos, limpeza, farmacêutico, óleos lubrificantes e agroquímicos. Dados públicos (site da empresa): ~1 bilhão de embalagens/ano, ~1.100 funcionários, operação em 7 estados, reciclagem bottle-to-bottle.'],
      ['Plantas de entrega', 'Vinhedo-SP (principal) | Unidade Nordeste | Unidade Sul (nomes das unidades fictícios)'],
      ['Cliente desde', D(2015, 2, 1)],
      ['Classificação', 'A — Cliente estratégico'],
      ['Key Account Manager', 'Rafael Moura'],
      ['Contato compras (cliente)', 'Fernanda Souza — Gerente de Compras de Matérias-Primas — fernanda.souza@exemplo.com'],
      ['Contato qualidade (cliente)', 'Ricardo Alves — Engenheiro de Qualidade de Materiais — ricardo.alves@exemplo.com'],
      ['Contato financeiro (cliente)', 'Luciana Martins — Tesouraria — luciana.martins@exemplo.com'],
      ['Prazo de pagamento atual (dias)', 45],
      ['Limite de crédito (R$)', 50000000],
      ['Títulos em aberto (R$)', null],
      ['Utilização do limite', { formula: 'IFERROR(B17/B16,0)' }],
      ['Contrato vigente', 'Fornecimento anual 2026 — reajuste mensal por fórmula (Brent em R$ com 1 mês de defasagem + componente fixo); +0,5 p.p. de desconto; sem volume mínimo em PEAD-HMW'],
      ['Incoterm', 'CIF (frete por conta do fornecedor)'],
      ['Concorrentes no cliente', 'PE importado dos EUA via tradings (bombonas), Petroquímica nacional B (PEAD/PP), recicladores independentes (PCR)'],
      ['Observações', 'Agro concentra compras de jun a out (bombonas para a safra de verão); higiene e cosméticos com pico no 4º tri. Brand owners exigem conteúdo reciclado (PCR) crescente.'],
    ],
    consumoAnualT: { 'PEAD-S5502': 13000, 'PEAD-HMW': 7500, 'PEAD-FARMA': 1800, 'PEAD-PCR': 2600, 'PEBD-S20': 2400, 'PP-RS30': 3200, 'PP-H-T25': 4800 },
    concorrente: { 'PEAD-S5502': 'Petroquímica nacional B', 'PEAD-HMW': 'PE importado dos EUA (trading)', 'PEAD-FARMA': 'Importado (Europa)', 'PEAD-PCR': 'Recicladores independentes', 'PEBD-S20': 'Petroquímica nacional B', 'PP-RS30': 'Importado (Oriente Médio)', 'PP-H-T25': 'Petroquímica nacional B' },
    interacoes: D => [
      [D(2023, 2, 15), 'Reunião de planejamento', 'Rafael Moura', 'Fernanda Souza', 'Forecast 2023: crescimento em bombonas agro e em higiene/cosméticos; estabilidade em limpeza e lubrificantes.'],
      [D(2023, 8, 22), 'Visita técnica', 'Marcos Tavares (Assist. Técnica)', 'Ricardo Alves', 'Homologação do PEAD-FARMA para a linha de frascos farmacêuticos (injeção-sopro) em Vinhedo.'],
      [D(2024, 2, 20), 'Negociação comercial', 'Rafael Moura', 'Fernanda Souza', 'Acordada fórmula mensal de preço: Brent em R$ (defasagem 1 mês) + componente fixo, para PE e PP.'],
      [D(2024, 9, 10), 'Projeto de sustentabilidade', 'Rafael Moura', 'Fernanda Souza', 'Início do fornecimento de PEAD-PCR para frascos de limpeza de um brand owner multinacional (meta de 30% de PCR até 2027).'],
      [D(2025, 3, 12), 'Pesquisa de satisfação', 'Rafael Moura', 'Fernanda Souza', 'Nota 8,7/10. Elogio à assistência técnica; pedem mais disponibilidade de PCR.'],
      [D(2025, 8, 5), 'Alerta de fornecimento', 'Paula Nunes (Supply)', 'Fernanda Souza', 'Parada não programada no fornecedor de eteno: risco de atraso em PE em ago-set/2025.'],
      [D(2025, 10, 2), 'Reclamação de entrega', 'Paula Nunes (Supply)', 'Fernanda Souza', 'Atrasos de PE em ago-set impactaram o pico de bombonas agro. Cliente qualificou PE importado dos EUA como 2ª fonte.'],
      [D(2025, 11, 18), 'Reclamação de qualidade', 'Marcos Tavares (Assist. Técnica)', 'Ricardo Alves', 'RNC-2025-031: stress cracking (ESCR) em bombonas de 20 L com PEAD-HMW; 4,8 t devolvidas. Ajuste de janela de processo e lote de teste.'],
      [D(2025, 12, 9), 'Renovação de contrato', 'Rafael Moura', 'Fernanda Souza', 'Contrato 2026 renovado com +0,5 p.p. de desconto; Globalpack não garantiu volume mínimo em PEAD-HMW.'],
      [D(2026, 3, 10), 'Alerta comercial', 'Rafael Moura', 'Fernanda Souza', 'Globalpack passou ~35% do volume de PEAD-HMW para PE americano via trading, a preço ~9% menor (paridade de importação).'],
      [D(2026, 5, 14), 'Visita técnica', 'Marcos Tavares (Assist. Técnica)', 'Ricardo Alves', 'Teste de PEAD-PCR com menor odor aprovado; cliente quer dobrar o volume de PCR em 2027.'],
      [D(2026, 7, 21), 'Reunião mensal', 'Rafael Moura', 'Fernanda Souza', 'Ver ata 2026-07-21. Pedido de prazo de 60 dias e de preço para retomar bombonas.'],
      [D(2026, 9, 16), 'Reunião mensal', 'Rafael Moura', 'Fernanda Souza', 'Ver ata 2026-09-16. Safra 26/27: forecast de bombonas +12%; pedido de proposta 2027 com cota de PCR.'],
    ],
    peers: [
      ['Peer A', 'Sopradora multinacional — grande porte (SP)', 1.30, 0.020, 60],
      ['Peer B', 'Sopradora de lubrificantes e químicos (RJ)', 0.55, 0.015, 45],
      ['Peer C', 'Sopradora regional de limpeza (NE)', 0.40, 0.010, 30],
      ['Peer D', 'Fabricante de bombonas e galões agro (PR)', 0.70, 0.025, 45],
      ['Peer E', 'Sopradora de cosméticos por injeção-sopro (SP)', 0.35, 0.012, 45],
    ],
    peersNaoCompram: {
      'Peer B': ['PEAD-FARMA', 'PEBD-S20', 'PP-RS30'],
      'Peer C': ['PEAD-FARMA', 'PP-RS30', 'PEAD-HMW'],
      'Peer D': ['PEAD-FARMA', 'PEBD-S20', 'PP-RS30', 'PEAD-PCR'],
      'Peer E': ['PEAD-HMW', 'PEAD-PCR'],
    },
    ajusteGrade: { 'PEAD-S5502': 0.01, 'PEAD-HMW': -0.07, 'PEAD-FARMA': 0.03, 'PEAD-PCR': 0.04, 'PEBD-S20': 0.015, 'PP-RS30': 0.0, 'PP-H-T25': 0.01 },
  },
};
