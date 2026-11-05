# Preparador de Reuniões (resinas petroquímicas)

Agente que prepara o briefing da reunião mensal com um cliente e depois responde perguntas sobre ele. Usa o Claude (Opus 5) via Amazon Bedrock, região São Paulo, com perfil de inferência global.

O briefing traz:
1. Cenário macro global e Brasil (petróleo, petroquímica, geopolítica, juros, câmbio)
2. Setor do cliente (indicadores e notícias)
3. Análise do cliente (volume, preço, repasse do petróleo, financeiro, entregas)
4. Comparação com peers
5. Projeções e cenários: curva futura do Brent, projeção da EIA, Focus, setor e o cliente nos próximos 3 meses (volume, tabela e faturamento por cenário)
6. Histórico de relacionamento (e-mails e atas)
7. Oportunidades da negociação do mês, em R$
8. Argumentos, objeções e roteiro da reunião

## Como rodar

```bash
cd backend
npm install
cp .env.example .env              # preencha AWS_BEARER_TOKEN_BEDROCK
npm run briefing -- --cliente mondial --data 2026-10-15
```

O briefing é salvo em `relatorios/` (`.md` e `.html`), junto com o JSON do painel visual. Depois disso, o terminal fica aberto para perguntas; digite `sair` para encerrar. Use `--sem-perguntas` para só gerar os arquivos.

## Painel visual (frontend)

```bash
npm run painel                    # abre em http://localhost:3000
```

O painel mostra o briefing em 10 blocos com gráficos (Chart.js): visão geral, macro, setor, cliente, peers, projeções, relacionamento, oportunidades, roteiro e riscos. Os números dos gráficos vêm direto das ferramentas; os textos são o briefing resumido pelo modelo em frases curtas.

O bloco Análise do cliente traz o **histórico de volume**: ano contra ano (mês a mês) e o acumulado de 12 meses, com filtro por grade, para ver se estamos ganhando ou perdendo volume.

O bloco **Simulador de negociação** calcula na hora, sem IA (funciona também no arquivo exportado), o efeito de mudar reajuste (% da fórmula), preço, desconto, volume e prazo, para todas as grades ou só uma: faturamento por mês e por ano contra a fórmula e contra não reajustar, custo financeiro do prazo pela Selic do dia, preço contra a mediana dos peers e uso do limite de crédito. Com a IA ativa, o botão "Pedir avaliação à IA" manda o cenário para o assistente.

Para atualizar só os números dos gráficos de um painel já gerado (sem chamar o modelo):

```bash
npm run atualizar-graficos -- --cliente mondial
```

Para refazer só o painel a partir do último briefing salvo (sem rodar a análise de novo):

```bash
npm run gerar-painel -- --cliente mondial --data 2026-10-15
```

O frontend fica em `../frontend` (HTML, CSS e JavaScript puros, sem build).

## Clientes disponíveis

| Cliente | Segmento | Grades de resina |
|---|---|---|
| Mondial | Eletroportáteis | PP, compostos de PP, HIPS, GPPS, ABS e PEBD |
| Globalpack | Embalagens plásticas sopradas (alimentos, higiene e cosméticos, limpeza, farma, lubrificantes e agroquímicos) | PEAD de sopro, PEAD de alta massa molar (bombonas), PEAD farma, PEAD reciclado (PCR), PEBD e PP |

No painel, escolha o cliente no seletor **Cliente** do topo. Se ele ainda não tiver briefing, o painel oferece gerar um.

Para criar as bases fictícias de um cliente novo, adicione a configuração dele em `scripts/clientes_demo.js`, o perfil do segmento em `dados/setores/`, e rode:

```bash
npm run gerar-dados-demo -- --cliente globalpack
```

Depois cadastre o cliente em `dados/clientes.json` (com e-mails e atas, se houver).

## Assistente de IA no painel

Com o servidor rodando (`npm run painel`) e a chave do Bedrock no `.env`, o painel ganha:

| Recurso | Onde | O que faz |
|---|---|---|
| **Assistente** | Botão "✦ Assistente IA" (canto inferior direito) | Conversa sobre o briefing, com acesso às mesmas ferramentas (notícias de hoje, cotações, cenários, dados do cliente). A resposta aparece enquanto é escrita. |
| **Simulador de negociação** | Aba "Simulador" do assistente | A IA faz o papel do comprador do cliente. No fim, "Encerrar e avaliar" dá nota de 0 a 10 e feedback com frases melhores. |
| **Ações rápidas** | Botões "Explicar", "Resumir" e outros em cada bloco | Mandam uma pergunta pronta sobre o bloco para o assistente (ex.: e-mail de follow-up no bloco Roteiro). |
| **Novo briefing** | Botão "＋ Novo briefing" no topo | Gera um briefing completo pela tela, mostrando o progresso, e abre o painel novo ao terminar (~8-10 min). |

Esses recursos ficam ocultos na versão exportada para e-mail, que não tem servidor.

## Enviar por e-mail

Toda vez que um painel é gerado, saem também dois arquivos em `relatorios/`, prontos para anexar:

- `painel_<cliente>_<data>.html`: arquivo único (~300 KB) com gráficos interativos. Abre com dois cliques em qualquer navegador, sem instalar nada e sem internet.
- `painel_<cliente>_<data>.pdf`: versão para impressão (A4). Precisa do Edge ou do Chrome instalado no computador que gera.

Para exportar de novo o painel mais recente:

```bash
npm run exportar-painel -- --cliente mondial
```

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `backend/agentes/` | `preparador_reuniao.js`: o agente (prompt, loop e relatório); `gerar_painel.js`: JSON do painel visual |
| `backend/servidor.js` | Servidor local do painel (frontend + API dos painéis) |
| `backend/skills/` | Roteiros que o agente segue: formato do briefing, macro petroquímica, análise setorial, negociação, projeções, **checagem de qualidade** e **perfil de novo segmento** |
| `backend/tools/` | Ferramentas que o agente chama (todas só de leitura): notícias, indicadores macro, projeções, perfil do setor, análise do cliente, peers, e-mails e atas, **importação de produtos acabados** (Comex Stat) e **verificação de atualidade** |
| `backend/lib/` | Conexão com o Bedrock e leitura de dados |
| `backend/dados/` | Bases do cliente, peers, setores, e-mails e atas |
| `backend/scripts/` | `gerar_dados_demo.js`: recria as bases fictícias; `exportar_painel.js`: HTML e PDF para e-mail |
| `frontend/` | Painel visual (HTML, CSS e JavaScript) |
| `relatorios/` | O que o sistema gera: briefings, painéis (JSON, HTML, PDF) e o link de compartilhamento |

## Fontes de dados

| Dado | Origem | Real ou fictício |
|---|---|---|
| Notícias | Google News RSS | **Real** |
| Selic, IPCA, dólar, Focus | Banco Central (SGS / Olinda) | **Real** |
| Brent, WTI, juros dos EUA, índice do dólar | FRED (Fed de St. Louis) | **Real** |
| Curva futura do Brent | Contratos NYMEX via Yahoo Finance | **Real** |
| Projeção do petróleo | EIA Short-Term Energy Outlook (opcional: EIA_API_KEY no .env; sem ela usa a chave pública de demonstração) | **Real** |
| Projeções do setor | `dados/setores/eletroportateis.json` | Fictício (com a fonte real indicada) |
| Histórico do cliente | `dados/clientes/base_cliente_mondial.xlsx` | Fictício (Brent e dólar da aba Referencias_Mercado são reais) |
| Peers | `dados/peers/base_peers_eletroportateis.xlsx` | Fictício |
| Indicadores do setor | `dados/setores/eletroportateis.json` | Fictício (com a fonte real indicada) |
| E-mails e atas | `dados/emails/`, `dados/reunioes/` | Fictício |

## Trocando por dados reais

- **Cliente:** mantenha os nomes das abas e os cabeçalhos do Excel. As ferramentas leem as colunas pelo nome, então a ordem pode mudar.
- **Novo cliente:** adicione um bloco em `dados/clientes.json` apontando para os arquivos dele. Se for de outro segmento, crie `dados/setores/<segmento>.json`. Se o arquivo não existir, o agente deduz os indicadores e avisa que são sugestões.
- **E-mails:** exporte no mesmo formato de `dados/emails/mondial.json` (dá para integrar com Gmail/Outlook depois).
- **Atas:** um arquivo `.md` ou `.txt` por reunião em `dados/reunioes/<cliente>/`, com a data no início do nome.

## Segurança

- A chave do Bedrock fica só no `.env`, que está no `.gitignore`. Nunca coloque a chave no código.
- Chaves de curto prazo do Bedrock expiram em até 12 h. Se aparecer "Acesso negado (401)", gere outra.
- A pasta está no OneDrive. Se preferir não sincronizar a chave, defina a variável no terminal em vez de usar o `.env`.
