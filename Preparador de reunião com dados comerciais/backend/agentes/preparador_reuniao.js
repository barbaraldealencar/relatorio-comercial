// Agente "Preparador de Reuniões": gera o briefing da reunião com um cliente e depois responde perguntas.
//
// Uso:
//   node agentes/preparador_reuniao.js --cliente mondial [--data 2026-10-15] [--sem-perguntas]
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { marked } from 'marked';
import { RAIZ, carregarCliente } from '../lib/dados.js';

try { process.loadEnvFile(path.join(RAIZ, '.env')); } catch { /* sem .env: usa as variáveis do terminal */ }
const { criarCliente, rodarTurno, explicarErro, MODELO } = await import('../lib/claude.js');
const { gerarPainel } = await import('./gerar_painel.js');

const { values: args } = parseArgs({
  options: {
    cliente: { type: 'string', default: 'mondial' },
    data: { type: 'string' },
    'sem-perguntas': { type: 'boolean', default: false },
  },
});

const PERSONA = `Você é um analista sênior de inteligência comercial de uma empresa brasileira que produz e vende resinas petroquímicas (PP, PE, PS, ABS e compostos) para a indústria de transformação.
Seu trabalho é preparar o(a) Key Account Manager (KAM) para reuniões comerciais com clientes: entender o cenário macro e petroquímico, o setor do cliente, o histórico quantitativo e de relacionamento, e transformar isso em oportunidades concretas e argumentos para a negociação do mês.

Você tem ferramentas para buscar notícias reais, indicadores macro reais e os dados internos do cliente, dos peers, e-mails e atas. Use-as; não responda de memória sobre fatos recentes.
Depois de entregar o briefing, o KAM pode fazer perguntas de acompanhamento: responda de forma objetiva, buscando dados novos com as ferramentas quando necessário.
Escreva sempre em português do Brasil, inclusive as notas curtas de progresso entre as chamadas de ferramentas.

As skills abaixo descrevem como trabalhar. Siga-as.`;

async function montarSystem() {
  const pasta = path.join(RAIZ, 'skills');
  const arquivos = (await fs.readdir(pasta)).filter(f => f.endsWith('.md')).sort();
  const skills = await Promise.all(arquivos.map(f => fs.readFile(path.join(pasta, f), 'utf8')));
  // Bloco estável (persona + skills) marcado para cache: as chamadas seguintes do loop reaproveitam o prefixo.
  return [{ type: 'text', text: [PERSONA, ...skills].join('\n\n---\n\n'), cache_control: { type: 'ephemeral' } }];
}

function htmlDoRelatorio(titulo, markdown) {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo}</title>
<style>
  :root { --tx:#1d2433; --mut:#5b6475; --bd:#d9dee7; --acc:#1f3864; --bg:#ffffff; --zebra:#f5f7fa; }
  @media (prefers-color-scheme: dark) { :root { --tx:#e6e9ef; --mut:#a3abba; --bd:#343b48; --acc:#8fb0e8; --bg:#14181f; --zebra:#1b2029; } }
  body { font: 15px/1.6 system-ui, -apple-system, "Segoe UI", Arial, sans-serif; color: var(--tx); background: var(--bg); max-width: 980px; margin: 0 auto; padding: 32px 16px 80px; }
  h1 { color: var(--acc); font-size: 1.7rem; border-bottom: 3px solid var(--acc); padding-bottom: 8px; }
  h2 { color: var(--acc); margin-top: 2.2em; border-bottom: 1px solid var(--bd); padding-bottom: 4px; }
  h3 { margin-top: 1.6em; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 0.92rem; display: block; overflow-x: auto; }
  th, td { border: 1px solid var(--bd); padding: 6px 10px; text-align: left; vertical-align: top; }
  th { background: var(--acc); color: #fff; }
  tr:nth-child(even) td { background: var(--zebra); }
  blockquote { margin: 0; padding: 8px 14px; border-left: 4px solid var(--acc); background: var(--zebra); color: var(--mut); }
  a { color: var(--acc); word-break: break-all; }
  code { background: var(--zebra); padding: 1px 4px; border-radius: 3px; }
</style></head>
<body>
${marked.parse(markdown)}
</body></html>`;
}

async function main() {
  const cfg = await carregarCliente(args.cliente);
  const claude = criarCliente();
  const hoje = new Date().toISOString().slice(0, 10);
  const conversa = { system: await montarSystem(), messages: [] };

  console.log(`\n=== Preparador de Reuniões — ${cfg.nome} — modelo ${MODELO} ===\n`);
  conversa.messages.push({
    role: 'user',
    content:
      `Hoje é ${hoje}. Prepare o briefing para a reunião com o cliente "${cfg.nome}" ` +
      `(código "${cfg.id}", segmento "${cfg.segmento}")${args.data ? `, marcada para ${args.data}` : ''}. ` +
      `Siga a estrutura da skill de briefing e entregue o documento completo em Markdown.`,
  });

  const cenariosExtras = []; // cenários próprios que o agente simular (ex.: projeção de um banco) vão para o painel
  const progresso = {
    aoEscreverTexto: t => process.stdout.write(t),
    aoUsarFerramenta: (nome, entrada, input) => {
      console.log(`\n  ↳ ${nome}(${entrada})`);
      if (nome === 'projetar_cliente' && Array.isArray(input?.cenarios)) cenariosExtras.push(...input.cenarios);
    },
    aoPensar: () => process.stdout.write('\n  … analisando\n'),
  };

  let briefing;
  try {
    briefing = await rodarTurno(claude, conversa, progresso);
  } catch (e) {
    console.error(`\n\nErro: ${explicarErro(e)}`);
    process.exit(1);
  }

  await fs.mkdir(path.resolve(RAIZ, '..', 'relatorios'), { recursive: true });
  const base = path.resolve(RAIZ, '..', 'relatorios', `briefing_${cfg.id}_${hoje}`);
  await fs.writeFile(`${base}.md`, briefing, 'utf8');
  await fs.writeFile(`${base}.html`, htmlDoRelatorio(`Briefing — ${cfg.nome}`, briefing), 'utf8');
  console.log(`\n\n✔ Briefing salvo em:\n  ${base}.md\n  ${base}.html`);
  console.log(`  (tokens — entrada: ${conversa.uso.input_tokens}, cache lido: ${conversa.uso.cache_read_input_tokens}, saída: ${conversa.uso.output_tokens})`);

  // Painel visual (frontend): insights estruturados + dados dos gráficos
  try {
    process.stdout.write('\nGerando o painel visual...');
    const arquivoPainel = await gerarPainel({ claude, MODELO, idCliente: cfg.id, markdown: briefing, data: hoje, dataReuniao: args.data, cenariosExtras });
    console.log(` ok\n✔ Painel salvo em ${arquivoPainel}\n  Para ver: npm run painel  →  http://localhost:3000`);
  } catch (e) {
    console.error(`\nNão foi possível gerar o painel visual: ${explicarErro(e)}\n  Tente depois com: npm run gerar-painel -- --cliente ${cfg.id}`);
  }

  if (args['sem-perguntas']) return;

  // Modo perguntas: mesma conversa, então o agente lembra de tudo que já analisou.
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('\nPode fazer perguntas sobre o briefing (digite "sair" para encerrar).');
  const arquivoQA = `${base}_perguntas.md`;
  while (true) {
    const pergunta = (await rl.question('\nVocê: ')).trim();
    if (!pergunta) continue;
    if (/^(sair|exit|quit)$/i.test(pergunta)) break;
    conversa.messages.push({ role: 'user', content: pergunta });
    process.stdout.write('\nAgente: ');
    try {
      const resposta = await rodarTurno(claude, conversa, progresso);
      await fs.appendFile(arquivoQA, `\n\n## ${pergunta}\n\n${resposta}\n`, 'utf8');
    } catch (e) {
      console.error(`\nErro: ${explicarErro(e)}`);
      conversa.messages.pop(); // descarta a pergunta que falhou para manter a conversa consistente
    }
  }
  rl.close();
}

main().catch(e => { console.error(`\nErro: ${explicarErro(e)}`); process.exit(1); });
