// Exporta o painel como arquivo único (HTML autocontido) e, opcionalmente, PDF — para enviar por e-mail.
// O HTML embute dados, estilo, scripts e a biblioteca de gráficos: abre offline em qualquer navegador.
//
// Uso: node scripts/exportar_painel.js [--cliente mondial] [--pdf]
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { RAIZ } from '../lib/dados.js';

const FRONTEND = path.resolve(RAIZ, '..', 'frontend');
const RELATORIOS = path.resolve(RAIZ, '..', 'relatorios');

// Evita que "</script>" dentro dos dados ou do código feche a tag antes da hora.
const seguroEmScript = s => s.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

// Na versão para PDF a página já é desenhada na largura útil do A4 (~718px): os gráficos não são redimensionados na impressão.
const CSS_IMPRESSAO = `@media screen { body { width: 718px; margin: 0; } .navegacao, .topo-acoes, .alternar-tabela { display: none !important; } .layout { display: block; padding: 0; } .topo-conteudo { padding: 0 0 8px; } .aviso { width: 100%; margin: 0 0 10px; } }`;

async function montarHtml(painel, { impressao = false } = {}) {
  const dados = JSON.stringify(painel).replace(/</g, '\\u003c');
  return montarPagina({ titulo: `Briefing — ${painel.meta.cliente} — ${painel.meta.gerado_em}`, scriptDados: `window.PAINEL_EMBUTIDO = ${dados};${impressao ? ' window.MODO_IMPRESSAO = true;' : ''}`, impressao });
}

async function montarPagina({ titulo, scriptDados, impressao = false, chartCdn = false }) {
  const ler = rel => fs.readFile(path.join(FRONTEND, rel), 'utf8');
  const [html, css, cssIa, formatos, graficos, app, chartjs] = await Promise.all([
    ler('index.html'), ler('css/painel.css'), ler('css/assistente.css'), ler('js/formatos.js'), ler('js/graficos.js'), ler('js/app.js'),
    fs.readFile(path.join(RAIZ, 'node_modules', 'chart.js', 'dist', 'chart.umd.js'), 'utf8'),
  ]);
  const scripts = [
    chartCdn ? '<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>' : `<script>${seguroEmScript(chartjs)}</script>`,
    `<script>${scriptDados}</script>`,
    ...[formatos, graficos, app].map(js => `<script>${seguroEmScript(js)}</script>`),
  ].join('\n');
  // A versão exportada não tem servidor: os recursos de IA (gaveta, novo briefing) ficam ocultos pelo assistente.css
  // e o assistente.js não é incluído. Todos os scripts externos são trocados pelas versões embutidas.
  return html
    .replace(/<title>.*?<\/title>/, `<title>${titulo}</title>`)
    .replace(/<link rel="stylesheet" href="css\/painel.css">/, () => `<style>\n${css}\n${cssIa}\n${impressao ? CSS_IMPRESSAO : ''}\n</style>`)
    .replace(/<link rel="stylesheet" href="css\/assistente.css">/, '')
    .replace(/<script src="[^"]+"><\/script>\s*/g, '')
    .replace('</body>', () => `${scripts}\n</body>`);
}

// Troca nomes e locais que identificariam clientes reais (para compartilhar fora da empresa).
const ANONIMIZAR = [
  [/Mondial/g, 'Cliente A'], [/mondial/g, 'cliente-a'],
  [/Globalpack/g, 'Cliente B'], [/globalpack/g, 'cliente-b'],
  [/Concei[çc][ãa]o do Jacu[íi]pe(-BA)?/g, 'Planta Nordeste'], [/Manaus(-AM)?/g, 'Planta Norte'],
  [/Vinhedo(-SP)?/g, 'Planta Sudeste'],
  [/~?1 bilh[ãa]o de embalagens(\/| por )ano/g, 'grande porte'], [/~?1\.100 funcion[áa]rios/g, 'centenas de funcionários'], [/opera[çc][ãa]o em 7 estados/g, 'operação em vários estados'],
];
export function anonimizarTexto(texto) {
  return ANONIMIZAR.reduce((t, [de, para]) => t.replace(de, para), texto);
}

// Exporta vários painéis numa página só (lista de clientes na lateral), opcionalmente anonimizada.
export async function exportarCarteira(arquivosJson, saida, { anonimizar = false, titulo = 'Carteira de Clientes', paraLink = false } = {}) {
  const paineis = [];
  for (const arq of arquivosJson) {
    let texto = await fs.readFile(arq, 'utf8');
    let nome = path.basename(arq);
    if (anonimizar) { texto = anonimizarTexto(texto); nome = anonimizarTexto(nome); }
    paineis.push({ arquivo: nome, ...JSON.parse(texto) });
  }
  const dados = JSON.stringify(paineis).replace(/</g, '\\u003c');
  let html = await montarPagina({ titulo, scriptDados: `window.PAINEIS_EMBUTIDOS = ${dados};`, chartCdn: paraLink });
  if (paraLink) {
    // Versão para link compartilhável: sem o esqueleto do documento (a plataforma monta), título no topo e sem impressão
    const tituloTag = html.match(/<title>.*?<\/title>/)[0];
    html = html.replace(/<!doctype html>/i, '').replace(/<\/?html[^>]*>/gi, '').replace(/<\/?head>/gi, '').replace(/<\/?body>/gi, '')
      .replace(/<meta [^>]*>/gi, '').replace(tituloTag, '');
    html = `${tituloTag}\n<style>#botao-imprimir { display: none !important; }</style>\n${html.trim()}\n`;
  }
  await fs.writeFile(saida, html, 'utf8');
  return saida;
}

function encontrarNavegador() {
  const candidatos = [
    process.env.NAVEGADOR_PDF,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium',
  ].filter(Boolean);
  return candidatos.find(c => fssync.existsSync(c));
}

export async function exportarPainel(arquivoJson, { pdf = false } = {}) {
  const painel = JSON.parse(await fs.readFile(arquivoJson, 'utf8'));
  const base = arquivoJson.replace(/\.json$/, '');
  const saidaHtml = `${base}.html`;
  await fs.writeFile(saidaHtml, await montarHtml(painel), 'utf8');
  const resultado = { html: saidaHtml };

  if (pdf) {
    const navegador = encontrarNavegador();
    if (!navegador) {
      resultado.avisoPdf = 'Navegador (Edge/Chrome) não encontrado para gerar o PDF. Abra o HTML e use "Imprimir / PDF".';
    } else {
      // Versão temporária sem animação, para os gráficos estarem prontos na hora da impressão.
      // Tudo numa pasta temporária: o navegador headless falha com caminhos com espaços/OneDrive e,
      // sem perfil próprio, não gera o arquivo se já houver uma janela aberta.
      const perfil = await fs.mkdtemp(path.join(os.tmpdir(), 'painel-pdf-'));
      const temp = path.join(perfil, 'painel.html');
      const pdfTemp = path.join(perfil, 'painel.pdf');
      await fs.writeFile(temp, await montarHtml(painel, { impressao: true }), 'utf8');
      const saidaPdf = `${base}.pdf`;
      try {
        await promisify(execFile)(navegador, [
          '--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${path.join(perfil, 'perfil-navegador')}`, '--no-pdf-header-footer', '--virtual-time-budget=8000',
          `--print-to-pdf=${pdfTemp}`, pathToFileURL(temp).href,
        ], { timeout: 120000 });
        // O navegador devolve o controle antes de terminar: espera o PDF aparecer e parar de crescer.
        let tamanhoAnterior = -1;
        for (let i = 0; i < 120; i++) {
          await new Promise(r => setTimeout(r, 500));
          const tamanho = fssync.existsSync(pdfTemp) ? fssync.statSync(pdfTemp).size : -1;
          if (tamanho > 0 && tamanho === tamanhoAnterior) break;
          tamanhoAnterior = tamanho;
        }
        if (fssync.existsSync(pdfTemp)) { await fs.copyFile(pdfTemp, saidaPdf); resultado.pdf = saidaPdf; }
        else resultado.avisoPdf = 'O navegador não gerou o PDF. Abra o HTML e use "Imprimir / PDF".';
      } finally {
        await fs.rm(perfil, { recursive: true, force: true }).catch(() => {});
      }
    }
  }
  return resultado;
}

// Execução direta: exporta o painel JSON mais recente do cliente
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values: args } = parseArgs({ options: { cliente: { type: 'string', default: 'mondial' }, pdf: { type: 'boolean', default: false } } });
  const jsons = (await fs.readdir(RELATORIOS)).filter(f => f.startsWith(`painel_${args.cliente}_`) && f.endsWith('.json')).sort();
  if (!jsons.length) { console.error(`Nenhum painel de "${args.cliente}" em relatorios/. Rode antes: npm run gerar-painel -- --cliente ${args.cliente}`); process.exit(1); }
  const r = await exportarPainel(path.join(RELATORIOS, jsons[jsons.length - 1]), { pdf: args.pdf });
  console.log(`✔ Arquivo para e-mail: ${r.html}`);
  if (r.pdf) console.log(`✔ PDF: ${r.pdf}`);
  if (r.avisoPdf) console.log(r.avisoPdf);
}
