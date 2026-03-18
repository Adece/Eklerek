import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { api } from '../api.js';

const userAlerts = new Map();
const watcherIntervals = new Map();
const sentAlerts = new Set();

function normalizeArray(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return [data];
  return [];
}

async function getWarScores(warId) {
  const [rawWar, rawRounds] = await Promise.all([
    api.wars({ war_id: warId, extra_details: 1 }),
    api.warRounds(warId),
  ]);
  const war = normalizeArray(rawWar)[0];
  const rounds = normalizeArray(rawRounds);

  const currentRound = rounds.find((r) => r.id === war?.current_round_id) ?? null;
  const totalAtk = Number(currentRound?.attackers_score ?? 0);
  const totalDef = Number(currentRound?.defenders_score ?? 0);

  return { war, totalAtk, totalDef, currentRound };
}

async function checkAlert(client, userId, warId, side) {
  try {
    const channelId = process.env.BOT_CHANNEL_ID;
    const { war, totalAtk, totalDef } = await getWarScores(warId);
    const alertKey = `${userId}:${warId}`;

    if (!war) {
      const channel = await client.channels.fetch(channelId);
      await channel.send(`<@${userId}> ⚠️ War **#${warId}** no longer exists or has ended. Alert removed.`);
      sentAlerts.delete(alertKey);
      removeAlert(userId, warId);
      return;
    }

    const attackerName = war.attackers.name;
    const defenderName = war.defenders.name;
    const isAttacker = attackerName.toLowerCase() === side.toLowerCase();
    const isDefender = defenderName.toLowerCase() === side.toLowerCase();

    if (!isAttacker && !isDefender) {
      const channel = await client.channels.fetch(channelId);
      await channel.send(`<@${userId}> ⚠️ Country **${side}** is not in war **#${warId}**. Alert removed.`);
      sentAlerts.delete(alertKey);
      removeAlert(userId, warId);
      return;
    }

    const userScore = isAttacker ? totalAtk : totalDef;
    const enemyScore = isAttacker ? totalDef : totalAtk;
    const enemyName = isAttacker ? defenderName : attackerName;

    if (enemyScore > userScore) {
      if (sentAlerts.has(alertKey)) return;

      sentAlerts.add(alertKey);

      const channel = await client.channels.fetch(channelId);
      const total = userScore + enemyScore;
      const pct = total === 0 ? 50 : Math.round((userScore / total) * 20);
      const bar = '█'.repeat(pct) + '░'.repeat(20 - pct);

      await channel.send({
        content: `<@${userId}> 🚨 **Alert! ${enemyName} is winning war #${warId}!**`,
        embeds: [
          new EmbedBuilder()
            .setTitle(`⚔️ War #${warId} — ${attackerName} vs ${defenderName}`)
            .setColor(0xe24b4a)
            .addFields(
              { name: '📍 Region', value: war.region.name, inline: true },
              { name: '🔄 Round', value: `#${war.current_round_number}`, inline: true },
              { name: '\u200b', value: '\u200b', inline: true },
              { name: `✅ Your side (${side})`, value: userScore.toLocaleString(), inline: true },
              { name: `❌ Enemy (${enemyName})`, value: enemyScore.toLocaleString(), inline: true },
              { name: '\u200b', value: '\u200b', inline: true },
              { name: 'Score', value: `⚔️ \`${bar}\` 🛡️` },
            )
            .setFooter({ text: 'Use /alert stop to cancel this alert • Eclesiar Bot' })
            .setTimestamp(),
        ],
      });
    } else {
      if (sentAlerts.has(alertKey)) {
        sentAlerts.delete(alertKey);
        const channel = await client.channels.fetch(channelId);
        await channel.send(`<@${userId}> ✅ **${side} has taken the lead in war #${warId}!** Resuming monitoring.`);
      }
    }
  } catch (err) {
    console.error(`Alert error for user ${userId} war ${warId}:`, err.message);
  }
}

function removeAlert(userId, warId) {
  const alerts = userAlerts.get(userId) ?? [];
  const updated = alerts.filter((a) => a.warId !== warId);

  if (updated.length === 0) {
    userAlerts.delete(userId);
  } else {
    userAlerts.set(userId, updated);
  }

  const stillWatched = [...userAlerts.values()].flat().some((a) => a.warId === warId);
  if (!stillWatched && watcherIntervals.has(warId)) {
    clearInterval(watcherIntervals.get(warId));
    watcherIntervals.delete(warId);
    console.log(`🛑 Stopped watcher for war #${warId} (no more alerts)`);
  }
}

function startWatcher(client, warId) {
  if (watcherIntervals.has(warId)) return;

  const interval = setInterval(async () => {
    const allAlerts = [...userAlerts.values()].flat().filter((a) => a.warId === warId);
    for (const alert of allAlerts) {
      await checkAlert(client, alert.userId, alert.warId, alert.side);
    }
  }, 60_000);

  watcherIntervals.set(warId, interval);
  console.log(`👀 Started watcher for war #${warId}`);
}

export const data = new SlashCommandBuilder()
  .setName('alert')
  .setDescription('Watch a war and get pinged if your side is losing')
  .addSubcommand((sub) =>
    sub
      .setName('set')
      .setDescription('Start watching a war')
      .addIntegerOption((opt) =>
        opt.setName('war_id').setDescription('The war ID to watch').setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName('side').setDescription('The country you want to be winning (e.g. South Korea)').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('stop')
      .setDescription('Stop watching a war')
      .addIntegerOption((opt) =>
        opt.setName('war_id').setDescription('The war ID to stop watching').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('Show all your active alerts')
  );

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const sub = interaction.options.getSubcommand();
  const userId = interaction.user.id;
  const client = interaction.client;

  try {
    if (sub === 'set') {
      const warId = interaction.options.getInteger('war_id');
      const side = interaction.options.getString('side');

      const { war } = await getWarScores(warId);

      if (!war) {
        return interaction.editReply(`❌ War #${warId} not found.`);
      }

      const attackerName = war.attackers.name;
      const defenderName = war.defenders.name;
      const isAttacker = attackerName.toLowerCase() === side.toLowerCase();
      const isDefender = defenderName.toLowerCase() === side.toLowerCase();

      if (!isAttacker && !isDefender) {
        return interaction.editReply(
          `❌ **${side}** is not in war #${warId}.\nCombatants are: **${attackerName}** vs **${defenderName}**`
        );
      }

      const normalizedSide = isAttacker ? attackerName : defenderName;

      const existing = userAlerts.get(userId) ?? [];
      if (existing.some((a) => a.warId === warId)) {
        return interaction.editReply(`⚠️ You already have an alert for war #${warId}. Use \`/alert stop\` first.`);
      }

      userAlerts.set(userId, [...existing, { warId, side: normalizedSide, userId }]);
      startWatcher(client, warId);

      await checkAlert(client, userId, warId, normalizedSide);

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ Alert Set!')
            .setColor(0x1d9e75)
            .addFields(
              { name: '⚔️ War', value: `#${warId} — ${attackerName} vs ${defenderName}`, inline: true },
              { name: '🏳️ Your Side', value: normalizedSide, inline: true },
              { name: '⏱️ Check Interval', value: 'Every 60 seconds', inline: true },
            )
            .setDescription(`You'll be pinged in <#${process.env.BOT_CHANNEL_ID}> if **${normalizedSide}** falls behind.`)
            .setFooter({ text: 'Use /alert stop war_id to cancel' }),
        ],
      });
    }

    if (sub === 'stop') {
      const warId = interaction.options.getInteger('war_id');
      const alerts = userAlerts.get(userId) ?? [];
      const found = alerts.some((a) => a.warId === warId);

      if (!found) {
        return interaction.editReply(`⚠️ You don't have an alert for war #${warId}.`);
      }

      sentAlerts.delete(`${userId}:${warId}`);
      removeAlert(userId, warId);
      return interaction.editReply(`✅ Alert for war **#${warId}** removed.`);
    }

    if (sub === 'list') {
      const alerts = userAlerts.get(userId) ?? [];

      if (!alerts.length) {
        return interaction.editReply('📭 You have no active alerts. Use `/alert set` to add one!');
      }

      const embed = new EmbedBuilder()
        .setTitle('🔔 Your Active Alerts')
        .setColor(0x378add)
        .setFooter({ text: 'Eclesiar Bot • Use /alert stop war_id to cancel' });

      for (const alert of alerts) {
        const alertKey = `${userId}:${alert.warId}`;
        const status = sentAlerts.has(alertKey) ? '🔴 Enemy leading — waiting for comeback' : '🟢 Monitoring';
        embed.addFields({
          name: `War #${alert.warId}`,
          value: `🏳️ Watching: **${alert.side}**\n${status}`,
          inline: true,
        });
      }

      return interaction.editReply({ embeds: [embed] });
    }
  } catch (err) {
    return interaction.editReply(`❌ Error: \`${err.message}\``);
  }
}