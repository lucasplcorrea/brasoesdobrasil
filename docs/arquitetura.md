# Arquitetura

Fluxo: IBGE → catálogo municipal → Wikidata → candidatos → Commons → validação → download/checkpoint → normalização → revisão humana → aprovação/atribuições/relatórios.

- `src/ibge`: snapshot mestre e validação offline.
- `src/wikidata`, `src/commons`, `src/wikipedia`: adaptadores externos.
- `src/http`: identificação, timeout, retry, `Retry-After` e cache.
- `src/imagens`: detecção por bytes, limites, SVG seguro e JPEG 192 × 192.
- `src/catalogo`, `src/revisao`: esquema e decisões auditáveis.
- `src/licenciamento`, `src/relatorios`: interpretação conservadora e saídas geradas.

Escritas usam arquivo temporário e `rename`. O checkpoint identifica código, tipo e SHA-1. A concorrência padrão é 1, com intervalo configurável entre requisições. Nenhum candidato descoberto vira aprovado automaticamente.

## SPARQL

```sparql
SELECT ?item ?codigo ?brasao ?bandeira ?article WHERE {
  VALUES ?codigo { "2504033" "3100203" "3500600" }
  ?item wdt:P1585 ?codigo.
  OPTIONAL { ?item wdt:P94 ?brasao. }
  OPTIONAL { ?item wdt:P41 ?bandeira. }
  OPTIONAL {
    ?article schema:about ?item;
             schema:isPartOf <https://pt.wikipedia.org/>.
  }
}
```
