import 'dotenv/config';
import { EmbedBuilder } from 'discord.js';
import { api } from './api.js';

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const alertedCountries = new Set();

function normalizeArray(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return [data];
  return [];
}

async function checkCentralism(client) {
  const channelId = process.env.BOT_CHANNEL_ID;
  const roleId = process.env.GOV_ROLE_ID;

  if (!channelId || !roleId) {
    console.warn('⚠️  BOT_CHANNEL_ID or GOV_ROLE_ID not set — centralism watcher disabled.');
    return;
  }

  try {
    const raw = await api.countries();
    const countries = normalizeArray(raw);
    const channel = await client.channels.fetch(channelId);

    for (const country of countries) {
      const centralism = country.ideology_share?.centralism ?? 0;
      const countryId = country.id;

      if (centralism >= 50) {
        if (alertedCountries.has(countryId)) continue;

        alertedCountries.add(countryId);

        const ideologyLines = Object.entries(country.ideology_share)
          .sort((a, b) => b[1] - a[1])
          .map(([ideology, value]) => {
            const bars = Math.round(value / 5);
            const bar = '█'.repeat(bars) + '░'.repeat(20 - bars);
            const highlight = ideology === 'centralism' ? ' ⬅️' : '';
            return `\`${bar}\` **${value}%** ${ideology.charAt(0).toUpperCase() + ideology.slice(1)}${highlight}`;
          })
          .join('\n');

        await channel.send({
          content: `<@&${roleId}> 🚨 **${country.name} has reached high centralism!**`,
          embeds: [
            new EmbedBuilder()
              .setTitle(`🏛️ ${country.name} — Centralism Alert`)
              .setColor(0x534ab7)
              .setDescription(`**${country.name}** has reached **${centralism}% centralism** — at or above the 50% threshold.`)
              .addFields(
                { name: '💰 Currency', value: country.currency.name, inline: true },
                { name: '📊 Centralism', value: `**${centralism}%**`, inline: true },
                { name: '\u200b', value: '\u200b', inline: true },
                {
                  name: '⚖️ Laws',
                  value: [
                    `Work tax: **${country.laws.work_tax}%**`,
                    `VAT: **${country.laws.vat}%**`,
                    `Import taxes: **${country.laws.import_taxes}%**`,
                    `Minimum wage: **${country.laws.minimum_wage}**`,
                  ].join('\n'),
                  inline: true,
                },
                { name: '🗳️ Ideology Breakdown', value: ideologyLines },
              )
              .setFooter({ text: 'Eclesiar Bot • Centralism Watcher' })
              .setTimestamp(),
          ],
        });

        console.log(`📢 Centralism alert sent for ${country.name} (${centralism}%)`);

      } else {
        if (alertedCountries.has(countryId)) {
          alertedCountries.delete(countryId);
          console.log(`✅ ${country.name} centralism dropped below 50% (${centralism}%) — reset`);
        }
      }
    }
  } catch (err) {
    console.error('Centralism watcher error:', err.message);
  }
}

export function startCentralismWatcher(client) {
  console.log('🏛️  Centralism watcher started — checking every 5 minutes');
  checkCentralism(client);
  setInterval(() => checkCentralism(client), INTERVAL_MS);
}