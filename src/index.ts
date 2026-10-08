#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import axios, { AxiosError } from 'axios';
import Conf from 'conf';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const program = new Command();
const config = new Conf({ projectName: 'apex-cli' });

// Default configuration
const DEFAULT_BASE_URL = 'http://127.0.0.1:3100/api';

// Helper functions
function getApiKey(): string | undefined {
  return process.env.APEX_API_KEY || (config.get('apiKey') as string | undefined);
}

function getBaseUrl(): string {
  return (process.env.APEX_BASE_URL || config.get('baseUrl', DEFAULT_BASE_URL)) as string;
}

interface ApiRequestOptions {
  method: string;
  data?: any;
}

async function apiRequest(endpoint: string, options: ApiRequestOptions) {
  const apiKey = getApiKey();
  const baseUrl = getBaseUrl();
  
  if (!apiKey) {
    console.error(chalk.red('Error: API key not provided. Set APEX_API_KEY environment variable or run "apex config set api-key <key>"'));
    process.exit(1);
  }

  try {
    const response = await axios.create({
      baseURL: baseUrl,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    }).request(options);
    
    return response.data;
  } catch (error: any) {
    if (error.response) {
      console.error(chalk.red(`API Error ${error.response.status}: ${error.response.data?.message || error.message}`));
    } else {
      console.error(chalk.red(`Request Error: ${error.message}`));
    }
    process.exit(1);
  }
}

function formatTable(data: any[], columns: any[]) {
  if (!data || data.length === 0) {
    console.log('No results found.');
    return;
  }

  const tableData = [columns.map((c: any) => c.header)];
  data.forEach((item: any) => {
    tableData.push(columns.map((c: any) => {
      const value = c.accessor ? c.accessor(item) : item[c.key];
      return value !== undefined && value !== null ? String(value) : '';
    }));
  });

  console.log(table(tableData, {
    border: {
      topBody: '─',
      topJoin: '┬',
      topLeft: '┌',
      topRight: '┐',
      bottomBody: '─',
      bottomJoin: '┴',
      bottomLeft: '└',
      bottomRight: '┘',
      bodyLeft: '│',
      bodyRight: '│',
      bodyJoin: '│',
      joinBody: '─',
      joinLeft: '├',
      joinRight: '┤',
      joinJoin: '┼',
    },
    drawHorizontalLine: (index: number, size: number) => index === 0 || index === 1 || index === size,
  }));
}

// Search command
program
  .command('search [query]')
  .description('Search publications')
  .option('-t, --topics <topics>', 'Topics to filter (comma-separated)')
  .option('-s, --sources <sources>', 'Sources to filter (comma-separated)')
  .option('--from <date>', 'Start date (ISO 8601)')
  .option('--to <date>', 'End date (ISO 8601)')
  .option('-l, --limit <number>', 'Max results', '20')
  .option('-o, --offset <number>', 'Offset for pagination', '0')
  .option('-f, --format <format>', 'Output format (json, table, markdown)', 'table')
  .option('--output <file>', 'Export to file')
  .option('-v, --verbose', 'Verbose mode')
  .option('--api-key <key>', 'API key (overrides env/config)')
  .action(async (query: string, options: any) => {
    const spinner = options.verbose ? null : ora('Searching...').start();
    
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (options.topics) params.append('topics', options.topics);
    if (options.sources) params.append('sources', options.sources);
    if (options.from) params.append('from', options.from);
    if (options.to) params.append('to', options.to);
    if (options.limit) params.append('limit', options.limit);
    if (options.offset) params.append('offset', options.offset);

    try {
      const data = await apiRequest(`/publications/search?${params.toString()}`, {
        method: 'GET',
      });

      if (spinner) spinner.succeed();

      if (options.format === 'json') {
        console.log(JSON.stringify(data, null, 2));
      } else if (options.format === 'markdown') {
        data.results?.forEach((pub: any, idx: number) => {
          console.log(`### ${idx + 1}. ${pub.title}`);
          console.log(`**Source:** ${pub.source}  `);
          console.log(`**Date:** ${pub.publishedAt}  `);
          console.log(`\n${pub.summary || pub.excerpt}\n`);
          console.log(`[Read more](${pub.url})\n`);
          console.log('---\n');
        });
      } else {
        formatTable(data.results || [], [
          { header: 'Title', accessor: (item: any) => item.title?.substring(0, 50) + (item.title?.length > 50 ? '...' : '') },
          { header: 'Date', accessor: (item: any) => item.publishedAt?.split('T')[0] },
          { header: 'Source', accessor: (item: any) => item.source },
        ]);
        console.log(chalk.green(`\nTotal: ${data.total} results`));
      }

      if (options.output) {
        const content = options.format === 'json' ? JSON.stringify(data, null, 2) : JSON.stringify(data.results, null, 2);
        fs.writeFileSync(options.output, content);
        console.log(chalk.green(`Results exported to ${options.output}`));
      }
    } catch (error) {
      if (spinner) spinner.fail();
      throw error;
    }
  });

// Follow commands
const followCmd = program.command('follow')
  .description('Manage follow configurations');

followCmd
  .command('list')
  .description('List active follows')
  .option('-f, --format <format>', 'Output format (json, table)', 'table')
  .action(async (options: any) => {
    const spinner = ora('Loading follows...').start();
    
    try {
      const data = await apiRequest('/follows', { method: 'GET' });
      spinner.succeed();

      if (options.format === 'json') {
        console.log(JSON.stringify(data, null, 2));
      } else {
        formatTable(data, [
          { header: 'ID', accessor: (item: any) => item.id?.substring(0, 8) },
          { header: 'Topics', accessor: (item: any) => item.topics?.map((t: any) => t.name || t).join(', ') },
          { header: 'Frequency', accessor: (item: any) => item.frequency },
          { header: 'Channels', accessor: (item: any) => item.channels?.join(', ') },
          { header: 'Status', accessor: (item: any) => item.active ? 'Active' : 'Inactive' },
        ]);
      }
    } catch (error) {
      spinner.fail();
      throw error;
    }
  });

followCmd
  .command('create')
  .description('Create a new follow')
  .requiredOption('-t, --topics <topics>', 'Topic IDs (comma-separated)')
  .option('-s, --sources <sources>', 'Source IDs (comma-separated)')
  .option('-f, --frequency <freq>', 'Frequency (realtime, daily, weekly)', 'daily')
  .option('-c, --channels <channels>', 'Channels (email,slack,webhook)', 'email')
  .option('--webhook-url <url>', 'Webhook URL (if webhook channel)')
  .action(async (options: any) => {
    const spinner = ora('Creating follow...').start();
    
    const payload: any = {
      topics: options.topics.split(','),
      sources: options.sources ? options.sources.split(',') : [],
      frequency: options.frequency,
      channels: options.channels.split(','),
    };

    if (options.webhookUrl) {
      payload.webhookUrl = options.webhookUrl;
    }

    try {
      const data = await apiRequest('/follows', {
        method: 'POST',
        data: payload,
      });
      spinner.succeed(`Follow created: ${data.id}`);
      console.log(JSON.stringify(data, null, 2));
    } catch (error) {
      spinner.fail();
      throw error;
    }
  });

followCmd
  .command('delete')
  .description('Delete a follow')
  .requiredOption('--id <id>', 'Follow ID')
  .action(async (options: any) => {
    const spinner = ora('Deleting follow...').start();
    
    try {
      await apiRequest(`/follows/${options.id}`, {
        method: 'DELETE',
      });
      spinner.succeed(`Follow ${options.id} deleted`);
    } catch (error) {
      spinner.fail();
      throw error;
    }
  });

// Brief command
program
  .command('brief')
  .description('Generate a brief summary')
  .option('-p, --period <period>', 'Period (daily, weekly, custom)', 'daily')
  .option('--from <date>', 'Start date (if custom)')
  .option('--to <date>', 'End date (if custom)')
  .option('-t, --topics <topics>', 'Topics to include')
  .option('-f, --format <format>', 'Output format (json, markdown, html)', 'markdown')
  .option('--output <file>', 'Export to file')
  .option('--send-email <email>', 'Send via email')
  .action(async (options: any) => {
    const spinner = ora('Generating brief...').start();
    
    const params = new URLSearchParams();
    params.append('period', options.period);
    if (options.from) params.append('from', options.from);
    if (options.to) params.append('to', options.to);
    if (options.topics) params.append('topics', options.topics);
    params.append('format', options.format);

    try {
      const data = await apiRequest(`/briefs?${params.toString()}`, {
        method: 'POST',
      });
      spinner.succeed();

      if (options.format === 'json') {
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.log(data.content || data.markdown);
      }

      if (options.output) {
        fs.writeFileSync(options.output, data.content || data.markdown);
        console.log(chalk.green(`Brief exported to ${options.output}`));
      }
    } catch (error) {
      spinner.fail();
      throw error;
    }
  });

// Topics commands
const topicsCmd = program.command('topics')
  .description('Manage topics');

topicsCmd
  .command('list')
  .description('List topics')
  .option('--active-only', 'Show only active topics')
  .option('--company <id>', 'Company ID')
  .option('-f, --format <format>', 'Output format (json, table)', 'table')
  .action(async (options: any) => {
    const spinner = ora('Loading topics...').start();
    
    const params = new URLSearchParams();
    if (options.activeOnly) params.append('active', 'true');
    if (options.company) params.append('company', options.company);

    try {
      const data = await apiRequest(`/topics?${params.toString()}`, { method: 'GET' });
      spinner.succeed();

      if (options.format === 'json') {
        console.log(JSON.stringify(data, null, 2));
      } else {
        formatTable(data, [
          { header: 'ID', accessor: (item: any) => item.id?.substring(0, 8) },
          { header: 'Name', accessor: (item: any) => item.name },
          { header: 'Keywords', accessor: (item: any) => item.keywords?.join(', ') },
          { header: 'Status', accessor: (item: any) => item.active ? 'Active' : 'Inactive' },
        ]);
      }
    } catch (error) {
      spinner.fail();
      throw error;
    }
  });

topicsCmd
  .command('create')
  .description('Create a topic')
  .requiredOption('-n, --name <name>', 'Topic name')
  .requiredOption('-k, --keywords <keywords>', 'Keywords (comma-separated)')
  .option('--company <id>', 'Company ID')
  .action(async (options: any) => {
    const spinner = ora('Creating topic...').start();
    
    const payload: any = {
      name: options.name,
      keywords: options.keywords.split(','),
    };
    if (options.company) payload.companyId = options.company;

    try {
      const data = await apiRequest('/topics', {
        method: 'POST',
        data: payload,
      });
      spinner.succeed(`Topic created: ${data.id}`);
      console.log(JSON.stringify(data, null, 2));
    } catch (error) {
      spinner.fail();
      throw error;
    }
  });

// Sources commands
const sourcesCmd = program.command('sources')
  .description('Manage sources');

sourcesCmd
  .command('list')
  .description('List sources')
  .option('-c, --category <category>', 'Category filter')
  .option('-f, --format <format>', 'Output format (json, table)', 'table')
  .action(async (options: any) => {
    const spinner = ora('Loading sources...').start();
    
    const params = new URLSearchParams();
    if (options.category) params.append('category', options.category);

    try {
      const data = await apiRequest(`/sources?${params.toString()}`, { method: 'GET' });
      spinner.succeed();

      if (options.format === 'json') {
        console.log(JSON.stringify(data, null, 2));
      } else {
        formatTable(data, [
          { header: 'Name', accessor: (item: any) => item.name },
          { header: 'Category', accessor: (item: any) => item.category },
          { header: 'URL', accessor: (item: any) => item.url },
        ]);
      }
    } catch (error) {
      spinner.fail();
      throw error;
    }
  });

// Config commands
program.command('doctor')
  .description('Check local configuration without contacting APEX / Vérifier la configuration locale sans réseau / Comprobar la configuración local sin red')
  .action(() => {
    const baseUrl = getBaseUrl();
    let validUrl = false;
    try {
      const parsed = new URL(baseUrl);
      validUrl = ['http:', 'https:'].includes(parsed.protocol);
    } catch { /* Report an invalid URL without echoing its contents. */ }
    const keyPresent = Boolean(getApiKey());
    console.log(`API key / Clé API / Clave API: ${keyPresent ? 'present / présente / presente' : 'missing / absente / ausente'}`);
    console.log(`Base URL / URL de base / URL base: ${validUrl ? 'valid / valide / válida' : 'invalid / invalide / inválida'}`);
    if (!keyPresent || !validUrl) process.exitCode = 2;
  });

const configCmd = program.command('config')
  .description('Manage configuration');

configCmd
  .command('list')
  .description('Show current configuration')
  .action(() => {
    const configs = {
      apiKey: getApiKey() ? '***' + String(getApiKey()).slice(-4) : 'not set',
      baseUrl: getBaseUrl(),
      defaultFormat: config.get('defaultFormat', 'table'),
    };
    console.log('Current configuration:');
    Object.entries(configs).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
  });

configCmd
  .command('set <key> <value>')
  .description('Set a configuration value')
  .action((key: string, value: string) => {
    config.set(key, value);
    const displayValue = key === 'apiKey' ? '***' + value.slice(-4) : value;
    console.log(chalk.green(`Set ${key} = ${displayValue}`));
  });

configCmd
  .command('delete <key>')
  .description('Delete a configuration value')
  .action((key: string) => {
    config.delete(key);
    console.log(chalk.green(`Deleted ${key}`));
  });

configCmd
  .command('reset')
  .description('Reset configuration to defaults')
  .action(() => {
    config.clear();
    console.log(chalk.green('Configuration reset to defaults'));
  });

// Auth commands
const authCmd = program.command('auth')
  .description('Authentication commands');

authCmd
  .command('test')
  .description('Test API key')
  .action(async () => {
    const spinner = ora('Testing API key...').start();
    
    try {
      await apiRequest('/auth/test', { method: 'GET' });
      spinner.succeed('API key is valid');
    } catch (error) {
      spinner.fail('API key is invalid');
      throw error;
    }
  });

authCmd
  .command('whoami')
  .description('Show account information')
  .action(async () => {
    const spinner = ora('Loading account info...').start();
    
    try {
      const data = await apiRequest('/auth/me', { method: 'GET' });
      spinner.succeed();
      console.log(JSON.stringify(data, null, 2));
    } catch (error) {
      spinner.fail();
      throw error;
    }
  });

authCmd
  .command('quota')
  .description('Show quota and rate limits')
  .action(async () => {
    const spinner = ora('Loading quota...').start();
    
    try {
      const data = await apiRequest('/auth/quota', { method: 'GET' });
      spinner.succeed();
      console.log(JSON.stringify(data, null, 2));
    } catch (error) {
      spinner.fail();
      throw error;
    }
  });

// Parse and run
program
  .name('apex')
  .description('APEX CLI - Intelligence platform command line interface')
  .version('1.0.1');

program.parse(process.argv);
