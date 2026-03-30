import 'dotenv/config';
import { EmbedBuilder } from 'discord.js';
import { api } from './api.js';

const INTERVAL_MS = 5 * 60 * 1000;       // check auctions every 5 minutes
const EQUIPMENT_REFRESH_MS = 60 * 60 * 1000; // refresh equipment list every hour

const announcedAuctionIds = new Set();
let highGradeEquipmentIds = new Set();

function normalizeArray(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return [data];
  return [];
}

// ── Fetch all equipment pages and build a Set of grade 4/5 IDs ────────────

async function buildEquipmentIndex() {
  console.log('🔧 Building equipment index (grade 4 & 5)...');
  const found = new Set();
  let page = 1;

  while (true) {
    try {
      const raw = await api.serverEquipments(page);
      const items = normalizeArray(raw);

      if (!items.length) break;

      for (const item of items) {
        if (item.grade >= 4) {
          found.add(item.id);
        }
      }

      // If we got a full page, there might be more
      if (items.length < 10) break;
      page++;
    } catch (err) {
      console.error(`Equipment index error on page ${page}:`, err.message);
      break;
    }
  }

  highGradeEquipmentIds = found;
  console.log(`✅ Equipment index built — ${found.size} high-grade items found (grade 4+)`);
}

// ── Check auctions ─────────────────────────────────────────────────────────

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
        // Only care about equipment type
        if (auction.item.type !== 'equipment') continue;

        // Check if it's a high grade equipment
        if (!highGradeEquipmentIds.has(auction.item.id)) continue;

        // Already announced
        if (announcedAuctionIds.has(auction.id)) continue;

        announcedAuctionIds.add(auction.id);

        // Figure out grade for display
        const grade = getGradeLabel(auction.item.id);

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
                { name: '💰 Starting Bid', value: `${auction.initial_bid.toLocaleString()}`, inline: true },
                { name: '⏰ Ends At', value: `\`${auction.end_at}\``, inline: true },
                { name: '📅 Created At', value: `\`${auction.created_at}\``, inline: true },
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

// Helper to get Q4/Q5 label from the equipment index
function getGradeLabel(equipmentId) {
  // We stored IDs but not grades — we need a map instead
  // This is handled by upgrading highGradeEquipmentIds to a Map below
  const grade = highGradeEquipmentIds.get ? highGradeEquipmentIds.get(equipmentId) : null;
  if (grade === 5) return 'Q5';
  if (grade === 4) return 'Q4';
  return 'Q4+';
}

// ── Start ──────────────────────────────────────────────────────────────────

export async function startAuctionWatcher(client) {
  // Use a Map instead of Set so we can store grade alongside ID
  highGradeEquipmentIds = new Map();

  // Override buildEquipmentIndex to use Map
  console.log('🔧 Building equipment index (grade 4 & 5)...');
  let page = 1;

  while (true) {
    try {
      const raw = await api.serverEquipments(page);
      const items = normalizeArray(raw);

      if (!items.length) break;

      for (const item of items) {
        if (item.grade >= 4) {
          highGradeEquipmentIds.set(item.id, item.grade);
        }
      }

      if (items.length < 10) break;
      page++;
    } catch (err) {
      console.error(`Equipment index error on page ${page}:`, err.message);
      break;
    }
  }

  console.log(`✅ Equipment index built — ${highGradeEquipmentIds.size} high-grade items (grade 4+)`);

  // Refresh equipment index every hour
  setInterval(async () => {
    console.log('🔄 Refreshing equipment index...');
    let p = 1;
    const fresh = new Map();
    while (true) {
      try {
        const raw = await api.serverEquipments(p);
        const items = normalizeArray(raw);
        if (!items.length) break;
        for (const item of items) {
          if (item.grade >= 4) fresh.set(item.id, item.grade);
        }
        if (items.length < 10) break;
        p++;
      } catch (err) {
        console.error(`Equipment refresh error on page ${p}:`, err.message);
        break;
      }
    }
    highGradeEquipmentIds = fresh;
    console.log(`✅ Equipment index refreshed — ${fresh.size} high-grade items`);
  }, EQUIPMENT_REFRESH_MS);

  // Start auction polling
  console.log('🔨 Auction watcher started — checking every 5 minutes');
  checkAuctions(client);
  setInterval(() => checkAuctions(client), INTERVAL_MS);
}