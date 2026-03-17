import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID; // optional — set for guild-only deploy (instant)

if (!token || !clientId) {
  console.error('❌ Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in environment.');
  process.exit(1);
}

const commands = [];
const commandFiles = readdirSync(join(__dirname, 'commands')).filter((f) => f.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = pathToFileURL(join(__dirname, 'commands', file)).href;
  const command = await import(filePath);
  if ('data' in command) {
    commands.push(command.data.toJSON());
    console.log(`📦 Queued: /${command.data.name}`);
  }
}

const rest = new REST().setToken(token);

try {
  console.log(`\n🚀 Deploying ${commands.length} slash command(s)...`);

  let data;
  if (guildId) {
    // Guild deploy — shows up instantly, great for testing
    data = await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log(`✅ Deployed to guild ${guildId} (${data.length} commands)`);
  } else {
    // Global deploy — takes up to 1 hour to propagate
    data = await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log(`✅ Deployed globally (${data.length} commands) — may take up to 1 hour`);
  }
} catch (err) {
  console.error('❌ Deployment failed:', err);
}
