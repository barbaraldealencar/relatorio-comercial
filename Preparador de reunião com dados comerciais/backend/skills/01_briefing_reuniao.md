# Skill: Briefing de reunião comercial

## Objetivo
Preparar o(a) KAM para a reunião mensal com um cliente que compra resinas petroquímicas de nós. O briefing deve ser lido em 10 minutos e responder: **o que mudou no mundo, no setor do cliente e no próprio cliente, onde está o dinheiro na negociação deste mês e o que eu digo na reunião.**

## Ordem de trabalho
1. `indicadores_macro`, `projecoes_mercado` e `buscar_noticias` para o cenário macro e petroquímico, atual e projetado (ver skills de macro e de projeções).
2. `perfil_setor` com o segmento do cliente e `buscar_noticias` com as consultas do setor (ver skill setorial).
3. `analisar_cliente`, `comparar_peers` e `projetar_cliente` para a análise quantitativa e os cenários.
4. `ler_emails` e `ler_atas_reunioes` para o histórico e as pendências.
5. Escreva o briefing. Chame ferramentas independentes em paralelo sempre que possível.

## Estrutura obrigatória (Markdown)
```
# Briefing — <Cliente> — reunião de <mês/ano>
> Data de preparação, data-base dos dados do cliente e aviso de dados fictícios, se houver.

## Resumo executivo
5 a 7 bullets: a mensagem central, os 3 números que importam e a recomendação de postura (defender preço, ceder pontualmente, crescer share...).

## 1. Cenário macro (global e Brasil)
### Petróleo, petroquímica e geopolítica
### Economia global
### Economia brasileira
Tabela com os indicadores (valor, variação e leitura para resinas) e depois 3 a 5 manchetes relevantes, com o "e daí?" para a negociação.

## 2. Setor do cliente — <segmento>
Indicadores-chave em tabela (valor, tendência e implicação) e notícias do setor. Feche com o que isso significa para a demanda de resina do cliente nos próximos 3 meses.

## 3. Análise do cliente
### Desempenho recente
Faturamento, volume, mix, crescimento por grade e share of wallet.
### Preço e repasse de custo
Tabela atual vs petróleo em R$, reajuste estimado pela fórmula para o próximo mês, por grade.
### Financeiro e operação
Prazo, títulos em aberto e vencidos, uso do limite, atrasos, entregas e ocorrências de qualidade.

## 4. Comparação com peers
Tabela por grade: preço líquido do cliente vs mediana dos peers, desconto, prazo e impacto mensal em R$. Diga onde o cliente está "barato" (oportunidade) e onde está "caro" (risco de perda).

## 5. Projeções e cenários
### Petróleo e resinas (próximos 12-15 meses)
Brent por trimestre: curva futura × EIA × bancos, e o que isso significa para o preço das resinas.
### Macro Brasil (Focus, 3 anos)
### Setor do cliente
### Cliente — próximos 3 meses
Tabela por cenário (curva futura, EIA, alta e baixa): Brent, tabela média, volume, faturamento e valor do repasse. Separe o que já está definido pela fórmula do que é incerto.
### Implicação para a estratégia

## 6. Histórico de relacionamento
Linha do tempo curta dos últimos e-mails e reuniões, **pendências em aberto (nossas e do cliente)** e o tom do relacionamento.

## 7. Oportunidades na negociação do mês
Tabela priorizada: oportunidade | evidência | valor estimado (R$/mês) | dificuldade | proposta.

## 8. Argumentação e roteiro da reunião
- Objetivo da reunião e o mínimo aceitável (walk-away).
- Abertura sugerida (2-3 frases).
- Argumentos principais, cada um com o dado que o sustenta.
- Objeções prováveis do cliente → resposta sugerida.
- Concessões possíveis em troca de quê (give/get).
- Perguntas para fazer ao cliente.

## 9. Riscos e próximos passos
## Fontes
Liste os veículos e datas das notícias usadas e as bases de dados consultadas.
```

## Regras de qualidade
- **Números sempre com unidade e período** (R$/kg, t/mês, % a/a, "set/2026").
- **Separe fato de inferência.** Fato: veio de ferramenta. Inferência: sua leitura; sinalize com "leitura:" ou "estimativa:".
- **Não invente dados.** Se uma ferramenta falhar ou um dado não existir, diga isso e siga.
- **Cite as notícias** pelo veículo e pela data. Não afirme nada além do que a manchete sustenta.
- Se os dados do cliente forem fictícios (`dados_ficticios: true`), avise no topo do briefing.
- Escreva em português do Brasil, direto, sem jargão desnecessário. Prefira tabelas a parágrafos longos para comparar números.
- Quantifique as oportunidades em R$ sempre que possível e mostre a conta em uma linha.
