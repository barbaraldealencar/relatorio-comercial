# Skill: Oportunidades e argumentação na negociação de resinas

## Alavancas de valor (procure cada uma nos dados)
| Alavanca | Onde olhar | Como quantificar |
|---|---|---|
| **Repasse de custo** | `analisar_cliente.grades[].reajuste_estimado_proximo_mes_pct`, Brent em R$ | volume previsto do mês × tabela × reajuste |
| **Desconto acima do mercado** | `comparar_peers` (desconto do cliente vs mediana dos peers) | (desconto cliente − desconto mediana) × tabela × volume mensal |
| **Preço líquido abaixo dos peers** | `comparar_peers.impacto_mensal_alinhar_a_mediana_R$` | já vem em R$/mês |
| **Prazo de pagamento** | prazo do cliente vs peers, Selic | faturamento mensal × (Selic/360) × dias extras |
| **Crédito/inadimplência** | títulos vencidos, uso do limite | exposição em R$; condicionar volume novo |
| **Share of wallet** | `share_of_wallet_pct` e concorrente | (consumo estimado − nosso volume) × margem |
| **Mix e serviço** | grades com crescimento, urgências, estoque local | prêmio de urgência, contratos de capacidade |
| **Risco de perda** | grades onde o cliente paga acima dos peers ou já compra importado | receita em risco/mês |

## Princípios
- **Give/get:** nunca ceda sem contrapartida. Ex.: escalonar reajuste ↔ contrato de volume do 4º tri; desconto em ABS ↔ volume integral e contrato anual; prazo maior ↔ preço maior ou garantia.
- **Ancoragem em dados:** abra com o fato externo (petróleo, peers), não com a necessidade interna.
- **Separar os temas:** preço, prazo, qualidade e volume 2027 são moedas diferentes; troque uma pela outra de forma explícita.
- **Defina o walk-away:** o mínimo aceitável em R$ e as condições.
- **Pendências nossas atrasadas** enfraquecem a posição: reconheça e entregue algo concreto na reunião.
- Respeite o histórico: se prometemos algo (teto, visita técnica), leve uma resposta.

## Objeções comuns e respostas-modelo (adapte com números reais)
- *"O importado está X% mais barato."* → custo total: lead time, estoque de segurança, risco cambial e de frete, assistência técnica, histórico de qualidade; ofereça um ajuste condicionado a volume e contrato.
- *"Não consigo repassar ao varejo antes da Black Friday."* → escalonamento em 2-3 parcelas com recuperação depois; trava de parte do volume a preço fixo com prêmio.
- *"Os concorrentes nacionais dão mais desconto."* → mostre o benchmark (sem identificar clientes): o desconto atual já está acima do mercado.
- *"Precisamos de mais prazo."* → mostre o custo financeiro com a Selic e ofereça desconto por pagamento antecipado como alternativa.

## Saída
Na tabela de oportunidades, ordene por valor × probabilidade. No roteiro, entregue frases prontas para usar na reunião.
