// Perfil do segmento do cliente: como usa resina, o que move a demanda e quais indicadores acompanhar.
import fs from 'node:fs/promises';
import path from 'node:path';
import { DADOS, normalizar } from '../lib/dados.js';

export const definicao = {
  name: 'perfil_setor',
  description:
    'Retorna o perfil do segmento do cliente (ex.: "eletroportateis"): como ele usa resina, os drivers de demanda, os indicadores-chave ' +
    'com últimos valores e fontes, e consultas de notícias sugeridas. Se o segmento não tiver perfil cadastrado, informa isso; nesse caso ' +
    'deduza os indicadores pelo seu conhecimento e deixe claro que são sugestões.',
  input_schema: {
    type: 'object',
    properties: { segmento: { type: 'string', description: 'Código do segmento, como aparece no cadastro do cliente.' } },
    required: ['segmento'],
    additionalProperties: false,
  },
};

export async function executar({ segmento }) {
  const pasta = path.join(DADOS, 'setores');
  const arquivos = (await fs.readdir(pasta)).filter(f => f.endsWith('.json'));
  const alvo = arquivos.find(f => normalizar(f.replace('.json', '')) === normalizar(segmento));
  if (!alvo) return { segmento, encontrado: false, segmentos_disponiveis: arquivos.map(f => f.replace('.json', '')) };
  return { encontrado: true, ...JSON.parse(await fs.readFile(path.join(pasta, alvo), 'utf8')) };
}
