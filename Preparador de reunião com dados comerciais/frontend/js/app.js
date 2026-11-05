// Monta o painel da reunião em blocos a partir de /api/paineis/<arquivo>.
(() => {
  const $ = id => document.getElementById(id);
  let painelAtual = null;

  const BLOCOS = [
    ['visao', 'Visão geral'],
    ['macro', 'Macro e petróleo'],
    ['setor', 'Setor do cliente'],
    ['cliente', 'Análise do cliente'],
    ['peers', 'Comparação com peers'],
    ['projecoes', 'Projeções e cenários'],
    ['relacionamento', 'Relacionamento'],
    ['oportunidades', 'Oportunidades'],
    ['simulador', 'Simulador de negociação'],
    ['roteiro', 'Roteiro da reunião'],
    ['riscos', 'Riscos e próximos passos'],
  ];

  // ---------- Componentes ----------
  const STATUS = { positivo: ['positivo', '▲ bom'], negativo: ['negativo', '▼ crítico'], atencao: ['atencao', '● atenção'], neutro: ['neutro', ''] };

  // Ações rápidas de IA em cada bloco (aparecem só com o servidor e a IA disponíveis)
  const ACOES_EXTRAS = {
    peers: [['Como usar na reunião?', t => `Como uso a comparação com peers (bloco "${t}") na reunião sem expor dados de outros clientes? Dê 3 frases prontas.`]],
    projecoes: [['Simular outro cenário', () => 'Simule o faturamento e a tabela dos próximos 3 meses com Brent a US$ 90 constante e compare com o cenário da curva futura. Use a ferramenta projetar_cliente.']],
    oportunidades: [['Qual priorizar?', () => 'Das oportunidades do briefing, qual devo priorizar na reunião e por quê? Considere valor, probabilidade e risco para o relacionamento. Responda em até 6 linhas.']],
    roteiro: [['E-mail de follow-up', () => 'Rascunhe o e-mail de follow-up para o comprador do cliente depois da reunião, assumindo que seguimos o roteiro e chegamos ao cenário "aceitável". Tom profissional e cordial, até 180 palavras, com assunto.']],
  };
  function acoesIa(id, titulo) {
    const perguntar = texto => window.AssistenteIA?.perguntar(texto);
    return el('div', { class: 'acoes-ia' },
      el('button', { type: 'button', class: 'acao-ia', texto: 'Explicar', onclick: () => perguntar(`Explique o bloco "${titulo}" do painel de forma simples: o que os números mostram e por que importam para a reunião.`) }),
      el('button', { type: 'button', class: 'acao-ia', texto: 'Resumir', onclick: () => perguntar(`Resuma o bloco "${titulo}" em 3 linhas objetivas, com os números principais.`) }),
      (ACOES_EXTRAS[id] || []).map(([rotulo, prompt]) => el('button', { type: 'button', class: 'acao-ia', texto: rotulo, onclick: () => perguntar(prompt(titulo)) })));
  }

  function bloco(id, n, titulo, mensagem, ...conteudo) {
    return el('section', { class: 'bloco', id },
      el('div', { class: 'bloco-cabecalho' },
        el('span', { class: 'bloco-num', texto: String(n) }),
        el('div', {}, el('h2', { texto: titulo }), mensagem ? el('p', { class: 'bloco-mensagem', texto: mensagem }) : null),
        acoesIa(id, titulo)),
      ...conteudo);
  }
  const listaInsights = itens => el('ul', { class: 'insights' }, (itens || []).map(t => el('li', { texto: t })));
  const secao = (titulo, ...conteudo) => el('div', {}, el('h3', { class: 'subtitulo', texto: titulo }), ...conteudo);
  const chip = (texto, tom = '', grande = false) => el('span', { class: `chip ${tom}${grande ? ' grande' : ''}`, texto });
  const tomProbabilidade = p => ({ alta: 'critico', 'média': 'atencao', baixa: 'bom' }[p] || '');
  const tomDificuldade = d => ({ alta: 'critico', 'média': 'atencao', baixa: 'bom' }[d] || '');

  function manchetes(lista) {
    return el('div', { class: 'manchetes' }, (lista || []).map(m =>
      el('article', { class: 'manchete' },
        el('span', { class: 'fonte', texto: `${m.veiculo} · ${Fmt.data(m.data)}` }),
        el('h4', { texto: m.titulo }),
        el('p', { class: 'implicacao' }, el('strong', { texto: 'E daí? ' }), m.implicacao))));
  }

  function tileMacro(rotulo, d, { casas = 2, prefixo = '', sufixo = '' } = {}) {
    if (!d || d.erro) return el('div', { class: 'tile' }, el('div', { class: 'rotulo', texto: rotulo }), el('div', { class: 'valor', texto: '—' }), el('div', { class: 'var', texto: 'indisponível' }));
    const vars = [['1m', d['var_1m_%']], ['3m', d['var_3m_%']], ['12m', d['var_12m_%']]].filter(([, v]) => v !== undefined);
    return el('div', { class: 'tile' },
      el('div', { class: 'rotulo', texto: rotulo }),
      el('div', { class: 'valor', texto: `${prefixo}${Fmt.num(d.ultimo, casas)}${sufixo}` }),
      el('div', { class: 'var' }, vars.map(([p, v]) => el('span', { texto: `${v > 0 ? '▲' : v < 0 ? '▼' : '•'} ${p} ${Fmt.pct(v)}` })), el('span', { texto: Fmt.data(d.data) })));
  }

  // ---------- Blocos ----------
  function blocoVisao({ insights: i }) {
    return bloco('visao', 1, 'Visão geral', null,
      el('div', { class: 'postura' }, el('span', { class: 'rotulo', texto: 'Postura recomendada' }), el('p', { texto: i.postura_recomendada })),
      el('p', { class: 'mensagem-central', texto: i.mensagem_central }),
      el('div', { class: 'kpis' }, (i.kpis || []).map(k => {
        const [classe, icone] = STATUS[k.tom] || STATUS.neutro;
        return el('div', { class: `kpi ${classe}` },
          el('div', { class: 'rotulo' }, k.rotulo, icone ? el('span', { class: `icone-status ${classe}`, texto: icone }) : null),
          el('div', { class: 'valor', texto: k.valor }),
          el('div', { class: 'detalhe', texto: k.detalhe }));
      })),
      secao('Resumo executivo', listaInsights(i.resumo)));
  }

  function blocoMacro({ insights: { macro }, graficos: g }) {
    const t = g.macro_tiles;
    const hist = g.brent_historico;
    const { card, canvas } = Graficos.cartao({
      titulo: 'Brent — últimos 13 meses', nota: 'US$/barril, média mensal · FRED (dado real)',
      tabela: Graficos.tabela([{ t: 'Mês' }, { t: 'Brent (US$/bbl)', num: true }, { t: 'Dólar (R$/US$)', num: true }], hist.map(h => [Fmt.mes(h.mes), Fmt.num(h.brent, 2), Fmt.num(h.dolar, 4)])),
    });
    const el_ = bloco('macro', 2, 'Macro e petróleo', macro.mensagem,
      el('div', { class: 'tiles' },
        tileMacro('Brent (US$/bbl)', t.brent), tileMacro('WTI (US$/bbl)', t.wti), tileMacro('Dólar PTAX (R$)', t.dolar, { casas: 4 }),
        tileMacro('Selic meta', t.selic, { sufixo: '%' }), tileMacro('IPCA 12 meses', t.ipca, { sufixo: '%' })),
      el('div', { class: 'grade-2' }, card, secao('Leitura para resinas', listaInsights(macro.insights))),
      secao('Manchetes que importam', manchetes(macro.manchetes)));
    requestAnimationFrame(() => Graficos.linhas(canvas, { rotulos: hist.map(h => Fmt.mes(h.mes)), series: [{ nome: 'Brent', dados: hist.map(h => h.brent), cor: cssVar('--serie-1') }], formatoY: v => `US$ ${Fmt.num(v, 0)}` }));
    return el_;
  }

  function blocoSetor({ insights: { setor }, meta }) {
    const tomDemanda = { alta: 'bom', 'estável': 'atencao', queda: 'critico' }[setor.demanda_3m];
    const tomPoder = { alto: 'critico', 'médio': 'atencao', baixo: 'bom' }[setor.poder_barganha_cliente];
    return bloco('setor', 3, `Setor do cliente — ${meta.segmento}`, setor.mensagem,
      el('div', { class: 'chips' }, chip(`Demanda de resina (3 meses): ${setor.demanda_3m}`, tomDemanda, true), chip(`Poder de barganha do cliente: ${setor.poder_barganha_cliente}`, tomPoder, true)),
      el('p', { class: 'mensagem-central', texto: setor.justificativa }),
      secao('Indicadores e leitura', listaInsights(setor.insights)),
      secao('Notícias do setor', manchetes(setor.manchetes)));
  }

  // Histórico de volume: ano contra ano (sazonal) + acumulado de 12 meses, com filtro de grade.
  function cartaoHistoricoVolume(hv) {
    const NOMES_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const grades = Object.keys(hv.por_grade);
    const filtro = el('select', { 'aria-label': 'Filtrar grade' }, el('option', { value: '', texto: 'Todas as grades' }), grades.map(s => el('option', { value: s, texto: s })));
    const resumo = el('div', { class: 'chips' });
    const canvasAno = el('canvas', { role: 'img', 'aria-label': 'Volume mensal, ano contra ano' });
    const canvas12 = el('canvas', { role: 'img', 'aria-label': 'Volume acumulado de 12 meses' });
    const tabelaBox = el('div', { class: 'tabela-grafico tabela-wrap' });
    const card = el('div', { class: 'cartao' });
    const botaoTabela = el('button', { type: 'button', class: 'alternar-tabela', texto: 'Ver tabela', 'aria-pressed': 'false' });
    botaoTabela.addEventListener('click', () => {
      const ativo = card.classList.toggle('mostrando-tabela');
      botaoTabela.textContent = ativo ? 'Ver gráfico' : 'Ver tabela';
      botaoTabela.setAttribute('aria-pressed', String(ativo));
    });
    const areaGraficos = el('div', { class: 'grade-2 area-historico' },
      el('div', {}, el('p', { class: 'nota nota-ano', texto: 'Volume mensal (t) — ano contra ano' }), el('div', { class: 'area-grafico' }, canvasAno)),
      el('div', {}, el('p', { class: 'nota nota-12m', texto: 'Volume acumulado dos últimos 12 meses (t) — a tendência' }), el('div', { class: 'area-grafico' }, canvas12)));
    card.append(
      el('div', { class: 'cartao-topo' },
        el('div', {}, el('h3', { texto: 'Histórico de volume — estamos ganhando ou perdendo?' }), el('p', { class: 'nota', texto: `Toneladas faturadas por mês, de ${Fmt.mes(hv.meses[0])} a ${Fmt.mes(hv.meses[hv.meses.length - 1])}` })),
        botaoTabela),
      el('div', { class: 'filtros' }, el('label', { class: 'filtro' }, 'Grade', filtro)),
      resumo, areaGraficos, tabelaBox);

    let grafAno = null, graf12 = null;
    const soma = arr => arr.reduce((s, x) => s + (x || 0), 0);
    const chipVar = (rotulo, atual, anterior) => {
      if (!anterior) return null;
      const v = (atual / anterior - 1) * 100;
      return chip(`${v >= 0 ? '▲' : '▼'} ${rotulo}: ${Fmt.num(atual)} t vs ${Fmt.num(anterior)} t (${Fmt.pct(v)})`, v >= 0 ? 'bom' : 'critico', true);
    };

    function desenhar() {
      const serie = filtro.value ? hv.por_grade[filtro.value] : hv.total;
      const porMes = Object.fromEntries(hv.meses.map((m, i) => [m, serie[i]]));
      const ultimo = hv.meses[hv.meses.length - 1];
      const [anoAtual, mesAtual] = ultimo.split('-').map(Number);
      const anos = [anoAtual - 2, anoAtual - 1, anoAtual].filter(a => hv.meses.some(m => m.startsWith(String(a))));
      const valoresAno = a => NOMES_MES.map((_, i) => porMes[`${a}-${String(i + 1).padStart(2, '0')}`] ?? null);

      // Resumo: últimos 12m vs 12m anteriores e acumulado do ano vs mesmo período do ano anterior
      const n = serie.length;
      const u12 = soma(serie.slice(Math.max(0, n - 12))), a12 = soma(serie.slice(Math.max(0, n - 24), n - 12));
      const ytd = soma(valoresAno(anoAtual).slice(0, mesAtual)), ytdAnt = soma(valoresAno(anoAtual - 1).slice(0, mesAtual));
      resumo.replaceChildren(...[chipVar('Últimos 12 meses', u12, a12), chipVar(`Jan–${NOMES_MES[mesAtual - 1]}/${String(anoAtual).slice(2)} vs ${String(anoAtual - 1).slice(2)}`, ytd, ytdAnt)].filter(Boolean));

      // Acumulado de 12 meses
      const rot12 = [], val12 = [];
      for (let i = 11; i < n; i++) { rot12.push(Fmt.mes(hv.meses[i])); val12.push(Math.round(soma(serie.slice(i - 11, i + 1)))); }

      Graficos.destruir(grafAno); Graficos.destruir(graf12);
      const cores = { [anoAtual]: cssVar('--serie-1'), [anoAtual - 1]: cssVar('--serie-2'), [anoAtual - 2]: cssVar('--neutro-grafico') };
      // Volume sempre em barras (preço em linha)
      grafAno = Graficos.colunas(canvasAno, {
        rotulos: NOMES_MES,
        series: anos.map(a => ({ nome: String(a), dados: valoresAno(a), cor: cores[a] })),
        formatoY: v => `${Fmt.num(v)} t`,
      });
      // Avisa quando o eixo não começa em zero (escala ajustada para mostrar a variação)
      const aviso = s => (Graficos.minimoAjustado(s) > 0 ? ' · eixo ajustado, não começa em zero' : '');
      areaGraficos.querySelector('.nota-ano').textContent = 'Volume mensal (t) — ano contra ano' + aviso(anos.map(a => ({ dados: valoresAno(a) })));
      areaGraficos.querySelector('.nota-12m').textContent = 'Volume acumulado dos últimos 12 meses (t) — a tendência' + aviso([{ dados: val12 }]);
      graf12 = Graficos.colunas(canvas12, { rotulos: rot12, series: [{ nome: 'Acumulado 12 meses', dados: val12, cor: cssVar('--serie-1') }], formatoY: v => `${Fmt.num(v)} t` });

      tabelaBox.replaceChildren(Graficos.tabela([{ t: 'Mês' }, ...anos.map(a => ({ t: String(a), num: true }))], NOMES_MES.map((m, i) => [m, ...anos.map(a => Fmt.num(valoresAno(a)[i]))])));
    }
    filtro.addEventListener('change', desenhar);
    return { card, desenhar };
  }

  function blocoCliente({ insights: { cliente }, graficos: g }) {
    const fin = g.financeiro, tot = g.cliente_totais;
    const uso = fin.utilizacao_limite_pct ?? 0;
    const classeUso = uso >= 85 ? 'critico' : uso >= 70 ? 'atencao' : '';
    const grades = [...g.grades].sort((a, b) => (b.variacao_aa_pct ?? 0) - (a.variacao_aa_pct ?? 0));

    const c1 = Graficos.cartao({
      titulo: 'Volume por grade — variação em 12 meses', nota: 'Últimos 12 meses vs 12 meses anteriores (%)',
      tabela: Graficos.tabela([{ t: 'Grade' }, { t: 'Volume 12m (t)', num: true }, { t: 'Var. a/a', num: true }, { t: 'Share of wallet', num: true }], grades.map(x => [x.sku, Fmt.num(x.volume_12m_t), Fmt.pct(x.variacao_aa_pct), Fmt.pct(x.share_pct, 1, false)])),
    });
    const tv = g.tabela_vs_brent;
    const c2 = Graficos.cartao({
      titulo: 'Preço de tabela vs petróleo em reais', nota: `Índice (${Fmt.mes(tv.meses[0])} = 100). A tabela segue o Brent em R$ com 1 mês de defasagem.`,
      tabela: Graficos.tabela([{ t: 'Mês' }, { t: 'Tabela média (R$/kg)', num: true }, { t: 'Brent (R$/bbl)', num: true }, { t: 'Índice tabela', num: true }, { t: 'Índice Brent R$', num: true }],
        tv.meses.map((m, i) => [Fmt.mes(m), Fmt.num(tv['tabela_media_R$_kg'][i], 2), Fmt.num(tv['brent_R$_bbl'][i], 0), Fmt.num(tv.indice_tabela[i], 1), Fmt.num(tv.indice_brent_reais[i], 1)])),
    });

    const historico = g.historico_volume ? cartaoHistoricoVolume(g.historico_volume) : null;

    const tabelaGrades = el('div', { class: 'tabela-wrap' }, Graficos.tabela(
      [{ t: 'Grade' }, { t: 'Tabela atual (R$/kg)', num: true }, { t: 'Reajuste próx. mês', num: true }, { t: 'Desconto 3m', num: true }, { t: 'Share', num: true }, { t: 'Concorrente' }],
      g.grades.map(x => [x.sku, Fmt.num(x.tabela_atual, 2), Fmt.pct(x.reajuste_proximo_mes_pct), Fmt.pct(x.desconto_3m_pct, 1, false), Fmt.pct(x.share_pct, 1, false), x.concorrente || '—'])));

    const b = bloco('cliente', 4, 'Análise do cliente', cliente.mensagem,
      el('div', { class: 'tiles' },
        el('div', { class: 'tile' }, el('div', { class: 'rotulo', texto: 'Faturamento 12 meses' }), el('div', { class: 'valor', texto: Fmt.reaisCompacto(tot['faturamento_ultimos_12m_R$']) }), el('div', { class: 'var', texto: `${Fmt.pct(tot.variacao_faturamento_aa_pct)} a/a` })),
        el('div', { class: 'tile' }, el('div', { class: 'rotulo', texto: 'Volume 12 meses' }), el('div', { class: 'valor', texto: `${Fmt.num(tot.volume_ultimos_12m_t)} t` }), el('div', { class: 'var', texto: `${Fmt.pct(tot.variacao_volume_aa_pct)} a/a` })),
        el('div', { class: 'tile' }, el('div', { class: 'rotulo', texto: 'Uso do limite de crédito' }), el('div', { class: 'valor', texto: Fmt.pct(uso, 1, false) }),
          el('div', { class: `medidor ${classeUso}`, role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': uso }, el('span', { style: `width:${Math.min(uso, 100)}%` })),
          el('div', { class: 'var', texto: `${Fmt.reaisCompacto(fin['titulos_em_aberto_R$'])} de ${Fmt.reaisCompacto(fin['limite_credito_R$'])}` })),
        el('div', { class: 'tile' }, el('div', { class: 'rotulo', texto: 'Títulos vencidos' }), el('div', { class: 'valor', texto: Fmt.reaisCompacto(fin['titulos_vencidos_R$']) }), el('div', { class: 'var', texto: `${Fmt.pct(fin.pct_pagamentos_com_atraso_12m, 1, false)} dos pagamentos com atraso` })),
        el('div', { class: 'tile' }, el('div', { class: 'rotulo', texto: 'Entregas no prazo (12m)' }), el('div', { class: 'valor', texto: Fmt.pct(g.entregas_no_prazo_pct, 1, false) }), el('div', { class: 'var', texto: `Prazo de pagamento: ${fin.prazo_pagamento_atual_dias} dias` }))),
      historico ? historico.card : null,
      el('div', { class: 'grade-2' }, c1.card, c2.card),
      cliente.alertas?.length ? secao('Alertas', el('ul', { class: 'alertas' }, cliente.alertas.map(a => el('li', { texto: a })))) : null,
      secao('Principais leituras', listaInsights(cliente.insights)),
      secao('Grades — preço, reajuste e participação', tabelaGrades));

    requestAnimationFrame(() => {
      historico?.desenhar();
      Graficos.divergente(c1.canvas, { rotulos: grades.map(x => x.sku), valores: grades.map(x => x.variacao_aa_pct ?? 0), corPositivo: cssVar('--div-positivo'), corNegativo: cssVar('--div-negativo'), rotuloTooltip: 'Variação a/a' });
      Graficos.linhas(c2.canvas, { rotulos: tv.meses.map(Fmt.mes), series: [{ nome: 'Tabela média ponderada', dados: tv.indice_tabela, cor: cssVar('--serie-1') }, { nome: 'Brent em R$', dados: tv.indice_brent_reais, cor: cssVar('--serie-2') }], formatoY: v => Fmt.num(v, 0) });
    });
    return b;
  }

  function blocoPeers({ insights: { peers }, graficos: g }) {
    const comp = [...g.peers.comparacao].sort((a, b) => a.gap_vs_mediana_pct - b.gap_vs_mediana_pct);
    const c = Graficos.cartao({
      titulo: `Preço líquido vs mediana dos peers — ${g.peers.trimestre}`, nota: 'Azul: o cliente paga menos que o mercado (oportunidade). Vermelho: paga mais (risco de perda).',
      tabela: Graficos.tabela([{ t: 'Grade' }, { t: 'Cliente (R$/kg)', num: true }, { t: 'Mediana peers', num: true }, { t: 'Gap', num: true }], comp.map(x => [x.sku, Fmt.num(x['cliente_preco_liquido_R$_kg'], 2), Fmt.num(x['peers_preco_liquido_mediana_R$_kg'], 2), Fmt.pct(x.gap_vs_mediana_pct)])),
    });
    const tabela = el('div', { class: 'tabela-wrap' }, Graficos.tabela(
      [{ t: 'Grade' }, { t: 'Desconto cliente', num: true }, { t: 'Desconto peers', num: true }, { t: 'Prazo cliente', num: true }, { t: 'Prazo peers', num: true }, { t: 'Peers que pagam menos', num: true }, { t: 'Alinhar à mediana (R$/mês)', num: true }],
      comp.map(x => [x.sku, Fmt.pct(x.cliente_desconto_pct, 1, false), Fmt.pct(x.peers_desconto_mediana_pct, 1, false), `${x.cliente_prazo_dias} d`, `${x.peers_prazo_mediana_dias} d`, (x.posicao.match(/(d+) de (d+)/) || []).slice(1).join('/') || '—', Fmt.reaisCompacto(x['impacto_mensal_alinhar_a_mediana_R$'])])));
    const b = bloco('peers', 5, 'Comparação com peers', peers.mensagem,
      el('div', { class: 'grade-2' }, c.card, secao('Leitura', listaInsights(peers.insights))),
      secao('Desconto, prazo e valor em jogo', tabela));
    requestAnimationFrame(() => Graficos.divergente(c.canvas, {
      rotulos: comp.map(x => x.sku), valores: comp.map(x => x.gap_vs_mediana_pct),
      // gap negativo = cliente paga menos (oportunidade, azul); positivo = paga mais (risco, vermelho)
      corPositivo: cssVar('--div-negativo'), corNegativo: cssVar('--div-positivo'), rotuloTooltip: 'Gap vs mediana',
    }));
    return b;
  }

  // Nomes curtos para os cenários (rótulos de eixo cabem sem corte)
  const nomeCenario = n => ({ curva_futura: 'Curva futura', eia: 'EIA' }[n] || n.replace(/^alta.*$/i, 'Alta (+20%)').replace(/^baixa.*$/i, 'Baixa (−20%)'));

  function blocoProjecoes({ insights: { projecoes }, graficos: g }) {
    // Brent: histórico + curva futura + EIA, num único eixo (US$/bbl)
    const hist = Object.fromEntries(g.brent_historico.map(h => [h.mes, h.brent]));
    const curvaOk = g.brent_projecao.curva_futura.filter(c => !c.desatualizado);
    const curva = Object.fromEntries(curvaOk.map(c => [c.mes, c.valor]));
    const eia = Object.fromEntries(g.brent_projecao.eia.map(e => [e.mes, e.valor]));
    const meses = [...new Set([...Object.keys(hist), ...Object.keys(curva), ...Object.keys(eia)])].sort();
    const omitidos = g.brent_projecao.curva_futura.length - curvaOk.length;
    const c1 = Graficos.cartao({
      titulo: 'Brent: histórico, curva futura e projeção da EIA', alto: true,
      nota: `US$/barril · histórico FRED, curva NYMEX, EIA STEO (dados reais)${omitidos ? ` · ${omitidos} contrato(s) sem negócios recentes omitido(s)` : ''}`,
      tabela: Graficos.tabela([{ t: 'Mês' }, { t: 'Histórico', num: true }, { t: 'Curva futura', num: true }, { t: 'EIA', num: true }], meses.map(m => [Fmt.mes(m), Fmt.num(hist[m], 1), Fmt.num(curva[m], 1), Fmt.num(eia[m], 1)])),
    });

    // Cenários do cliente: valor do repasse (vs tabela congelada)
    const cen = [...g.cenarios].sort((a, b) => b.valor_repasse - a.valor_repasse);
    const iCentral = cen.findIndex(c => c.cenario === 'curva_futura');
    const c2 = Graficos.cartao({
      titulo: 'Cliente — valor do repasse no período por cenário', nota: `Faturamento a mais vs tabela congelada, ${g.cenarios[0]?.meses.map(m => Fmt.mes(m.mes)).join(', ')} · destaque: curva futura (cenário central)`,
      tabela: Graficos.tabela([{ t: 'Cenário' }, { t: 'Brent médio (US$)', num: true }, { t: 'Tabela no fim (R$/kg)', num: true }, { t: 'Faturamento (R$)', num: true }, { t: 'Valor do repasse', num: true }],
        cen.map(c => [nomeCenario(c.cenario), Fmt.num(c.meses.reduce((s, m) => s + m['brent_US$_bbl'], 0) / c.meses.length, 1), Fmt.num(c.meses[c.meses.length - 1]['tabela_media_ponderada_R$_kg'], 2), Fmt.reaisCompacto(c.faturamento_periodo), Fmt.reaisCompacto(c.valor_repasse)])),
    });

    const f = g.focus || {};
    const anos = f.IPCA ? Object.keys(f.IPCA) : [];
    const focus = f.IPCA ? el('div', { class: 'cartao' },
      el('div', {}, el('h3', { texto: 'Boletim Focus — consenso do mercado' }), el('p', { class: 'nota', texto: `Medianas · pesquisa de ${Fmt.data(f.data_pesquisa)} (dado real)` })),
      el('div', { class: 'tabela-wrap' }, Graficos.tabela([{ t: 'Indicador' }, ...anos.map(a => ({ t: a, num: true }))],
        [['IPCA (%)', 'IPCA', 2], ['Selic (%)', 'Selic', 2], ['PIB (%)', 'PIB Total', 2], ['Câmbio (R$/US$)', 'Câmbio', 2]].map(([r, k, c]) => [r, ...anos.map(a => Fmt.num(f[k]?.[a], c))])))) : null;

    const b = bloco('projecoes', 6, 'Projeções e cenários', projecoes.mensagem,
      c1.card,
      el('div', { class: 'grade-3' },
        el('div', { class: 'callout' }, el('h4', {}, chip('definido', 'bom'), 'Já está definido'), el('p', { texto: projecoes.ja_definido })),
        el('div', { class: 'callout' }, el('h4', {}, chip('incerto', 'atencao'), 'Ainda é incerto'), el('p', { texto: projecoes.incerto })),
        el('div', { class: 'callout' }, el('h4', {}, chip('estratégia', ''), 'Implicação para a reunião'), el('p', { texto: projecoes.implicacao_estrategica }))),
      el('div', { class: 'grade-2' }, c2.card, focus),
      secao('Leitura das projeções', listaInsights(projecoes.insights)));

    requestAnimationFrame(() => {
      Graficos.linhas(c1.canvas, {
        rotulos: meses.map(Fmt.mes),
        series: [
          { nome: 'Histórico', dados: meses.map(m => hist[m] ?? null), cor: cssVar('--serie-1') },
          { nome: 'Curva futura (NYMEX)', dados: meses.map(m => curva[m] ?? null), cor: cssVar('--serie-2'), tracejado: true },
          { nome: 'Projeção EIA', dados: meses.map(m => (m >= (Object.keys(hist).pop() || '') ? eia[m] ?? null : null)), cor: cssVar('--serie-3'), tracejado: true },
        ],
        formatoY: v => `US$ ${Fmt.num(v, 0)}`,
      });
      Graficos.barras(c2.canvas, { rotulos: cen.map(c => nomeCenario(c.cenario)), valores: cen.map(c => c.valor_repasse), cor: cssVar('--serie-1'), destaque: iCentral >= 0 ? iCentral : null, formato: Fmt.reaisCompacto, rotuloTooltip: 'Valor do repasse' });
    });
    return b;
  }

  function blocoRelacionamento({ insights: { relacionamento: r } }) {
    const tomChip = { positivo: 'bom', neutro: 'atencao', tenso: 'critico' }[r.tom_atual];
    const pend = quem => el('ul', { class: 'pendencias' }, r.pendencias.filter(p => p.responsavel === quem).map(p =>
      el('li', {}, el('div', {}, el('div', { texto: p.item }), p.desde ? el('div', { class: 'desde', texto: `desde ${Fmt.data(p.desde)}` }) : null),
        chip(p.situacao, { atrasada: 'critico', 'em aberto': 'atencao', 'concluída': 'bom' }[p.situacao]))));
    return bloco('relacionamento', 7, 'Histórico de relacionamento', r.mensagem,
      el('div', { class: 'chips' }, chip(`Tom atual: ${r.tom_atual}`, tomChip, true)),
      el('div', { class: 'grade-2' },
        secao('Linha do tempo', el('ol', { class: 'timeline' }, [...r.linha_do_tempo].sort((a, b) => a.data.localeCompare(b.data)).map(e =>
          el('li', { class: e.tom }, el('div', { class: 'data', texto: Fmt.data(e.data) }), el('div', { class: 'evento', texto: e.evento }))))),
        el('div', { style: 'display:flex;flex-direction:column;gap:18px' }, secao('Pendências nossas', pend('nós')), secao('Pendências do cliente', pend('cliente')))));
  }

  function blocoOportunidades({ insights: { oportunidades } }) {
    const comValor = oportunidades.filter(o => o.valor_mensal_reais > 0).sort((a, b) => b.valor_mensal_reais - a.valor_mensal_reais);
    const c = Graficos.cartao({
      titulo: 'Valor estimado por oportunidade', nota: 'R$ por mês (estimativas do briefing)',
      tabela: Graficos.tabela([{ t: 'Oportunidade' }, { t: 'R$/mês', num: true }, { t: 'Dificuldade' }], comValor.map(o => [o.titulo, Fmt.reaisCompacto(o.valor_mensal_reais), o.dificuldade])),
    });
    const b = bloco('oportunidades', 8, 'Oportunidades na negociação do mês', `${oportunidades.length} oportunidades mapeadas, ordenadas por valor.`,
      comValor.length ? c.card : null,
      el('div', { class: 'oportunidades' }, [...oportunidades].sort((a, b) => b.valor_mensal_reais - a.valor_mensal_reais).map(o =>
        el('article', { class: 'oportunidade' },
          el('div', { class: 'cab' }, el('h4', { texto: o.titulo }), chip(`dificuldade ${o.dificuldade}`, tomDificuldade(o.dificuldade))),
          el('div', { class: 'valor', texto: o.valor_texto }),
          el('p', { class: 'evidencia', texto: o.evidencia }),
          el('p', { class: 'proposta' }, el('strong', { texto: 'Proposta: ' }), o.proposta)))));
    if (comValor.length) requestAnimationFrame(() => Graficos.barras(c.canvas, { rotulos: comValor.map(o => o.titulo.length > 38 ? o.titulo.slice(0, 36) + '…' : o.titulo), valores: comValor.map(o => o.valor_mensal_reais), cor: cssVar('--serie-1'), formato: Fmt.reaisCompacto, rotuloTooltip: 'R$/mês' }));
    return b;
  }

  // ---------- Simulador de negociação (cálculo local, sem IA) ----------
  function blocoSimulador({ graficos: g, meta }) {
    const grades = g.grades.filter(x => x.tabela_atual && x.volume_12m_t);
    const mediana = Object.fromEntries((g.peers?.comparacao || []).map(c => [c.sku, c['peers_preco_liquido_mediana_R$_kg']]));
    const selic = (g.macro_tiles?.selic?.ultimo ?? 13.75) / 100;
    const fin = g.financeiro || {};
    const prazoAtual = fin.prazo_pagamento_atual_dias || 45;

    // Base mensal por grade: volume médio dos últimos 12 meses, tabela atual, desconto atual e reajuste da fórmula
    const base = grades.map(x => ({
      sku: x.sku, vol: x.volume_12m_t / 12, tabela: x.tabela_atual, desc: (x.desconto_3m_pct || 0) / 100, reajFormula: (x.reajuste_proximo_mes_pct || 0) / 100,
    }));

    // ----- Controles -----
    const controles = {};
    const controle = (id, rotulo, min, max, passo, valor, formato, ajuda) => {
      const input = el('input', { type: 'range', min, max, step: passo, value: valor, id: `sim-${id}`, 'aria-describedby': `sim-${id}-ajuda` });
      const saida = el('output', { for: `sim-${id}`, texto: formato(valor) });
      input.addEventListener('input', () => { saida.textContent = formato(+input.value); recalcular(); });
      controles[id] = { input, saida, formato };
      return el('div', { class: 'sim-controle' },
        el('label', { for: `sim-${id}` }, el('span', { texto: rotulo }), saida),
        input,
        el('p', { class: 'nota', id: `sim-${id}-ajuda`, texto: ajuda }));
    };
    const setar = (id, v) => { const c = controles[id]; c.input.value = v; c.saida.textContent = c.formato(+v); };

    const escopo = el('select', { 'aria-label': 'Aplicar a' }, el('option', { value: '', texto: 'Todas as grades' }), base.map(b => el('option', { value: b.sku, texto: b.sku })));
    escopo.addEventListener('change', recalcular);

    const painelControles = el('div', { class: 'sim-controles' },
      el('label', { class: 'filtro' }, 'Aplicar preço, desconto e volume a', escopo),
      controle('reajuste', 'Reajuste aplicado (% da fórmula)', 0, 150, 5, 100, v => `${v}%`, 'Quanto do reajuste da fórmula você aplica no mês. 100% = fórmula integral; 50% = escalonar.'),
      controle('preco', 'Ajuste extra de preço', -10, 10, 0.5, 0, v => Fmt.pct(v), 'Aumento ou redução adicional sobre a tabela (ex.: alinhar ao preço dos peers).'),
      controle('desconto', 'Desconto adicional (p.p.)', -3, 5, 0.25, 0, v => `${v > 0 ? '+' : ''}${Fmt.num(v, 2)} p.p.`, 'Positivo = mais desconto para o cliente; negativo = retirar desconto.'),
      controle('volume', 'Variação de volume', -40, 40, 1, 0, v => Fmt.pct(v, 0), 'Volume a mais (recuperar share) ou a menos (perder para concorrente).'),
      controle('prazo', 'Prazo de pagamento (dias)', 15, 120, 5, prazoAtual, v => `${v} dias`, `Hoje: ${prazoAtual} dias. Custo financeiro calculado com a Selic de ${Fmt.num(selic * 100, 2)}%.`));

    const PRESETS = [
      ['Fórmula integral', { reajuste: 100, preco: 0, desconto: 0, volume: 0, prazo: prazoAtual }],
      ['Escalonar 50%', { reajuste: 50, preco: 0, desconto: 0, volume: 0, prazo: prazoAtual }],
      ['Pedido do cliente', { reajuste: 0, preco: 0, desconto: 1, volume: 0, prazo: prazoAtual + 15 }],
      ['Pacote volume', { reajuste: 100, preco: 0, desconto: 1, volume: 10, prazo: prazoAtual }],
    ];
    const presets = el('div', { class: 'chips sim-presets' }, el('span', { class: 'nota', texto: 'Atalhos:' }),
      PRESETS.map(([nome, v]) => el('button', { type: 'button', class: 'acao-preset', texto: nome, onclick: () => { Object.entries(v).forEach(([k, x]) => setar(k, x)); recalcular(); } })),
      el('button', { type: 'button', class: 'acao-preset', texto: 'Limpar', onclick: () => { escopo.value = ''; Object.entries(PRESETS[0][1]).forEach(([k, x]) => setar(k, x)); recalcular(); } }));

    // ----- Resultados -----
    const tiles = el('div', { class: 'tiles sim-resultados' });
    const veredito = el('div', { class: 'callout sim-veredito' });
    const canvas = el('canvas', { role: 'img', 'aria-label': 'Faturamento mensal por cenário' });
    const tabelaGrades = el('div', { class: 'tabela-wrap' });
    const botaoIa = el('button', { type: 'button', class: 'botao so-ia', texto: '✦ Pedir avaliação à IA' });
    let grafico = null, ultimoTexto = '';

    function calcular({ reajPct, preco, desc, volume, prazo, sku }) {
      let fat = 0, vol = 0, bruto = 0;
      const linhas = base.map(b => {
        const alvo = !sku || sku === b.sku;
        const tabela = b.tabela * (1 + b.reajFormula * reajPct) * (1 + (alvo ? preco : 0));
        const d = Math.min(0.5, Math.max(0, b.desc + (alvo ? desc : 0)));
        const v = b.vol * (1 + (alvo ? volume : 0));
        const liquido = tabela * (1 - d);
        // Para comparar com os peers, tira o reajuste da fórmula (ele vale para todo o mercado)
        const comparavel = b.tabela * (1 + (alvo ? preco : 0)) * (1 - d);
        fat += v * 1000 * liquido; vol += v; bruto += v * 1000 * tabela;
        return { sku: b.sku, tabela, d, liquido, comparavel, v, mediana: mediana[b.sku] };
      });
      const custoFin = fat * (selic / 360) * prazo;
      return { fat, vol, desconto: 1 - fat / bruto, custoFin, liquidoMedio: fat / (vol * 1000), linhas, prazo };
    }

    function recalcular() {
      const sim = calcular({ reajPct: +controles.reajuste.input.value / 100, preco: +controles.preco.input.value / 100, desc: +controles.desconto.input.value / 100, volume: +controles.volume.input.value / 100, prazo: +controles.prazo.input.value, sku: escopo.value });
      const formula = calcular({ reajPct: 1, preco: 0, desc: 0, volume: 0, prazo: prazoAtual, sku: '' });
      const semReajuste = calcular({ reajPct: 0, preco: 0, desc: 0, volume: 0, prazo: prazoAtual, sku: '' });
      const resultado = s => s.fat - s.custoFin; // faturamento menos custo financeiro do prazo
      const dif = resultado(sim) - resultado(formula);
      const difSem = resultado(sim) - resultado(semReajuste);

      // Volume necessário para compensar a diferença contra a fórmula (mantendo os preços simulados)
      const volCompensa = dif < 0 ? (-dif / (sim.liquidoMedio * 1000 * (1 - selic / 360 * sim.prazo))) : 0;
      const pctCompensa = volCompensa / sim.vol * 100;

      // Exposição de crédito: saldo em aberto de hoje, escalado pelo faturamento e pelo prazo da proposta
      const abertoHoje = fin['titulos_em_aberto_R$'] || semReajuste.fat / 30 * prazoAtual;
      const aberto = abertoHoje * (sim.fat * sim.prazo) / (semReajuste.fat * prazoAtual);
      const limite = fin['limite_credito_R$'];
      const usoLimite = limite ? aberto / limite * 100 : null;

      // Posição contra os peers (preço líquido médio ponderado vs mediana)
      const comMediana = sim.linhas.filter(l => l.mediana);
      const gapPeers = comMediana.length ? (comMediana.reduce((s, l) => s + l.v * l.comparavel, 0) / comMediana.reduce((s, l) => s + l.v * l.mediana, 0) - 1) * 100 : null;

      const tile = (rotulo, valor, detalhe, tom = '') => el('div', { class: `tile ${tom}` }, el('div', { class: 'rotulo', texto: rotulo }), el('div', { class: 'valor', texto: valor }), el('div', { class: 'var', texto: detalhe }));
      tiles.replaceChildren(
        tile('Faturamento líquido / mês', Fmt.reaisCompacto(sim.fat), `Fórmula: ${Fmt.reaisCompacto(formula.fat)} · sem reajuste: ${Fmt.reaisCompacto(semReajuste.fat)}`),
        Math.abs(dif) < 1000
          ? tile('Resultado vs fórmula', '= igual à fórmula', 'Mexa nos controles para comparar')
          : tile('Resultado vs fórmula', `${dif > 0 ? '▲' : '▼'} ${Fmt.reaisCompacto(dif)}/mês`, `${Fmt.reaisCompacto(dif * 12)} por ano (já descontado o custo do prazo)`, dif > 0 ? 'tom-bom' : 'tom-critico'),
        Math.abs(difSem) < 1000
          ? tile('Resultado vs não reajustar', '= igual', 'Sem diferença contra congelar a tabela')
          : tile('Resultado vs não reajustar', `${difSem > 0 ? '▲' : '▼'} ${Fmt.reaisCompacto(difSem)}/mês`, 'Quanto a proposta rende contra congelar a tabela', difSem > 0 ? 'tom-bom' : 'tom-critico'),
        tile('Custo financeiro do prazo', `${Fmt.reaisCompacto(sim.custoFin)}/mês`, `${sim.prazo} dias · ${sim.prazo !== prazoAtual ? `${Fmt.reaisCompacto(sim.custoFin - formula.custoFin)}/mês vs hoje` : 'igual a hoje'}`),
        tile('Preço líquido médio', `${Fmt.reais(sim.liquidoMedio)}/kg`, gapPeers === null ? 'sem benchmark' : `${Fmt.pct(gapPeers)} vs mediana dos peers`),
        tile('Volume / mês', `${Fmt.num(sim.vol)} t`, `Desconto médio ${Fmt.pct(sim.desconto * 100, 1, false)}`),
        tile('Uso estimado do limite', usoLimite === null ? '—' : Fmt.pct(usoLimite, 0, false), limite ? `${Fmt.reaisCompacto(aberto)} em aberto de ${Fmt.reaisCompacto(limite)}` : 'limite não cadastrado', usoLimite > 90 ? 'tom-critico' : usoLimite > 75 ? 'tom-atencao' : ''));

      const frases = [];
      if (Math.abs(dif) < 1000) frases.push('A proposta rende o mesmo que aplicar a fórmula integral.');
      else if (dif < 0) frases.push(`A proposta rende ${Fmt.reaisCompacto(-dif)}/mês a menos que a fórmula. Para compensar só com volume, seria preciso vender +${Fmt.num(volCompensa)} t/mês (+${Fmt.num(pctCompensa, 1)}%).`);
      else frases.push(`A proposta rende ${Fmt.reaisCompacto(dif)}/mês a mais que a fórmula.`);
      if (sim.prazo > prazoAtual) frases.push(`Os ${sim.prazo - prazoAtual} dias extras de prazo custam ${Fmt.reaisCompacto(sim.custoFin - formula.custoFin)}/mês: peça contrapartida (volume ou preço).`);
      if (gapPeers !== null) frases.push(gapPeers < 0 ? `O cliente fica ${Fmt.pct(-gapPeers, 1, false)} abaixo da mediana dos peers: há espaço de preço.` : `O cliente fica ${Fmt.pct(gapPeers, 1, false)} acima da mediana dos peers: risco de perder volume para a concorrência.`);
      if (usoLimite > 90) frases.push('O uso do limite de crédito passa de 90%: condicione a proposta a revisão de limite ou garantias.');
      veredito.replaceChildren(el('h4', { texto: 'Leitura do cenário' }), el('ul', { class: 'insights' }, frases.map(f => el('li', { texto: f }))));

      tabelaGrades.replaceChildren(Graficos.tabela(
        [{ t: 'Grade' }, { t: 'Volume/mês (t)', num: true }, { t: 'Tabela (R$/kg)', num: true }, { t: 'Desconto', num: true }, { t: 'Líquido (R$/kg)', num: true }, { t: 'Mediana peers', num: true }, { t: 'vs peers', num: true }],
        sim.linhas.map(l => [l.sku, Fmt.num(l.v), Fmt.num(l.tabela, 2), Fmt.pct(l.d * 100, 1, false), Fmt.num(l.liquido, 2), l.mediana ? Fmt.num(l.mediana, 2) : '—', l.mediana ? Fmt.pct((l.comparavel / l.mediana - 1) * 100) : '—'])));

      const dados = [resultado(semReajuste), resultado(formula), resultado(sim)];
      if (!grafico) {
        grafico = Graficos.colunas(canvas, { rotulos: ['Sem reajuste', 'Fórmula integral', 'Simulado'], series: [{ nome: 'Faturamento − custo do prazo (R$/mês)', dados, cor: [cssVar('--neutro-grafico'), cssVar('--serie-1'), cssVar('--serie-2')] }], formatoY: Fmt.reaisCompacto });
      } else {
        grafico.data.datasets[0].data = dados;
        grafico.options.scales.y.min = Graficos.minimoAjustado([{ dados }]) || undefined;
        grafico.update('none');
      }

      ultimoTexto = `Cenário simulado para ${meta.cliente}${escopo.value ? ` (preço, desconto e volume só em ${escopo.value})` : ''}: reajuste de ${controles.reajuste.input.value}% da fórmula, ajuste extra de preço de ${controles.preco.saida.textContent}, desconto adicional de ${controles.desconto.saida.textContent}, volume ${controles.volume.saida.textContent}, prazo de ${sim.prazo} dias. ` +
        `Resultado: faturamento líquido de ${Fmt.reaisCompacto(sim.fat)}/mês, ${dif >= 0 ? '+' : '−'}${Fmt.reaisCompacto(Math.abs(dif))}/mês vs fórmula (já descontado o custo financeiro do prazo), preço líquido médio de ${Fmt.reais(sim.liquidoMedio)}/kg${gapPeers !== null ? ` (${Fmt.pct(gapPeers)} vs mediana dos peers)` : ''}.`;
    }

    botaoIa.addEventListener('click', () => window.AssistenteIA?.perguntar(`${ultimoTexto}\n\nAvalie esta proposta para a reunião: é boa para nós? Quais contrapartidas devo pedir, como o cliente deve reagir e como eu apresentaria? Responda em até 10 linhas.`));

    const b = bloco('simulador', 9, 'Simulador de negociação', 'Mexa nos controles e veja o efeito no faturamento, no custo do prazo, na posição contra os peers e no crédito. Base: volume médio mensal dos últimos 12 meses e preço da fórmula do próximo mês.',
      presets,
      el('div', { class: 'sim-grade' },
        painelControles,
        el('div', { class: 'sim-saidas' },
          tiles,
          el('div', { class: 'cartao' },
            el('div', {}, el('h3', { texto: 'Resultado mensal por cenário' }), el('p', { class: 'nota', texto: 'Faturamento líquido menos o custo financeiro do prazo · eixo ajustado' })),
            el('div', { class: 'area-grafico' }, canvas)),
          veredito,
          botaoIa)),
      secao('Detalhe por grade (cenário simulado)', tabelaGrades,
        el('p', { class: 'nota', texto: 'Comparação com a mediana dos peers sem o reajuste da fórmula do mês, que vale para todo o mercado.' })));
    requestAnimationFrame(recalcular);
    return b;
  }

  function blocoRoteiro({ insights: { roteiro: r } }) {
    return bloco('roteiro', 10, 'Roteiro da reunião', r.objetivo,
      el('div', { class: 'grade-2' },
        secao('Abertura sugerida', el('blockquote', { class: 'abertura', texto: r.abertura })),
        el('div', { class: 'walk-away' }, el('h4', { texto: '⛔ Walk-away — mínimo aceitável' }), el('ol', {}, r.walk_away.map(w => el('li', { texto: w }))))),
      secao('Argumentos e o dado que sustenta', el('div', { class: 'tabela-wrap' }, Graficos.tabela([{ t: 'Argumento' }, { t: 'Dado' }], r.argumentos.map(a => [a.argumento, a.dado])))),
      secao('Objeções prováveis', el('div', {}, r.objecoes.map(o => el('details', { class: 'objecao' }, el('summary', { texto: `“${o.objecao}”` }), el('p', { texto: o.resposta }))))),
      el('div', { class: 'grade-2' },
        secao('Concessões (dar → receber)', el('div', { class: 'tabela-wrap' }, Graficos.tabela([{ t: 'Nós damos' }, { t: 'Em troca de' }], r.concessoes.map(c => [c.damos, c.recebemos])))),
        secao('Perguntas para o cliente', el('ol', { class: 'perguntas' }, r.perguntas.map(p => el('li', { texto: p }))))));
  }

  function blocoRiscos({ insights: i, meta }) {
    const chave = `passos_${meta.id}_${meta.gerado_em}`;
    let marcados = {};
    try { marcados = JSON.parse(localStorage.getItem(chave) || '{}'); } catch { /* sem armazenamento local */ }
    const salvar = () => { try { localStorage.setItem(chave, JSON.stringify(marcados)); } catch { /* ignora */ } };
    const grupos = ['antes', 'na reunião', 'depois'];
    return bloco('riscos', 11, 'Riscos e próximos passos', null,
      secao('Riscos', el('div', { class: 'tabela-wrap' }, el('table', {},
        el('thead', {}, el('tr', {}, ['Risco', 'Probabilidade', 'Impacto', 'Mitigação'].map(h => el('th', { texto: h })))),
        el('tbody', {}, i.riscos.map(x => el('tr', {}, el('td', { texto: x.risco }), el('td', {}, chip(x.probabilidade, tomProbabilidade(x.probabilidade))), el('td', { texto: x.impacto }), el('td', { texto: x.mitigacao }))))))),
      el('div', { class: 'grade-3' }, grupos.map(gp => secao(`${gp[0].toUpperCase()}${gp.slice(1)}`, el('ul', { class: 'passos' }, i.proximos_passos.filter(p => p.quando === gp).map((p, k) => {
        const id = `${gp}-${k}`;
        const cb = el('input', { type: 'checkbox', checked: !!marcados[id], onchange: e => { marcados[id] = e.target.checked; salvar(); } });
        return el('li', {}, el('label', {}, cb, el('span', { texto: p.acao })));
      }))))));
  }

  // ---------- Montagem ----------
  function renderizar(painel) {
    painelAtual = painel;
    Graficos.destruirTodos();
    const { meta } = painel;
    document.title = `Painel — ${meta.cliente}`;
    $('titulo-cliente').textContent = meta.cliente;
    $('meta').textContent = [meta.data_reuniao ? `Reunião em ${Fmt.data(meta.data_reuniao)}` : null, meta.kam ? `GC ${meta.kam}` : null, `Preparado em ${Fmt.data(meta.gerado_em)}`, meta.modelo].filter(Boolean).join(' · ');
    $('aviso-ficticio').hidden = !meta.dados_ficticios;

    const main = $('conteudo');
    main.replaceChildren();
    const construtores = [blocoVisao, blocoMacro, blocoSetor, blocoCliente, blocoPeers, blocoProjecoes, blocoRelacionamento, blocoOportunidades, blocoSimulador, blocoRoteiro, blocoRiscos];
    for (const fn of construtores) {
      try { main.append(fn(painel)); } catch (e) { console.error(e); main.append(el('section', { class: 'bloco' }, el('p', { class: 'erro-carga', texto: `Não foi possível montar um bloco (${fn.name}).` }))); }
    }
    $('nav-blocos').replaceChildren(...BLOCOS.map(([id, nome], i) => el('li', {}, el('a', { href: `#${id}`, 'data-bloco': id }, el('span', { class: 'num', texto: String(i + 1) }), nome))));
    observarNavegacao();
  }

  function observarNavegacao() {
    const links = [...document.querySelectorAll('#nav-blocos a')];
    const obs = new IntersectionObserver(entradas => {
      for (const e of entradas) if (e.isIntersecting) links.forEach(a => a.classList.toggle('ativo', a.dataset.bloco === e.target.id));
    }, { rootMargin: '-20% 0px -70% 0px' });
    document.querySelectorAll('section.bloco').forEach(s => obs.observe(s));
  }

  // Fonte dos painéis: servidor local, ou vários painéis embutidos na página (versão exportada da carteira)
  const EMBUTIDOS = window.PAINEIS_EMBUTIDOS || null;
  const fonte = {
    lista: async () => EMBUTIDOS
      ? EMBUTIDOS.map(p => ({ arquivo: p.arquivo, ...p.meta, resumo: { var_volume_pct: p.graficos?.cliente_totais?.variacao_volume_aa_pct ?? null } }))
      : fetch('/api/paineis').then(r => r.json()),
    clientes: async () => (EMBUTIDOS ? [] : fetch('/api/clientes').then(r => r.json()).catch(() => [])),
    painel: async arquivo => {
      if (EMBUTIDOS) return EMBUTIDOS.find(p => p.arquivo === arquivo);
      const r = await fetch(`/api/paineis/${encodeURIComponent(arquivo)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
  };

  async function carregar(arquivo) {
    renderizar(await fonte.painel(arquivo));
    window.PainelApp.arquivo = arquivo;
    document.dispatchEvent(new CustomEvent('painel-carregado', { detail: { arquivo, meta: painelAtual.meta } }));
  }

  // ---------- Seleção de cliente e de briefing ----------
  let paineis = [], clientes = [], clienteAtual = null;

  // Lista de clientes (barra lateral): nome, segmento, último briefing e variação de volume em 12 meses
  function desenharListaClientes() {
    const itens = clientes.map(c => {
      const ultimo = paineis.find(p => p.id === c.id);
      const varVol = ultimo?.resumo?.var_volume_pct;
      const tendencia = varVol == null ? null : el('span', { class: `tendencia ${varVol >= 0 ? 'alta' : 'queda'}`, title: 'Volume dos últimos 12 meses vs 12 meses anteriores', texto: `${varVol >= 0 ? '▲' : '▼'} ${Fmt.pct(varVol)} vol.` });
      return el('li', {},
        el('button', { type: 'button', class: `item-cliente${c.id === clienteAtual ? ' ativo' : ''}`, 'aria-current': c.id === clienteAtual ? 'true' : null, onclick: () => escolherCliente(c.id) },
          el('span', { class: 'nome', texto: c.nome }),
          el('span', { class: 'detalhe', texto: (c.segmento || '').replace(/_/g, ' ') }),
          el('span', { class: 'linha' }, el('span', { class: 'data', texto: ultimo ? `Briefing ${Fmt.data(ultimo.gerado_em)}` : 'Sem briefing' }), tendencia)));
    });
    $('lista-clientes').replaceChildren(...itens);
    $('painel-clientes').hidden = !clientes.length;
  }

  // Mostra os briefings do cliente escolhido; se ele ainda não tem nenhum, oferece gerar.
  async function escolherCliente(id, abrir) {
    painelAtual = null;
    clienteAtual = id;
    desenharListaClientes();
    const doCliente = paineis.filter(p => p.id === id);
    const sel = $('seletor-painel');
    sel.replaceChildren(...doCliente.map(p => el('option', { value: p.arquivo, texto: `${Fmt.data(p.gerado_em)}${p.data_reuniao ? ` · reunião ${Fmt.data(p.data_reuniao)}` : ''}` })));
    sel.disabled = !doCliente.length;
    if (doCliente.length) {
      const alvo = abrir && doCliente.some(p => p.arquivo === abrir) ? abrir : doCliente[0].arquivo;
      sel.value = alvo;
      return carregar(alvo);
    }
    // Cliente sem briefing ainda
    const c = clientes.find(x => x.id === id) || { id, nome: id };
    Graficos.destruirTodos();
    window.PainelApp.arquivo = null;
    document.title = `Painel — ${c.nome}`;
    $('titulo-cliente').textContent = c.nome;
    $('meta').textContent = c.segmento ? `Segmento: ${c.segmento}` : '';
    $('aviso-ficticio').hidden = true;
    $('nav-blocos').replaceChildren();
    $('conteudo').replaceChildren(el('section', { class: 'bloco vazio' },
      el('h2', { texto: `Ainda não há briefing de ${c.nome}` }),
      el('p', { class: 'mensagem-central', texto: 'O agente busca notícias, indicadores e projeções de hoje, analisa o histórico do cliente e monta o painel em cerca de 10 minutos.' }),
      el('div', {}, el('button', { type: 'button', class: 'botao botao-primario so-ia', texto: `＋ Gerar briefing de ${c.nome}`, onclick: () => window.AssistenteIA?.novoBriefing(c.id) })),
      el('p', { class: 'nota', texto: `Pelo terminal: npm run briefing -- --cliente ${c.id}` })));
    document.dispatchEvent(new CustomEvent('painel-carregado', { detail: { arquivo: null, meta: null } }));
  }

  // Recarrega clientes e painéis e abre o indicado (usado também depois de gerar um briefing pela tela)
  async function recarregarLista(abrir) {
    [paineis, clientes] = await Promise.all([
      fonte.lista(),
      fonte.clientes(),
    ]);
    // Clientes do cadastro + clientes que só aparecem nos painéis
    for (const p of paineis) if (!clientes.some(c => c.id === p.id)) clientes.push({ id: p.id, nome: p.cliente, segmento: p.segmento });
    const painelAbrir = paineis.find(p => p.arquivo === abrir);
    const idCliente = painelAbrir?.id || clienteAtual || paineis[0]?.id || clientes[0]?.id;
    if (idCliente) await escolherCliente(idCliente, abrir);
  }
  window.PainelApp = { arquivo: null, recarregarLista, meta: () => painelAtual?.meta, clienteSelecionado: () => clienteAtual };

  async function iniciar() {
    // Versão exportada (arquivo único para e-mail): os dados vêm embutidos na página, sem servidor.
    if (EMBUTIDOS && window.MODO_IMPRESSAO) Chart.defaults.animation = false;
    if (window.PAINEL_EMBUTIDO) {
      document.querySelectorAll('.seletor').forEach(s => { s.hidden = true; });
      if (window.MODO_IMPRESSAO) Chart.defaults.animation = false;
      renderizar(window.PAINEL_EMBUTIDO);
      return;
    }
    try {
      $('seletor-painel').addEventListener('change', e => carregar(e.target.value));
      await recarregarLista();
      if (!clientes.length) {
        $('titulo-cliente').textContent = 'Nenhum cliente cadastrado';
        $('conteudo').replaceChildren(el('p', { class: 'erro-carga', texto: 'Cadastre clientes em backend/dados/clientes.json e recarregue a página.' }));
      }
    } catch (e) {
      console.error(e);
      $('conteudo').replaceChildren(el('p', { class: 'erro-carga', texto: 'Não foi possível carregar o painel. O servidor está rodando? (npm run painel)' }));
    }
  }

  $('botao-imprimir').addEventListener('click', () => {
    document.querySelectorAll('details.objecao').forEach(d => { d.open = true; });
    window.print();
  });
  // Tema do sistema mudou: redesenha os gráficos com as novas cores.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => painelAtual && renderizar(painelAtual));

  iniciar();
})();
