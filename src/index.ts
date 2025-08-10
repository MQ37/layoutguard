#!/usr/bin/env node

import { Command } from 'commander';
import { initAction } from './commands/init';
import { checkAction } from './commands/check';
import { approveAction } from './commands/approve';

const program = new Command();

program
  .name('layout-guard')
  .description('CLI tool for visual regression testing')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize layout-guard in the project')
  .action(initAction);

program
  .command('check')
  .description('Run visual regression tests')
  .argument('[test-name]', 'Name of a specific test to run')
  .option('--show-diff', 'Open the diff image if a test fails')
  .action((testName, options) => checkAction(testName, options));

program
  .command('approve')
  .description('Approve new snapshots')
  .argument('[test-name]', 'Name of a specific test to approve')
  .action((testName, options) => approveAction(testName, options));

program.parse();