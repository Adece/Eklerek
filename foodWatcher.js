import 'dotenv/config';
import { EmbedBuilder } from 'discord.js';
import { api } from './api.js';

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const COUNTRY_ID = 45; // South Korea
const TRUSTED_OWNER_IDS = new Set([150, 676]);
const ITEMS = [
  { id: 2, label: 'Food Q2' },
  { id: 3, label: 'Food Q3' },
];

// Tracks which items have already been alerted — resets when trusted owner takes back the lowest offer
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

      // Sort by value ascending to find the lowest offer
      const sorted = [...offers].sort((a, b) => a.value - b.value);
      const lowest = sorted[0];
      const lowestOwnerId = lowest.owner.id;
      const isTrusted = TRUSTED_OWNER_IDS.has(lowestOwnerId);
      const alertKey = `item:${item.id}`;

      if (!isTrusted) {
        // Untrusted owner has the lowest offer — alert if not already sent
        if (alertedItems.has(alertKey)) continue;

        alertedItems.add(alertKey);

        // Build offer list (top 5)
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
              .setTitle(`🍞 ${item.label} Market Alert — South Korea`)
              .setColor(0xe24b4a)
              .setDescription(`The lowest offer for **${item.label}** is no longer from a trusted owner.`)
              .addFields(
                { name: '📦 Item', value: item.label, inline: true },
                { name: '💰 Lowest Price', value: `**${lowest.value}**`, inline: true },
                { name: '👤 Owner', value: `${lowest.owner.type} #${lowestOwnerId}`, inline: true },
                { name: '📊 Top 5 Offers', value: offerLines },
              )
              .setFooter({ text: 'Eclesiar Bot • Food Watcher • ✅ = trusted owner' })
              .setTimestamp(),
          ],
        });

        console.log(`📢 Food alert sent for ${item.label} — lowest offer by owner #${lowestOwnerId} (untrusted)`);

      } else {
        // Trusted owner is back on top — reset alert
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
  console.log('🍞 Food watcher started — checking every 5 minutes');
  checkFood(client);
  setInterval(() => checkFood(client), INTERVAL_MS);
}