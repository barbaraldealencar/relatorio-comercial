# Skill: Análise macro para resinas petroquímicas

## Por que importa
Nossa matéria-prima (nafta, eteno, propeno) acompanha o petróleo. O preço das resinas no Brasil segue as referências internacionais (Ásia, EUA) convertidas pelo dólar, mais frete e imposto de importação. Então petróleo, câmbio, oferta global de resinas e política comercial definem o nosso custo e o preço que o cliente consegue no importado.

## Cadeia de transmissão (use para explicar o "e daí?")
- **Brent ↑** → nafta ↑ → eteno/propeno ↑ → PP/PE/PS ↑, com 2 a 6 semanas de defasagem. Na nossa fórmula contratual, o Brent em R$ entra com 1 mês de defasagem.
- **Dólar ↑ (real fraco)** → resina importada fica mais cara em R$ → menos pressão de importados e mais espaço para repasse.
- **Oferta asiática / China** com nova capacidade de PP e PE → preço Ásia ↓ → importado mais barato e pressão sobre o nosso preço.
- **Frete marítimo ↑** (Mar Vermelho, Canal do Panamá, conflitos) → importado mais caro e lead time maior → argumento de segurança de abastecimento local.
- **Geopolítica** (Oriente Médio, Irã/Estreito de Ormuz, Rússia/Ucrânia, sanções, OPEP+) → risco de oferta de petróleo, volatilidade e prêmio de risco.
- **Selic alta** → custo de capital de giro ↑ → cliente pede mais prazo; cada dia de prazo custa dinheiro para nós (calcule).
- **IPCA / atividade** → custos fixos e demanda final do cliente.
- **Política comercial brasileira**: alíquotas de importação de resinas, antidumping, reforma tributária → mudam a competitividade do importado.

## Indicadores a buscar
`indicadores_macro` traz dados reais de Brent, WTI, Selic, IPCA, dólar, Focus, juros dos EUA e índice do dólar. Para nafta, PP e PS internacionais, use as referências da base do cliente (`analisar_cliente` → `referencias_mercado_ultimos_13m`) e as notícias.

## Consultas de notícias recomendadas (faça de 6 a 10, curtas, em paralelo)
Petróleo e geopolítica: "petróleo Brent", "OPEP+ produção", "Irã Oriente Médio petróleo", "Estreito de Ormuz", "oil prices" (idioma en)
Petroquímica: "Braskem resinas preço", "polipropileno preço", "petroquímica Ásia margens" ou "polypropylene prices Asia" (en), "nafta petroquímica"
Brasil: "Copom Selic", "dólar real câmbio", "antidumping resinas Brasil" ou "imposto importação resinas"
Global: "Fed juros", "China economia indústria"

## Como escrever
- Comece com a mensagem central em 1 frase (ex.: "Choque de oferta no petróleo eleva o custo das resinas em ~X% no 4º tri; câmbio estável não compensa").
- Para cada indicador, diga o impacto para a negociação: **pressiona o custo para cima/baixo, favorece/desfavorece o importado, aumenta/diminui o poder do cliente**.
- Diferencie choque temporário de tendência quando as manchetes permitirem.
