/**
 * nodra new-site - Create a new Nodra site
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { Database } from '../../database/connection.js';
import { loadConfig } from '../../core/config.js';

export const newSiteCommand = new Command('new-site')
  .description('Create a new Nodra site with database')
  .argument('<site-name>', 'Name of the site')
  .option('--db-host <host>', 'Database host', 'localhost')
  .option('--db-port <port>', 'Database port', '5432')
  .option('--db-user <user>', 'Database user', 'postgres')
  .option('--db-password <password>', 'Database password', '')
  .option('--admin-email <email>', 'Admin user email', 'admin@example.com')
  .option('--admin-password <password>', 'Admin user password', undefined)
  .action(async (siteName: string, options) => {
    let db: Database | null = null;

    try {
      console.log(chalk.blue(`🏗️  Creating new site: ${chalk.bold(siteName)}\n`));

      // Validate site name
      if (!/^[a-z0-9_]+$/.test(siteName)) {
        throw new Error('Site name must contain only lowercase letters, numbers, and underscores');
      }

      // Validate admin password
      if (!options.adminPassword) {
        throw new Error('Admin password is required. Use --admin-password <password>');
      }

      if (options.adminPassword.length < 8) {
        throw new Error('Admin password must be at least 8 characters long');
      }

      const dbName = `nodra_${siteName}`;

      console.log(chalk.gray('Configuration:'));
      console.log(chalk.gray(`  Site name: ${siteName}`));
      console.log(chalk.gray(`  Database: ${dbName}`));
      console.log(chalk.gray(`  Admin: ${options.adminEmail}`));
      console.log();

      // Connect to PostgreSQL (postgres database to create new database)
      console.log(chalk.blue('🔌 Connecting to PostgreSQL...'));
      const config = loadConfig({
        db: {
          host: options.dbHost,
          port: parseInt(options.dbPort, 10),
          database: 'postgres', // Connect to default postgres DB first
          user: options.dbUser,
          password: options.dbPassword,
        },
      });

      db = new Database(config.db);
      await db.connect();
      console.log(chalk.green('✓ Connected\n'));

      // Check if database already exists
      console.log(chalk.blue('🔍 Checking if database exists...'));
      const checkResult = await db.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [dbName]
      );

      if (checkResult.rows.length > 0) {
        throw new Error(`Database '${dbName}' already exists`);
      }

      // Create database
      console.log(chalk.blue(`🗄️  Creating database '${dbName}'...`));
      // Note: Database name cannot be parameterized, but we validated it above
      await db.query(`CREATE DATABASE ${dbName}`);
      console.log(chalk.green('✓ Database created\n'));

      // Disconnect from postgres database
      await db.disconnect();

      // Connect to new database
      console.log(chalk.blue('🔌 Connecting to new database...'));
      config.db.database = dbName;
      db = new Database(config.db);
      await db.connect();
      console.log(chalk.green('✓ Connected\n'));

      console.log(chalk.green('✨ Site created successfully!\n'));
      console.log(chalk.cyan('Next steps:'));
      console.log(chalk.gray('  1. Run migrations:'));
      console.log(chalk.white(`     nodra migrate --db-name ${dbName}`));
      console.log(chalk.gray('  2. Start the server:'));
      console.log(chalk.white(`     nodra start --db-name ${dbName} --secret <your-secret>`));
      console.log();

      // Store site config reminder
      console.log(chalk.yellow('💡 Tip: Save these credentials in a .env file or nodra.config.ts'));

      await db.disconnect();

    } catch (error) {
      if (error instanceof Error) {
        console.error(chalk.red('✗ Failed to create site:'), error.message);
      } else {
        console.error(chalk.red('✗ An unexpected error occurred'));
      }

      if (db) {
        await db.disconnect();
      }

      process.exit(1);
    }
  });
