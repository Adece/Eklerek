import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { api } from '../api.js';

export const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription('Show the current Eclesiar server status');

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const data = await api.serverStatus();
    const status = Array.isArray(data) ? data[0] : data;

    const isOk = status.status === 'ok';

    const embed = new EmbedBuilder()
      .setTitle('🌐 Eclesiar Server Status')
      .setColor(isOk ? 0x1d9e75 : 0xe24b4a)
      .addFields(
        {
          name: '⚙️ Status',
          value: isOk ? '🟢 Online' : '🔴 Offline',
          inline: true,
        },
        {
          name: '📦 Version',
          value: status.version ?? 'Unknown',
          inline: true,
        },
        {
          name: '🕐 Server Time',
          value: status.server_time ?? 'Unknown',
          inline: true,
        },
        {
          name: '📅 Server Day',
          value: `Day **${status.server_day}**`,
          inline: true,
        },
        {
          name: '🏰 Server Name',
          value: status.server_name ?? 'Unknown',
          inline: true,
        },
      )
      .setFooter({ text: 'Eclesiar Bot' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply({
      content: `❌ Failed to fetch server status: \`${err.message}\``,
    });
  }
}