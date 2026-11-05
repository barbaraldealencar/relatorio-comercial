// Informações de campo: o que o GC captura nas reuniões e quer reaproveitar em outros briefings.
// NÃO são informações públicas. O cliente onde a informação foi capturada fica guardado só para uso interno
// e nunca sai daqui para o agente nem para o painel (o código remove o campo, não depende do prompt).
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { DADOS } from './dados.js';

const ARQUIVO = path.join(DADOS, 'notas_campo.json');
const ROTULO = 'Informação de campo — não pública';

// Nome legível do segmento (ex.: eletroportateis → Eletrodomésticos e eletroportáteis)
async function nomeSegmento(id) {
  if (!/^[\w-]+$/.test(id)) return id;
  try { return (JSON.parse(await fs.readFile(path.join(DADOS, 'setores', id + '.json'), 'utf8')).nome || id).split(' (')[0]; } catch { return id; }
}

async function lerTodas() {
  try { return JSON.parse(await fs.readFile(ARQUIVO, 'utf8')); } catch { return []; }
}

// Sinal de alerta: a nota parece trazer preço, desconto ou volume (cuidado com dado de um cliente específico)
export function pareceSensivel(texto) {
  return /\d/.test(texto) && /(R\$|US\$|US \$|\$|%|\btoneladas?\b|\bt\/m[eê]s\b|\bpre[çc]o|\bdesconto|\bvolume|\bmargem|\bcota[çc][ãa]o)/i.test(texto);
}

// Versão segura para o agente e para o painel: sem o cliente de origem e sem o nome do GC
const publicavel = async n => ({
  id: n.id, rotulo: ROTULO, data_captura: n.data_captura, registrada_em: n.criado_em.slice(0, 10),
  vale_para: n.abrangencia === 'todos' ? 'todos os segmentos' : (await Promise.all(n.segmentos.map(nomeSegmento))).join(', '),
  texto: n.texto, alerta_preco_ou_volume: n.alerta,
});

export async function notasParaSegmento(segmento, { dias = 180 } = {}) {
  const limite = Date.now() - dias * 86400000;
  const notas = (await lerTodas())
    .filter(n => (n.abrangencia === 'todos' || n.segmentos.includes(segmento)) && Date.parse(n.data_captura) >= limite)
    .sort((a, b) => b.data_captura.localeCompare(a.data_captura))
    .map(publicavel);
  return Promise.all(notas);
}

export async function adicionarNota({ texto, data_captura, segmentos = [], abrangencia = 'segmento', origem_interna = '', gc = '' }) {
  texto = String(texto || '').trim();
  if (texto.length < 10) throw Object.assign(new Error('Escreva a informação (pelo menos 10 caracteres).'), { status: 400 });
  if (texto.length > 4000) throw Object.assign(new Error('Texto longo demais (máximo 4.000 caracteres).'), { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data_captura || '')) data_captura = new Date().toISOString().slice(0, 10);
  if (abrangencia !== 'todos' && !segmentos.length) throw Object.assign(new Error('Escolha o segmento ou marque "todos os segmentos".'), { status: 400 });
  const nota = {
    id: crypto.randomUUID(), criado_em: new Date().toISOString(), data_captura,
    abrangencia: abrangencia === 'todos' ? 'todos' : 'segmento', segmentos: segmentos.map(String).filter(x => /^[\w-]+$/.test(x)),
    texto, alerta: pareceSensivel(texto),
    // Uso interno: nunca enviado ao agente nem exibido no painel
    origem_interna: String(origem_interna).slice(0, 120), gc: String(gc).slice(0, 80),
  };
  const todas = await lerTodas();
  todas.push(nota);
  await fs.writeFile(ARQUIVO, JSON.stringify(todas, null, 2), 'utf8');
  return await publicavel(nota);
}

export async function removerNota(id) {
  const todas = await lerTodas();
  const resto = todas.filter(n => n.id !== id);
  if (resto.length === todas.length) throw Object.assign(new Error('nota não encontrada'), { status: 404 });
  await fs.writeFile(ARQUIVO, JSON.stringify(resto, null, 2), 'utf8');
}
