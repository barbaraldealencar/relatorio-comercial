# Relatório comercial — Preparador de reuniões

Agente de IA que prepara gerentes de conta (GCs) para reuniões com clientes de resinas (PE e PP): cenário macro, petróleo, câmbio, frete internacional, mercado da resina, setor do cliente, perfil público, informações de campo, projeções e roteiro de negociação.

**Painel publicado:** https://barbaraldealencar.github.io/relatorio-comercial/

## Como o painel se atualiza

| O quê | Como |
|---|---|
| **Números** (Brent, câmbio, frete, preço da resina, IBGE, CVM, notícias) | GitHub Actions toda segunda às 7h (Brasília). Para atualizar na hora: aba **Actions → Atualizar dados do relatório → Run workflow**, ou o botão "↻ Atualizar dados" no painel. |
| **Textos** (bullets, postura, roteiro) | Escritos com a IA e enviados ao repositório em `Preparador de reunião sem dados comerciais/relatorios/painel_<cliente>_<data>.json`. |

Brent e câmbio aparecem com cotação diária nos gráficos; as tabelas comparam a média do mês fechado com o mês atual (parcial). Frete e preço da resina vêm do Comex Stat, que publica um mês por vez. Quando o Comex limita consultas, o painel usa a última cópia salva em `backend/dados/cache/`.

## Estrutura

```
Preparador de reunião com dados comerciais/   versão com base interna do cliente (dados brutos fora do repositório)
Preparador de reunião sem dados comerciais/   versão só com dados públicos (a que vai para o painel)
  backend/    agentes, ferramentas, skills, servidor local
  frontend/   painel
  relatorios/ painéis (JSON) e briefings (Markdown)
.github/workflows/atualizar-dados.yml          atualização semanal e publicação no GitHub Pages
```

Para rodar localmente, veja [COMO_USAR.md](COMO_USAR.md).

## O que não está no repositório

Dados brutos dos clientes (planilhas, e-mails, atas), a chave da IA (`.env`) e as **informações de campo** registradas pelos GCs, que não são públicas.
