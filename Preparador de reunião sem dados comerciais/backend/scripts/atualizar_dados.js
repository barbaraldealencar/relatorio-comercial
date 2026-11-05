// Atualiza só os NÚMEROS dos painéis (gráficos, tabelas e notícias) com os dados públicos de hoje.
// Os textos (bullets, roteiro, hipóteses) ficam como estão: são escritos pela IA e atualizados à parte.
// Uso: npm run atualizar-dados   (ou node scripts/atualizar_dados.js [--cliente mondial])
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { RAIZ, lerJson } from '../lib/dados.js';
import { dadosGraficos } from '../agentes/gerar_painel.js';
import { exportarPainel, exportarCarteira } from './exportar_painel.js';

const RELATORIOS = path.resolve(RAIZ, '..', 'relatorios');
const { values: args } = parseArgs({ options: { cliente: { type: 'string' }, 'sem-pdf': { type: 'boolean', default: false } } });
const hoje = new Date().toISOString().slice(0, 10);

const clientes = Object.keys(await lerJson('clientes.json')).filter(k => !k.startsWith('_') && (!args.cliente || k === args.cliente));
const arquivos = (await fs.readdir(RELATORIOS)).filter(f => /^painel_[\w-]+_\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
const atualizados = [];

// Um cliente por vez: o Comex Stat limita consultas simultâneas (o cache do dia evita repetir)
for (const id of clientes) {
  const ultimo = arquivos.filter(f => f.startsWith(`painel_${id}_`)).pop();
  if (!ultimo) { console.log(`- ${id}: sem painel, pulei (gere o briefing primeiro)`); continue; }
  const arq = path.join(RELATORIOS, ultimo);
  const painel = JSON.parse(await fs.readFile(arq, 'utf8'));
  console.log(`- ${id}: atualizando números de ${ultimo}…`);
  painel.graficos = await dadosGraficos(id);
  painel.meta.dados_atualizados_em = hoje;
  await fs.writeFile(arq, JSON.stringify(painel, null, 2), 'utf8');
  await exportarPainel(arq, { pdf: !args['sem-pdf'] }).catch(e => console.log(`  exportação falhou: ${e.message}`));
  atualizados.push(arq);
  console.log(`  ✔ números de ${hoje}; textos de ${painel.meta.gerado_em}`);
}

// Arquivo da carteira e versão para o link compartilhado (todos os clientes com painel)
const todos = (await fs.readdir(RELATORIOS)).filter(f => /^painel_[\w-]+_\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
const ultimosPorCliente = Object.values(Object.fromEntries(todos.map(f => [f.split('_')[1], path.join(RELATORIOS, f)])));
if (ultimosPorCliente.length) {
  await exportarCarteira(ultimosPorCliente, path.join(RELATORIOS, 'carteira_mercado.html'), { titulo: 'Preparador de Reuniões de Mercado' });
  await exportarCarteira(ultimosPorCliente, path.join(RELATORIOS, 'preparador_mercado_link.html'), { titulo: 'Preparador de Reuniões de Mercado', paraLink: true });
}
console.log(`Pronto: ${atualizados.length} painel(is) com números de ${hoje}.`);
