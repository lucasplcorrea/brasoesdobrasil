# brasoes-do-brasil

Base aberta, estruturada e auditável de brasões e bandeiras municipais brasileiros, vinculada pelo código IBGE de sete dígitos. A primeira versão é uma prova de conceito com Abaeté/MG, Águas de São Pedro/SP e Capim/PB; não realiza coleta em massa nem aprovação automática.

## Arquitetura e fontes

O IBGE é o cadastro mestre. O código IBGE liga o município ao Wikidata (`P1585`), que fornece os candidatos de brasão (`P94`) e bandeira (`P41`). O Wikimedia Commons fornece arquivo, autoria e licença. A API da Wikipedia em português é apenas fallback; HTML é o último recurso. Originais, derivados, catálogo, decisões de revisão e relatórios permanecem separados.

O catálogo JSON usa `schemaVersion: 1`; toda decisão automática deixa fonte, pontuação, hashes e transformações. Assets aprovados são consumíveis offline. Escritas de estado são atômicas, downloads usam cache/checkpoint e hashes evitam trabalho repetido.

## Instalação

Requer Node.js 22 ou LTS atual compatível.

```bash
npm install
cp .env.example .env
# preencha BRASOES_CONTACT e BRASOES_REPOSITORY_URL
npm test
```

O contato real é obrigatório para chamadas externas; o programa não inventa nem oculta a identidade do cliente.

## Comandos

```bash
npm run cli -- ibge atualizar
npm run cli -- ibge validar
npm run cli -- catalogo auditar
npm run cli -- descobrir --uf MG --limite 3
npm run cli -- baixar --uf MG --limite 3 --dry-run
npm run cli -- baixar --uf MG --limite 3
npm run cli -- revisar listar
npm run cli -- revisar listar --uf AC
npm run cli -- revisar aprovar --ibge 3100203 --tipo brasao
npm run cli -- revisar rejeitar --ibge 3100203 --tipo brasao --motivo "arquivo incorreto"
npm run cli -- relatorios
```

`catalogo auditar` funciona offline e confere referências, procedência,
licenças, MIME real, dimensões, hashes e arquivos órfãos. O resultado é salvo em
`data/auditoria.json` e `docs/auditoria.md`. Use `--sem-hashes` para uma
verificação estrutural mais rápida.

## Worker contínuo e container

O worker autentica a conta `BrasoesDoBrasilBot` com Bot Password, sincroniza o catálogo do IBGE, processa uma tarefa por vez e persiste cada resultado. No primeiro HTTP 429 ele abre um circuit breaker, respeita `Retry-After` e suspende toda a fila. Quando não restar tarefa não terminal, gera os relatórios e encerra com código `0`.

```bash
cp .env.worker.example .env.worker
# preencha somente em .env.worker:
# WIKIMEDIA_BOT_USERNAME=BrasoesDoBrasilBot@SufixoCriado
# WIKIMEDIA_BOT_PASSWORD=senha-gerada

docker compose build
docker compose up -d
docker compose logs -f coletor
```

O arquivo `.env.worker` é ignorado pelo Git. Nunca coloque o Bot Password no Dockerfile, Compose, catálogo ou logs. `restart: on-failure:5` reinicia falhas inesperadas, mas não reinicia o container depois da conclusão normal. Consulte [docs/worker.md](docs/worker.md).

A aprovação é individual e explícita. Um arquivo sem licença determinada fica `licenca_pendente` e não é distribuído como aprovado.

## Licenças

O código-fonte deste projeto está licenciado sob MIT.

As imagens possuem licenças individuais, registradas no catálogo, em `ATTRIBUTIONS.md` e nos arquivos de metadados. A inclusão de uma imagem neste repositório não altera sua licença original. Consulte [docs/licenciamento.md](docs/licenciamento.md).

## Cobertura, contribuição e limites

Os relatórios em `docs/` separam aprovação, pendências, ausências e inconsistências. Leia [CONTRIBUTING.md](CONTRIBUTING.md) antes de propor um símbolo. A POC não confirma juridicamente declarações do Commons, não resolve divergências históricas entre símbolos e não substitui revisão da fonte oficial municipal.
