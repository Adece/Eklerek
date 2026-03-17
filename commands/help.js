import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Show all available bot commands');

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const embed = new EmbedBuilder()
    .setTitle('📖 Eclesiar Bot — Command Reference')
    .setColor(0x534ab7)
    .setDescription('All available commands for the Eclesiar Discord bot.')
    .addFields(
      // ── STATUS ──────────────────────────────────────────────────────
      {
        name: '🌐 `/status`',
        value: 'Shows the current Eclesiar server status, version, server time, and current day.',
      },

      // ── WAR ─────────────────────────────────────────────────────────
      {
        name: '\u200b',
        value: '**⚔️ War Commands**',
      },
      {
        name: '`/war list`',
        value: [
          'Lists all currently active wars.',
          '• `page` *(optional)* — page number for pagination, default `1`',
          '• `type` *(optional)* — `Normal` or `Event` wars, default `Normal`',
        ].join('\n'),
      },
      {
        name: '`/war info <war_id>`',
        value: [
          'Shows full details of a specific war including scores, region, current round, and the last 5 rounds.',
          '• `war_id` *(required)* — the ID of the war (find it with `/war list`)',
        ].join('\n'),
      },
      {
        name: '`/war hits <round_id>`',
        value: [
          'Shows the hit log for a specific war round with attacker/defender breakdown and top damage.',
          '• `round_id` *(required)* — the ID of the round (find it with `/war info`)',
          '• `page` *(optional)* — page number for pagination, default `1`',
        ].join('\n'),
      },

      // ── ALERT ───────────────────────────────────────────────────────
      {
        name: '\u200b',
        value: '**🔔 Alert Commands**',
      },
      {
        name: '`/alert set <war_id> <side>`',
        value: [
          'Starts watching a war every 60 seconds. You\'ll be pinged in the current channel if your chosen side falls behind.',
          '• `war_id` *(required)* — the ID of the war to watch',
          '• `side` *(required)* — the country you want to be winning (e.g. `South Korea`)',
        ].join('\n'),
      },
      {
        name: '`/alert stop <war_id>`',
        value: [
          'Stops watching a war and removes your alert.',
          '• `war_id` *(required)* — the ID of the war to stop watching',
        ].join('\n'),
      },
      {
        name: '`/alert list`',
        value: 'Shows all your currently active alerts — which wars you\'re watching and which side you\'re rooting for.',
      },

      // ── TIPS ────────────────────────────────────────────────────────
      {
        name: '\u200b',
        value: '**💡 Tips**',
      },
      {
        name: 'Typical workflow',
        value: [
          '1. Use `/war list` to find active wars and their IDs',
          '2. Use `/war info <war_id>` to inspect a specific war and get round IDs',
          '3. Use `/war hits <round_id>` to see who dealt damage in a round',
          '4. Use `/alert set <war_id> <side>` to get notified if your side starts losing',
        ].join('\n'),
      },
    )
    .setFooter({ text: 'Eclesiar Bot • Alerts check every 60 seconds' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}