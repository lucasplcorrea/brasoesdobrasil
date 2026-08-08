# Worker contínuo

## Identidade

- Operador: [shibiriba](https://meta.wikimedia.org/wiki/User:Shibiriba)
- Bot: [BrasoesDoBrasilBot](https://meta.wikimedia.org/wiki/User:BrasoesDoBrasilBot)
- Contato público: `lucaspedrolopescorrea@gmail.com`
- Autenticação: Bot Password com permissões mínimas de leitura

O nome completo gerado em `Special:BotPasswords` inclui um sufixo, por exemplo `BrasoesDoBrasilBot@Coletor`. O sufixo e a senha são fornecidos somente por variáveis de ambiente.

## Ciclo

1. Autenticar no Meta-Wiki e manter cookies na sessão HTTP.
2. Sincronizar municípios do snapshot IBGE com o catálogo.
3. Priorizar downloads já descobertos e pendentes.
4. Descobrir o próximo município ainda não consultado.
5. Consultar Wikidata, fallback Wikipedia e metadados Commons.
6. Validar e normalizar downloads, persistindo catálogo e checkpoint.
7. Dormir entre operações.
8. No primeiro 429, interromper novas requisições e aguardar `Retry-After` com jitter.
9. Gerar relatórios a cada 50 unidades e ao concluir.
10. Encerrar com código `0` quando não houver trabalho não terminal.

O estado operacional fica em `data/checkpoints/worker.json`. `SIGTERM` e `SIGINT` solicitam encerramento gracioso; o Compose concede 60 segundos antes de finalizar o processo.

## Operação

```bash
cp .env.worker.example .env.worker
$EDITOR .env.worker
docker compose pull coletor
docker compose up -d
docker compose ps
docker compose logs -f --tail=100 coletor
```

Para construir localmente durante o desenvolvimento:

```bash
docker build --tag lucasplcorrea/brasoes-do-brasil:local .
```

Em outro servidor, baixe a imagem publicada antes de iniciar:

```bash
docker compose pull coletor
docker compose up -d coletor
```

Na primeira execução com os diretórios vazios, o worker cria um catálogo vazio,
obtém a lista oficial de municípios pelo IBGE e então inicia a coleta. Arquivos
existentes nunca são substituídos durante esse bootstrap.

O intervalo recomendado inicial é `BRASOES_REQUEST_DELAY_MS=10000`, com
`BRASOES_DOWNLOAD_DELAY_MS=1000` e concorrência `1`. O primeiro controla a
cadência entre municípios; o segundo evita espera duplicada entre imagens. Se a
Wikimedia responder com HTTP 429, o worker interrompe a fila e respeita
`Retry-After`; aumentar a concorrência não é recomendado.

Para parar com segurança:

```bash
docker compose stop
```

Para retomar:

```bash
docker compose up -d
```

O catálogo, assets, documentação e checkpoints são bind mounts; recriar a imagem ou o container não apaga o progresso.

## Segurança

- `.env.worker` não deve ser versionado nem enviado a terceiros.
- O container roda sem capabilities e com `no-new-privileges`.
- O filesystem da imagem é somente leitura; apenas `data`, `assets`, `docs` e `/tmp` são graváveis.
- Para outro servidor, ajuste `WORKER_UID` e `WORKER_GID` ao proprietário dos diretórios montados.
- Nunca execute duas réplicas apontando para os mesmos arquivos.
