import 'dotenv/config';
import { EmbedBuilder } from 'discord.js';
import { api } from './api.js';

const INTERVAL_MS = 5 * 60 * 1000;
const COUNTRY_ID = 45;
const TRUSTED_OWNER_IDS = new Set([150, 676]);
const ITEMS = [
  { id: 1, label: 'Grain' },
  { id: 2, label: 'Food Q2' },
  { id: 3, label: 'Food Q3' },
  { id: 7, label: 'Iron' },
  { id: 13, label: 'Fuel' },
  { id: 19, label: 'Titanium' },
];

const alertedItems = new Set();

function normalizeArray(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return [data];
  return [];
}

async function checkFood(client) {
  const channelId = process.env.BOT_CHANNEL_ID;
  const roleId = process.env.FOOD_ROLE_ID;

  if (!channelId || !roleId) {
    console.warn('⚠️  BOT_CHANNEL_ID or FOOD_ROLE_ID not set — food watcher disabled.');
    return;
  }

  try {
    const channel = await client.channels.fetch(channelId);

    for (const item of ITEMS) {
      const raw = await api.marketItems(COUNTRY_ID, item.id);
      const offers = normalizeArray(raw);

      if (!offers.length) continue;

      const sorted = [...offers].sort((a, b) => a.value - b.value);
      const lowest = sorted[0];
      const lowestOwnerId = lowest.owner.id;
      const isTrusted = TRUSTED_OWNER_IDS.has(lowestOwnerId);
      const alertKey = `item:${item.id}`;

      if (!isTrusted) {
        if (alertedItems.has(alertKey)) continue;

        alertedItems.add(alertKey);

        const offerLines = sorted
          .slice(0, 5)
          .map((o, i) => {
            const trusted = TRUSTED_OWNER_IDS.has(o.owner.id) ? ' ✅' : ' ⚠️';
            return `${i + 1}. **${o.value}** x${o.amount} — ${o.owner.type} #${o.owner.id}${trusted}`;
          })
          .join('\n');

        await channel.send({
          content: `<@&${roleId}> ⚠️ **${item.label} lowest offer is not from a trusted owner!**`,
          embeds: [
            new EmbedBuilder()
              .setTitle(`🏪 ${item.label} Market Alert — South Korea`)
              .setColor(0xe24b4a)
              .setDescription(`The lowest offer for **${item.label}** is no longer from a trusted owner.`)
              .addFields(
                { name: '📦 Item', value: item.label, inline: true },
                { name: '💰 Lowest Price', value: `**${lowest.value}**`, inline: true },
                { name: '👤 Owner', value: `${lowest.owner.type} #${lowestOwnerId}`, inline: true },
                { name: '📊 Top 5 Offers', value: offerLines },
              )
              .setFooter({ text: 'Eclesiar Bot • Market Watcher • ✅ = trusted owner' })
              .setTimestamp(),
          ],
        });

        console.log(`📢 Market alert sent for ${item.label} — lowest offer by owner #${lowestOwnerId} (untrusted)`);

      } else {
        if (alertedItems.has(alertKey)) {
          alertedItems.delete(alertKey);

          await channel.send(
            `✅ **${item.label}** lowest offer is back to a trusted owner (**#${lowestOwnerId}** at **${lowest.value}**). Resuming monitoring.`
          );

          console.log(`✅ ${item.label} lowest offer back to trusted owner #${lowestOwnerId}`);
        }
      }
    }
  } catch (err) {
    console.error('Food watcher error:', err.message);
  }
}

export function startFoodWatcher(client) {
  console.log('🍞 Market watcher started — checking every 5 minutes');
  checkFood(client);
  setInterval(() => checkFood(client), INTERVAL_MS);
}