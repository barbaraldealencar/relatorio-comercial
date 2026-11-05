// Assistente de IA do painel: chat sobre o briefing, simulador de negociação, ações rápidas e geração de briefing pela tela.
// Só é ativado quando o painel é servido pelo servidor local com a IA configurada (não na versão exportada para e-mail).
(() => {
  if (window.PAINEL_EMBUTIDO) return;
  const $ = id => document.getElementById(id);

  const NOMES_FERRAMENTAS = {
    buscar_noticias: 'Buscando notícias', indicadores_macro: 'Consultando indicadores macro (BCB/FRED)',
    projecoes_mercado: 'Consultando projeções (curva futura, EIA, Focus)', perfil_setor: 'Lendo o perfil do setor',
    analisar_cliente: 'Analisando o histórico do cliente', comparar_peers: 'Comparando com peers',
    projetar_cliente: 'Projetando cenários do cliente', ler_emails: 'Lendo e-mails', ler_atas_reunioes: 'Lendo atas de reunião',
  };
  const SUGESTOES = [
    'Quais são os 3 pontos mais importantes para a reunião?',
    'Como respondo se pedirem 75 dias de prazo?',
    'Me dê uma abertura de reunião em 3 frases.',
    'Tem alguma notícia de hoje que muda a análise?',
  ];

  const estado = { sessoes: {}, ocupado: false, abaAtual: 'assistente' };

  // ---------- Markdown seguro ----------
  const renderMd = texto => DOMPurify.sanitize(marked.parse(texto || '', { breaks: true }));

  // ---------- Streaming (Server-Sent Events via fetch POST) ----------
  async function stream(url, corpo, aoEvento) {
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo || {}) });
    if (!resp.ok || !resp.body) throw new Error((await resp.json().catch(() => ({}))).erro || `HTTP ${resp.status}`);
    const leitor = resp.body.getReader(), dec = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await leitor.read();
      if (done) break;
      buffer += dec.decode(value, { stream: true });
      const partes = buffer.split('\n\n'); buffer = partes.pop();
      for (const p of partes) if (p.startsWith('data: ')) aoEvento(JSON.parse(p.slice(6)));
    }
  }

  async function sessao(tipo, nova = false) {
    if (!nova && estado.sessoes[tipo]) return estado.sessoes[tipo];
    if (!window.PainelApp.arquivo) throw new Error('este cliente ainda não tem briefing. Gere um briefing primeiro (botão "＋ Novo briefing").');
    const r = await fetch('/api/sessoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo, painel: window.PainelApp.arquivo }) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro || 'não foi possível iniciar a conversa');
    return (estado.sessoes[tipo] = (await r.json()).id);
  }

  // ---------- Mensagens na tela ----------
  const rolar = caixa => { caixa.scrollTop = caixa.scrollHeight; };
  function adicionarMensagem(caixa, classe, conteudo, { html = false, quem } = {}) {
    caixa.querySelector('.ia-boas-vindas')?.remove();
    const m = el('div', { class: `msg ${classe}` });
    if (quem) m.append(el('span', { class: 'quem', texto: quem }));
    const corpo = el('div', { class: 'corpo' });
    if (html) corpo.innerHTML = conteudo; else corpo.textContent = conteudo;
    m.append(corpo);
    caixa.append(m); rolar(caixa);
    return { m, corpo };
  }

  // Envia uma mensagem e mostra a resposta chegando aos poucos.
  async function enviar(tipo, texto, { mostrarPergunta = true, classeResposta = 'ia', quem, url } = {}) {
    if (estado.ocupado) return;
    const caixa = $(`ia-msgs-${tipo}`);
    estado.ocupado = true; atualizarBotoes();
    if (mostrarPergunta) adicionarMensagem(caixa, 'usuario', texto);
    const status = el('div', { class: 'status-ia', texto: tipo === 'simulador' ? 'O comprador está respondendo…' : 'Pensando…' });
    caixa.append(status); rolar(caixa);
    let acumulado = '', alvo = null, agendado = false;
    const desenhar = () => { agendado = false; alvo.corpo.innerHTML = renderMd(acumulado); rolar(caixa); };
    try {
      const id = await sessao(tipo);
      await stream(url || `/api/sessoes/${id}/mensagens`, { mensagem: texto }, ev => {
        if (ev.tipo === 'texto') {
          if (!alvo) { status.remove(); alvo = adicionarMensagem(caixa, classeResposta, '', { html: true, quem }); }
          acumulado += ev.delta;
          if (!agendado) { agendado = true; requestAnimationFrame(desenhar); }
        } else if (ev.tipo === 'ferramenta') {
          status.textContent = `${NOMES_FERRAMENTAS[ev.nome] || ev.nome}…`;
          // Texto antes da ferramenta fica no balão anterior; o que vier depois abre um balão novo.
          if (alvo) { desenhar(); alvo = null; acumulado = ''; caixa.append(status); rolar(caixa); }
        } else if (ev.tipo === 'erro') {
          throw new Error(ev.mensagem);
        }
      });
      if (alvo) { desenhar(); adicionarCopiar(alvo.m, () => acumulado); }
    } catch (e) {
      adicionarMensagem(caixa, 'erro', `Não foi possível responder: ${e.message}`);
      if (/expirada/i.test(e.message)) delete estado.sessoes[tipo];
    } finally {
      status.remove();
      estado.ocupado = false; atualizarBotoes();
    }
  }

  function adicionarCopiar(msg, obterTexto) {
    const botao = el('button', { type: 'button', texto: 'Copiar' });
    botao.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(obterTexto()); botao.textContent = 'Copiado ✓'; } catch { botao.textContent = 'Não foi possível copiar'; }
      setTimeout(() => { botao.textContent = 'Copiar'; }, 1500);
    });
    msg.append(el('div', { class: 'msg-acoes' }, botao));
  }

  function atualizarBotoes() {
    document.querySelectorAll('.ia-enviar, #sim-avaliar, #sim-iniciar').forEach(b => { b.disabled = estado.ocupado; });
  }

  // ---------- Gaveta ----------
  function abrirGaveta(aba = estado.abaAtual) {
    $('ia-gaveta').hidden = false;
    document.body.classList.add('gaveta-aberta');
    $('ia-abrir').setAttribute('aria-expanded', 'true');
    trocarAba(aba);
  }
  function fecharGaveta() {
    $('ia-gaveta').hidden = true;
    document.body.classList.remove('gaveta-aberta');
    $('ia-abrir').setAttribute('aria-expanded', 'false');
  }
  function trocarAba(aba) {
    estado.abaAtual = aba;
    document.querySelectorAll('.ia-aba').forEach(b => { const ativa = b.dataset.aba === aba; b.classList.toggle('ativa', ativa); b.setAttribute('aria-selected', String(ativa)); });
    document.querySelectorAll('.ia-painel').forEach(p => { p.hidden = p.dataset.painel !== aba; });
    const campo = document.querySelector(`.ia-painel[data-painel="${aba}"] textarea`);
    if (campo && !campo.closest('form').hidden) campo.focus();
  }

  function boasVindasAssistente() {
    const caixa = $('ia-msgs-assistente');
    caixa.replaceChildren(el('div', { class: 'ia-boas-vindas' },
      el('p', { texto: 'Pergunte qualquer coisa sobre o briefing. Eu uso os dados do cliente, peers, projeções e notícias de hoje.' }),
      el('div', { class: 'ia-sugestoes' }, SUGESTOES.map(s => el('button', { type: 'button', class: 'ia-sugestao', texto: s, onclick: () => enviar('assistente', s) })))));
  }
  function boasVindasSimulador() {
    $('ia-msgs-simulador').replaceChildren(el('div', { class: 'ia-boas-vindas' },
      el('p', {}, el('strong', { texto: 'Treine a reunião antes de ir. ' }), 'A IA faz o papel do comprador do cliente, com os pedidos e objeções do briefing. Negocie como faria de verdade; no fim, peça a avaliação para receber nota e feedback.'),
      el('button', { type: 'button', class: 'botao botao-primario', id: 'sim-iniciar', texto: 'Iniciar simulação', onclick: iniciarSimulacao })));
    $('ia-form-simulador').hidden = true;
    $('sim-acoes').hidden = true;
  }

  // ---------- Simulador ----------
  async function iniciarSimulacao() {
    delete estado.sessoes.simulador;
    $('ia-msgs-simulador').replaceChildren();
    $('ia-form-simulador').hidden = false;
    $('sim-acoes').hidden = false;
    const comprador = `Comprador — ${window.PainelApp.meta()?.cliente || 'cliente'}`;
    await enviar('simulador', '[início da simulação] Abra a reunião como o comprador, com seu primeiro pedido.', { mostrarPergunta: false, classeResposta: 'comprador', quem: comprador });
    $('ia-form-simulador').querySelector('textarea').focus();
  }
  async function avaliarSimulacao() {
    if (!estado.sessoes.simulador) return;
    $('ia-form-simulador').hidden = true;
    await enviar('simulador', '', { mostrarPergunta: false, classeResposta: 'avaliacao', url: `/api/sessoes/${estado.sessoes.simulador}/avaliar` });
  }

  // ---------- Novo briefing ----------
  async function abrirNovoBriefing(idCliente) {
    const dlg = $('dlg-briefing');
    $('nb-progresso').hidden = true; $('nb-progresso').replaceChildren();
    $('nb-erro').hidden = true;
    $('nb-gerar').disabled = false; $('nb-gerar').textContent = 'Gerar briefing';
    try {
      const clientes = await (await fetch('/api/clientes')).json();
      $('nb-cliente').replaceChildren(...clientes.map(c => el('option', { value: c.id, texto: `${c.nome} (${c.segmento})` })));
      const atual = (typeof idCliente === 'string' && idCliente) || window.PainelApp.clienteSelecionado?.() || window.PainelApp.meta()?.id;
      if (atual) $('nb-cliente').value = atual;
    } catch { /* lista vazia: o servidor avisa ao gerar */ }
    dlg.showModal();
  }

  async function gerarBriefing(ev) {
    ev.preventDefault();
    const progresso = $('nb-progresso'), erro = $('nb-erro'), botao = $('nb-gerar');
    erro.hidden = true; progresso.hidden = false; progresso.replaceChildren();
    botao.disabled = true; botao.textContent = 'Gerando…';
    const inicio = Date.now();
    const passo = (texto, detalhe) => {
      progresso.querySelector('li.atual')?.classList.remove('atual');
      progresso.append(el('li', { class: 'atual' }, el('span', { texto }), detalhe ? el('span', { class: 'detalhe', texto: detalhe }) : null));
      progresso.scrollTop = progresso.scrollHeight;
    };
    try {
      const r = await fetch('/api/briefings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cliente: $('nb-cliente').value, dataReuniao: $('nb-data').value || undefined }) });
      const corpo = await r.json();
      if (!r.ok) throw new Error(corpo.erro || `HTTP ${r.status}`);
      await new Promise((resolve, reject) => {
        const es = new EventSource(`/api/briefings/${corpo.job}/eventos`);
        es.onmessage = async m => {
          const e = JSON.parse(m.data);
          if (e.tipo === 'status') passo(e.texto);
          else if (e.tipo === 'ferramenta') passo(NOMES_FERRAMENTAS[e.nome] || e.nome, e.nome === 'buscar_noticias' ? e.detalhe.replace(/^consulta="([^"]*)".*/, '$1') : '');
          else if (e.tipo === 'concluido') {
            es.close();
            progresso.querySelector('li.atual')?.classList.remove('atual');
            passo(`Pronto em ${Math.round(e.segundos / 60)} min. Abrindo o painel…`);
            progresso.querySelector('li.atual')?.classList.remove('atual');
            await window.PainelApp.recarregarLista(e.painel);
            setTimeout(() => $('dlg-briefing').close(), 900);
            resolve();
          } else if (e.tipo === 'erro') { es.close(); reject(new Error(e.mensagem)); }
        };
        es.onerror = () => { if (Date.now() - inicio > 2000) { es.close(); reject(new Error('A conexão com o servidor caiu durante a geração.')); } };
      });
    } catch (e) {
      progresso.querySelector('li.atual')?.classList.remove('atual');
      erro.textContent = `Não foi possível gerar: ${e.message}`; erro.hidden = false;
      botao.disabled = false; botao.textContent = 'Tentar de novo';
    }
  }

  // ---------- Inicialização ----------
  async function iniciar() {
    try {
      const st = await (await fetch('/api/status')).json();
      if (!st.ia) return; // sem chave da IA: o painel funciona normalmente, sem os recursos de IA
      $('ia-modelo').textContent = st.modelo;
    } catch { return; }
    document.body.classList.add('ia-ativa');
    boasVindasAssistente();

    $('ia-abrir').addEventListener('click', () => abrirGaveta());
    $('ia-fechar').addEventListener('click', fecharGaveta);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('ia-gaveta').hidden && !$('dlg-briefing').open) fecharGaveta(); });
    document.querySelectorAll('.ia-aba').forEach(b => b.addEventListener('click', () => trocarAba(b.dataset.aba)));

    for (const tipo of ['assistente', 'simulador']) {
      const form = $(`ia-form-${tipo}`), campo = form.querySelector('textarea');
      form.addEventListener('submit', e => { e.preventDefault(); const t = campo.value.trim(); if (!t) return; campo.value = ''; enviar(tipo, t, tipo === 'simulador' ? { classeResposta: 'comprador', quem: `Comprador — ${window.PainelApp.meta()?.cliente || 'cliente'}` } : {}); });
      campo.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
    }
    $('sim-iniciar').addEventListener('click', iniciarSimulacao);
    $('sim-avaliar').addEventListener('click', avaliarSimulacao);
    $('sim-reiniciar').addEventListener('click', boasVindasSimulador);

    $('botao-novo-briefing').addEventListener('click', () => abrirNovoBriefing());
    $('form-briefing').addEventListener('submit', gerarBriefing);
    $('nb-fechar').addEventListener('click', () => $('dlg-briefing').close());

    // Trocou de painel: as conversas recomeçam com o novo contexto
    document.addEventListener('painel-carregado', () => { estado.sessoes = {}; boasVindasAssistente(); boasVindasSimulador(); });
  }

  // API usada pelas ações rápidas dos blocos
  window.AssistenteIA = { perguntar: texto => { abrirGaveta('assistente'); enviar('assistente', texto); }, novoBriefing: id => abrirNovoBriefing(id) };

  iniciar();
})();
