// Utilitários para localizar e ler os arquivos da pasta dados/ (versão sem dados comerciais: só JSON de configuração).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

// Normaliza textos para comparar sem acento, caixa ou pontuação.
export const normalizar = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();

export const arred = (x, casas = 2) => (x === null || x === undefined || !isFinite(x)) ? null : Math.round(x * 10 ** casas) / 10 ** casas;
export const mesChave = d => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
export const dataIso = d => (d instanceof Date ? d.toISOString().slice(0, 10) : d);
