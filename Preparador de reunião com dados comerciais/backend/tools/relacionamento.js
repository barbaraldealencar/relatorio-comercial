// Histórico de relacionamento: e-mails trocados e atas das últimas reuniões.
import fs from 'node:fs/promises';
import path from 'node:path';
import { DADOS, carregarCliente, lerJson } from '../lib/dados.js';

export const definicaoEmails = {
  name: 'ler_emails',
  description: 'Retorna os e-mails mais recentes trocados com o cliente (do mais novo para o mais antigo), com data, remetente, assunto e corpo.',
  input_schema: {
    type: 'object',
    properties: {
      cliente: { type: 'string', description: 'Código do cliente (ex.: "mondial").' },
      limite: { type: 'integer', description: 'Quantidade máxima de e-mails (padrão 15).' },
    },
    required: ['cliente'],
    additionalProperties: false,
  },
};

export async function executarEmails({ cliente, limite = 15 }) {
  const cfg = await carregarCliente(cliente);
  if (!cfg.emails) return { cliente: cfg.nome, emails: [], observacao: 'Nenhuma fonte de e-mails configurada para este cliente.' };
  const { emails = [], _aviso } = await lerJson(cfg.emails);
  const ordenados = [...emails].sort((a, b) => String(b.data).localeCompare(String(a.data))).slice(0, limite);
  return { cliente: cfg.nome, aviso: _aviso, total: ordenados.length, emails: ordenados };
}

export const definicaoAtas = {
  name: 'ler_atas_reunioes',
  description: 'Retorna as atas das últimas reuniões com o cliente (da mais nova para a mais antiga), incluindo as pendências registradas.',
  input_schema: {
    type: 'object',
    properties: {
      cliente: { type: 'string', description: 'Código do cliente (ex.: "mondial").' },
      limite: { type: 'integer', description: 'Quantidade máxima de atas (padrão 5).' },
    },
    required: ['cliente'],
    additionalProperties: false,
  },
};

export async function executarAtas({ cliente, limite = 5 }) {
  const cfg = await carregarCliente(cliente);
  if (!cfg.atas_reunioes) return { cliente: cfg.nome, atas: [], observacao: 'Nenhuma pasta de atas configurada.' };
  const pasta = path.join(DADOS, cfg.atas_reunioes);
  const arquivos = (await fs.readdir(pasta)).filter(f => /\.(md|txt)$/i.test(f)).sort().reverse().slice(0, limite);
  const atas = await Promise.all(arquivos.map(async f => ({ arquivo: f, conteudo: await fs.readFile(path.join(pasta, f), 'utf8') })));
  return { cliente: cfg.nome, total: atas.length, atas };
}
