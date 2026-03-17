# Eclesiar Discord Bot

A Discord bot for the [Eclesiar](https://eclesiar.com) browser game, built with [discord.js v14](https://discord.js.org/).

## Commands

| Command | Description |
|---|---|
| `/status` | Show current server status, version, time, and day |
| `/war list` | List active wars (paginated, supports normal/event filter) |
| `/war info <war_id>` | Full details + round breakdown for a specific war |
| `/war hits <round_id>` | Hit log for a war round with attacker/defender breakdown |

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Then fill in your `.env`:
- `DISCORD_TOKEN` — from the [Discord Developer Portal](https://discord.com/developers/applications) → Your App → Bot → Token
- `DISCORD_CLIENT_ID` — Your App → General Information → Application ID
- `DISCORD_GUILD_ID` — *(optional)* Right-click your server in Discord → Copy Server ID. Set this for instant command registration during development.

### 3. Deploy slash commands
```bash
npm run deploy
```

### 4. Start the bot
```bash
npm start
```

## Project Structure

```
src/
├── index.js            # Bot entry point, loads commands & handles interactions
├── api.js              # Eclesiar API wrapper (all endpoints)
├── deploy-commands.js  # Registers slash commands with Discord
└── commands/
    ├── status.js       # /status command
    └── war.js          # /war list | info | hits commands
```

## Adding More Commands

1. Create a new file in `src/commands/` (e.g. `player.js`)
2. Export `data` (a `SlashCommandBuilder`) and `execute(interaction)`
3. Run `npm run deploy` to register the new command

The `api.js` file already has wrappers for all Eclesiar endpoints ready to use.
