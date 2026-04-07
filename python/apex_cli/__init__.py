"""APEX CLI - Command line interface for APEX intelligence platform."""

import os
import sys
import json
import click
import requests
from tabulate import tabulate
from rich.console import Console
from rich.spinner import Spinner
from datetime import datetime
from pathlib import Path
import configparser

console = Console()

# Configuration
CONFIG_DIR = Path.home() / '.apex'
CONFIG_FILE = CONFIG_DIR / 'config.ini'

DEFAULT_BASE_URL = 'http://127.0.0.1:3100/api'


def get_config():
    """Load configuration from file."""
    config = configparser.ConfigParser()
    if CONFIG_FILE.exists():
        config.read(CONFIG_FILE)
    return config


def get_api_key():
    """Get API key from environment or config."""
    return os.environ.get('APEX_API_KEY') or get_config().get('auth', 'api_key', fallback=None)


def get_base_url():
    """Get base URL from environment or config."""
    return os.environ.get('APEX_BASE_URL') or get_config().get('api', 'base_url', fallback=DEFAULT_BASE_URL)


def api_request(endpoint, method='GET', data=None):
    """Make an API request."""
    api_key = get_api_key()
    base_url = get_base_url()
    
    if not api_key:
        console.print("[red]Error:[/red] API key not provided. Set APEX_API_KEY environment variable or run 'apex config set api-key <key>'")
        sys.exit(1)
    
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }
    
    url = f"{base_url}{endpoint}"
    
    try:
        if method == 'GET':
            response = requests.get(url, headers=headers, params=data)
        elif method == 'POST':
            response = requests.post(url, headers=headers, json=data)
        elif method == 'DELETE':
            response = requests.delete(url, headers=headers)
        else:
            response = requests.request(method, url, headers=headers, json=data)
        
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as e:
        console.print(f"[red]API Error {e.response.status_code}:[/red] {e.response.json().get('message', str(e))}")
        sys.exit(1)
    except requests.exceptions.RequestException as e:
        console.print(f"[red]Request Error:[/red] {e}")
        sys.exit(1)


@click.group()
@click.version_option(version='1.0.0')
def main():
    """APEX CLI - Intelligence platform command line interface."""
    pass


@main.command()
@click.argument('query', required=False)
@click.option('-t', '--topics', help='Topics to filter (comma-separated)')
@click.option('-s', '--sources', help='Sources to filter (comma-separated)')
@click.option('--from', 'from_date', help='Start date (ISO 8601)')
@click.option('--to', 'to_date', help='End date (ISO 8601)')
@click.option('-l', '--limit', default=20, help='Max results')
@click.option('-o', '--offset', default=0, help='Offset for pagination')
@click.option('-f', '--format', 'output_format', type=click.Choice(['json', 'table', 'markdown']), default='table')
@click.option('--output', help='Export to file')
@click.option('-v', '--verbose', is_flag=True, help='Verbose mode')
def search(query, topics, sources, from_date, to_date, limit, offset, output_format, output, verbose):
    """Search publications."""
    if not verbose:
        spinner = Spinner('dots', text='Searching...')
        console.print(spinner)
    
    params = {}
    if query:
        params['q'] = query
    if topics:
        params['topics'] = topics
    if sources:
        params['sources'] = sources
    if from_date:
        params['from'] = from_date
    if to_date:
        params['to'] = to_date
    params['limit'] = limit
    params['offset'] = offset
    
    data = api_request('/publications/search', method='GET', data=params)
    
    if output_format == 'json':
        click.echo(json.dumps(data, indent=2))
    elif output_format == 'markdown':
        for idx, pub in enumerate(data.get('results', []), 1):
            click.echo(f"### {idx}. {pub.get('title', '')}")
            click.echo(f"**Source:** {pub.get('source', '')}  ")
            click.echo(f"**Date:** {pub.get('publishedAt', '')}  ")
            click.echo(f"\n{pub.get('summary', pub.get('excerpt', ''))}\n")
            click.echo(f"[Read more]({pub.get('url', '')})\n")
            click.echo('---\n')
    else:
        table_data = []
        for pub in data.get('results', []):
            title = pub.get('title', '')[:50] + ('...' if len(pub.get('title', '')) > 50 else '')
            date = pub.get('publishedAt', '').split('T')[0] if pub.get('publishedAt') else ''
            source = pub.get('source', '')
            table_data.append([title, date, source])
        
        if table_data:
            click.echo(tabulate(table_data, headers=['Title', 'Date', 'Source'], tablefmt='grid'))
            click.echo(click.style(f"\nTotal: {data.get('total', 0)} results", fg='green'))
        else:
            click.echo("No results found.")
    
    if output:
        with open(output, 'w') as f:
            if output_format == 'json':
                json.dump(data, f, indent=2)
            else:
                json.dump(data.get('results', []), f, indent=2)
        console.print(f"[green]Results exported to {output}[/green]")


@main.group()
def follow():
    """Manage follow configurations."""
    pass


@follow.command('list')
@click.option('-f', '--format', 'output_format', type=click.Choice(['json', 'table']), default='table')
def follow_list(output_format):
    """List active follows."""
    spinner = Spinner('dots', text='Loading follows...')
    console.print(spinner)
    
    data = api_request('/follows', method='GET')
    
    if output_format == 'json':
        click.echo(json.dumps(data, indent=2))
    else:
        table_data = []
        for item in data:
            table_data.append([
                item.get('id', '')[:8],
                ', '.join([t.get('name', t) if isinstance(t, dict) else t for t in item.get('topics', [])]),
                item.get('frequency', ''),
                ', '.join(item.get('channels', [])),
                'Active' if item.get('active') else 'Inactive',
            ])
        
        if table_data:
            click.echo(tabulate(table_data, headers=['ID', 'Topics', 'Frequency', 'Channels', 'Status'], tablefmt='grid'))
        else:
            click.echo("No follows found.")


@follow.command()
@click.option('-t', '--topics', required=True, help='Topic IDs (comma-separated)')
@click.option('-s', '--sources', help='Source IDs (comma-separated)')
@click.option('-f', '--frequency', type=click.Choice(['realtime', 'daily', 'weekly']), default='daily')
@click.option('-c', '--channels', default='email', help='Channels (email,slack,webhook)')
@click.option('--webhook-url', help='Webhook URL (if webhook channel)')
def create(topics, sources, frequency, channels, webhook_url):
    """Create a new follow."""
    spinner = Spinner('dots', text='Creating follow...')
    console.print(spinner)
    
    payload = {
        'topics': topics.split(','),
        'sources': sources.split(',') if sources else [],
        'frequency': frequency,
        'channels': channels.split(','),
    }
    
    if webhook_url:
        payload['webhookUrl'] = webhook_url
    
    data = api_request('/follows', method='POST', data=payload)
    console.print(f"[green]Follow created: {data.get('id')}[/green]")
    click.echo(json.dumps(data, indent=2))


@follow.command()
@click.option('--id', 'follow_id', required=True, help='Follow ID')
def delete(follow_id):
    """Delete a follow."""
    spinner = Spinner('dots', text='Deleting follow...')
    console.print(spinner)
    
    api_request(f'/follows/{follow_id}', method='DELETE')
    console.print(f"[green]Follow {follow_id} deleted[/green]")


@main.command()
@click.option('-p', '--period', type=click.Choice(['daily', 'weekly', 'custom']), default='daily')
@click.option('--from', 'from_date', help='Start date (if custom)')
@click.option('--to', 'to_date', help='End date (if custom)')
@click.option('-t', '--topics', help='Topics to include')
@click.option('-f', '--format', 'output_format', type=click.Choice(['json', 'markdown', 'html']), default='markdown')
@click.option('--output', help='Export to file')
@click.option('--send-email', help='Send via email')
def brief(period, from_date, to_date, topics, output_format, output, send_email):
    """Generate a brief summary."""
    spinner = Spinner('dots', text='Generating brief...')
    console.print(spinner)
    
    params = {
        'period': period,
        'format': output_format,
    }
    if from_date:
        params['from'] = from_date
    if to_date:
        params['to'] = to_date
    if topics:
        params['topics'] = topics
    if send_email:
        params['sendEmail'] = send_email
    
    data = api_request('/briefs', method='POST', data=params)
    
    if output_format == 'json':
        click.echo(json.dumps(data, indent=2))
    else:
        click.echo(data.get('content', data.get('markdown', '')))
    
    if output:
        with open(output, 'w') as f:
            f.write(data.get('content', data.get('markdown', '')))
        console.print(f"[green]Brief exported to {output}[/green]")


@main.group()
def topics():
    """Manage topics."""
    pass


@topics.command('list')
@click.option('--active-only', is_flag=True, help='Show only active topics')
@click.option('--company', help='Company ID')
@click.option('-f', '--format', 'output_format', type=click.Choice(['json', 'table']), default='table')
def topics_list(active_only, company, output_format):
    """List topics."""
    spinner = Spinner('dots', text='Loading topics...')
    console.print(spinner)
    
    params = {}
    if active_only:
        params['active'] = 'true'
    if company:
        params['company'] = company
    
    data = api_request('/topics', method='GET', data=params)
    
    if output_format == 'json':
        click.echo(json.dumps(data, indent=2))
    else:
        table_data = []
        for item in data:
            table_data.append([
                item.get('id', '')[:8],
                item.get('name', ''),
                ', '.join(item.get('keywords', [])),
                'Active' if item.get('active') else 'Inactive',
            ])
        
        if table_data:
            click.echo(tabulate(table_data, headers=['ID', 'Name', 'Keywords', 'Status'], tablefmt='grid'))
        else:
            click.echo("No topics found.")


@topics.command()
@click.option('-n', '--name', required=True, help='Topic name')
@click.option('-k', '--keywords', required=True, help='Keywords (comma-separated)')
@click.option('--company', help='Company ID')
def create(name, keywords, company):
    """Create a topic."""
    spinner = Spinner('dots', text='Creating topic...')
    console.print(spinner)
    
    payload = {
        'name': name,
        'keywords': keywords.split(','),
    }
    if company:
        payload['companyId'] = company
    
    data = api_request('/topics', method='POST', data=payload)
    console.print(f"[green]Topic created: {data.get('id')}[/green]")
    click.echo(json.dumps(data, indent=2))


@main.group()
def sources():
    """Manage sources."""
    pass


@sources.command('list')
@click.option('-c', '--category', help='Category filter')
@click.option('-f', '--format', 'output_format', type=click.Choice(['json', 'table']), default='table')
def sources_list(category, output_format):
    """List sources."""
    spinner = Spinner('dots', text='Loading sources...')
    console.print(spinner)
    
    params = {}
    if category:
        params['category'] = category
    
    data = api_request('/sources', method='GET', data=params)
    
    if output_format == 'json':
        click.echo(json.dumps(data, indent=2))
    else:
        table_data = []
        for item in data:
            table_data.append([
                item.get('name', ''),
                item.get('category', ''),
                item.get('url', ''),
            ])
        
        if table_data:
            click.echo(tabulate(table_data, headers=['Name', 'Category', 'URL'], tablefmt='grid'))
        else:
            click.echo("No sources found.")


@main.group()
def config():
    """Manage configuration."""
    pass


@config.command('list')
def config_list():
    """Show current configuration."""
    config = get_config()
    api_key = get_api_key()
    base_url = get_base_url()
    
    click.echo("Current configuration:")
    click.echo(f"  apiKey: {'***' + api_key[-4:] if api_key else 'not set'}")
    click.echo(f"  baseUrl: {base_url}")
    click.echo(f"  defaultFormat: {config.get('cli', 'default_format', fallback='table')}")


@config.command()
@click.argument('key')
@click.argument('value')
def set(key, value):
    """Set a configuration value."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    config = get_config()
    
    section = 'auth' if key == 'apiKey' else 'api' if key in ['baseUrl', 'base_url'] else 'cli'
    if section not in config:
        config[section] = {}
    
    config[section][key] = value
    
    with open(CONFIG_FILE, 'w') as f:
        config.write(f)
    
    display_value = '***' + value[-4:] if key == 'apiKey' else value
    console.print(f"[green]Set {key} = {display_value}[/green]")


@config.command()
@click.argument('key')
def delete(key):
    """Delete a configuration value."""
    config = get_config()
    
    for section in config.sections():
        if config.has_option(section, key):
            config.remove_option(section, key)
    
    with open(CONFIG_FILE, 'w') as f:
        config.write(f)
    
    console.print(f"[green]Deleted {key}[/green]")


@config.command()
def reset():
    """Reset configuration to defaults."""
    if CONFIG_FILE.exists():
        CONFIG_FILE.unlink()
    console.print("[green]Configuration reset to defaults[/green]")


@main.group()
def auth():
    """Authentication commands."""
    pass


@auth.command()
def test():
    """Test API key."""
    spinner = Spinner('dots', text='Testing API key...')
    console.print(spinner)
    
    api_request('/auth/test', method='GET')
    console.print("[green]API key is valid[/green]")


@auth.command()
def whoami():
    """Show account information."""
    spinner = Spinner('dots', text='Loading account info...')
    console.print(spinner)
    
    data = api_request('/auth/me', method='GET')
    click.echo(json.dumps(data, indent=2))


@auth.command()
def quota():
    """Show quota and rate limits."""
    spinner = Spinner('dots', text='Loading quota...')
    console.print(spinner)
    
    data = api_request('/auth/quota', method='GET')
    click.echo(json.dumps(data, indent=2))


if __name__ == '__main__':
    main()
