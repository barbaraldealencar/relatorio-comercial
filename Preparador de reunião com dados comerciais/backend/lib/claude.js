// Cliente do Claude via Amazon Bedrock (bedrock-runtime, perfil de inferência global) e loop de ferramentas do agente.
import Anthropic from '@anthropic-ai/sdk';
import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import { ferramentas, executarFerramenta } from '../tools/index.js';

// Em sa-east-1 os modelos novos são acessados por perfil de inferência global (prefixo "global.").
export const MODELO = process.env.CLAUDE_MODEL || 'global.anthropic.claude-opus-5';
const ESFORCO = process.env.CLAUDE_EFFORT || 'high';

export function criarCliente() {
  const token = process.env.AWS_BEARER_TOKEN_BEDROCK;
  if (!token) {
    throw new Error('Variável AWS_BEARER_TOKEN_BEDROCK não definida. Crie o arquivo backend/.env a partir de .env.example ou defina a variável no terminal.');
  }
  // Chave de API do Bedrock (bearer token): o SDK do Bedrock usa direto, sem credenciais IAM.
  return new AnthropicBedrock({ apiKey: token, awsRegion: process.env.AWS_REGION || 'sa-east-1' });
}

export function explicarErro(e) {
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
    return `Acesso negado pelo Bedrock (${e.status}). A chave AWS_BEARER_TOKEN_BEDROCK pode ter expirado (chaves de curto prazo valem até 12 h) ou não ter permissão para o modelo ${MODELO}. Gere uma nova chave no console da AWS.`;
  }
  if (e instanceof Anthropic.NotFoundError || e instanceof Anthropic.BadRequestError) {
    return `O Bedrock recusou a requisição (${e.status}): ${e.message}\nSe o modelo ${MODELO} não estiver liberado na sua conta, tente CLAUDE_MODEL=global.anthropic.claude-opus-4-8 no .env.`;
  }
  if (e instanceof Anthropic.InternalServerError) {
    return `O Bedrock não conseguiu processar a requisição (${e.status}) com o modelo ${MODELO}. Pode ser instabilidade ou modelo ainda não liberado na conta; tente novamente ou use CLAUDE_MODEL=global.anthropic.claude-opus-5.`;
  }
  if (e instanceof Anthropic.RateLimitError) return 'Limite de requisições do Bedrock atingido. Aguarde um minuto e tente novamente.';
  if (e instanceof Anthropic.APIConnectionError) return `Falha de conexão com o Bedrock: ${e.message}`;
  return e?.message || String(e);
}

const resumirEntrada = input => Object.entries(input || {}).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ');

/**
 * Executa um turno completo do agente: chama o modelo, roda as ferramentas pedidas e repete até a resposta final.
 * `conversa.messages` é atualizado no lugar (só acrescentamos mensagens, nunca editamos as anteriores).
 * Retorna o texto final do assistente.
 */
export async function rodarTurno(cliente, conversa, { aoEscreverTexto = t => process.stdout.write(t), aoUsarFerramenta, aoPensar, usarFerramentas = true, esforco = ESFORCO } = {}) {
  for (let rodada = 0; rodada < 25; rodada++) {
    const stream = cliente.messages.stream({
      model: MODELO,
      max_tokens: 64000,
      system: conversa.system,
      ...(usarFerramentas ? { tools: ferramentas } : {}),
      messages: conversa.messages,
      thinking: { type: 'adaptive' },
      output_config: { effort: esforco },
    });
    stream.on('text', aoEscreverTexto);
    stream.on('streamEvent', ev => { if (ev.type === 'content_block_start' && ev.content_block.type === 'thinking') aoPensar?.(); });

    const resposta = await stream.finalMessage();
    conversa.messages.push({ role: 'assistant', content: resposta.content });
    conversa.uso = somarUso(conversa.uso, resposta.usage);

    if (resposta.stop_reason === 'refusal') {
      throw new Error('O modelo recusou continuar esta solicitação (stop_reason=refusal). Reformule o pedido.');
    }
    if (resposta.stop_reason === 'max_tokens') {
      throw new Error('A resposta atingiu o limite de tokens antes de terminar.');
    }
    if (resposta.stop_reason === 'pause_turn') continue;

    const chamadas = resposta.content.filter(b => b.type === 'tool_use');
    if (resposta.stop_reason !== 'tool_use' || chamadas.length === 0) {
      return resposta.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    }

    chamadas.forEach(c => aoUsarFerramenta?.(c.name, resumirEntrada(c.input), c.input));
    // Ferramentas independentes rodam em paralelo; todos os resultados voltam numa única mensagem.
    const resultados = await Promise.all(chamadas.map(executarFerramenta));
    conversa.messages.push({ role: 'user', content: resultados });
  }
  throw new Error('O agente excedeu o número máximo de rodadas de ferramentas.');
}

function somarUso(acc = {}, u = {}) {
  const out = { ...acc };
  for (const k of ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens']) out[k] = (out[k] || 0) + (u[k] || 0);
  return out;
}
