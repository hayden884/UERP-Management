const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dm')
    .setDescription('Send a direct message to a member')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to message')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('message')
        .setDescription('The message to send')
        .setRequired(true))
    .addBooleanOption(option =>
      option.setName('anonymous')
        .setDescription('Send anonymously (true) or show who sent it (false)')
        .setRequired(true)),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const messageContent = interaction.options.getString('message');
    const anonymous = interaction.options.getBoolean('anonymous');

    if (!targetUser) {
      return interaction.reply({ content: '❌ User not found.', ephemeral: true });
    }

    // Build the embed based on anonymous choice
    const dmEmbed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setAuthor({
        name: anonymous
          ? 'Message from the Staff Team'
          : `Message from ${interaction.user.username}`
      })
      .setDescription(messageContent)
      .setTimestamp();

    try {
      await targetUser.send({ embeds: [dmEmbed] });
      await interaction.reply({
        content: `✅ Message sent to ${targetUser.user ? targetUser.user.tag : targetUser.username}`,
        ephemeral: true
      });
    } catch (err) {
      console.error(err);
      await interaction.reply({
        content: '❌ Failed to send DM. User may have DMs disabled.',
        ephemeral: true
      });
    }
  }
};
