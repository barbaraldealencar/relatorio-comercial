# Preparador de Reuniões — duas versões

```
Projeto Aula IA Insper/
├── Preparador de reunião com dados comerciais/
│   ├── backend/      agentes, tools, skills, dados, lib, scripts, servidor
│   ├── frontend/     painel visual
│   └── relatorios/   briefings, painéis, PDFs e links gerados
├── Preparador de reunião sem dados comerciais/
│   ├── backend/
│   ├── frontend/
│   └── relatorios/
└── Trabalho final/   apresentação do trabalho da disciplina (PDF)
```

| | **Com dados comerciais** | **Sem dados comerciais** |
|---|---|---|
| Pasta | `Preparador de reunião com dados comerciais/` | `Preparador de reunião sem dados comerciais/` |
| Quando usar | Clientes da carteira, com histórico interno disponível | Prospects, clientes novos, ou quando os dados internos não podem ser usados |
| Dados do cliente | Base Excel: pedidos, preços, descontos, crédito, entregas, peers, e-mails e atas | Perfil público: site, notícias, porte, plantas |
| Mercado | Macro, petróleo, projeções, notícias | Só PE e PP: Brent, câmbio, **frete internacional** e referências de resina (12 meses + n × n-1), importação (Comex), IBGE e empresas listadas (CVM) |
| Simulador | Usa os números da base do cliente | Removido por enquanto |
| Informação de campo | — | Botão para o GC registrar o que ouviu em reuniões; vale para outros clientes do segmento, marcado como não público |
| Fechamento | Oportunidades em R$ e roteiro | Hipóteses, perguntas de descoberta e roteiro |
| Painel | `npm run painel` na pasta `backend` da versão → http://localhost:3000 | `npm run painel` na pasta `backend` da versão → http://localhost:3001 |

As duas versões têm assistente de IA, simulador de negociação, geração de briefing pela tela e exportação em HTML e PDF para e-mail. A IA (gerar briefing, assistente, simulador de comprador) precisa de uma chave válida do Amazon Bedrock no arquivo `.env` de cada versão.

**Reforços (nas duas versões):** a skill de **checagem de qualidade** e a ferramenta **verificar_atualidade** conferem fonte e data de cada número e barram notícias antigas antes do briefing sair. A skill de **perfil de novo segmento** orienta o marketing estratégico a cadastrar segmentos novos. A ferramenta **importacao_produtos_acabados** (Comex Stat), que traz unidades importadas por linha (linha branca, portáteis) e a participação da China, agora existe também na versão com dados comerciais. Todas as ferramentas são só de leitura: a IA consulta, mas não envia nem altera nada.
