// Agentes interativos usados pelo painel (via servidor.js):
//   - Assistente: conversa sobre o briefing, com acesso às mesmas ferramentas de dados, notícias e projeções.
//   - Simulador: o modelo faz o papel do comprador do cliente para o KAM treinar a negociação.
//   - Avaliação: um "coach" dá nota e feedback sobre a simulação.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { RAIZ } from '../lib/dados.js';
import { criarCliente, rodarTurno } from '../lib/claude.js';

const RELATORIOS = path.resolve(RAIZ, '..', 'relatorios');
const sessoes = new Map(); // id → { tipo, painel, conversa, criadaEm }
const VALIDADE_MS = 4 * 60 * 60 * 1000;
let claude;
const cliente = () => (claude ||= criarCliente());

function limparSessoesAntigas() {
  const agora = Date.now();
  for (const [id, s] of sessoes) if (agora - s.criadaEm > VALIDADE_MS) sessoes.delete(id);
}

// Carrega o painel (JSON) e o briefing completo (Markdown) correspondente.
async function carregarContexto(arquivoPainel) {
  if (!/^painel_[\w-]+_\d{4}-\d{2}-\d{2}\.json$/.test(arquivoPainel)) throw new Error('painel inválido');
  const painel = JSON.parse(await fs.readFile(path.join(RELATORIOS, arquivoPainel), 'utf8'));
  const md = path.join(RELATORIOS, `briefing_${painel.meta.id}_${painel.meta.gerado_em}.md`);
  const briefing = await fs.readFile(md, 'utf8').catch(() => JSON.stringify(painel.insights, null, 1));
  return { painel, briefing };
}

const hoje = () => new Date().toISOString().slice(0, 10);

const PROMPT_ASSISTENTE = ({ meta }, briefing) => `Você é o assistente de IA do painel de reuniões comerciais de uma empresa que vende resinas petroquímicas (PP, PE, PS, ABS e compostos).
Você ajuda o(a) Key Account Manager a se preparar para a reunião com o cliente ${meta.cliente} (código "${meta.id}", segmento "${meta.segmento}"${meta.data_reuniao ? `, reunião em ${meta.data_reuniao}` : ''}). Hoje é ${hoje()}.

Como responder:
- Direto e objetivo: comece pela resposta. Use listas curtas e tabelas pequenas quando ajudarem. Markdown é permitido.
- Sempre com números e unidades quando houver; diga de onde vem o dado (briefing, ferramenta, notícia com veículo e data).
- O briefing abaixo é a base. Para dados novos ou atualizados (notícias de hoje, cotações, cenários diferentes, outra grade), use as ferramentas.
- Se o usuário pedir um texto pronto (e-mail, mensagem, frase de abertura), entregue o texto pronto para copiar.
- Não invente dados. Se algo não estiver disponível, diga.
${meta.dados_ficticios ? '- Os dados do cliente, peers, e-mails e atas são fictícios (demonstração); macro, petróleo, projeções e notícias são reais.\n' : ''}- Escreva em português do Brasil.

<briefing>
${briefing}
</briefing>`;

const PROMPT_SIMULADOR = ({ meta }, briefing) => `Você vai fazer um ROLE-PLAY de treino de negociação. Você é o principal comprador (gerente de suprimentos) do cliente ${meta.cliente}, citado no briefing abaixo, numa reunião com o(a) KAM do fornecedor de resinas.

Sua personagem:
- Profissional, cordial e firme. Defende a margem da sua empresa: o varejo não aceita repasse, a concorrência de importados é real, e você tem metas de custo.
- Seus objetivos (use os do briefing: pedidos de teto de reajuste, desconto, prazo maior, preço de ABS, RFQ 2027 etc.). Abra pedindo algo concreto.
- Você conhece o que um comprador do cliente saberia: seus próprios volumes, as cotações que recebeu, os e-mails e as reuniões anteriores, o histórico de qualidade e de entregas. Você NÃO conhece as informações internas do fornecedor (benchmark de peers, margem, mínimo aceitável, estratégia). Nunca revele que leu o briefing.
- Reaja de forma realista: se o KAM trouxer bons argumentos com dados, ceda aos poucos e peça contrapartidas; se ele ceder fácil, peça mais; se ele for vago, pressione.
- Respostas curtas, de 2 a 5 frases, como numa conversa real. Fique sempre no papel. Não dê dicas ao KAM.
- Português do Brasil.

<briefing_do_fornecedor_contexto_para_a_personagem>
${briefing}
</briefing_do_fornecedor_contexto_para_a_personagem>`;

const PROMPT_AVALIADOR = briefing => `Você é um coach sênior de negociação B2B (indústria química/petroquímica). Avalie a simulação de reunião abaixo entre o(a) KAM do fornecedor de resinas e o comprador do cliente.
Use o briefing (objetivos, mínimo aceitável, argumentos, oportunidades) como referência do que era esperado.

Entregue em Markdown, de forma objetiva:
## Nota: X/10
Uma frase de veredito.
## Resultado obtido
O que foi acordado (ou não) vs o objetivo e o mínimo aceitável do briefing.
## Pontos fortes
2 a 4 bullets, citando trechos.
## O que melhorar
2 a 4 bullets. Para cada um, cite o trecho e sugira a frase que teria funcionado melhor.
## Argumentos do briefing que ficaram de fora
## Próximo treino
1 sugestão concreta.

<briefing>
${briefing}
</briefing>`;

// ---------------------------------------------------------------------------

export async function novaSessao(tipo, arquivoPainel) {
  limparSessoesAntigas();
  const { painel, briefing } = await carregarContexto(arquivoPainel);
  const texto = tipo === 'simulador' ? PROMPT_SIMULADOR(painel, briefing) : PROMPT_ASSISTENTE(painel, briefing);
  const id = crypto.randomUUID();
  // O system (com o briefing inteiro) fica em cache: as mensagens seguintes da conversa custam bem menos.
  sessoes.set(id, { tipo, arquivoPainel, briefing, conversa: { system: [{ type: 'text', text: texto, cache_control: { type: 'ephemeral' } }], messages: [] }, criadaEm: Date.now() });
  return id;
}

/**
 * Envia uma mensagem na sessão e transmite a resposta por callbacks.
 * eventos: { texto(delta), ferramenta(nome), pensando() }
 */
export async function conversar(idSessao, mensagem, eventos) {
  const s = sessoes.get(idSessao);
  if (!s) throw new Error('Sessão expirada. Recarregue a conversa.');
  const conteudo = String(mensagem || '').trim().slice(0, 8000);
  if (!conteudo) throw new Error('Mensagem vazia.');
  const tamanhoAntes = s.conversa.messages.length;
  s.conversa.messages.push({ role: 'user', content: conteudo });
  try {
    return await rodarTurno(cliente(), s.conversa, {
      aoEscreverTexto: eventos.texto,
      aoUsarFerramenta: nome => eventos.ferramenta?.(nome),
      aoPensar: () => eventos.pensando?.(),
      usarFerramentas: s.tipo === 'assistente',
      esforco: s.tipo === 'assistente' ? 'medium' : 'low',
    });
  } catch (e) {
    // Descarta o turno que falhou (pergunta + respostas parciais) para a conversa continuar consistente.
    s.conversa.messages.length = tamanhoAntes;
    throw e;
  }
}

// Avalia a simulação: monta a transcrição e pede o feedback a um "coach" (conversa separada).
export async function avaliarSimulacao(idSessao, eventos) {
  const s = sessoes.get(idSessao);
  if (!s || s.tipo !== 'simulador') throw new Error('Simulação não encontrada.');
  const falas = s.conversa.messages
    .map(m => ({ papel: m.role === 'user' ? 'KAM' : 'COMPRADOR', texto: typeof m.content === 'string' ? m.content : m.content.filter(b => b.type === 'text').map(b => b.text).join('\n') }))
    .filter(f => f.texto && !f.texto.startsWith('[início da simulação]'));
  if (falas.filter(f => f.papel === 'KAM').length < 1) throw new Error('Converse um pouco antes de pedir a avaliação.');
  const transcricao = falas.map(f => `${f.papel}: ${f.texto}`).join('\n\n');
  const conversa = { system: [{ type: 'text', text: PROMPT_AVALIADOR(s.briefing) }], messages: [{ role: 'user', content: `<simulacao>\n${transcricao}\n</simulacao>\n\nAvalie a atuação do KAM.` }] };
  return rodarTurno(cliente(), conversa, { aoEscreverTexto: eventos.texto, usarFerramentas: false, esforco: 'medium' });
}
