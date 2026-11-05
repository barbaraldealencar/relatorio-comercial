// Checagem de atualidade: aponta notícias e dados velhos demais antes de entrarem no briefing.
// Só leitura: recebe a lista do que o agente pretende citar e devolve o que está dentro ou fora do prazo.

const DIA = 24 * 60 * 60 * 1000;
// Idade máxima recomendada por tipo de informação (em dias)
const LIMITES = { noticia: 30, mercado: 7, indicador: 120, cliente: 45, perfil: 730 };

function lerData(texto) {
  if (!texto) return null;
  const s = String(texto).trim();
  let m = s.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);                 // 2026-10-08 ou 2026-10
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +(m[3] || 1)));
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);                        // 08/10/2026
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  m = s.match(/^(\d{2})\/(\d{4})$/);                                 // 10/2026
  if (m) return new Date(Date.UTC(+m[2], +m[1] - 1, 1));
  m = s.match(/^(\d{4})$/);                                          // 2020
  if (m) return new Date(Date.UTC(+m[1], 0, 1));
  return null;
}

export const definicao = {
  name: 'verificar_atualidade',
  description:
    'Confere se as notícias, dados de mercado, indicadores e fatos que você pretende citar no briefing estão atuais. ' +
    'Envie cada item com o tipo e a data (AAAA-MM-DD, AAAA-MM, DD/MM/AAAA, MM/AAAA ou AAAA). Limites padrão: notícia 30 dias, ' +
    'mercado (petróleo, câmbio) 7 dias, indicador setorial 120 dias, dado interno do cliente 45 dias, perfil/fato corporativo 2 anos. ' +
    'Use antes de fechar o briefing: item "antigo" sai ou entra como contexto histórico, com a data explícita; item "sem data" não pode ser apresentado como atual.',
  input_schema: {
    type: 'object',
    properties: {
      itens: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            descricao: { type: 'string', description: 'O que será citado (ex.: manchete, indicador, fato).' },
            tipo: { type: 'string', enum: Object.keys(LIMITES) },
            data: { type: 'string', description: 'Data da informação.' },
          },
          required: ['descricao', 'tipo'],
        },
      },
      data_referencia: { type: 'string', description: 'Data da reunião ou de hoje (padrão: hoje).' },
    },
    required: ['itens'],
    additionalProperties: false,
  },
};

export async function executar({ itens, data_referencia }) {
  const ref = lerData(data_referencia) || new Date();
  const resultado = itens.map(it => {
    const data = lerData(it.data);
    const limite = LIMITES[it.tipo] ?? 30;
    if (!data) return { ...it, situacao: 'sem data', orientacao: 'Não apresente como atual; procure a data ou retire.' };
    const idade = Math.round((ref - data) / DIA);
    if (idade < -1) return { ...it, idade_dias: idade, situacao: 'data no futuro', orientacao: 'Confira a data: provavelmente é projeção ou erro.' };
    const antigo = idade > limite;
    return {
      ...it, idade_dias: idade, limite_dias: limite,
      situacao: antigo ? 'antigo' : 'ok',
      orientacao: antigo ? `Mais velho que ${limite} dias: retire ou cite como histórico, com a data.` : 'Pode usar, citando a data.',
    };
  });
  const problemas = resultado.filter(r => r.situacao !== 'ok').length;
  return { data_referencia: ref.toISOString().slice(0, 10), total: resultado.length, com_problema: problemas, itens: resultado };
}
