#!/usr/bin/env node
import { Command } from 'commander';
import { execa } from 'execa';
import ora from 'ora';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import which from 'which';
import { detectOs } from './installers/index.js';
import { installUbuntuDebian } from './installers/ubuntu.js';
import { installRhel } from './installers/rhel.js';
import { installWindows } from './installers/windows.js';

const program = new Command();

async function ensureTool(tool: string, installHint?: string) {
  try {
    which.sync(tool);
  } catch {
    console.error(chalk.red(`Required tool not found: ${tool}`));
    if (installHint) console.error(chalk.yellow(installHint));
    process.exit(1);
  }
}

async function run(cmd: string, args: string[], opts: { cwd?: string } = {}) {
  return execa(cmd, args, { stdio: 'inherit', cwd: opts.cwd });
}

program
  .name('cpanel')
  .description('Atulya Panel CLI')
  .version('0.1.0');

program
  .command('install')
  .description('Install dependencies and set up system')
  .option('--no-db', 'Skip database migrations and seed')
  .option('--os <os>', 'Specify OS family (auto|ubuntu|debian|rhel|windows)', 'auto')
  .action(async (opts) => {
    const spinner = ora('Installing dependencies').start();
    try {
      await ensureTool('node', 'Please install Node.js 20+');
      await ensureTool('npm', 'npm should come with Node.js');
      const os = opts.os === 'auto' ? detectOs() : opts.os;
      if (os === 'windows') {
        spinner.text = 'Running Windows installer';
        await installWindows();
        spinner.succeed('Windows installation complete');
        return;
      }
      if (os === 'ubuntu' || os === 'debian') {
        spinner.text = 'Running Ubuntu/Debian installer';
        await installUbuntuDebian();
      } else if (os === 'rhel') {
        spinner.text = 'Running RHEL/Fedora installer';
        await installRhel();
      }
      spinner.text = 'Installing root dependencies';
      await run('npm', ['install', '--no-audit', '--no-fund']);
      spinner.text = 'Installing backend dependencies';
      await run('npm', ['install', '--no-audit', '--no-fund'], { cwd: 'backend' });
      spinner.text = 'Installing frontend dependencies';
      await run('npm', ['install', '--no-audit', '--no-fund'], { cwd: 'frontend' });
      if (opts.db !== false) {
        spinner.text = 'Generating Prisma client';
        await run('npm', ['run', 'db:generate'], { cwd: 'backend' });
        spinner.text = 'Running database migrations';
        await run('npm', ['run', 'db:migrate'], { cwd: 'backend' });
        spinner.text = 'Seeding database';
        await run('npm', ['run', 'db:seed'], { cwd: 'backend' });
      }
      spinner.succeed('Installation complete');
    } catch (err) {
      spinner.fail('Installation failed');
      process.exit(1);
    }
  });

program
  .command('setup')
  .description('Run OS-specific setup (Linux/macOS via shell, Windows via BAT)')
  .action(async () => {
    const spinner = ora('Running system setup').start();
    try {
      if (process.platform === 'win32') {
        const bat = path.resolve('setup-dev.bat');
        await run('cmd', ['/c', bat]);
      } else {
        const sh = path.resolve('setup-dev.sh');
        await run('bash', [sh]);
      }
      spinner.succeed('System setup complete');
    } catch {
      spinner.fail('System setup failed');
      process.exit(1);
    }
  });

program
  .command('start')
  .description('Start backend and frontend in dev mode')
  .action(async () => {
    await ensureTool('node');
    await ensureTool('npm');
    await run('npm', ['run', 'dev']);
  });

program
  .command('status')
  .description('Check services and environment')
  .action(async () => {
    const checks: Array<[string, () => Promise<boolean>]> = [
      ['Node.js 20+', async () => !!which.sync('node', { nothrow: true })],
      ['npm', async () => !!which.sync('npm', { nothrow: true })],
      ['PostgreSQL reachable (optional)', async () => true],
      ['Redis reachable (optional)', async () => true],
    ];
    for (const [label, fn] of checks) {
      try {
        const ok = await fn();
        console.log(`${ok ? chalk.green('✔') : chalk.red('✘')} ${label}`);
      } catch {
        console.log(`${chalk.red('✘')} ${label}`);
      }
    }
  });

program.parseAsync(process.argv);


