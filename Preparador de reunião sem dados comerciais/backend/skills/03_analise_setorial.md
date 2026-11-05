# Skill: Análise do setor do cliente

## Objetivo
Entender como está o negócio do cliente para prever a demanda de resina e o poder de barganha dele. Um cliente cujo mercado está aquecido precisa de garantia de abastecimento (nossa alavanca). Um cliente com margem espremida vai brigar por preço (precisamos de contrapartidas).

## Passo a passo
1. Chame `perfil_setor` com o segmento do cadastro do cliente.
2. Se o perfil existir, use os drivers, os indicadores e as consultas sugeridas. Faça de 4 a 6 buscas de notícias do setor e pelo menos uma com o nome do cliente.
3. Se o perfil **não existir**, deduza você mesmo:
   - Que produtos o cliente fabrica e que resinas usa.
   - O que move a demanda final (renda, juros, clima, sazonalidade, construção, agro, automóveis...).
   - De 5 a 8 indicadores públicos que medem isso (IBGE PIM/PMC, associações setoriais, ANFAVEA, ABRAS, Eletros, ABIPLAST etc.).
   - Sinalize claramente que os indicadores são sugestões sem valor atualizado.
4. Cruze com o macro: juros e crédito, câmbio (insumos importados do cliente), importação de produtos acabados concorrentes.

## Para eletroportáteis (exemplo)
- Ventiladores dependem de calor: verão forte = pico de produção de jul a nov.
- Air fryers e portáteis dependem do varejo: Black Friday e Natal; a produção antecipa 2 a 3 meses.
- O cliente sofre com importados acabados chineses e com o varejo resistindo a repasse → margem apertada.
- Resina é de 30% a 45% do custo de material; um reajuste grande no pico é sensível.

## Saída esperada
- Tabela com o indicador, o último valor, a tendência e a implicação para a demanda de resina.
- De 3 a 5 manchetes com veículo, data e "e daí?".
- Conclusão: perspectiva da demanda do cliente para os próximos 3 meses (↑ / → / ↓) e o poder de barganha do cliente (alto/médio/baixo), com justificativa.

## Neste modelo (só dados públicos)
- Os indicadores do perfil do setor são **reais**: busque-os com `indicadores_ibge` (séries listadas em `series_ibge` do perfil).
- Leia demanda e margem do setor com `resultados_empresas_listadas` (empresas em `empresas_listadas` do perfil): receita contra o mesmo trimestre do ano anterior e margem bruta.
- Use as `perguntas_de_descoberta` do perfil no roteiro da reunião.
