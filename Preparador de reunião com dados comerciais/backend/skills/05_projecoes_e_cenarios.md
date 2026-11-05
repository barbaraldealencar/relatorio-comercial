# Skill: Projeções e cenários

## Por que importa
Na reunião, o cliente vai perguntar "para onde vai o preço?". Quem chega com uma visão de futuro bem fundamentada conduz a conversa. As projeções também definem a estratégia: se o petróleo deve cair, vale ceder um escalonamento agora; se deve subir, vale travar volume e preço.

## Fontes (use todas e compare)
1. **`projecoes_mercado`** (dados reais):
   - **Curva futura do Brent:** o que o mercado paga hoje por petróleo entregue em cada mês futuro.
   - **Projeção da EIA:** visão oficial do governo dos EUA, mensal.
   - **Boletim Focus:** IPCA, Selic, PIB e câmbio para 3 anos (consenso de mercado no Brasil).
2. **Notícias com projeções** (`buscar_noticias`): bancos e consultorias. Consultas sugeridas:
   "previsão preço petróleo 2027", "Brent forecast 2027" (en), "Goldman Sachs Brent forecast" (en), "OPEP+ produção 2027",
   "polypropylene price outlook" (en), "petroquímica perspectivas 2027", "projeção Selic Copom", "projeção dólar 2027".
3. **`perfil_setor` → `projecoes`:** expectativas do setor do cliente.
4. **`projetar_cliente`:** volume, tabela e faturamento do cliente nos próximos meses, por cenário.

## Como montar a seção
### Petróleo e resinas
- Tabela trimestral do Brent lado a lado: curva futura × EIA × bancos (se houver nas notícias).
- Diga se a curva está em **backwardation** (mercado espera queda) ou **contango** (espera alta).
- Traduza para resina: com a elasticidade de cada grade (`projetar_cliente.elasticidades`), quanto a tabela deve variar nos próximos meses.
- Se houver projeção de um banco nas notícias, rode `projetar_cliente` também com esse cenário próprio.

### Macro Brasil
- Focus: IPCA, Selic, PIB e câmbio no ano corrente e nos dois seguintes. Leitura: câmbio estável ou mais fraco protege contra importado; Selic alta encarece o prazo.

### Setor do cliente
- Projeções do setor e o que elas implicam para o volume de resina.

### Cliente — próximos meses (`projetar_cliente`)
- Tabela por cenário: Brent, tabela média, volume e faturamento por mês.
- **Valor do repasse** (vs tabela congelada) em cada cenário: esse é o "custo" de conceder teto ou escalonamento.
- Destaque o que **já está definido pela fórmula** (o próximo mês depende do Brent do mês passado, já conhecido) e o que ainda é incerto.

## Regras
- Projeção não é fato: sempre diga a fonte, a data e a premissa.
- Mostre uma faixa (cenários), não um número único.
- Termine com a **implicação para a estratégia da reunião** (ex.: "curva em backwardation forte: escalonar o reajuste de outubro em 2 parcelas custa pouco se o petróleo cair como o mercado espera; condicionar a contrato de volume do 1º tri").
