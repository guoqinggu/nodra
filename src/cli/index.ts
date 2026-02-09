#!/usr/bin/env node
/**
 * Nodra CLI
 * 
 * Command-line interface for the Nodra framework
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { VERSION } from '../index.js';

const program = new Command();

program
  .name('nodra')
  .description('Nodra Framework CLI - Metadata-driven web framework')
  .version(VERSION);

// Import commands
import { startCommand } from './commands/start.js';
import { migrateCommand } from './commands/migrate.js';
import { newSiteCommand } from './commands/new-site.js';

// Register commands
program.addCommand(startCommand);
program.addCommand(migrateCommand);
program.addCommand(newSiteCommand);

// Parse arguments
try {
  await program.parseAsync(process.argv);
} catch (error) {
  if (error instanceof Error) {
    console.error(chalk.red('Error:'), error.message);
  } else {
    console.error(chalk.red('An unexpected error occurred'));
  }
  process.exit(1);
}
