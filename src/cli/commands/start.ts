/**
 * nodra start - Start development server
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { Nodra } from '../../nodra.js';
import { loadConfig, validateConfig } from '../../core/config.js';
import { loadDocTypesFromDirectory } from '../../core/doctype/loader.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const startCommand = new Command('start')
  .description('Start the Nodra development server')
  .option('-p, --port <port>', 'Server port', '8000')
  .option('-h, --host <host>', 'Server host', '0.0.0.0')
  .option('--db-name <name>', 'Database name', 'nodra_dev')
  .option('--db-host <host>', 'Database host', 'localhost')
  .option('--db-port <port>', 'Database port', '5432')
  .option('--db-user <user>', 'Database user', 'postgres')
  .option('--db-password <password>', 'Database password', '')
  .option('--secret <secret>', 'JWT secret (required)', undefined)
  .action(async (options) => {
    try {
      console.log(chalk.blue('🚀 Starting Nodra development server...\n'));

      // Validate required options
      if (!options.secret) {
        throw new Error('JWT secret is required. Use --secret <your-secret-key>');
      }

      // Load configuration
      const config = loadConfig({
        server: {
          host: options.host,
          port: parseInt(options.port, 10),
        },
        db: {
          host: options.dbHost,
          port: parseInt(options.dbPort, 10),
          database: options.dbName,
          user: options.dbUser,
          password: options.dbPassword,
        },
        auth: {
          secret: options.secret,
        },
      });

      // Validate configuration
      validateConfig(config);

      console.log(chalk.gray('Configuration:'));
      console.log(chalk.gray(`  Server: ${config.server.host}:${config.server.port}`));
      console.log(chalk.gray(`  Database: ${config.db.user}@${config.db.host}:${config.db.port}/${config.db.database}`));
      console.log();

      // Create Nodra instance
      const app = new Nodra(config);

      // Load core DocTypes
      console.log(chalk.blue('📦 Loading DocTypes...'));
      const coreDocTypesPath = path.join(__dirname, '../../../doctypes/core');
      const docTypes = await loadDocTypesFromDirectory(coreDocTypesPath);
      
      for (const docType of docTypes) {
        app.registry.register(docType);
        console.log(chalk.gray(`  ✓ Loaded ${docType.name}`));
      }
      console.log(chalk.green(`✓ Loaded ${docTypes.length} DocTypes\n`));

      // Boot the application
      console.log(chalk.blue('🔌 Connecting to database...'));
      await app.boot();

      console.log();
      console.log(chalk.green('✨ Server is ready!'));
      console.log(chalk.cyan(`   → Local: http://localhost:${config.server.port}`));
      console.log(chalk.cyan(`   → API:   http://localhost:${config.server.port}/api`));
      console.log();
      console.log(chalk.gray('Press Ctrl+C to stop the server'));

      // Handle graceful shutdown
      const shutdown = async () => {
        console.log(chalk.yellow('\n\n🛑 Shutting down server...'));
        await app.shutdown();
        console.log(chalk.green('✓ Server stopped gracefully'));
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

    } catch (error) {
      if (error instanceof Error) {
        console.error(chalk.red('✗ Failed to start server:'), error.message);
      } else {
        console.error(chalk.red('✗ An unexpected error occurred'));
      }
      process.exit(1);
    }
  });
