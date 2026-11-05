// Registro das ferramentas disponíveis para o agente.
import * as noticias from './noticias.js';
import * as macro from './macro.js';
import * as setor from './setor.js';
import * as cliente from './cliente.js';
import * as peers from './peers.js';
import * as rel from './relacionamento.js';
import * as projecoes from './projecoes.js';
import * as projCliente from './projecao_cliente.js';
import * as importados from './importados.js';
import * as atualidade from './atualidade.js';

const REGISTRO = [
  [noticias.definicao, noticias.executar],
  [macro.definicao, macro.executar],
  [projecoes.definicao, projecoes.executar],
  [setor.definicao, setor.executar],
  [cliente.definicao, cliente.executar],
  [peers.definicao, peers.executar],
  [projCliente.definicao, projCliente.executar],
  [rel.definicaoEmails, rel.executarEmails],
  [rel.definicaoAtas, rel.executarAtas],
  [importados.definicao, importados.executar],
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
