import { api } from './api.js';

const WATCH_COUNTRY = process.env.WATCH_COUNTRY || 'South Korea';
const CHANNEL_ID = process.env.WATCH_CHANNEL_ID;
const ROLE_ID = process.env.PING_ROLE_ID;
const INTERVAL_MS = 60_000;

const announcedWarIds = new Set();

async function checkWars(client) {
  if (!CHANNEL_ID || !ROLE_ID) {
    console.warn('⚠️  WATCH_CHANNEL_ID or PING_ROLE_ID not set — war watcher disabled.');
    return;
  }

  try {
    const wars = await api.wars({ extra_details: 1 });

    for (const war of wars) {
      if (announcedWarIds.has(war.id)) continue;

      const attackerMatch = war.attackers.name === WATCH_COUNTRY;
      const defenderMatch = war.defenders.name === WATCH_COUNTRY;

      if (!attackerMatch && !defenderMatch) continue;

      announcedWarIds.add(war.id);

      const channel = await client.channels.fetch(CHANNEL_ID);
      if (!channel) continue;

      const side = attackerMatch ? '⚔️ Attacking' : '🛡️ Defending';
      const opponent = attackerMatch ? war.defenders.name : war.attackers.name;

      await channel.send(
        `<@&${ROLE_ID}> 🚨 **${WATCH_COUNTRY} is at war!**\n` +
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
  // Run once immediately, then on interval
  checkWars(client);
  setInterval(() => checkWars(client), INTERVAL_MS);
}