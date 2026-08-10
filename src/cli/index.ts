#!/usr/bin/env node
import { Command, Option } from 'commander';
import { updateIbge, validateIbge } from '../ibge/index.js';
import { discover } from '../wikidata/index.js';
import { enrichCommons } from '../commons/index.js';
import { downloadCandidates } from '../imagens/index.js';
import { decide, listReviews } from '../revisao/index.js';
import { generateReports } from '../relatorios/index.js';
import { log } from '../io.js';
import { syncCatalog } from '../catalogo/index.js';
import { discoverWikipediaFallback } from '../wikipedia/index.js';
import { runWorker } from '../worker/index.js';
import { notifyError } from '../notificacoes/index.js';

const program = new Command()
  .name('brasoes-do-brasil')
  .description('Catálogo auditável de símbolos municipais')
  .showHelpAfterError();
const ibge = program.command('ibge');
ibge.command('atualizar').action(async () => {
  await updateIbge();
  log('ibge.atualizado');
});
ibge.command('validar').action(async () => {
  log('ibge.validado', { municipios: await validateIbge() });
});
const catalog = program.command('catalogo');
catalog
  .command('sincronizar')
  .option('--uf <UF>')
  .action(async (options) => {
    log('catalogo.sincronizado', { uf: options.uf, adicionados: await syncCatalog(options.uf) });
  });
const filters = (command: Command) =>
  command
    .option('--uf <UF>')
    .option('--ibge <codigo>')
    .addOption(new Option('--limite <n>').default(3).argParser(Number));
filters(program.command('descobrir')).action(async (o) => {
  const options = { uf: o.uf, ibge: o.ibge, limit: o.limite };
  await discover(options);
  await discoverWikipediaFallback(options);
  await enrichCommons(options);
  log('descoberta.concluida', o);
});
filters(program.command('baixar'))
  .option('--dry-run')
  .action(async (o) => {
    await downloadCandidates({ uf: o.uf, ibge: o.ibge, limit: o.limite, dryRun: o.dryRun });
    log('download.concluido', o);
  });
const review = program.command('revisar');
review.command('listar').action(async () => {
  process.stdout.write(`${JSON.stringify(await listReviews(), null, 2)}\n`);
});
review
  .command('aprovar')
  .requiredOption('--ibge <codigo>')
  .requiredOption('--tipo <tipo>')
  .action(async (o) => {
    await decide(o.ibge, o.tipo, 'aprovado');
  });
review
  .command('rejeitar')
  .requiredOption('--ibge <codigo>')
  .requiredOption('--tipo <tipo>')
  .requiredOption('--motivo <texto>')
  .action(async (o) => {
    await decide(o.ibge, o.tipo, 'rejeitado', o.motivo);
  });
program.command('relatorios').action(async () => {
  await generateReports();
  log('relatorios.gerados');
});
const worker = program.command('worker');
worker.command('executar').action(async () => {
  await runWorker();
});
program.parseAsync().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  log('erro', { message });
  await notifyError({ event: 'worker.erro_fatal', message });
  process.exitCode = 1;
});
