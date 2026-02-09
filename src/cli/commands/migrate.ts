/**
 * nodra migrate - Sync DocTypes to database schema
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { Database } from '../../database/connection.js';
import { SchemaSync } from '../../database/schema-sync.js';
import { loadDocTypesFromDirectory } from '../../core/doctype/loader.js';
import { loadConfig } from '../../core/config.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const migrateCommand = new Command('migrate')
  .description('Sync DocType definitions to database schema')
  .option('--db-name <name>', 'Database name', 'nodra_dev')
  .option('--db-host <host>', 'Database host', 'localhost')
  .option('--db-port <port>', 'Database port', '5432')
  .option('--db-user <user>', 'Database user', 'postgres')
  .option('--db-password <password>', 'Database password', '')
  .option('--dry-run', 'Show SQL without executing', false)
  .action(async (options) => {
    let db: Database | null = null;

    try {
      console.log(chalk.blue('🔄 Running database migration...\n'));

      // Load configuration
      const config = loadConfig({
        db: {
          host: options.dbHost,
          port: parseInt(options.dbPort, 10),
          database: options.dbName,
          user: options.dbUser,
          password: options.dbPassword,
        },
      });

      console.log(chalk.gray('Database:'), chalk.cyan(`${config.db.user}@${config.db.host}:${config.db.port}/${config.db.database}`));
      console.log();

      // Connect to database
      console.log(chalk.blue('🔌 Connecting to database...'));
      db = new Database(config.db);
      await db.connect();
      console.log(chalk.green('✓ Connected\n'));

      // Load DocTypes
      console.log(chalk.blue('📦 Loading DocTypes...'));
      const coreDocTypesPath = path.join(__dirname, '../../../doctypes/core');
      const docTypes = await loadDocTypesFromDirectory(coreDocTypesPath);
      console.log(chalk.green(`✓ Loaded ${docTypes.length} DocTypes\n`));

      // Sync schema
      console.log(chalk.blue('🔨 Syncing schema...'));
      const schemaSync = new SchemaSync(db);

      let syncedCount = 0;
      for (const docType of docTypes) {
        console.log(chalk.gray(`  Syncing ${docType.name}...`));
        
        if (options.dryRun) {
          // In dry-run mode, just show what would be done
          console.log(chalk.yellow(`    [DRY RUN] Would sync ${docType.name}`));
        } else {
          await schemaSync.syncDocType(docType);
          console.log(chalk.green(`    ✓ ${docType.name} synced`));
        }
        syncedCount++;
      }

      console.log();
      if (options.dryRun) {
        console.log(chalk.yellow(`✓ Dry run complete. ${syncedCount} DocTypes would be synced.`));
      } else {
        console.log(chalk.green(`✨ Migration complete! ${syncedCount} DocTypes synced.`));
      }

      // Disconnect
      await db.disconnect();

    } catch (error) {
      if (error instanceof Error) {
        console.error(chalk.red('✗ Migration failed:'), error.message);
      } else {
        console.error(chalk.red('✗ An unexpected error occurred'));
      }
      
      if (db) {
        await db.disconnect();
      }
      
      process.exit(1);
    }
  });
