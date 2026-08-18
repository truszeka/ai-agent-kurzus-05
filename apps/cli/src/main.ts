import 'dotenv/config';
import { join } from 'node:path';
import { Command } from 'commander';
import {
  askAgent,
  askRagAgent,
  knowledgeChunksExist,
  askIngestAgent,
  ingestKnowledgeBase,
  closeVectorPool,
  loadConfig,
  ConfigError,
  closeReadOnlyPool,
  closeReadWritePool,
  setWatchLog,
} from '@plantbase/core';
import { runInteractive } from './interactive.js';

// plantbase ask "<kérdés>"   -> egyszeri válasz (élő színes trace + logs/<ts>.json)
// plantbase ask              -> interaktív mód (beszélgetés-memóriával, exit-ig)
// plantbase ask --quiet ...  -> nincs élő trace (csak a válasz), a JSON nyom akkor is elkészül

const program = new Command();

interface AskOptions {
  quiet: boolean;
}

program
  .name('plantbase')
  .description(
    'Plantbase — természetes nyelvű kérdés-válasz a növény-katalógus felett (CLI).',
  )
  .version('0.0.1');

program
  .command('ask')
  .description('Egyszeri kérdés, vagy argumentum nélkül interaktív mód.')
  .argument('[kérdés...]', 'a feltett kérdés (idézőjelben vagy szavanként)')
  .option(
    '--quiet',
    'ne írja ki az élő trace-t (a JSON nyom akkor is elkészül)',
    false,
  )
  .action(async (words: string[], options: AskOptions) => {
    // Fail-fast: a kulcs/konfiguráció hiányát azonnal, érthetően jelezzük.
    try {
      loadConfig();
    } catch (error: unknown) {
      if (error instanceof ConfigError) {
        console.error(`plantbase: ${error.message}`);
        process.exit(1);
      }
      throw error;
    }

    // A folyamatos "control room" log bekapcsolása: külön terminálban `tail -f logs/agent.log`.
    setWatchLog(join(process.cwd(), 'logs', 'agent.log'));

    const question = words.join(' ').trim();
    try {
      if (question === '') {
        await runInteractive(options.quiet);
      } else {
        // Ha be van töltve a tudásbázis, a RAG-agent válaszol (HyDE + rerank + grounding),
        // különben a meglévő SQL-agent (fallback). A döntés runtime, nincs külön kapcsoló.
        const useRag = await knowledgeChunksExist();
        const result = useRag
          ? await askRagAgent(question, { print: !options.quiet })
          : await askAgent(question, { print: !options.quiet });
        // Csendes módban a trace nem ír semmit → a választ itt írjuk ki.
        if (options.quiet) {
          console.log(result.answer);
        }
      }
    } finally {
      // A read-only pg-pool ÉS a RAG vektor-pool is életben tartja az event loopot — zárjuk.
      await Promise.all([closeReadOnlyPool(), closeVectorPool()]);
    }
  });

program
  .command('ingest')
  .description(
    'Katalógus-kezelő agent: BESZÉLGETVE veszel fel/frissítesz termékeket (írás!). ' +
      'Argumentummal egyszeri utasítás, anélkül interaktív mód.',
  )
  .argument('[utasítás...]', 'pl. "állítsd a Kentia pálma árát 17900-ra"')
  .option(
    '--quiet',
    'ne írja ki az élő trace-t (a JSON nyom akkor is elkészül)',
    false,
  )
  .action(async (words: string[], options: AskOptions) => {
    try {
      loadConfig();
    } catch (error: unknown) {
      if (error instanceof ConfigError) {
        console.error(`plantbase: ${error.message}`);
        process.exit(1);
      }
      throw error;
    }

    setWatchLog(join(process.cwd(), 'logs', 'agent.log'));

    const instruction = words.join(' ').trim();
    try {
      if (instruction === '') {
        await runInteractive({
          quiet: options.quiet,
          ask: askIngestAgent,
          banner:
            'Plantbase katalógus-kezelő (ingest) mód — írási művelet! Kilépés: "exit" vagy Ctrl-D.',
        });
      } else {
        const result = await askIngestAgent(instruction, {
          print: !options.quiet,
        });
        if (options.quiet) {
          process.stdout.write(`${result.answer}\n`);
        }
      }
    } finally {
      // Az ingest-agent olvas (read-only) ÉS ír (read-write) — mindkét poolt zárjuk.
      await Promise.all([closeReadOnlyPool(), closeReadWritePool()]);
    }
  });

program
  .command('knowledge-ingest')
  .description(
    'Betölti a seed/knowledge/ Markdown cikkeket pgvector-ba (idempotens).',
  )
  .option('--quiet', 'ne írja ki a haladást', false)
  .action(async (options: { quiet: boolean }) => {
    try {
      loadConfig();
    } catch (error: unknown) {
      if (error instanceof ConfigError) {
        console.error(`plantbase: ${error.message}`);
        process.exit(1);
      }
      throw error;
    }

    const knowledgeDir = join(process.cwd(), 'seed', 'knowledge');

    try {
      const result = await ingestKnowledgeBase(knowledgeDir, {
        print: !options.quiet,
      });
      console.log(
        `\nKész: ${result.totalDocs} dokumentum, ${result.totalChunks} chunk betöltve` +
          (result.skipped > 0 ? `, ${result.skipped} kihagyva (üres)` : '') +
          '.',
      );
    } finally {
      await closeVectorPool();
    }
  });

// Parancs nélkül: súgó.
if (process.argv.length <= 2) {
  program.outputHelp();
  process.exit(0);
}

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`plantbase hiba: ${message}`);
  process.exit(1);
});
