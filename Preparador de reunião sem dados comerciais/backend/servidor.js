// Servidor local do painel: entrega o frontend, os painéis gerados e a API dos agentes de IA.
// Uso: npm run painel  →  http://localhost:3000
//
// API
//   GET  /api/paineis                     lista os painéis gerados
//   GET  /api/paineis/:arquivo            conteúdo de um painel
//   GET  /api/status                      IA disponível? qual modelo?
//   GET  /api/clientes                    clientes cadastrados (para gerar briefing)
//   POST /api/sessoes                     { tipo: "assistente" | "simulador", painel } → { id }
//   POST /api/sessoes/:id/mensagens       { mensagem } → resposta em streaming (SSE)
//   POST /api/sessoes/:id/avaliar         avaliação da simulação em streaming (SSE)
//   POST /api/briefings                   { cliente, dataReuniao } → { job }   (gera briefing + painel)
//   GET  /api/briefings/:job/eventos      progresso da geração (SSE)
//   GET  /api/segmentos                   segmentos com perfil cadastrado
//   GET  /api/notas?segmento=x            informações de campo do segmento (sem o cliente de origem)
//   POST /api/notas                       registra uma informação de campo
//   DELETE /api/notas/:id                 remove uma informação de campo
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { RAIZ, DADOS, lerJson } from './lib/dados.js';
import { notasParaSegmento, adicionarNota, removerNota, pareceSensivel } from './lib/notas.js';

try { process.loadEnvFile(path.join(RAIZ, '.env')); } catch { /* sem .env: usa as variáveis do terminal */ }
const { novaSessao, conversar, avaliarSimulacao } = await import('./agentes/assistente.js');
const { explicarErro, MODELO } = await import('./lib/claude.js');

const PORTA = Number(process.env.PORT) || 3001;
const FRONTEND = path.resolve(RAIZ, '..', 'frontend');
const RELATORIOS = path.resolve(RAIZ, '..', 'relatorios');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const RE_PAINEL = /^painel_[\w-]+_\d{4}-\d{2}-\d{2}\.json$/;

const responder = (res, status, corpo, tipo = 'application/json; charset=utf-8') => {
  res.writeHead(status, { 'Content-Type': tipo, 'Cache-Control': 'no-store' });
  res.end(typeof corpo === 'string' || Buffer.isBuffer(corpo) ? corpo : JSON.stringify(corpo));
};

async function lerCorpo(req) {
  let dados = '';
  for await (const parte of req) { dados += parte; if (dados.length > 100_000) throw Object.assign(new Error('corpo grande demais'), { status: 413 }); }
  try { return dados ? JSON.parse(dados) : {}; } catch { throw Object.assign(new Error('JSON inválido'), { status: 400 }); }
}

// Server-Sent Events: cada evento é um objeto JSON numa linha "data:".
function abrirSSE(res) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  let fechado = false;
  res.on('close', () => { fechado = true; });
  return { enviar: obj => { if (!fechado) res.write(`data: ${JSON.stringify(obj)}\n\n`); }, fim: () => { if (!fechado) res.end(); } };
}

async function streamDoAgente(res, executar) {
  const sse = abrirSSE(res);
  try {
    await executar({ texto: t => sse.enviar({ tipo: 'texto', delta: t }), ferramenta: nome => sse.enviar({ tipo: 'ferramenta', nome }), pensando: () => sse.enviar({ tipo: 'pensando' }) });
    sse.enviar({ tipo: 'fim' });
  } catch (e) {
    sse.enviar({ tipo: 'erro', mensagem: explicarErro(e) });
  }
  sse.fim();
}

async function listarPaineis() {
  const arquivos = (await fs.readdir(RELATORIOS).catch(() => [])).filter(f => RE_PAINEL.test(f)).sort().reverse();
  return Promise.all(arquivos.map(async arquivo => {
    const { meta, graficos } = JSON.parse(await fs.readFile(path.join(RELATORIOS, arquivo), 'utf8'));
    const t = graficos?.cliente_totais || {};
    // Resumo para a lista de clientes: variação de volume e faturamento de 12 meses
    return { arquivo, ...meta, resumo: { var_volume_pct: t.variacao_volume_aa_pct ?? null, faturamento_12m: t['faturamento_ultimos_12m_R$'] ?? null } };
  }));
}

// ---------------------------------------------------------------------------
// Geração de briefing em segundo plano (roda o mesmo agente do terminal)
// ---------------------------------------------------------------------------
const atualizacao = { rodando: false, ok: null, log: [] };
const jobs = new Map(); // id → { eventos: [], ouvintes: Set, terminado }
function emitir(job, evento) { job.eventos.push(evento); for (const f of job.ouvintes) f(evento); }

function iniciarBriefing(idCliente, dataReuniao) {
  if ([...jobs.values()].some(j => !j.terminado)) throw Object.assign(new Error('Já existe um briefing sendo gerado. Aguarde terminar.'), { status: 409 });
  const id = crypto.randomUUID();
  const job = { eventos: [], ouvintes: new Set(), terminado: false, inicio: Date.now() };
  jobs.set(id, job);
  const args = ['agentes/preparador_reuniao.js', '--cliente', idCliente, '--sem-perguntas'];
  if (dataReuniao) args.push('--data', dataReuniao);
  const proc = spawn(process.execPath, args, { cwd: RAIZ, env: process.env });
  let buffer = '', erros = '', painel = null;
  emitir(job, { tipo: 'status', texto: 'Iniciando o agente…' });
  proc.stdout.setEncoding('utf8');
  proc.stdout.on('data', parte => {
    buffer += parte;
    const linhas = buffer.split('\n'); buffer = linhas.pop();
    for (const l of linhas) {
      const ferramenta = l.match(/↳ (\w+)\((.*)\)/);
      if (ferramenta) emitir(job, { tipo: 'ferramenta', nome: ferramenta[1], detalhe: ferramenta[2].slice(0, 120) });
      else if (/Briefing salvo/.test(l)) emitir(job, { tipo: 'status', texto: 'Briefing escrito. Montando o painel visual…' });
      else if (/Painel salvo em/.test(l)) painel = path.basename(l.split('Painel salvo em')[1].trim());
      else if (/^Erro:|Não foi possível/.test(l.trim())) erros += l + '\n';
    }
  });
  proc.stderr.setEncoding('utf8');
  proc.stderr.on('data', t => { erros += t; });
  proc.on('close', codigo => {
    job.terminado = true;
    if (codigo === 0 && painel) emitir(job, { tipo: 'concluido', painel, segundos: Math.round((Date.now() - job.inicio) / 1000) });
    else emitir(job, { tipo: 'erro', mensagem: (erros.trim().split('\n').filter(Boolean).slice(-3).join(' ') || `O agente terminou com código ${codigo}.`).replace(/^Erro:\s*/, '') });
    setTimeout(() => jobs.delete(id), 30 * 60 * 1000);
  });
  return id;
}

// ---------------------------------------------------------------------------
const servidor = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const rota = `${req.method} ${url.pathname}`;
    let m;

    if (rota === 'GET /api/paineis') return responder(res, 200, await listarPaineis());
    if (req.method === 'GET' && (m = url.pathname.match(/^\/api\/paineis\/([^/]+)$/)) && RE_PAINEL.test(m[1])) {
      return responder(res, 200, await fs.readFile(path.join(RELATORIOS, m[1]), 'utf8'));
    }
    if (rota === 'GET /api/status') return responder(res, 200, { ia: !!process.env.AWS_BEARER_TOKEN_BEDROCK, modelo: MODELO });
    if (rota === 'GET /api/clientes') {
      const cad = await lerJson('clientes.json');
      return responder(res, 200, Object.entries(cad).filter(([k]) => !k.startsWith('_')).map(([id, c]) => ({ id, nome: c.nome, segmento: c.segmento })));
    }

    // Atualização dos números (sem IA): roda o script e informa o andamento
    if (rota === 'POST /api/atualizar-dados') {
      if (atualizacao.rodando) return responder(res, 409, { erro: 'Já existe uma atualização em andamento.' });
      Object.assign(atualizacao, { rodando: true, inicio: Date.now(), log: [], ok: null });
      const proc = spawn(process.execPath, ['scripts/atualizar_dados.js'], { cwd: RAIZ, env: process.env });
      proc.stdout.setEncoding('utf8'); proc.stderr.setEncoding('utf8');
      const guardar = t => atualizacao.log.push(...t.split('\n').filter(Boolean));
      proc.stdout.on('data', guardar);
      proc.stderr.on('data', guardar);
      proc.on('close', codigo => Object.assign(atualizacao, { rodando: false, ok: codigo === 0, fim: Date.now() }));
      return responder(res, 200, { iniciado: true });
    }
    if (rota === 'GET /api/atualizar-dados') return responder(res, 200, { rodando: atualizacao.rodando, ok: atualizacao.ok, ultimas: atualizacao.log.slice(-3) });

    if (rota === 'GET /api/segmentos') {
      const arqs = (await fs.readdir(path.join(DADOS, 'setores'))).filter(f => f.endsWith('.json'));
      return responder(res, 200, await Promise.all(arqs.map(async f => { const p = JSON.parse(await fs.readFile(path.join(DADOS, 'setores', f), 'utf8')); return { id: p.segmento || f.replace('.json', ''), nome: p.nome }; })));
    }
    if (rota === 'GET /api/notas') return responder(res, 200, await notasParaSegmento(url.searchParams.get('segmento') || ''));
    if (rota === 'POST /api/notas/verificar') { const { texto } = await lerCorpo(req); return responder(res, 200, { alerta: pareceSensivel(String(texto || '')) }); }
    if (rota === 'POST /api/notas') return responder(res, 200, await adicionarNota(await lerCorpo(req)));
    if (req.method === 'DELETE' && (m = url.pathname.match(/^\/api\/notas\/([\w-]+)$/))) { await removerNota(m[1]); return responder(res, 200, { ok: true }); }

    if (rota === 'POST /api/sessoes') {
      const { tipo, painel } = await lerCorpo(req);
      if (!['assistente', 'simulador'].includes(tipo) || !RE_PAINEL.test(painel || '')) return responder(res, 400, { erro: 'tipo ou painel inválido' });
      return responder(res, 200, { id: await novaSessao(tipo, painel) });
    }
    if (req.method === 'POST' && (m = url.pathname.match(/^\/api\/sessoes\/([\w-]+)\/mensagens$/))) {
      const { mensagem } = await lerCorpo(req);
      return streamDoAgente(res, ev => conversar(m[1], mensagem, ev));
    }
    if (req.method === 'POST' && (m = url.pathname.match(/^\/api\/sessoes\/([\w-]+)\/avaliar$/))) {
      return streamDoAgente(res, ev => avaliarSimulacao(m[1], ev));
    }

    if (rota === 'POST /api/briefings') {
      const { cliente, dataReuniao } = await lerCorpo(req);
      const cad = await lerJson('clientes.json');
      if (!cliente || !cad[cliente] || cliente.startsWith('_')) return responder(res, 400, { erro: 'cliente inválido' });
      if (dataReuniao && !/^\d{4}-\d{2}-\d{2}$/.test(dataReuniao)) return responder(res, 400, { erro: 'data inválida' });
      return responder(res, 200, { job: iniciarBriefing(cliente, dataReuniao) });
    }
    if (req.method === 'GET' && (m = url.pathname.match(/^\/api\/briefings\/([\w-]+)\/eventos$/))) {
      const job = jobs.get(m[1]);
      if (!job) return responder(res, 404, { erro: 'geração não encontrada' });
      const sse = abrirSSE(res);
      job.eventos.forEach(sse.enviar); // repete o que já aconteceu
      if (job.terminado) return sse.fim();
      const ouvinte = ev => { sse.enviar(ev); if (ev.tipo === 'concluido' || ev.tipo === 'erro') { job.ouvintes.delete(ouvinte); sse.fim(); } };
      job.ouvintes.add(ouvinte);
      res.on('close', () => job.ouvintes.delete(ouvinte));
      return;
    }

    // Arquivos estáticos do frontend (sem permitir sair da pasta)
    if (req.method !== 'GET') return responder(res, 404, { erro: 'não encontrado' });
    const relativo = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const alvo = path.resolve(FRONTEND, relativo);
    if (!alvo.startsWith(FRONTEND + path.sep)) return responder(res, 403, { erro: 'acesso negado' });
    return responder(res, 200, await fs.readFile(alvo), TIPOS[path.extname(alvo)] || 'application/octet-stream');
  } catch (e) {
    if (e.code === 'ENOENT') return responder(res, 404, { erro: 'não encontrado' });
    if (e.status) return responder(res, e.status, { erro: e.message });
    console.error(e);
    return responder(res, 500, { erro: explicarErro(e) });
  }
});

servidor.listen(PORTA, () => console.log(`Painel em http://localhost:${PORTA}  (modelo: ${MODELO})`));
