# APEX CLI

Command-line interface for the APEX intelligence platform. Search publications, manage follows, generate briefs, and automate your regulatory monitoring workflow.

## Installation

### npm (Node.js version)

```bash
# Install globally
npm install -g @apex/cli

# Or use without installation
npx @apex/cli <command>
```

### PyPI (Python version)

```bash
# Install via pip
pip install apex-cli

# Or install in development mode
pip install -e .
```

### From Source

```bash
git clone https://github.com/apex-dev/cli.git
cd cli

# For Node.js
cd cli
npm install
npm link

# For Python
cd python
pip install -e .
```

## Configuration

### 1. Generate an API Key

Visit https://apex.dev/dashboard > Settings > API Keys to generate your API key.

### 2. Configure the CLI

**Option A: Environment Variable (Recommended)**

```bash
export APEX_API_KEY="apex_x...xxxx"
```

Add this line to your `~/.bashrc` or `~/.zshrc` to make it permanent.

**Option B: Configuration File**

```bash
# Node.js and Python
apex config set api-key apex_xxxxxxxxxxxxxxxxx
apex config set base-url http://127.0.0.1:3100/api
```

Configuration is stored in `~/.apex/config.json` (Node.js) or `~/.apex/config.ini` (Python).

**Option C: Pass as Argument**

```bash
apex search --api-key apex_xxxxxxxxxxxxx "RGPD"
```

## Commands

### `apex search` - Search Publications

Search publications in monitored sources.

```bash
apex search [QUERY] [OPTIONS]
```

**Options:**
- `-t, --topics <topics>` - Topics to filter (comma-separated)
- `-s, --sources <sources>` - Sources to filter (comma-separated)
- `--from <date>` - Start date (ISO 8601)
- `--to <date>` - End date (ISO 8601)
- `-l, --limit <n>` - Max results (default: 20)
- `-o, --offset <n>` - Offset for pagination (default: 0)
- `-f, --format <format>` - Output format: json, table, markdown (default: table)
- `--output <file>` - Export to file
- `-v, --verbose` - Verbose mode

**Examples:**

```bash
# Simple search
apex search "RGPD"

# Search with filters
apex search "intelligence artificielle" --topics "tech,regulation" --from 2024-01-01

# Export results
apex search "cybersecurity" --limit 50 --format json --output results.json

# Table format (readable)
apex search "marchés publics" --format table

# Pagination
apex search "ISO 27001" --limit 20 --offset 40
```

### `apex follow` - Manage Follows

Manage your watch configurations.

#### List follows

```bash
apex follow list
apex follow list --format table
```

#### Create a follow

```bash
apex follow create --topics "rgpd,iso27001" --frequency daily --channels email
```

**Options:**
- `-t, --topics <topics>` - Topic IDs (required)
- `-s, --sources <sources>` - Source IDs (optional)
- `-f, --frequency <freq>` - Frequency: realtime, daily, weekly (default: daily)
- `-c, --channels <channels>` - Channels: email, slack, webhook (default: email)
- `--webhook-url <url>` - Webhook URL (if using webhook channel)

**Examples:**

```bash
# Daily email follow
apex follow create --topics "rgpd" --frequency daily --channels email

# Real-time Slack webhook
apex follow create --topics "cybersecurity" --frequency realtime \
  --channels webhook --webhook-url https://hooks.slack.com/xxx

# Weekly multi-topic follow
apex follow create --topics "rgpd,iso27001,nis2" --frequency weekly
```

#### Delete a follow

```bash
apex follow delete --id <FOLLOW_ID>
```

### `apex brief` - Generate Brief

Generate a summary brief of recent publications.

```bash
apex brief [OPTIONS]
```

**Options:**
- `-p, --period <period>` - Period: daily, weekly, custom (default: daily)
- `--from <date>` - Start date (if custom)
- `--to <date>` - End date (if custom)
- `-t, --topics <topics>` - Topics to include
- `-f, --format <format>` - Output format: json, markdown, html (default: markdown)
- `--output <file>` - Export to file
- `--send-email <email>` - Send via email

**Examples:**

```bash
# Daily brief
apex brief --period daily

# Weekly brief in Markdown
apex brief --period weekly --format markdown

# Custom period with export
apex brief --period custom --from 2024-01-01 --to 2024-01-31 \
  --format markdown --output janvier-report.md

# Brief with topic filtering
apex brief --period daily --topics "rgpd,compliance" --format html
```

### `apex topics` - Manage Topics

Manage watch topics.

#### List topics

```bash
apex topics list
apex topics list --active-only
apex topics list --company <COMPANY_ID>
```

#### Create a topic

```bash
apex topics create --name "AI_REGULATION" --keywords "artificial intelligence,EU AI Act,regulation"
```

**Options:**
- `-n, --name <name>` - Topic name (required)
- `-k, --keywords <keywords>` - Keywords (comma-separated, required)
- `--company <id>` - Company ID

#### Delete a topic

```bash
apex topics delete --id <TOPIC_ID>
```

### `apex sources` - Manage Sources

List and manage publication sources.

#### List sources

```bash
apex sources list
apex sources list --category official
```

**Options:**
- `-c, --category <cat>` - Category: official, regulatory, news

#### Get source info

```bash
apex sources info --id <SOURCE_ID>
```

### `apex config` - Configuration

Manage CLI configuration.

```bash
# Show current configuration
apex config list

# Set a value
apex config set api-key apex_xxxxx
apex config set base-url http://127.0.0.1:3100/api
apex config set default-format table

# Delete a value
apex config delete api-key

# Reset configuration
apex config reset
```

### `apex auth` - Authentication

Manage authentication.

```bash
# Test API key
apex auth test

# Show account info
apex auth whoami

# Show quota and rate limits
apex auth quota
```

## Common Workflows

### 1. Set Up Complete Monitoring

```bash
# 1. Configure API key
export APEX_API_KEY="***"

# 2. Create topics
apex topics create --name "RGPD" --keywords "rgpd,gdpr,cnil,protection données"
apex topics create --name "Cybersecurity" --keywords "cybersecurity,anssi,hacking,risques"

# 3. List topics to get IDs
apex topics list --format table

# 4. Create follows
apex follow create --topics "rgpd-topic-id" --frequency daily --channels email
apex follow create --topics "cyber-topic-id" --frequency realtime --channels webhook

# 5. Test with a search
apex search "rgpd" --limit 5 --format table
```

### 2. Automation with Cron

```bash
# Edit crontab
crontab -e

# Add daily task at 8 AM
0 8 * * * apex brief --period daily --format markdown --output /var/reports/apex-daily.md

# Add weekly search every Monday at 9 AM
0 9 * * 1 apex search "regulation" --from monday --format json --output /var/reports/weekly.json
```

### 3. CI/CD Integration

```bash
#!/bin/bash
# .github/workflows/veille-reglementaire.sh

set -e

# Search for new publications
RESULTS=$(apex search "regulation" --from yesterday --format json)

# Count results
COUNT=$(echo $RESULTS | jq '.total')

if [ "$COUNT" -gt 0 ]; then
  echo "📢 $COUNT new publications detected"
  
  # Send Slack notification
  curl -X POST $SLACK_WEBHOOK_URL \
    -H "Content-Type: application/json" \
    -d "{\"text\":\"🚨 $COUNT new regulatory publications detected\"}"
  
  # Generate brief
  apex brief --period daily --format markdown --output brief.md
  
  # Commit and push
  git add brief.md
  git commit -m "Add regulatory brief for $(date +%Y-%m-%d)"
  git push
fi
```

### 4. Real-time Monitoring Pipeline

```bash
#!/bin/bash
# surveillance.sh

TOPICS="rgpd,cybersecurity,compliance"
WEBHOOK="https://hooks.slack.com/services/xxx"

while true; do
  # Search publications from last 5 minutes
  RESULTS=$(apex search --topics "$TOPICS" \
    --from "$(date -d '5 minutes ago' --iso-8601=seconds)" \
    --format json)
  
  COUNT=$(echo $RESULTS | jq '.total')
  
  if [ "$COUNT" -gt 0 ]; then
    echo "📢 Alert: $COUNT new publications"
    
    # Extract titles
    TITLES=$(echo $RESULTS | jq -r '.results[].title')
    
    # Send to Slack
    curl -X POST $WEBHOOK \
      -H "Content-Type: application/json" \
      -d "{\"text\":\"🚨 Regulatory Alerts\\n\\n$TITLES\"}"
  fi
  
  # Wait 5 minutes
  sleep 300
done
```

## Tips and Best Practices

### 1. Use Shell Aliases

Add to your `~/.bashrc`:

```bash
alias apex-search='apex search --format table'
alias apex-brief='apex brief --format markdown'
alias apex-follows='apex follow list --format table'
```

### 2. Combine with Other CLI Tools

```bash
# Pipeline with jq
apex search "RGPD" --format json | jq '.results[].title'

# Pipeline with grep
apex search "regulation" | grep -i "urgency"

# Export to CSV
apex search "compliance" --format json | jq -r '.results[] | [.title, .publishedAt, .url] | @csv' > results.csv
```

### 3. Error Handling

```bash
#!/bin/bash
if ! apex auth test &>/dev/null; then
  echo "❌ Authentication failed. Check your API key."
  exit 1
fi

# Handle rate limits
RESPONSE=$(apex search "test" 2>&1)
if echo "$RESPONSE" | grep -q "429"; then
  echo "⚠ Rate limit reached. Waiting..."
  sleep 60
fi
```

## Troubleshooting

### "API key not provided"

```bash
# Check if variable is set
echo $APEX_API_KEY

# Or configure via CLI
apex config set api-key apex_xxxxx
```

### "Rate limit exceeded"

```bash
# Check quotas
apex auth quota

# Wait for reset (see X-RateLimit-Reset header)
```

## License

MIT License - See LICENSE file for details.

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## October 2026 improvement · Amélioration d’octobre 2026 · Mejora de octubre de 2026

Run `apex doctor` to check whether a key is configured and the base URL is valid, without an API request or revealing the key.

Exécutez `apex doctor` pour vérifier la présence d’une clé et la validité de l’URL de base, sans requête API ni affichage de la clé.

Ejecute `apex doctor` para comprobar si hay una clave configurada y si la URL base es válida, sin solicitud API ni revelar la clave.
