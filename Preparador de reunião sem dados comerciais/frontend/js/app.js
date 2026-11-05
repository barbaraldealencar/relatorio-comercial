// Painel de reunião — versão SEM dados comerciais (só informações públicas de mercado).
(() => {
  const $ = id => document.getElementById(id);
  let painelAtual = null;

  const BLOCOS = [
    ['visao', 'Visão geral'],
    ['macro', 'Macro e frete'],
    ['mercado', 'Mercado da resina'],
    ['setor', 'Setor do cliente'],
    ['cliente', 'Perfil do cliente'],
    ['campo', 'Informações de campo'],
    ['projecoes', 'Projeções e cenários'],
    ['hipoteses', 'Hipóteses e descoberta'],
    ['roteiro', 'Roteiro da reunião'],
    ['riscos', 'Riscos e próximos passos'],
  ];

  // ---------- Componentes ----------
  const STATUS = { positivo: ['positivo', '▲ bom'], negativo: ['negativo', '▼ crítico'], atencao: ['atencao', '● atenção'], neutro: ['neutro', ''] };
  const ACOES_EXTRAS = {
    mercado: [['O que isso muda no preço?', () => 'Com base nos preços de importação das resinas e no Brent, quanto o preço de mercado deve mudar nos próximos 3 meses e como uso isso na reunião? Responda em até 8 linhas.']],
    roteiro: [['E-mail de follow-up', () => 'Rascunhe o e-mail de follow-up para o comprador do cliente depois da reunião, com base no roteiro. Tom profissional e cordial, até 180 palavras, com assunto.']],
    hipoteses: [['Priorizar perguntas', () => 'Das perguntas de descoberta, quais 3 são mais importantes para esta reunião e por quê?']],
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
        el('span', { class: 'bloco-num', texto: String(BLOCOS.findIndex(([b]) => b === id) + 1 || n) }),
        el('div', {}, el('h2', { texto: titulo }), mensagem ? el('p', { class: 'bloco-mensagem', texto: mensagem }) : null),
        acoesIa(id, titulo)),
      ...conteudo);
  }
  const listaInsights = itens => el('ul', { class: 'insights' }, (itens || []).map(t => el('li', { texto: t })));
  const secao = (titulo, ...conteudo) => el('div', {}, el('h3', { class: 'subtitulo', texto: titulo }), ...conteudo);
  const chip = (texto, tom = '', grande = false) => el('span', { class: `chip ${tom}${grande ? ' grande' : ''}`, texto });
  const tomProbabilidade = p => ({ alta: 'critico', 'média': 'atencao', baixa: 'bom' }[p] || '');
  function manchetes(lista) {
    return el('div', { class: 'manchetes' }, (lista || []).map(m =>
      el('article', { class: 'manchete' },
        el('span', { class: 'fonte', texto: `${m.veiculo} · ${Fmt.data(m.data)}` }),
        el('h4', { texto: m.titulo }),
        m.implicacao ? el('p', { class: 'implicacao' }, el('strong', { texto: 'E daí? ' }), m.implicacao) : null)));
  }
  function tileMacro(rotulo, d, { casas = 2, sufixo = '' } = {}) {
    if (!d || d.erro) return el('div', { class: 'tile' }, el('div', { class: 'rotulo', texto: rotulo }), el('div', { class: 'valor', texto: '—' }), el('div', { class: 'var', texto: 'indisponível' }));
    const vars = [['1m', d['var_1m_%']], ['3m', d['var_3m_%']], ['12m', d['var_12m_%']]].filter(([, v]) => v !== undefined);
    return el('div', { class: 'tile' }, el('div', { class: 'rotulo', texto: rotulo }), el('div', { class: 'valor', texto: `${Fmt.num(d.ultimo, casas)}${sufixo}` }),
      el('div', { class: 'var' }, vars.map(([p, v]) => el('span', { texto: `${v > 0 ? '▲' : v < 0 ? '▼' : '•'} ${p} ${Fmt.pct(v)}` })), el('span', { texto: Fmt.data(d.data) })));
  }
  // Filtro (select) com rótulo, no padrão dos cartões
  const filtro = (rotulo, opcoes, aoMudar) => {
    const s = el('select', { 'aria-label': rotulo }, opcoes.map(([v, t]) => el('option', { value: v, texto: t })));
    s.addEventListener('change', () => aoMudar(s.value));
    return { el: el('div', { class: 'filtros' }, el('label', { class: 'filtro' }, rotulo, s)), select: s };
  };

  // ---------- Blocos ----------
  function blocoVisao({ insights: i }) {
    return bloco('visao', 1, 'Visão geral', null,
      el('div', { class: 'postura' }, el('span', { class: 'rotulo', texto: 'Postura recomendada' }), el('p', { texto: i.postura_recomendada })),
      el('p', { class: 'mensagem-central', texto: i.mensagem_central }),
      el('div', { class: 'kpis' }, (i.kpis || []).map(k => {
        const [classe, icone] = STATUS[k.tom] || STATUS.neutro;
        return el('div', { class: `kpi ${classe}` }, el('div', { class: 'rotulo' }, k.rotulo, icone ? el('span', { class: `icone-status ${classe}`, texto: icone }) : null), el('div', { class: 'valor', texto: k.valor }), el('div', { class: 'detalhe', texto: k.detalhe }));
      })),
      i.insights_por_bloco?.length
        ? secao('O que levar de cada bloco', el('div', { class: 'tabela-wrap' }, Graficos.tabela(
          [{ t: 'Bloco' }, { t: 'Insight para usar na reunião' }],
          i.insights_por_bloco.map(x => [x.bloco, x.insight]))))
        : secao('Resumo executivo', listaInsights(i.resumo)));
  }

  // Macro: Brent, câmbio, frete internacional e referências de PE e PP.
  // Cada variável: gráfico dos últimos 12 meses (preço em linha) e tabela mês n-1 × mês n com a variação absoluta.
  function blocoMacro({ insights: { macro }, graficos: g }) {
    const vars = g.macro_mensal || [];
    const CASAS = { brent: 2, cambio: 4, frete: 0, resinas: 0 };
    const cores = [cssVar('--serie-1'), cssVar('--serie-2')];
    const desenhos = [];
    const cards = vars.map(v => {
      const casas = CASAS[v.id] ?? 2;
      const series = (v.series || []).filter(x => x.serie?.length);
      if (!series.length) return el('div', { class: 'cartao' }, el('h3', { texto: `${v.nome} (${v.unidade})` }), el('p', { class: 'nota', texto: `Dado indisponível agora · ${v.fonte}` }));
      const meses = [...new Set(series.flatMap(x => x.serie.map(p => p.mes)))].sort();
      const valor = (x, m) => x.serie.find(p => p.mes === m)?.valor ?? null;
      const peso = v.peso_no_preco_pct
        ? ` · peso no preço CIF: ${['PE', 'PP'].map(r => (v.peso_no_preco_pct[r] ? `${r} ${Fmt.num(v.peso_no_preco_pct[r].valor, 1)}%` : null)).filter(Boolean).join(', ')}`
        : '';
      const c = Graficos.cartao({
        titulo: `${v.nome} (${v.unidade})`,
        nota: `${v.serie_diaria?.length ? 'Diário, últimos 12 meses' : 'Últimos 12 meses'} · ${v.fonte}${peso}${v.ultimo_dia ? ` · último dia: ${Fmt.num(v.ultimo_dia.valor, casas)} em ${Fmt.data(v.ultimo_dia.data)}` : ''}`,
        tabela: Graficos.tabela([{ t: 'Mês' }, ...series.map(x => ({ t: x.nome, num: true }))], meses.map(m => [Fmt.mes(m), ...series.map(x => Fmt.num(valor(x, m), casas))])),
      });
      const n1 = series[0].n_1?.mes, n = series[0].n?.mes;
      // Mês corrente parcial (Brent e câmbio): "out/26 (até 27/10)"
      const ateN = series[0].n?.parcial ? ` (até ${Fmt.data(series[0].n.ate).slice(0, 5)})` : '';
      c.card.append(el('div', { class: 'tabela-wrap macro-nn' }, Graficos.tabela(
        [{ t: '' }, { t: n1 ? Fmt.mes(n1) : 'n-1', num: true }, { t: n ? `${Fmt.mes(n)}${ateN}` : 'n', num: true }, { t: 'Variação', num: true }],
        series.map(x => [x.nome, Fmt.num(x.n_1?.valor, casas), Fmt.num(x.n?.valor, casas), x.var_abs == null ? '—' : `${x.var_abs > 0 ? '+' : ''}${Fmt.num(x.var_abs, casas)}`]))));
      // Brent e câmbio têm cotação diária: o gráfico mostra cada dia; a tabela abaixo segue com as médias mensais
      const diaria = v.serie_diaria || [];
      if (diaria.length) desenhos.push(() => Graficos.linhas(c.canvas, {
        rotulos: diaria.map(x => Fmt.data(x.data)),
        series: [{ nome: series[0].nome, dados: diaria.map(x => x.valor), cor: cores[0] }],
        formatoY: y => Fmt.num(y, Math.min(casas, 2)),
      }));
      else desenhos.push(() => Graficos.linhas(c.canvas, {
        rotulos: meses.map(Fmt.mes),
        series: series.map((x, i) => ({ nome: x.nome, dados: meses.map(m => valor(x, m)), cor: cores[i % 2] })),
        formatoY: y => Fmt.num(y, Math.min(casas, 2)),
      }));
      return c.card;
    });
    const b = bloco('macro', 2, 'Macro: petróleo, câmbio, frete e resinas', macro.mensagem,
      vars.length ? el('div', { class: 'grade-2' }, cards) : el('p', { class: 'nota', texto: 'Indicadores mensais indisponíveis neste briefing.' }),
      secao('Leitura', listaInsights((macro.insights || []).slice(0, 3))),
      macro.manchetes?.length ? secao('Manchetes que importam', manchetes(macro.manchetes.slice(0, 3))) : null);
    requestAnimationFrame(() => desenhos.forEach(d => d()));
    return b;
  }

  function blocoMercado({ insights: { mercado }, graficos: g }) {
    const pos = (g.importacoes || []).filter(p => p.serie_mensal?.length);
    const cores = [cssVar('--serie-1'), cssVar('--serie-2'), cssVar('--serie-3')];
    const meses = [...new Set(pos.flatMap(p => p.serie_mensal.map(s => s.mes)))].sort();
    const valor = (p, m, campo) => p.serie_mensal.find(s => s.mes === m)?.[campo] ?? null;

    const cPreco = Graficos.cartao({
      titulo: 'Preço médio de importação (US$/t)', nota: 'FOB, sem frete e impostos · Comex Stat/MDIC (dado real). Referência de tendência do preço de mercado.',
      tabela: Graficos.tabela([{ t: 'Mês' }, ...pos.map(p => ({ t: p.posicao, num: true }))], meses.map(m => [Fmt.mes(m), ...pos.map(p => Fmt.num(valor(p, m, 'preco_US$_t')))])),
    });
    // Volume importado: barras, uma posição por vez (filtro)
    const canvasVol = el('canvas', { role: 'img', 'aria-label': 'Volume importado por mês' });
    const notaVol = el('p', { class: 'nota' });
    let grafVol = null;
    const fVol = filtro('Resina', pos.map(p => [p.posicao, `${p.posicao} — ${p.descricao}`]), v => desenharVolume(v));
    const cardVol = el('div', { class: 'cartao' }, el('div', {}, el('h3', { texto: 'Volume importado (t/mês)' }), notaVol), fVol.el, el('div', { class: 'area-grafico' }, canvasVol));
    function desenharVolume(cod) {
      const p = pos.find(x => x.posicao === cod) || pos[0];
      if (!p) return;
      const dados = meses.map(m => valor(p, m, 'volume_t'));
      notaVol.textContent = `${p.descricao} · Comex Stat${Graficos.minimoAjustado([{ dados }]) > 0 ? ' · eixo ajustado, não começa em zero' : ''}`;
      Graficos.destruir(grafVol);
      grafVol = Graficos.colunas(canvasVol, { rotulos: meses.map(Fmt.mes), series: [{ nome: 'Volume importado', dados, cor: cssVar('--serie-1') }], formatoY: v => `${Fmt.num(v / 1000, 0)} mil t` });
    }

    const resumo = el('div', { class: 'tabela-wrap' }, Graficos.tabela(
      [{ t: 'Resina' }, { t: 'Preço (US$/t)', num: true }, { t: '3 meses', num: true }, { t: '12 meses', num: true }, { t: 'Volume 12m (mil t)', num: true }, { t: 'Reação ao Brent', num: true }, { t: 'Projeção próximo mês', num: true }],
      pos.map(p => [`${p.posicao} — ${p.descricao}`, Fmt.num(p['preco_ultimo_US$_t']), Fmt.pct(p.preco_var_3m_pct), Fmt.pct(p.preco_var_12m_pct), Fmt.num(p.volume_12m_t / 1000, 0),
        p.elasticidade_preco_vs_brent != null ? `${Fmt.num(p.elasticidade_preco_vs_brent, 2)} (${p.defasagem_meses} m)` : '—',
        p.projecao_proximos_meses ? Fmt.pct(p.projecao_proximos_meses.variacao_preco_projetada_pct) : '—'])));

    const nomesResina = pos.map(p => ({ '3901': 'PE', '3902': 'PP' }[p.posicao] || p.posicao)).join(' e ');
    const b = bloco('mercado', 3, `Mercado de ${nomesResina || 'resinas'}`, mercado?.mensagem,
      el('div', { class: 'grade-2' }, cPreco.card, cardVol),
      secao('Resumo por resina', resumo, el('p', { class: 'nota', texto: 'Reação ao Brent: quanto o preço de importação varia para cada 1% do Brent, com a defasagem em meses. Projeção pela curva futura do Brent.' })),
      secao('Leitura', listaInsights(mercado?.insights)));
    requestAnimationFrame(() => {
      Graficos.linhas(cPreco.canvas, { rotulos: meses.map(Fmt.mes), series: pos.map((p, i) => ({ nome: `${p.posicao} ${p.descricao.split(' (')[0]}`, dados: meses.map(m => valor(p, m, 'preco_US$_t')), cor: cores[i % 3] })), formatoY: v => `US$ ${Fmt.num(v)}` });
      desenharVolume(fVol.select.value);
    });
    return b;
  }

  function blocoSetor({ insights: { setor }, graficos: g, meta }) {
    const series = (g.ibge || []).filter(s => s.serie?.length);
    const tomDemanda = { alta: 'bom', 'estável': 'atencao', queda: 'critico' }[setor.demanda_3m];
    const tomPoder = { alto: 'critico', 'médio': 'atencao', baixo: 'bom' }[setor.poder_barganha_cliente];
    // Variação contra o mesmo mês do ano anterior (último mês) — barras divergentes
    const cVar = Graficos.cartao({
      titulo: 'Indicadores do IBGE — último mês vs mesmo mês do ano anterior', nota: 'Produção industrial (PIM-PF) e vendas do varejo (PMC), volume · dado real',
      tabela: Graficos.tabela([{ t: 'Indicador' }, { t: 'Mês' }, { t: 'vs ano anterior', num: true }, { t: 'Acumulado 12m', num: true }], series.map(s => [s.nome, Fmt.mes(s.ultimo_mes), Fmt.pct(s.var_aa_pct), Fmt.pct(s.var_12m_pct)])),
    });
    // Índice mensal (volume) de uma série — barras com filtro
    const canvasIdx = el('canvas', { role: 'img', 'aria-label': 'Índice mensal do indicador' });
    const notaIdx = el('p', { class: 'nota' });
    let grafIdx = null;
    const fIdx = filtro('Indicador', series.map(s => [s.id, s.nome]), v => desenharIndice(v));
    const cardIdx = el('div', { class: 'cartao' }, el('div', {}, el('h3', { texto: 'Evolução mensal (índice 2022 = 100)' }), notaIdx), fIdx.el, el('div', { class: 'area-grafico' }, canvasIdx));
    function desenharIndice(id) {
      const s = series.find(x => x.id === id) || series[0];
      if (!s) return;
      const dados = s.serie.map(x => x.indice);
      notaIdx.textContent = `${s.nome} · IBGE${Graficos.minimoAjustado([{ dados }]) > 0 ? ' · eixo ajustado, não começa em zero' : ''}`;
      Graficos.destruir(grafIdx);
      grafIdx = Graficos.colunas(canvasIdx, { rotulos: s.serie.map(x => Fmt.mes(x.mes)), series: [{ nome: s.nome, dados, cor: cssVar('--serie-1') }], formatoY: v => Fmt.num(v, 0) });
    }
    // Importação de produtos acabados por linha (concorrência com a produção nacional do cliente)
    const acab = g.importados_acabados;
    const linhasAcab = (acab?.linhas || []).filter(l => l.serie_mensal?.length);
    const nomeCurto = l => l.linha.split(' (')[0].replace(' e freezers', '/freezers').replace('Liquidificadores, batedeiras e processadores', 'Liquidif./processadores').replace('Air fryers e fornos elétricos', 'Air fryer/fornos').replace('Ferros, torradeiras e outros', 'Ferros/torradeiras');
    let blocoAcab = null, desenharAcab = () => {};
    if (linhasAcab.length) {
      const [anoAt, mesAt] = acab.ultimo_mes.split('-').map(Number);
      // Linhas medidas em peso (ex.: tampas) aparecem em toneladas; as demais em unidades
      const emKg = linhasAcab[0].unidade === 'kg';
      const U = emKg ? { nome: 'Toneladas', tab: 'Toneladas no ano', min: 'toneladas', preco: 'US$/kg', fmt: v => `${Fmt.num(v / 1000, 0)} t` } : { nome: 'Unidades', tab: 'Unidades no ano (mil)', min: 'unidades', preco: 'US$/un.', fmt: v => (v >= 1e6 ? `${Fmt.num(v / 1e6, 1)} mi` : `${Fmt.num(v / 1000, 0)} mil`) };
      const cVarAcab = Graficos.cartao({
        titulo: `${U.nome} importadas no ano — jan a ${Fmt.mes(acab.ultimo_mes)} vs mesmo período de ${anoAt - 1}`,
        nota: 'Produtos acabados por linha · Comex Stat/MDIC (dado real). Barra à direita = mais importado entrando no mercado.',
        tabela: Graficos.tabela([{ t: 'Linha' }, { t: U.tab, num: true }, { t: 'vs ano anterior', num: true }], linhasAcab.map(l => [l.linha, Fmt.num(l.unidades_ano_ate_mes / 1000, 0), Fmt.pct(l.unidades_ano_var_pct)])),
      });
      const canvasM = el('canvas', { role: 'img', 'aria-label': 'Unidades importadas por mês' });
      const notaM = el('p', { class: 'nota' });
      let grafM = null;
      const fLinha = filtro('Linha', [...new Set(linhasAcab.map(l => l.grupo))].flatMap(gr => linhasAcab.filter(l => l.grupo === gr).map(l => [l.linha, `${gr} — ${l.linha}`])), v => desenharMensal(v));
      const cardM = el('div', { class: 'cartao' }, el('div', {}, el('h3', { texto: `${U.nome} importadas por mês — ${anoAt} vs ${anoAt - 1}` }), notaM), fLinha.el, el('div', { class: 'area-grafico' }, canvasM));
      const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
      function desenharMensal(nome) {
        const l = linhasAcab.find(x => x.linha === nome) || linhasAcab[0];
        const doAno = ano => MESES.map((_, i) => { const k = `${ano}-${String(i + 1).padStart(2, '0')}`; return ano === anoAt && i + 1 > mesAt ? null : (l.serie_mensal.find(s => s.mes === k)?.unidades ?? null); });
        notaM.textContent = `${l.linha} · Comex Stat · uso de resina: ${l.relevancia_para_resina}`;
        Graficos.destruir(grafM);
        grafM = Graficos.colunas(canvasM, { rotulos: MESES, escalaAjustada: false, series: [{ nome: String(anoAt - 1), dados: doAno(anoAt - 1), cor: cssVar('--neutro-grafico') }, { nome: String(anoAt), dados: doAno(anoAt), cor: cssVar('--serie-1') }], formatoY: U.fmt });
      }
      // Começa pela linha com mais unidades importadas no ano (a mais exposta)
      fLinha.select.value = [...linhasAcab].sort((a, b) => b.unidades_ano_ate_mes - a.unidades_ano_ate_mes).find(l => l.grupo === 'Portáteis' && !/Cuidados/.test(l.linha))?.linha || linhasAcab[0].linha;
      desenharAcab = () => {
        if (linhasAcab.length > 1) Graficos.divergente(cVarAcab.canvas, { rotulos: linhasAcab.map(nomeCurto), valores: linhasAcab.map(l => l.unidades_ano_var_pct ?? 0), corPositivo: cssVar('--div-negativo'), corNegativo: cssVar('--div-positivo'), rotuloTooltip: `${U.min} vs ano anterior` });
        desenharMensal(fLinha.select.value);
      };
      const tabelaAcab = el('div', { class: 'tabela-wrap' }, Graficos.tabela(
        [{ t: 'Grupo' }, { t: 'Linha' }, { t: U.tab, num: true }, { t: 'vs ano anterior', num: true }, { t: `${U.nome} 12m vs 12m`, num: true }, { t: 'Valor no ano (US$ mi)', num: true }, { t: `Preço médio (${U.preco})`, num: true }, { t: 'Preço vs ano anterior', num: true }, { t: 'Origem China', num: true }],
        linhasAcab.map(l => [l.grupo, l.linha, Fmt.num(l.unidades_ano_ate_mes / 1000, 0), Fmt.pct(l.unidades_ano_var_pct), Fmt.pct(l.unidades_12m_var_pct), Fmt.num(l['fob_ano_US$_mi'], 1), Fmt.num(l['preco_medio_US$_un'], 1), Fmt.pct(l.preco_medio_var_pct), l.participacao_china_pct != null ? `${Fmt.num(l.participacao_china_pct, 0)}%` : '—'])));
      blocoAcab = secao('Importação de produtos acabados — concorrência com a produção nacional',
        // Uma linha só (ex.: tampas): o comparativo por linha não acrescenta, fica só o gráfico mensal
        linhasAcab.length > 1 ? el('div', { class: 'grade-2' }, cVarAcab.card, cardM) : cardM,
        tabelaAcab,
        el('p', { class: 'nota', texto: `Acumulado ${acab.acumulado_do_ano}. Preço médio = valor FOB ÷ ${U.min} (sem frete e impostos). Origem China = participação no valor importado no ano. Importado crescendo = menos produção local e menos resina comprada no Brasil.` }));
    }
    // Empresas listadas
    const emp = (g.empresas || []).filter(e => e.trimestre);
    const tabelaEmp = el('div', { class: 'tabela-wrap' }, Graficos.tabela(
      [{ t: 'Empresa' }, { t: 'Papel' }, { t: 'Trimestre' }, { t: 'Receita (R$ mi)', num: true }, { t: 'vs ano anterior', num: true }, { t: 'Margem bruta', num: true }, { t: 'Margem ano anterior', num: true }, { t: 'Ação 12m', num: true }],
      emp.map(e => [e.empresa, e.papel || '—', e.trimestre, Fmt.num(e['receita_liquida_R$_mi']), Fmt.pct(e.receita_var_aa_pct), Fmt.pct(e.margem_bruta_pct, 1, false), Fmt.pct(e.margem_bruta_ano_anterior_pct, 1, false), e.cotacao ? Fmt.pct(e.cotacao.var_12m_pct) : '—'])));

    const b = bloco('setor', 4, `Setor do cliente — ${(meta.segmento || '').replace(/_/g, ' ')}`, setor.mensagem,
      el('div', { class: 'chips' }, chip(`Demanda de resina (3 meses): ${setor.demanda_3m}`, tomDemanda, true), chip(`Poder de barganha do cliente: ${setor.poder_barganha_cliente}`, tomPoder, true)),
      el('p', { class: 'mensagem-central', texto: setor.justificativa }),
      el('div', { class: 'grade-2' }, cVar.card, cardIdx),
      blocoAcab,
      emp.length ? secao('Empresas listadas do setor (CVM, último trimestre)', tabelaEmp) : null,
      secao('Leitura', listaInsights(setor.insights)),
      secao('Notícias do setor', manchetes(setor.manchetes)));
    requestAnimationFrame(() => {
      // Rótulo curto: "Prod." ou "Varejo" + atividade, sem código CNAE nem "(volume)"
      const ABREV = [[/linha branca: fogões, refrigeradores e lavadoras/, 'linha branca'], [/eletroportáteis e outros eletrodomésticos/, 'portáteis'], [/sabões, limpeza, cosméticos e higiene/, 'limpeza e cosméticos'], [/defensivos agrícolas e domissanitários/, 'defensivos'], [/embalagens de material plástico/, 'embalagens plásticas'], [/produtos de material plástico/, 'plásticos'], [/produtos alimentícios/, 'alimentos'], [/farmoquímicos e farmacêuticos/, 'farmacêuticos'], [/hiper e supermercados/, 'supermercados'], [/farmácia, perfumaria e cosméticos/, 'farmácia e cosméticos'], [/combustíveis e lubrificantes/, 'combustíveis/lubrif.']];
      const rotulo = s => {
        let t = `${s.nome.startsWith('Produção') ? 'Prod.' : 'Varejo'} ${s.nome.split('— ')[1].replace(/ \(volume\)| \([\d.]+\)/g, '')}`;
        for (const [de, para] of ABREV) t = t.replace(de, para);
        return t.length > 24 ? `${t.slice(0, 23)}…` : t;
      };
      Graficos.divergente(cVar.canvas, { rotulos: series.map(rotulo), valores: series.map(s => s.var_aa_pct ?? 0), corPositivo: cssVar('--div-positivo'), corNegativo: cssVar('--div-negativo'), rotuloTooltip: 'vs ano anterior' });
      desenharIndice(fIdx.select.value);
      desenharAcab();
    });
    return b;
  }

  function blocoCliente({ insights: { cliente }, graficos: g }) {
    const perfil = g.perfil?.perfil_conhecido || [];
    return bloco('cliente', 5, 'Perfil público do cliente', cliente.mensagem,
      el('div', { class: 'tiles perfil-tiles' }, perfil.map(p => el('div', { class: 'tile' }, el('div', { class: 'rotulo', texto: p.item }), el('div', { class: 'texto-perfil', texto: p.valor }), el('div', { class: 'var', texto: `Fonte: ${p.fonte}` })))),
      cliente.movimentos?.length ? secao('Movimentos recentes', el('ol', { class: 'timeline' }, cliente.movimentos.map(m =>
        el('li', { class: 'neutro' }, el('div', { class: 'data', texto: [m.data ? Fmt.data(m.data) : null, m.fonte].filter(Boolean).join(' · ') }), el('div', { class: 'evento', texto: m.fato }), el('div', { class: 'nota', texto: `E daí? ${m.implicacao}` }))))) : null,
      secao('Leitura', listaInsights(cliente.insights)),
      g.perfil?.noticias?.length ? secao('Notícias recentes sobre o cliente', manchetes(g.perfil.noticias)) : null);
  }

  // ---------- Informações de campo (não públicas, registradas pelos GCs) ----------
  const pareceSensivel = t => /\d/.test(t) && /(R\$|US\$|\$|%|\btoneladas?\b|\bpre[çc]o|\bdesconto|\bvolume|\bmargem|\bcota[çc][ãa]o)/i.test(t);

  function blocoCampo({ insights: i, graficos: g, meta }) {
    const org = i.campo;
    const lista = el('div', { class: 'campo-lista' });
    const desenhar = notas => lista.replaceChildren(...(notas.length
      ? notas.map(n => el('article', { class: 'nota-campo' },
        el('div', { class: 'nota-campo-topo' },
          chip('Não pública · campo', 'atencao'),
          el('span', { class: 'fonte', texto: `Captada em ${Fmt.data(n.data_captura)} · vale para ${n.vale_para}` }),
          n.alerta_preco_ou_volume ? chip('Tem preço ou volume: use só a tendência', 'critico') : null),
        el('p', { texto: n.texto }),
        EMBUTIDOS ? null : el('button', {
          type: 'button', class: 'remover', texto: 'Remover',
          onclick: async () => {
            if (!confirm('Remover esta informação de campo? Ela deixa de aparecer em todos os briefings.')) return;
            await fetch(`/api/notas/${n.id}`, { method: 'DELETE' });
            carregarNotas();
          },
        })))
      : [el('p', { class: 'nota', texto: 'Nenhuma informação de campo registrada para este segmento.' })]));
    async function carregarNotas() {
      if (EMBUTIDOS) return desenhar(g.notas_campo || []);
      try { desenhar(await (await fetch(`/api/notas?segmento=${encodeURIComponent(meta.segmento || '')}`)).json()); } catch { desenhar(g.notas_campo || []); }
    }
    document.addEventListener('notas-campo-mudaram', carregarNotas);
    carregarNotas();
    return bloco('campo', 6, 'Informações de campo', 'Capturadas pelos GCs em outras reuniões. Não são públicas: use como sinal de mercado e nunca cite de qual cliente vieram.',
      org?.itens?.length ? secao('Organizado pela IA', el('div', { class: 'tabela-wrap' }, Graficos.tabela([{ t: 'Tema' }, { t: 'Informação' }, { t: 'Data' }, { t: 'Como usar' }], org.itens.map(x => [x.tema, x.informacao, x.data, x.como_usar])))) : null,
      secao('Registradas pelos GCs', lista),
      EMBUTIDOS ? null : el('div', {}, el('button', { type: 'button', class: 'botao', texto: '＋ Adicionar informação de campo', onclick: () => abrirCampo(meta.segmento) })));
  }

  // Botão de atualização dos números (sem IA): roda no servidor e recarrega o painel ao terminar
  function prepararAtualizacao() {
    const botao = $('botao-atualizar');
    if (EMBUTIDOS) {
      // Versão publicada (GitHub Pages): o botão abre o workflow do GitHub Actions, onde fica o "Run workflow"
      if (!window.LINK_ATUALIZAR) { botao.hidden = true; return; }
      botao.hidden = false;
      botao.title = 'Abre o GitHub Actions: clique em "Run workflow". O painel atualiza em alguns minutos.';
      botao.addEventListener('click', () => window.open(window.LINK_ATUALIZAR, '_blank', 'noopener'));
      return;
    }
    const rotulo = botao.textContent;
    async function acompanhar() {
      const st = await fetch('/api/atualizar-dados').then(r => r.json()).catch(() => ({ rodando: false, ok: false }));
      if (st.rodando) { botao.textContent = '↻ Atualizando…'; botao.disabled = true; return setTimeout(acompanhar, 5000); }
      botao.disabled = false; botao.textContent = rotulo;
      if (st.ok === false) alert('A atualização não terminou. Tente de novo em alguns minutos (o Comex limita consultas).');
      if (st.ok) await recarregarLista(window.PainelApp.arquivo);
    }
    botao.addEventListener('click', async () => {
      const r = await fetch('/api/atualizar-dados', { method: 'POST' });
      if (!r.ok && r.status !== 409) return alert('Não foi possível iniciar a atualização.');
      acompanhar();
    });
    fetch('/api/atualizar-dados').then(r => r.json()).then(st => { if (st.rodando) acompanhar(); }).catch(() => {});
  }

  // Diálogo de registro
  let segmentosCache = null;
  async function abrirCampo(segmentoPadrao) {
    $('form-campo').reset();
    $('campo-erro').hidden = true;
    $('campo-alerta').hidden = true;
    $('campo-segmento').disabled = false;
    $('campo-data').value = new Date().toISOString().slice(0, 10);
    if (!segmentosCache) segmentosCache = await fetch('/api/segmentos').then(r => r.json()).catch(() => []);
    $('campo-segmento').replaceChildren(...segmentosCache.map(x => el('option', { value: x.id, texto: x.nome || x.id })));
    const seg = segmentoPadrao || painelAtual?.meta?.segmento;
    if (seg) $('campo-segmento').value = seg;
    $('dlg-campo').showModal();
  }
  function prepararDialogoCampo() {
    if (EMBUTIDOS) { $('botao-campo').hidden = true; return; }
    $('botao-campo').addEventListener('click', () => abrirCampo());
    $('campo-cancelar').addEventListener('click', () => $('dlg-campo').close());
    $('campo-todos').addEventListener('change', e => { $('campo-segmento').disabled = e.target.checked; });
    $('campo-texto').addEventListener('input', e => { $('campo-alerta').hidden = !pareceSensivel(e.target.value); });
    $('form-campo').addEventListener('submit', async e => {
      e.preventDefault();
      const todos = $('campo-todos').checked;
      const corpo = {
        texto: $('campo-texto').value, data_captura: $('campo-data').value,
        abrangencia: todos ? 'todos' : 'segmento', segmentos: todos ? [] : [$('campo-segmento').value],
        origem_interna: $('campo-origem').value, gc: $('campo-gc').value,
      };
      const r = await fetch('/api/notas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
      if (!r.ok) { $('campo-erro').textContent = (await r.json().catch(() => ({}))).erro || 'Não foi possível salvar.'; $('campo-erro').hidden = false; return; }
      $('dlg-campo').close();
      document.dispatchEvent(new CustomEvent('notas-campo-mudaram'));
    });
  }

  function blocoProjecoes({ insights: { projecoes }, graficos: g }) {
    const hist = Object.fromEntries((g.brent_historico || []).map(h => [h.mes, h.brent]));
    const curvaOk = (g.brent_projecao?.curva_futura || []).filter(c => !c.desatualizado);
    const curva = Object.fromEntries(curvaOk.map(c => [c.mes, c.valor]));
    const eia = Object.fromEntries((g.brent_projecao?.eia || []).map(e => [e.mes, e.valor]));
    const meses = [...new Set([...Object.keys(hist), ...Object.keys(curva), ...Object.keys(eia)])].sort();
    const ultHist = Object.keys(hist).sort().pop() || '';
    const c1 = Graficos.cartao({
      titulo: 'Brent: histórico, curva futura e projeção da EIA', alto: true, nota: 'US$/barril · FRED, NYMEX, EIA STEO (dados reais)',
      tabela: Graficos.tabela([{ t: 'Mês' }, { t: 'Histórico', num: true }, { t: 'Curva futura', num: true }, { t: 'EIA', num: true }], meses.map(m => [Fmt.mes(m), Fmt.num(hist[m], 1), Fmt.num(curva[m], 1), Fmt.num(eia[m], 1)])),
    });
    const f = g.focus || {};
    const anos = f.IPCA ? Object.keys(f.IPCA) : [];
    const focus = f.IPCA ? el('div', { class: 'cartao' }, el('div', {}, el('h3', { texto: 'Boletim Focus — consenso do mercado' }), el('p', { class: 'nota', texto: `Medianas · pesquisa de ${Fmt.data(f.data_pesquisa)} (dado real)` })),
      el('div', { class: 'tabela-wrap' }, Graficos.tabela([{ t: 'Indicador' }, ...anos.map(a => ({ t: a, num: true }))], [['IPCA (%)', 'IPCA'], ['Selic (%)', 'Selic'], ['PIB (%)', 'PIB Total'], ['Câmbio (R$/US$)', 'Câmbio']].map(([r, k]) => [r, ...anos.map(a => Fmt.num(f[k]?.[a], 2))])))) : null;
    const projResinas = (g.importacoes || []).filter(p => p.projecao_proximos_meses);
    const cardResinas = projResinas.length ? el('div', { class: 'cartao' }, el('div', {}, el('h3', { texto: 'Preço de importação projetado' }), el('p', { class: 'nota', texto: 'Pela reação histórica ao Brent e o contrato futuro mais próximo' })),
      el('div', { class: 'tabela-wrap' }, Graficos.tabela([{ t: 'Resina' }, { t: 'Último (US$/t)', num: true }, { t: 'Projetado (US$/t)', num: true }, { t: 'Variação', num: true }],
        projResinas.map(p => [p.posicao, Fmt.num(p['preco_ultimo_US$_t']), Fmt.num(p.projecao_proximos_meses['preco_projetado_US$_t']), Fmt.pct(p.projecao_proximos_meses.variacao_preco_projetada_pct)])))) : null;
    const b = bloco('projecoes', 6, 'Projeções e cenários', projecoes.mensagem,
      c1.card,
      el('div', { class: 'grade-2' }, focus, cardResinas),
      el('div', { class: 'callout' }, el('h4', {}, chip('estratégia', ''), 'Implicação para a reunião'), el('p', { texto: projecoes.implicacao_estrategica })),
      secao('Leitura das projeções', listaInsights(projecoes.insights)));
    requestAnimationFrame(() => Graficos.linhas(c1.canvas, {
      rotulos: meses.map(Fmt.mes),
      series: [
        { nome: 'Histórico', dados: meses.map(m => hist[m] ?? null), cor: cssVar('--serie-1') },
        { nome: 'Curva futura (NYMEX)', dados: meses.map(m => curva[m] ?? null), cor: cssVar('--serie-2'), tracejado: true },
        { nome: 'Projeção EIA', dados: meses.map(m => (m >= ultHist ? eia[m] ?? null : null)), cor: cssVar('--serie-3'), tracejado: true },
      ],
      formatoY: v => `US$ ${Fmt.num(v, 0)}`,
    }));
    return b;
  }

  function blocoHipoteses({ insights: i }) {
    return bloco('hipoteses', 8, 'Hipóteses e perguntas de descoberta', 'Sem dados internos, a reunião também serve para aprender. Cada hipótese tem a evidência pública e a pergunta que a confirma.',
      el('div', { class: 'tabela-wrap' }, Graficos.tabela([{ t: 'Hipótese' }, { t: 'Evidência pública' }, { t: 'Como confirmar' }], (i.hipoteses || []).map(h => [h.hipotese, h.evidencia, h.como_confirmar]))),
      secao('Perguntas de descoberta', el('ol', { class: 'perguntas' }, (i.roteiro?.perguntas_descoberta || []).map(p => el('li', { texto: p })))));
  }

  function blocoRoteiro({ insights: { roteiro: r } }) {
    return bloco('roteiro', 9, 'Roteiro da reunião', r.objetivo,
      secao('Abertura sugerida', el('blockquote', { class: 'abertura', texto: r.abertura })),
      secao('Argumentos e o dado público que sustenta', el('div', { class: 'tabela-wrap' }, Graficos.tabela([{ t: 'Argumento' }, { t: 'Dado' }], r.argumentos.map(a => [a.argumento, a.dado])))),
      secao('Objeções prováveis', el('div', {}, r.objecoes.map(o => el('details', { class: 'objecao' }, el('summary', { texto: `“${o.objecao}”` }), el('p', { texto: o.resposta }))))));
  }

  function blocoRiscos({ insights: i, meta }) {
    const chave = `passos_${meta.id}_${meta.gerado_em}`;
    let marcados = {};
    try { marcados = JSON.parse(localStorage.getItem(chave) || '{}'); } catch { /* sem armazenamento */ }
    const salvar = () => { try { localStorage.setItem(chave, JSON.stringify(marcados)); } catch { /* ignora */ } };
    return bloco('riscos', 10, 'Riscos e próximos passos', null,
      secao('Riscos', el('div', { class: 'tabela-wrap' }, el('table', {},
        el('thead', {}, el('tr', {}, ['Risco', 'Probabilidade', 'Impacto', 'Mitigação'].map(h => el('th', { texto: h })))),
        el('tbody', {}, i.riscos.map(x => el('tr', {}, el('td', { texto: x.risco }), el('td', {}, chip(x.probabilidade, tomProbabilidade(x.probabilidade))), el('td', { texto: x.impacto }), el('td', { texto: x.mitigacao }))))))),
      el('div', { class: 'grade-3' }, ['antes', 'na reunião', 'depois'].map(gp => secao(`${gp[0].toUpperCase()}${gp.slice(1)}`, el('ul', { class: 'passos' }, i.proximos_passos.filter(p => p.quando === gp).map((p, k) => {
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
    document.title = `Painel de mercado — ${meta.cliente}`;
    $('titulo-cliente').textContent = meta.cliente;
    $('meta').textContent = [meta.data_reuniao ? `Reunião em ${Fmt.data(meta.data_reuniao)}` : null, meta.kam ? `GC ${meta.kam}` : null, `Números de ${Fmt.data(meta.dados_atualizados_em || meta.gerado_em)}`, `Textos de ${Fmt.data(meta.gerado_em)}`].filter(Boolean).join(' · ');
    $('aviso-ficticio').hidden = false;
    const main = $('conteudo');
    main.replaceChildren();
    for (const fn of [blocoVisao, blocoMacro, blocoMercado, blocoSetor, blocoCliente, blocoCampo, blocoProjecoes, blocoHipoteses, blocoRoteiro, blocoRiscos]) {
      try { main.append(fn(painel)); } catch (e) { console.error(e); main.append(el('section', { class: 'bloco' }, el('p', { class: 'erro-carga', texto: `Não foi possível montar um bloco (${fn.name}).` }))); }
    }
    $('nav-blocos').replaceChildren(...BLOCOS.map(([id, nome], i) => el('li', {}, el('a', { href: `#${id}`, 'data-bloco': id }, el('span', { class: 'num', texto: String(i + 1) }), nome))));
    const links = [...document.querySelectorAll('#nav-blocos a')];
    const obs = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) links.forEach(a => a.classList.toggle('ativo', a.dataset.bloco === e.target.id)); }, { rootMargin: '-20% 0px -70% 0px' });
    document.querySelectorAll('section.bloco').forEach(s => obs.observe(s));
  }

  // Fonte dos painéis: servidor local ou painéis embutidos na página (versão exportada)
  const EMBUTIDOS = window.PAINEIS_EMBUTIDOS || (window.PAINEL_EMBUTIDO ? [{ arquivo: 'embutido', ...window.PAINEL_EMBUTIDO }] : null);
  const fonte = {
    lista: async () => (EMBUTIDOS ? EMBUTIDOS.map(p => ({ arquivo: p.arquivo, ...p.meta })) : fetch('/api/paineis').then(r => r.json())),
    clientes: async () => (EMBUTIDOS ? [] : fetch('/api/clientes').then(r => r.json()).catch(() => [])),
    painel: async arquivo => {
      if (EMBUTIDOS) return EMBUTIDOS.find(p => p.arquivo === arquivo);
      const r = await fetch(`/api/paineis/${encodeURIComponent(arquivo)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
  };

  let paineis = [], clientes = [], clienteAtual = null;
  function desenharListaClientes() {
    $('lista-clientes').replaceChildren(...clientes.map(c => {
      const ultimo = paineis.find(p => p.id === c.id);
      return el('li', {}, el('button', { type: 'button', class: `item-cliente${c.id === clienteAtual ? ' ativo' : ''}`, 'aria-current': c.id === clienteAtual ? 'true' : null, onclick: () => escolherCliente(c.id) },
        el('span', { class: 'nome', texto: c.nome }),
        el('span', { class: 'detalhe', texto: (c.segmento || '').replace(/_/g, ' ') }),
        el('span', { class: 'linha' }, el('span', { class: 'data', texto: ultimo ? `Briefing ${Fmt.data(ultimo.gerado_em)}` : 'Sem briefing' }))));
    }));
    $('painel-clientes').hidden = clientes.length < 2;
  }

  async function carregar(arquivo) {
    renderizar(await fonte.painel(arquivo));
    window.PainelApp.arquivo = arquivo;
    document.dispatchEvent(new CustomEvent('painel-carregado', { detail: { arquivo, meta: painelAtual.meta } }));
  }

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
    const c = clientes.find(x => x.id === id) || { id, nome: id };
    Graficos.destruirTodos();
    window.PainelApp.arquivo = null;
    $('titulo-cliente').textContent = c.nome;
    $('meta').textContent = c.segmento ? `Segmento: ${c.segmento.replace(/_/g, ' ')}` : '';
    $('nav-blocos').replaceChildren();
    $('conteudo').replaceChildren(el('section', { class: 'bloco vazio' },
      el('h2', { texto: `Ainda não há briefing de ${c.nome}` }),
      el('p', { class: 'mensagem-central', texto: 'O agente busca notícias, indicadores, importação de resinas, resultados de empresas listadas e o perfil público do cliente, e monta o painel em cerca de 10 minutos.' }),
      el('div', {}, el('button', { type: 'button', class: 'botao botao-primario so-ia', texto: `＋ Gerar briefing de ${c.nome}`, onclick: () => window.AssistenteIA?.novoBriefing(c.id) })),
      el('p', { class: 'nota', texto: `Pelo terminal: npm run briefing -- --cliente ${c.id}` })));
    document.dispatchEvent(new CustomEvent('painel-carregado', { detail: { arquivo: null, meta: null } }));
  }

  async function recarregarLista(abrir) {
    [paineis, clientes] = await Promise.all([fonte.lista(), fonte.clientes()]);
    for (const p of paineis) if (!clientes.some(c => c.id === p.id)) clientes.push({ id: p.id, nome: p.cliente, segmento: p.segmento });
    const painelAbrir = paineis.find(p => p.arquivo === abrir);
    const id = painelAbrir?.id || clienteAtual || paineis[0]?.id || clientes[0]?.id;
    if (id) await escolherCliente(id, abrir);
  }
  window.PainelApp = { arquivo: null, recarregarLista, meta: () => painelAtual?.meta, clienteSelecionado: () => clienteAtual };

  async function iniciar() {
    prepararDialogoCampo();
    prepararAtualizacao();
    if (window.MODO_IMPRESSAO) Chart.defaults.animation = false;
    if (EMBUTIDOS?.length === 1) document.querySelectorAll('.seletor').forEach(s => { s.hidden = true; });
    try {
      $('seletor-painel').addEventListener('change', e => carregar(e.target.value));
      await recarregarLista();
      if (!clientes.length) $('conteudo').replaceChildren(el('p', { class: 'erro-carga', texto: 'Cadastre clientes em backend/dados/clientes.json e recarregue a página.' }));
    } catch (e) {
      console.error(e);
      $('conteudo').replaceChildren(el('p', { class: 'erro-carga', texto: 'Não foi possível carregar o painel. O servidor está rodando? (npm run painel)' }));
    }
  }

  $('botao-imprimir').addEventListener('click', () => { document.querySelectorAll('details.objecao').forEach(d => { d.open = true; }); window.print(); });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => painelAtual && renderizar(painelAtual));
  iniciar();
})();
