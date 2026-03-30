import 'dotenv/config';
import { EmbedBuilder } from 'discord.js';
import { api } from './api.js';

const INTERVAL_MS = 5 * 60 * 1000;
const EQUIPMENT_REFRESH_MS = 60 * 60 * 1000;

const announcedAuctionIds = new Set();
let highGradeEquipmentIds = new Map(); // id -> { grade, ...stats }

function normalizeArray(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return [data];
  return [];
}

// Stat fields to display (skips avatar, id, drop_category)
const STAT_LABELS = {
  slot: 'Slot',
  critical_chance: 'Critical Chance',
  critical_hit: 'Critical Hit',
  damage_percentage: 'Damage %',
  true_damage: 'True Damage',
  flatland_damage_percentage: 'Flatland Damage %',
  mountains_damage_percentage: 'Mountains Damage %',
  forest_damage_percentage: 'Forest Damage %',
  desert_damage_percentage: 'Desert Damage %',
  accuracy: 'Accuracy',
  drop_chance: 'Drop Chance',
  construction_percentage: 'Construction %',
  hospital_construction_percentage: 'Hospital Construction %',
  militarybase_construction_percentage: 'Military Base Construction %',
  productionfields_construction_percentage: 'Production Fields Construction %',
  industrialzone_construction_percentage: 'Industrial Zone Construction %',
  construction_item_donation_percentage: 'Construction Item Donation %',
  mining_gold_percentage: 'Mining Gold %',
  construction_energy_reduction_percentage: 'Construction Energy Reduction %',
};

function buildStatsText(equipment) {
  const lines = [];
  for (const [key, label] of Object.entries(STAT_LABELS)) {
    const value = equipment[key];
    if (value !== undefined && value !== null && value !== 0) {
      lines.push(`• **${label}:** ${value}`);
    }
  }
  return lines.length ? lines.join('\n') : 'No notable stats.';
}

async function buildEquipmentIndex() {
  console.log('🔧 Building equipment index (grade 4 & 5)...');
  let page = 1;
  const fresh = new Map();

  while (true) {
    try {
      const raw = await api.serverEquipments(page);
      const items = normalizeArray(raw);

      if (!items.length) break;

      for (const item of items) {
        if (item.grade >= 4) {
          fresh.set(item.id, item); // store full item object
        }
      }

      if (items.length < 10) break;
      page++;
    } catch (err) {
      console.error(`Equipment index error on page ${page}:`, err.message);
      break;
    }
  }

  highGradeEquipmentIds = fresh;
  console.log(`✅ Equipment index built — ${fresh.size} high-grade items (grade 4+)`);
}

async function checkAuctions(client) {
  const channelId = process.env.BOT_CHANNEL_ID;
  const roleId = process.env.AUCTION_ROLE_ID;

  if (!channelId || !roleId) {
    console.warn('⚠️  BOT_CHANNEL_ID or AUCTION_ROLE_ID not set — auction watcher disabled.');
    return;
  }

  if (highGradeEquipmentIds.size === 0) {
    console.warn('⚠️  Equipment index is empty, skipping auction check.');
    return;
  }

  try {
    let page = 1;

    while (true) {
      const raw = await api.auctions(0, page);
      const auctions = normalizeArray(raw);

      if (!auctions.length) break;

      const channel = await client.channels.fetch(channelId);

      for (const auction of auctions) {
        if (auction.item.type !== 'equipment') continue;
        if (!highGradeEquipmentIds.has(auction.item.id)) continue;
        if (announcedAuctionIds.has(auction.id)) continue;

        announcedAuctionIds.add(auction.id);

        const equipment = highGradeEquipmentIds.get(auction.item.id);
        const grade = equipment.grade === 5 ? 'Q5' : 'Q4';
        const statsText = buildStatsText(equipment);

        await channel.send({
          content: `<@&${roleId}> 🔨 **High-grade equipment auction detected!**`,
          embeds: [
            new EmbedBuilder()
              .setTitle(`🏆 Auction #${auction.id} — ${grade} Equipment`)
              .setColor(grade === 'Q5' ? 0xef9f27 : 0x378add)
              .addFields(
                { name: '🆔 Auction ID', value: `#${auction.id}`, inline: true },
                { name: '⚙️ Equipment ID', value: `#${auction.item.id}`, inline: true },
                { name: '🏅 Grade', value: grade, inline: true },
                { name: '💰 Starting Bid', value: auction.initial_bid.toLocaleString(), inline: true },
                { name: '⏰ Ends At', value: `\`${auction.end_at}\``, inline: true },
                { name: '📦 Drop Category', value: equipment.drop_category ?? 'Unknown', inline: true },
                { name: '📊 Stats', value: statsText },
              )
              .setFooter({ text: 'Eclesiar Bot • Auction Watcher' })
              .setTimestamp(),
          ],
        });

        console.log(`📢 Auction alert sent for auction #${auction.id} (equipment #${auction.item.id} ${grade})`);
      }

      if (auctions.length < 10) break;
      page++;
    }
  } catch (err) {
    console.error('Auction watcher error:', err.message);
  }
}

export async function startAuctionWatcher(client) {
  await buildEquipmentIndex();

  setInterval(async () => {
    console.log('🔄 Refreshing equipment index...');
    await buildEquipmentIndex();
  }, EQUIPMENT_REFRESH_MS);

  console.log('🔨 Auction watcher started — checking every 5 minutes');
  checkAuctions(client);
  setInterval(() => checkAuctions(client), INTERVAL_MS);
}