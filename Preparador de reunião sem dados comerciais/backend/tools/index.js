// Registro das ferramentas do agente (versão sem dados comerciais: só fontes públicas).
import * as noticias from './noticias.js';
import * as macro from './macro.js';
import * as projecoes from './projecoes.js';
import * as setor from './setor.js';
import * as ibge from './ibge.js';
import * as comex from './comex.js';
import * as empresas from './empresas.js';
import * as perfil from './perfil.js';
import * as importados from './importados.js';
import * as atualidade from './atualidade.js';
import * as indicadoresMensais from './indicadores_mensais.js';
import * as notasCampo from './notas_campo.js';

const REGISTRO = [
  [noticias.definicao, noticias.executar],
  [macro.definicao, macro.executar],
  [indicadoresMensais.definicao, indicadoresMensais.executar],
  [projecoes.definicao, projecoes.executar],
  [comex.definicao, comex.executar],
  [setor.definicao, setor.executar],
  [importados.definicao, importados.executar],
  [ibge.definicao, ibge.executar],
  [empresas.definicao, empresas.executar],
  [perfil.definicao, perfil.executar],
  [notasCampo.definicao, notasCampo.executar],
  [atualidade.definicao, atualidade.executar],
];

export const ferramentas = REGISTRO.map(([def]) => def);
const executores = Object.fromEntries(REGISTRO.map(([def, fn]) => [def.name, fn]));

const LIMITE_CARACTERES = 60000;

// Executa a ferramenta e devolve o tool_result correspondente (erros voltam com is_error para o modelo se ajustar).
export async function executarFerramenta(bloco) {
  const fn = executores[bloco.name];
  try {
    if (!fn) throw new Error(`ferramenta desconhecida: ${bloco.name}`);
    if (typeof bloco.input !== 'object' || bloco.input === null) throw new Error('entrada inválida');
    let texto = JSON.stringify(await fn(bloco.input));
    if (texto.length > LIMITE_CARACTERES) texto = texto.slice(0, LIMITE_CARACTERES) + '… [resultado truncado]';
    return { type: 'tool_result', tool_use_id: bloco.id, content: texto };
  } catch (e) {
    return { type: 'tool_result', tool_use_id: bloco.id, content: `Erro: ${e.message}`, is_error: true };
  }
}
