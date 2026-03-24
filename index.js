import 'dotenv/config';
import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import { readdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { startWarWatcher } from './warWatcher.js';
import { startCentralismWatcher } from './centralismWatcher.js';
import { startAuctionWatcher } from './auctionWatcher.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

// ── Load commands ──────────────────────────────────────────────────────────

const commandFiles = readdirSync(join(__dirname, 'commands')).filter((f) => f.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = pathToFileURL(join(__dirname, 'commands', file)).href;
  const command = await import(filePath);

  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    console.log(`✅ Loaded command: /${command.data.name}`);
  } else {
    console.warn(`⚠️  Skipping ${file} — missing "data" or "execute"`);
  }
}

// ── Events ─────────────────────────────────────────────────────────────────

client.once(Events.ClientReady, (c) => {
  console.log(`\n🤖 Logged in as ${c.user.tag}`);
  console.log(`📡 Serving ${c.guilds.cache.size} server(s)`);
  startWarWatcher(client);
  startCentralismWatcher(client);
  startAuctionWatcher(client);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Error in /${interaction.commandName}:`, err);
    const reply = { content: '❌ An unexpected error occurred.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

// ── Start ──────────────────────────────────────────────────────────────────

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ DISCORD_TOKEN is not set. Add it to your .env file.');
  process.exit(1);
}

client.login(token);
