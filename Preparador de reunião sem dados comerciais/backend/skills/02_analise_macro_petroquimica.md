# Skill: Análise macro para resinas petroquímicas

## Por que importa
Nossa matéria-prima (nafta, eteno, propeno) acompanha o petróleo. O preço das resinas no Brasil segue as referências internacionais (Ásia, EUA) convertidas pelo dólar, mais frete e imposto de importação. Então petróleo, câmbio, oferta global de resinas e política comercial definem o nosso custo e o preço que o cliente consegue no importado.

## Cadeia de transmissão (use para explicar o "e daí?")
- **Brent ↑** → nafta ↑ → eteno/propeno ↑ → PP/PE ↑, com 2 a 6 semanas de defasagem. Na nossa fórmula contratual, o Brent em R$ entra com 1 mês de defasagem.
- **Dólar ↑ (real fraco)** → resina importada fica mais cara em R$ → menos pressão de importados e mais espaço para repasse.
- **Oferta asiática / China** com nova capacidade de PP e PE → preço Ásia ↓ → importado mais barato e pressão sobre o nosso preço.
- **Frete marítimo ↑** (Mar Vermelho, Canal do Panamá, conflitos) → importado mais caro e lead time maior → argumento de segurança de abastecimento local.
- **Geopolítica** (Oriente Médio, Irã/Estreito de Ormuz, Rússia/Ucrânia, sanções, OPEP+) → risco de oferta de petróleo, volatilidade e prêmio de risco.
- **Selic alta** → custo de capital de giro ↑ → cliente pede mais prazo; cada dia de prazo custa dinheiro para nós (calcule).
- **IPCA / atividade** → custos fixos e demanda final do cliente.
- **Política comercial brasileira**: alíquotas de importação de resinas, antidumping, reforma tributária → mudam a competitividade do importado.

## Indicadores a buscar
**Foco: PE e PP.** `indicadores_mensais` traz, mês a mês, as quatro variáveis do bloco macro: **Brent**, **câmbio**, **frete internacional** (US$/t pago na importação de PE e PP, Comex) e **referências internacionais de resina** (preço FOB de importação de PE e PP). Monte a tabela mês n-1 × mês n × variação. `indicadores_macro` complementa com Selic, IPCA, Focus e juros dos EUA.

**Frete internacional:** sempre no macro e no resumo. Frete e câmbio somam-se ao preço FOB para formar o custo do importado no Brasil (CIF em reais): frete subindo encarece o importado e abre espaço para o preço local.

## Consultas de notícias recomendadas (faça de 6 a 10, curtas, em paralelo)
Petróleo e geopolítica: "petróleo Brent", "OPEP+ produção", "Irã Oriente Médio petróleo", "Estreito de Ormuz", "oil prices" (idioma en)
Petroquímica: "Braskem resinas preço", "polipropileno preço", "polietileno preço", "polypropylene prices Asia" (en), "nafta petroquímica", "frete marítimo contêiner"
Brasil: "Copom Selic", "dólar real câmbio", "antidumping resinas Brasil" ou "imposto importação resinas"
Global: "Fed juros", "China economia indústria"

## Como escrever
- Seja objetivo: no máximo 3 bullets, uma linha cada.
- Comece com a mensagem central em 1 frase (ex.: "Choque de oferta no petróleo eleva o custo das resinas em ~X% no 4º tri; câmbio estável não compensa").
- Para cada indicador, diga o impacto para a negociação: **pressiona o custo para cima/baixo, favorece/desfavorece o importado, aumenta/diminui o poder do cliente**.
- Diferencie choque temporário de tendência quando as manchetes permitirem.
