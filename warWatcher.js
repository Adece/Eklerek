import 'dotenv/config';
import { api } from './api.js';

const WATCH_COUNTRY = process.env.WATCH_COUNTRY || 'South Korea';
const INTERVAL_MS = 60_000;

const announcedWarIds = new Set();

function normalizeArray(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return [data];
  return [];
}

async function checkWars(client) {
  const channelId = process.env.BOT_CHANNEL_ID;

  if (!channelId) {
    console.warn('⚠️  BOT_CHANNEL_ID not set — war watcher disabled.');
    return;
  }

  try {
    const wars = await api.wars({ extra_details: 1 });
    const warList = normalizeArray(wars);

    for (const war of warList) {
      if (announcedWarIds.has(war.id)) continue;

      const attackerMatch = war.attackers.name === WATCH_COUNTRY;
      const defenderMatch = war.defenders.name === WATCH_COUNTRY;

      if (!attackerMatch && !defenderMatch) continue;

      announcedWarIds.add(war.id);

      const channel = await client.channels.fetch(channelId);
      if (!channel) continue;

      const side = attackerMatch ? '⚔️ Attacking' : '🛡️ Defending';
      const opponent = attackerMatch ? war.defenders.name : war.attackers.name;

      await channel.send(
        `🚨 **${WATCH_COUNTRY} is at war!**\n` +
        `${side} against **${opponent}** in **${war.region.name}**\n` +
        `War ID: \`${war.id}\` • Round **${war.current_round_number}**\n` +
        `Use \`/war info war_id:${war.id}\` for details.`
      );

      console.log(`📢 Announced war #${war.id} (${WATCH_COUNTRY} vs ${opponent})`);
    }
  } catch (err) {
    console.error('War watcher error:', err.message);
  }
}

export function startWarWatcher(client) {
  console.log(`👀 War watcher started — watching for ${WATCH_COUNTRY} every ${INTERVAL_MS / 1000}s`);
  checkWars(client);
  setInterval(() => checkWars(client), INTERVAL_MS);
}