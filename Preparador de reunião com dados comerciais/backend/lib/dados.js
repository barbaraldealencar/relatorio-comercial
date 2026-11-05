// Utilitários para localizar e ler os arquivos da pasta dados/.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DADOS = path.join(RAIZ, 'dados');

export async function lerJson(relativo) {
  return JSON.parse(await fs.readFile(path.join(DADOS, relativo), 'utf8'));
}

export async function carregarCliente(id) {
  const clientes = await lerJson('clientes.json');
  const chave = String(id || '').toLowerCase().trim();
  const cfg = clientes[chave];
  if (!cfg) {
    const disponiveis = Object.keys(clientes).filter(k => !k.startsWith('_'));
    throw new Error(`Cliente "${id}" não cadastrado em dados/clientes.json. Disponíveis: ${disponiveis.join(', ')}`);
  }
  return { id: chave, ...cfg };
}

// Normaliza textos de cabeçalho para comparar sem acento, caixa ou pontuação.
export const normalizar = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();

function valorCelula(cell) {
  let v = cell.value;
  if (v && typeof v === 'object') {
    if (v instanceof Date) return v;
    if ('result' in v) v = v.result;          // fórmula com valor em cache
    else if ('formula' in v) v = null;        // fórmula sem valor em cache
    else if ('richText' in v) v = v.richText.map(t => t.text).join('');
    else if ('text' in v) v = v.text;         // hyperlink
  }
  return v ?? null;
}

const cacheWorkbooks = new Map();
export async function abrirWorkbook(relativo) {
  const arquivo = path.join(DADOS, relativo);
  if (!cacheWorkbooks.has(arquivo)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(arquivo);
    cacheWorkbooks.set(arquivo, wb);
  }
  return cacheWorkbooks.get(arquivo);
}

// Lê uma aba tabular (cabeçalho na linha 1) como lista de objetos { cabecalho: valor }.
export async function lerTabela(relativo, aba) {
  const wb = await abrirWorkbook(relativo);
  const ws = wb.getWorksheet(aba);
  if (!ws) throw new Error(`Aba "${aba}" não encontrada em ${relativo}`);
  const cabecalhos = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (c, i) => { cabecalhos[i] = String(valorCelula(c) ?? '').trim(); });
  const linhas = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const obj = {}; let vazia = true;
    cabecalhos.forEach((h, i) => { if (!h) return; const v = valorCelula(row.getCell(i)); obj[h] = v; if (v !== null && v !== '') vazia = false; });
    if (!vazia) linhas.push(obj);
  });
  return linhas;
}

// Lê uma aba no formato chave (coluna A) → valor (coluna B).
export async function lerChaveValor(relativo, aba) {
  const wb = await abrirWorkbook(relativo);
  const ws = wb.getWorksheet(aba);
  if (!ws) return {};
  const out = {};
  ws.eachRow(row => {
    const k = valorCelula(row.getCell(1)), v = valorCelula(row.getCell(2));
    if (k && v !== null && v !== '') out[String(k).trim()] = v;
  });
  return out;
}

// Busca o valor de uma coluna pelo início do nome normalizado (ex.: campo(linha, 'quantidade')).
export function campo(linha, prefixo) {
  const alvo = normalizar(prefixo);
  for (const [k, v] of Object.entries(linha)) if (normalizar(k).startsWith(alvo)) return v;
  return undefined;
}

export const arred = (x, casas = 2) => (x === null || x === undefined || !isFinite(x)) ? null : Math.round(x * 10 ** casas) / 10 ** casas;
export const mesChave = d => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
export const dataIso = d => (d instanceof Date ? d.toISOString().slice(0, 10) : d);
