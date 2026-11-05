// Formatação (pt-BR) e pequenos utilitários de DOM.
const Fmt = {
  num: (v, casas = 0) => (v === null || v === undefined || Number.isNaN(+v)) ? '—' : (+v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }),
  pct: (v, casas = 1, sinal = true) => (v === null || v === undefined) ? '—' : `${sinal && v > 0 ? '+' : ''}${Fmt.num(v, casas)}%`,
  reais: (v, casas = 2) => (v === null || v === undefined) ? '—' : `R$ ${Fmt.num(v, casas)}`,
  // Valores grandes em R$ de forma compacta: R$ 3,0 mi / R$ 716 mil
  reaisCompacto: v => {
    if (v === null || v === undefined) return '—';
    const a = Math.abs(v), s = v < 0 ? '−' : '';
    if (a >= 1e6) return `${s}R$ ${Fmt.num(a / 1e6, 1)} mi`;
    if (a >= 1e3) return `${s}R$ ${Fmt.num(a / 1e3, 0)} mil`;
    return `${s}R$ ${Fmt.num(a, 0)}`;
  },
  mes: chave => { // "2026-10" → "out/26"
    if (!chave) return '';
    const [y, m] = chave.split('-');
    return `${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][+m - 1]}/${y.slice(2)}`;
  },
  data: iso => { // "2026-10-15" → "15/10/2026"
    if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso || '';
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  },
};

// Cria elemento com atributos e filhos. Texto é sempre inserido como texto (nunca como HTML).
function el(tag, attrs = {}, ...filhos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'texto') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat()) if (f !== null && f !== undefined && f !== false) n.append(f instanceof Node ? f : document.createTextNode(String(f)));
  return n;
}

// Lê uma variável CSS (para os gráficos seguirem o tema claro/escuro).
const cssVar = nome => getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
