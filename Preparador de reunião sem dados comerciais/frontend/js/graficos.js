// Gráficos (Chart.js) seguindo as regras de visualização:
// marcas finas, grade discreta, um único eixo de valores, legenda quando há 2+ séries,
// tooltip no hover e uma tabela equivalente para cada gráfico.
const Graficos = (() => {
  const instancias = [];

  function base() {
    const texto2 = cssVar('--texto-2'), mudo = cssVar('--texto-mudo'), grade = cssVar('--grade');
    Chart.defaults.font.family = cssVar('--fonte') || 'system-ui';
    Chart.defaults.font.size = 12;
    Chart.defaults.color = mudo;
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false, position: 'top', align: 'start', labels: { usePointStyle: true, pointStyle: 'rectRounded', boxWidth: 10, boxHeight: 10, color: texto2, padding: 14 } },
        tooltip: {
          backgroundColor: cssVar('--superficie'), titleColor: cssVar('--texto'), bodyColor: texto2,
          borderColor: cssVar('--borda'), borderWidth: 1, padding: 10, cornerRadius: 8, boxPadding: 4, usePointStyle: true,
        },
      },
      scales: {
        x: { grid: { display: false }, border: { color: cssVar('--eixo') }, ticks: { color: mudo } },
        y: { grid: { color: grade, drawTicks: false }, border: { display: false }, ticks: { color: mudo, padding: 8 } },
      },
    };
  }

  const mesclar = (a, b) => {
    const out = { ...a };
    for (const [k, v] of Object.entries(b || {})) out[k] = (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object') ? mesclar(a[k], v) : v;
    return out;
  };

  // Cartão com título, nota, botão "ver tabela", área do gráfico e tabela equivalente.
  function cartao({ titulo, nota, alto = false, tabela }) {
    const canvas = el('canvas', { role: 'img', 'aria-label': titulo });
    const area = el('div', { class: `area-grafico${alto ? ' alta' : ''}` }, canvas);
    const card = el('div', { class: 'cartao' });
    const botao = el('button', { type: 'button', class: 'alternar-tabela', texto: 'Ver tabela', 'aria-pressed': 'false' });
    botao.addEventListener('click', () => {
      const ativo = card.classList.toggle('mostrando-tabela');
      botao.textContent = ativo ? 'Ver gráfico' : 'Ver tabela';
      botao.setAttribute('aria-pressed', String(ativo));
    });
    card.append(
      el('div', { class: 'cartao-topo' }, el('div', {}, el('h3', { texto: titulo }), nota ? el('p', { class: 'nota', texto: nota }) : null), botao),
      area,
      el('div', { class: 'tabela-grafico tabela-wrap' }, tabela),
    );
    return { card, canvas };
  }

  function criar(canvas, config) {
    const grafico = new Chart(canvas, config);
    instancias.push({ grafico, canvas, config });
    return grafico;
  }

  // Tabela simples a partir de cabeçalhos e linhas (células numéricas alinhadas à direita).
  function tabela(cabecalhos, linhas) {
    return el('table', {},
      el('thead', {}, el('tr', {}, cabecalhos.map(h => el('th', { class: h.num ? 'num' : null, texto: h.t ?? h })))),
      el('tbody', {}, linhas.map(l => el('tr', {}, l.map((c, i) => el('td', { class: cabecalhos[i].num ? 'num' : null, texto: c }))))));
  }

  // ---------- Tipos de gráfico ----------

  // Linhas com eixo único. series: [{nome, dados, cor, tracejado}]
  function linhas(canvas, { rotulos, series, formatoY = v => Fmt.num(v), sufixoTooltip = '' }) {
    const ds = series.map(s => ({
      label: s.nome, data: s.dados, borderColor: s.cor, backgroundColor: s.cor,
      borderWidth: 2, borderDash: s.tracejado ? [6, 4] : [], pointRadius: 0, pointHoverRadius: 5,
      pointHoverBorderWidth: 2, pointHoverBorderColor: cssVar('--superficie'), cubicInterpolationMode: 'monotone', spanGaps: !!s.tracejado,
    }));
    return criar(canvas, {
      type: 'line',
      data: { labels: rotulos, datasets: ds },
      options: mesclar(base(), {
        plugins: {
          legend: { display: series.length > 1 },
          tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y === null ? '—' : formatoY(c.parsed.y)}${sufixoTooltip}` } },
        },
        scales: { y: { grace: '5%', ticks: { callback: v => formatoY(v) } } },
      }),
    });
  }

  // Barras horizontais divergentes (polaridade): positivo e negativo em polos opostos, base no zero.
  function divergente(canvas, { rotulos, valores, corPositivo, corNegativo, formato = v => Fmt.pct(v), rotuloTooltip = '' }) {
    return criar(canvas, {
      type: 'bar',
      data: { labels: rotulos, datasets: [{ label: rotuloTooltip, data: valores, backgroundColor: valores.map(v => (v >= 0 ? corPositivo : corNegativo)), borderRadius: 4, borderSkipped: 'start', barPercentage: 0.7, categoryPercentage: 0.85 }] },
      options: mesclar(base(), {
        indexAxis: 'y',
        interaction: { mode: 'nearest', axis: 'y', intersect: false },
        plugins: { tooltip: { callbacks: { label: c => ` ${rotuloTooltip ? rotuloTooltip + ': ' : ''}${formato(c.parsed.x)}` } } },
        scales: {
          x: { grid: { color: cssVar('--grade'), drawTicks: false }, border: { display: false }, ticks: { callback: v => formato(v) } },
          y: { grid: { display: false }, border: { color: cssVar('--eixo') } },
        },
      }),
    });
  }

  // Colunas verticais (padrão para VOLUME ao longo do tempo). Uma ou mais séries agrupadas, base no zero.
  // series: [{nome, dados, cor}]
  // Mínimo 'redondo' um pouco abaixo do menor valor, para a variação aparecer (eixo não começa em zero).
  function minimoAjustado(series) {
    const valores = series.flatMap(s => s.dados).filter(v => v !== null && v !== undefined && isFinite(v));
    if (!valores.length) return 0;
    const min = Math.min(...valores), max = Math.max(...valores), amplitude = max - min || Math.abs(max) || 1;
    const passo = Math.pow(10, Math.floor(Math.log10(amplitude))) / 2;
    const alvo = Math.floor((min - amplitude * 0.25) / passo) * passo;
    return alvo > 0 ? alvo : 0;
  }

  function colunas(canvas, { rotulos, series, formatoY = v => Fmt.num(v), escalaAjustada = true }) {
    const minY = escalaAjustada ? minimoAjustado(series) : 0;
    return criar(canvas, {
      type: 'bar',
      data: {
        labels: rotulos,
        datasets: series.map(s => ({ label: s.nome, data: s.dados, backgroundColor: s.cor, borderRadius: 4, borderSkipped: 'start', barPercentage: 0.85, categoryPercentage: series.length > 1 ? 0.8 : 0.7 })),
      },
      options: mesclar(base(), {
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: series.length > 1 },
          tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y === null ? '—' : formatoY(c.parsed.y)}` } },
        },
        scales: { y: { beginAtZero: minY === 0, min: minY || undefined, ticks: { callback: v => formatoY(v) } } },
      }),
    });
  }

  // Barras horizontais de uma série (magnitude). destaque: índice da barra em evidência (as demais em neutro).
  function barras(canvas, { rotulos, valores, cor, destaque = null, formato = v => Fmt.num(v), rotuloTooltip = '' }) {
    const cores = valores.map((_, i) => (destaque === null || i === destaque ? cor : cssVar('--neutro-grafico')));
    return criar(canvas, {
      type: 'bar',
      data: { labels: rotulos, datasets: [{ label: rotuloTooltip, data: valores, backgroundColor: cores, borderRadius: 4, borderSkipped: 'start', barPercentage: 0.7, categoryPercentage: 0.85 }] },
      options: mesclar(base(), {
        indexAxis: 'y',
        interaction: { mode: 'nearest', axis: 'y', intersect: false },
        plugins: { tooltip: { callbacks: { label: c => ` ${rotuloTooltip ? rotuloTooltip + ': ' : ''}${formato(c.parsed.x)}` } } },
        scales: {
          x: { beginAtZero: true, grid: { color: cssVar('--grade'), drawTicks: false }, border: { display: false }, ticks: { callback: v => formato(v) } },
          y: { grid: { display: false }, border: { color: cssVar('--eixo') } },
        },
      }),
    });
  }

  // Redesenha tudo quando o tema do sistema muda (cores vêm das variáveis CSS).
  function destruirTodos() { while (instancias.length) instancias.pop().grafico.destroy(); }
  function destruir(grafico) {
    const i = instancias.findIndex(x => x.grafico === grafico);
    if (i >= 0) instancias.splice(i, 1);
    grafico?.destroy();
  }

  return { cartao, tabela, linhas, colunas, divergente, barras, destruir, destruirTodos, minimoAjustado };
})();
