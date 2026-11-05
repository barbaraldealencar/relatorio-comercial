# Preparador de reunião — sem dados comerciais

Versão do agente de briefing que usa **informações públicas** e as **informações de campo** registradas pelos GCs (não públicas, sempre marcadas). Documento interno. **Foco: PE e PP.** Serve para reuniões em que não temos (ou não podemos usar) dados comerciais internos: histórico de pedidos, preços praticados, contratos, crédito, e-mails e atas.

## O que o briefing traz

| Bloco | Fonte pública (dado real) |
|---|---|
| Macro | Para **Brent, câmbio, frete internacional e referências de PE e PP**: gráfico dos últimos 12 meses e tabela mês n-1 × mês n com a variação. Fontes: FRED/Yahoo, Banco Central, Comex Stat (frete pago e preço FOB de importação) |
| Mercado de PE e PP | **Comex Stat/MDIC**: preço, volume e frete de importação de PE e PP, mês a mês; reação do preço ao Brent e projeção |
| Setor do cliente | **IBGE** (produção industrial e vendas do varejo por atividade), **importação de produtos acabados por linha** (Comex Stat: unidades, preço médio e % China, ex.: refrigeradores, lavadoras, air fryers, ventiladores; linhas definidas em `linhas_importacao` do perfil do setor) e **CVM** (receita e margem das empresas listadas) + cotação das ações |
| Perfil do cliente | Site oficial, notícias recentes e fatos públicos com fonte (porte, plantas, expansões) |
| Projeções | Curva futura do Brent (NYMEX), EIA STEO, Focus |
| Informações de campo | Botão **"＋ Informação de campo"**: depois da reunião, o GC escreve em texto livre o que ouviu. A informação aparece nos briefings do mesmo segmento (ou de todos), marcada como **não pública**. O cliente de origem fica só no registro interno e nunca vai para o painel nem para a IA |
| Hipóteses e descoberta | O que provavelmente está acontecendo no cliente, a evidência pública e a pergunta que confirma |
| Roteiro | Abertura, argumentos com o dado público, objeções e perguntas de descoberta |

## Como rodar

```bash
cd backend
npm install
cp .env.example .env              # preencha AWS_BEARER_TOKEN_BEDROCK (só para gerar briefings com IA)
npm run painel                    # http://localhost:3001
npm run briefing -- --cliente mondial --data 2026-10-15
```

Roda na porta **3001**, para funcionar ao mesmo tempo que a versão com dados comerciais (porta 3000).

## Cadastrar um cliente

Em `backend/dados/clientes.json`: nome, segmento, sites oficiais, consultas de notícias, resinas que ele consome (posições do Comex: 3901 PE, 3902 PP, 3903 estirênicos, 3904 PVC, 3907 PET) e fatos públicos já conhecidos, com a fonte. O perfil do segmento (`backend/dados/setores/<segmento>.json`) define quais séries do IBGE e quais empresas listadas acompanhar.

## Limitações

- Preço de importação é **FOB** (sem frete, câmbio, impostos e margem): use como **tendência**, não como preço do cliente.
- A API pública da EIA e a do Comex Stat têm limite de consultas; o Comex é guardado em cache por dia em `backend/dados/cache/`.
- Os resultados da CVM vêm do formulário trimestral (ITR): o 4º trimestre só aparece no formulário anual.
