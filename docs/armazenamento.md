# Estratégia de armazenamento

Medição realizada sobre o snapshot concluído em agosto de 2026.

- Originais: 9.390 arquivos, aproximadamente 2,2 GiB.
- Normalizados: 9.394 arquivos, aproximadamente 130 MiB.
- Maior arquivo individual: aproximadamente 22 MiB.
- Assets aprovados: nenhum; todos ainda dependem de revisão humana explícita.

## Volume por UF

| UF | Originais | Tamanho dos originais | Normalizados | Tamanho dos normalizados |
|---|---:|---:|---:|---:|
| MG | 1374 | 364 MiB | 1376 | 17 MiB |
| SC | 574 | 282 MiB | 574 | 7,9 MiB |
| RS | 970 | 227 MiB | 970 | 12 MiB |
| SP | 1248 | 194 MiB | 1250 | 17 MiB |
| PR | 655 | 145 MiB | 655 | 8,3 MiB |
| BA | 783 | 131 MiB | 783 | 8,5 MiB |
| CE | 306 | 94 MiB | 306 | 3,6 MiB |
| PI | 177 | 82 MiB | 177 | 2,0 MiB |
| PE | 318 | 81 MiB | 318 | 3,5 MiB |
| RN | 331 | 79 MiB | 331 | 4,0 MiB |
| GO | 439 | 63 MiB | 439 | 4,9 MiB |
| PA | 203 | 60 MiB | 203 | 2,2 MiB |
| TO | 119 | 57 MiB | 119 | 1,4 MiB |
| ES | 152 | 46 MiB | 152 | 1,8 MiB |
| MA | 237 | 44 MiB | 237 | 2,5 MiB |
| AL | 156 | 42 MiB | 156 | 1,7 MiB |
| PB | 421 | 41 MiB | 423 | 4,7 MiB |
| MT | 198 | 40 MiB | 198 | 2,4 MiB |
| MS | 127 | 38 MiB | 127 | 1,5 MiB |
| RJ | 181 | 25 MiB | 181 | 2,2 MiB |
| SE | 132 | 24 MiB | 132 | 1,8 MiB |
| RO | 91 | 17 MiB | 91 | 954 KiB |
| AM | 90 | 11 MiB | 90 | 963 KiB |
| AP | 30 | 7,3 MiB | 30 | 374 KiB |
| RR | 30 | 5,2 MiB | 30 | 296 KiB |
| AC | 44 | 3,1 MiB | 44 | 500 KiB |
| DF | 2 | 42 KiB | 2 | 13 KiB |

## Recomendação

1. Versionar código, catálogo, auditoria e relatórios no Git normal.
2. Revisar e aprovar os símbolos individualmente antes de distribuí-los.
3. Versionar derivados aprovados em commits separados por UF.
4. Publicar originais aprovados em GitHub Releases por UF, acompanhados de
   manifesto, hashes e atribuições, evitando acrescentar 2,2 GiB ao histórico
   permanente do Git.
5. Não publicar `revisao_pendente`, `licenca_pendente`, `rejeitado` ou
   `desatualizado` como distribuição oficial.

Commits por UF são úteis para revisão, reversão e acompanhamento, mas não
reduzem o tamanho final do repositório. O GitHub não possui um limite geral de
10 mil arquivos por repositório; os fatores relevantes são tamanho de arquivos,
pushes e crescimento do histórico.
