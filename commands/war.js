import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { api } from '../api.js';

export const data = new SlashCommandBuilder()
  .setName('war')
  .setDescription('War tracker for Eclesiar')
  .addSubcommand((sub) =>
    sub
      .setName('list')
      .setDescription('List active wars')
      .addIntegerOption((opt) =>
        opt.setName('page').setDescription('Page number').setMinValue(1).setRequired(false)
      )
      .addIntegerOption((opt) =>
        opt
          .setName('type')
          .setDescription('War type')
          .addChoices(
            { name: 'Normal', value: 0 },
            { name: 'Event', value: 1 }
          )
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('info')
      .setDescription('Show details and rounds of a specific war')
      .addIntegerOption((opt) =>
        opt.setName('war_id').setDescription('The war ID').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('hits')
      .setDescription('Show hits for a specific war round')
      .addIntegerOption((opt) =>
        opt.setName('round_id').setDescription('The war round ID').setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt.setName('page').setDescription('Page number').setMinValue(1).setRequired(false)
      )
  );

// ── Helpers ────────────────────────────────────────────────────────────────

function scoreBar(attackers, defenders) {
  const total = attackers + defenders;
  if (total === 0) return '`─────────────────────`  (no damage yet)';
  const pct = Math.round((attackers / total) * 20);
  const bar = '█'.repeat(pct) + '░'.repeat(20 - pct);
  return `⚔️ \`${bar}\` 🛡️`;
}

function formatScore(n) {
  return Number(n).toLocaleString('en-US');
}

function normalizeArray(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return [data];
  return [];
}

// ── Subcommand handlers ────────────────────────────────────────────────────

async function handleList(interaction) {
  const page = interaction.options.getInteger('page') ?? 1;
  const event_wars = interaction.options.getInteger('type') ?? 0;

  const raw = await api.wars({ page, event_wars, extra_details: 1 });
  const wars = normalizeArray(raw);

  if (!wars.length) {
    return interaction.editReply('📭 No active wars found on this page.');
  }

  const embed = new EmbedBuilder()
    .setTitle(`⚔️ Active Wars — Page ${page}`)
    .setColor(0xd85a30)
    .setFooter({ text: `Eclesiar Bot • Use /war info war_id:<id> for details` })
    .setTimestamp();

  for (const war of wars.slice(0, 8)) {
    const atkScore = Number(war.attackers_score);
    const defScore = Number(war.defenders_score);
    embed.addFields({
      name: `🆔 War #${war.id}  •  Round ${war.current_round_number}`,
      value: [
        `**${war.attackers.name}** ⚔️ vs 🛡️ **${war.defenders.name}**`,
        `📍 Region: **${war.region.name}**`,
        `${scoreBar(atkScore, defScore)}`,
        `⚔️ ${formatScore(atkScore)}  🛡️ ${formatScore(defScore)}`,
        war.flags?.is_revolution ? '🔴 _Revolution war_' : '',
      ]
        .filter(Boolean)
        .join('\n'),
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleInfo(interaction) {
  const war_id = interaction.options.getInteger('war_id');

  const [rawWar, rawRounds] = await Promise.all([
    api.wars({ war_id, extra_details: 1 }),
    api.warRounds(war_id),
  ]);

  const wars = normalizeArray(rawWar);
  const rounds = normalizeArray(rawRounds);
  const war = wars[0];

  if (!war) return interaction.editReply(`❌ War #${war_id} not found.`);

  // Use only the current round's score
  const currentRound = rounds.find((r) => r.id === war.current_round_id) ?? null;
  const atkScore = Number(currentRound?.attackers_score ?? 0);
  const defScore = Number(currentRound?.defenders_score ?? 0);

  const embed = new EmbedBuilder()
    .setTitle(`⚔️ War #${war.id} — ${war.attackers.name} vs ${war.defenders.name}`)
    .setColor(0xd85a30)
    .addFields(
      { name: '📍 Region', value: war.region.name, inline: true },
      { name: '🔄 Current Round', value: `#${war.current_round_number}`, inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: `⚔️ ${war.attackers.name}`, value: formatScore(atkScore), inline: true },
      { name: `🛡️ ${war.defenders.name}`, value: formatScore(defScore), inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: '🔄 Current Round Score', value: scoreBar(atkScore, defScore) },
    )
    .setFooter({ text: `Use /war hits round_id:<id> to see hits • Eclesiar Bot` })
    .setTimestamp();

  const relevantRounds = rounds.filter(
    (r) => r.attackers_score > 0 || r.defenders_score > 0 || r.id === war.current_round_id
  );

  if (relevantRounds.length) {
    const roundLines = relevantRounds
      .slice(-5)
      .map((r) => {
        const atkHero = r.attackers_hero
          ? `MVP: **${r.attackers_hero.username}** (${formatScore(r.attackers_hero.damage)})`
          : 'No hits yet';
        const defHero = r.defenders_hero
          ? `MVP: **${r.defenders_hero.username}** (${formatScore(r.defenders_hero.damage)})`
          : 'No hits yet';
        const isCurrent = r.id === war.current_round_id ? ' ⬅️ current' : '';
        return [
          `**Round #${r.id}**${isCurrent} — ends \`${r.end_date}\``,
          `⚔️ ${formatScore(r.attackers_score)} pts (${atkHero})`,
          `🛡️ ${formatScore(r.defenders_score)} pts (${defHero})`,
        ].join('\n');
      })
      .join('\n\n');

    embed.addFields({
      name: `📋 Rounds (${relevantRounds.length})`,
      value: roundLines,
    });
  } else {
    embed.addFields({
      name: '📋 Rounds',
      value: 'No rounds with damage yet.',
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleHits(interaction) {
  const round_id = interaction.options.getInteger('round_id');
  const page = interaction.options.getInteger('page') ?? 1;

  const raw = await api.warRoundHits(round_id, page);
  const hits = normalizeArray(raw);

  if (!hits.length) {
    return interaction.editReply(`📭 No hits found for round #${round_id} on page ${page}.`);
  }

  const attackerHits = hits.filter((h) => h.side === 'ATTACKER');
  const defenderHits = hits.filter((h) => h.side === 'DEFENDER');

  const topAttacker = [...attackerHits].sort((a, b) => b.damage - a.damage)[0];
  const topDefender = [...defenderHits].sort((a, b) => b.damage - a.damage)[0];

  const totalAtkDmg = attackerHits.reduce((s, h) => s + h.damage, 0);
  const totalDefDmg = defenderHits.reduce((s, h) => s + h.damage, 0);

  const embed = new EmbedBuilder()
    .setTitle(`💥 Round #${round_id} — Hit Log (Page ${page})`)
    .setColor(0xd85a30)
    .addFields(
      {
        name: '⚔️ Attackers',
        value: `Hits: **${attackerHits.length}**\nTotal dmg: **${formatScore(totalAtkDmg)}**\nTop hit: **${formatScore(topAttacker?.damage ?? 0)}** by player #${topAttacker?.fighter.id ?? '?'}`,
        inline: true,
      },
      {
        name: '🛡️ Defenders',
        value: `Hits: **${defenderHits.length}**\nTotal dmg: **${formatScore(totalDefDmg)}**\nTop hit: **${formatScore(topDefender?.damage ?? 0)}** by player #${topDefender?.fighter.id ?? '?'}`,
        inline: true,
      }
    )
    .setFooter({ text: `Eclesiar Bot • Page ${page}` })
    .setTimestamp();

  const recentLines = hits
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10)
    .map(
      (h) =>
        `${h.side === 'ATTACKER' ? '⚔️' : '🛡️'} Player **#${h.fighter.id}** — **${formatScore(h.damage)}** dmg · \`${h.created_at}\``
    )
    .join('\n');

  embed.addFields({ name: '🕐 Recent Hits', value: recentLines });

  await interaction.editReply({ embeds: [embed] });
}

// ── Main execute ────────────────────────────────────────────────────────────

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const sub = interaction.options.getSubcommand();
    if (sub === 'list') return await handleList(interaction);
    if (sub === 'info') return await handleInfo(interaction);
    if (sub === 'hits') return await handleHits(interaction);
  } catch (err) {
    await interaction.editReply({
      content: `❌ Error: \`${err.message}\``,
    });
  }
}