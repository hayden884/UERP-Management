const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, AttachmentBuilder } = require('discord.js');

const PUNISHMENT_TYPES = ['timeout', 'mute', 'blacklist', 'demotion', 'ban'];
const LENGTH_OPTIONS = [
  { name: '7 Days', value: '7 Days' },
  { name: '14 Days', value: '14 Days' },
  { name: '21 Days', value: '21 Days' },
  { name: '32 Days', value: '32 Days' },
  { name: '64 Days', value: '64 Days' },
  { name: 'Permanent', value: 'Permanent' }
];

const LOG_CHANNEL_ID = '1548751006773411870';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('punishment issue')
    .setDescription('Issue a punishment to a member')
    .addUserOption(option =>
      option.setName('member')
        .setDescription('The member to punish')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('punishment')
        .setDescription('Type of punishment')
        .setRequired(true)
        .addChoices(...PUNISHMENT_TYPES.map(p => ({ name: p, value: p }))))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for punishment')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('length')
        .setDescription('Duration of punishment')
        .setRequired(true)
        .addChoices(...LENGTH_OPTIONS))
    .addAttachmentOption(option =>
      option.setName('evidence')
        .setDescription('Image or video evidence')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('note')
        .setDescription('Additional notes')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('demotion')
        .setDescription('New rank (if demotion) e.g. Head Management > Management')
        .setRequired(false)),

  async execute(interaction) {
    const targetMember = interaction.options.getMember('member');
    const punishment = interaction.options.getString('punishment');
    const reason = interaction.options.getString('reason');
    const length = interaction.options.getString('length');
    const evidence = interaction.options.getAttachment('evidence');
    const note = interaction.options.getString('note') || 'No additional notes';
    const demotionText = interaction.options.getString('demotion') || 'N/A';

    if (!targetMember) return interaction.reply({ content: '❌ Member not found.', ephemeral: true });

    // --- DM to User ---
    const dmEmbed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle('Union Estate RP Punishment')
      .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'Member', value: `${targetMember.user}`, inline: true },
        { name: 'Issued by', value: `${interaction.user}`, inline: true },
        { name: 'Punishment', value: `**${punishment.toUpperCase()}**`, inline: true },
        { name: 'Length', value: length, inline: true },
        { name: 'Expires', value: `${length} after you acknowledge the punishment`, inline: true },
        { name: 'Reason', value: reason },
        { name: 'Note', value: note },
        { name: 'Demotion Info', value: demotionText }
      )
      .setImage(evidence?.url || null)
      .setTimestamp();

    const dmButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`acknowledge_${targetMember.id}`).setLabel('Acknowledge').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`evidence_${targetMember.id}`).setLabel('Request Evidence').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`appeal_${targetMember.id}`).setLabel('Appeal').setStyle(ButtonStyle.Secondary)
    );

    try {
      await targetMember.send({ embeds: [dmEmbed], components: [dmButtons] });
    } catch (err) {
      console.log('Could not DM user');
    }

    // --- Log Channel Embed ---
    const logEmbed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle(`Punishment - ${punishment}`)
      .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'Member', value: `${targetMember.user}\n(${targetMember.id})`, inline: true },
        { name: 'Issued by', value: `${interaction.user}\n(${interaction.user.id})`, inline: true },
        { name: 'Issued', value: new Date().toLocaleString(), inline: true },
        { name: 'Punishment Issued', value: `**${punishment.toUpperCase()}**` },
        { name: 'Reason', value: reason },
        { name: 'Active For', value: `${length}\nStarts after member acknowledges`, inline: true },
        { name: 'Role Applied', value: punishment === 'demotion' ? demotionText : punishment, inline: true },
        { name: 'Internal Note (Management Team only)', value: `You can appeal this in ${length}.` }
      )
      .setTimestamp();

    if (evidence) logEmbed.setImage(evidence.url);

    const logButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`reviewed_${targetMember.id}`).setLabel('Reviewed by Head Management').setStyle(ButtonStyle.Success)
    );

    const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) await logChannel.send({ embeds: [logEmbed], components: [logButtons] });

    await interaction.reply({ content: `✅ Punishment issued to ${targetMember.user}`, ephemeral: true });
  }
};
