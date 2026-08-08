# Estratégia de armazenamento

O Brasil tem 5.571 registros municipais no snapshot consultado. Com dois símbolos, o teto teórico é 11.142 originais e 11.142 derivados. Se um original médio tiver 0,5–2 MB, seriam aproximadamente 5,6–22,3 GB; JPEGs de 192 px a 20–60 KB acrescentariam cerca de 0,22–0,67 GB.

| Opção                 | Vantagem               | Custo/risco                                                  |
| --------------------- | ---------------------- | ------------------------------------------------------------ |
| Git normal            | simples e offline      | histórico cresce muito; clones pesados                       |
| Git LFS               | clone seletivo         | quotas, custo e dependência do serviço                       |
| Apenas derivados      | repositório pequeno    | perde original offline; licença ainda deve permitir derivado |
| Originais em releases | separa código de blobs | gestão/versionamento mais complexos                          |
| URL + hashes          | mínimo custo           | origem pode desaparecer; não é offline                       |

Recomendação: manter no Git catálogo, metadados e derivados aprovados; guardar originais redistribuíveis em releases versionadas ou armazenamento de objetos, referenciados por hash. Para fontes sem redistribuição validada, manter apenas URL e hash. Não habilitar LFS/serviço externo antes de medir a POC e obter autorização.
