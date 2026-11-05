# Skill: Como montar o perfil de um novo segmento

São mais de 600 clientes em segmentos muito diferentes. Quando um cliente for de um segmento sem perfil em `dados/setores/`, use esta skill: ela orienta você e o time de marketing estratégico a montar o perfil.

## Quando usar
- `perfil_setor` respondeu `encontrado: false` para o segmento do cliente.
- O GC ou o marketing estratégico pediu para cadastrar ou revisar um segmento.

## O que o perfil precisa ter (arquivo `dados/setores/<segmento>.json`)
| Campo | O que escrever | Exemplo (eletroportáteis) |
|---|---|---|
| `segmento` | código curto, sem acento, igual ao do cadastro do cliente | `eletroportateis` |
| `nome` | nome legível do segmento | Eletroportáteis (ventiladores, air fryers…) |
| `como_o_setor_usa_resina` | quais resinas, em quais peças, e quanto pesam no custo | PP em carcaças, PP com talco em peças quentes, HIPS/ABS em gabinetes |
| `drivers_de_demanda` | o que move a produção do cliente: clima, datas do varejo, renda, crédito, câmbio, importados | verão, Black Friday, Selic |
| `indicadores_chave` | 4 a 6 indicadores com último valor, tendência e **fonte real** | vendas da associação setorial, produção do IBGE |
| `projecoes` | projeções públicas do setor, com fonte | associação setorial, consultorias |
| `consultas_de_noticias_sugeridas` | 4 a 8 buscas curtas e específicas | "air fryer mercado Brasil" |
| `riscos_e_oportunidades_tipicos` | situações que viram alavanca ou risco na negociação | pico de verão → garantia de abastecimento |
| `linhas_importacao` (opcional) | linhas de produto acabado com códigos SH6 do Comex | refrigeradores 841821, ventiladores 841451 |

## Como pesquisar
1. Comece pela associação do setor (ex.: Eletros, ABRE, Abiplast, Anfavea) e pelo IBGE (PIM e PMC da atividade).
2. Use `buscar_noticias` com termos do setor para achar os temas do momento (sempre dos últimos 30 dias).
3. Pergunte ao marketing estratégico o que eles já acompanham: o conhecimento do time vale mais que uma busca genérica.
4. Marque o que é estimativa ou exemplo; o que for número real precisa de fonte e data.

## Enquanto o perfil não existe
- Deduza os indicadores pelo seu conhecimento, mas **diga no briefing que são sugestões** e que o perfil do segmento precisa ser cadastrado.
- Não invente valores de indicadores: deixe "a confirmar" e indique a fonte onde buscar.

## Saída
Quando pedirem um perfil novo, entregue o JSON completo no formato acima, pronto para o marketing estratégico revisar e salvar em `dados/setores/`.
