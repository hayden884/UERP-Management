const { Events, ChannelType, EmbedBuilder } = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (err) {
        console.error(err);
        await interaction.reply({ content: '❌ Error executing command.', ephemeral: true });
      }
    }

    if (interaction.isButton()) {
      const [action, targetId] = interaction.customId.split('_');

      if (action === 'acknowledge') {
        const targetUser = await interaction.client.users.fetch(targetId);
        const guild = interaction.guild;

        // Find or create forum channel for this user
        const forumChannel = guild.channels.cache.find(
          ch => ch.type === ChannelType.GuildForum && ch.name.includes(targetUser.username)
        );

        if (forumChannel) {
          const ackEmbed = new EmbedBuilder()
            .setColor(0x2b2d31)
            .setTitle('**Punishment Acknowledgement**')
            .setDescription(`${interaction.user} has acknowledged their punishment.`)
            .setTimestamp();

          await forumChannel.threads.create({
            name: `Punishment — ${targetUser.username}`,
            message: { embeds: [ackEmbed] }
          });

          await interaction.update({ content: '✅ Punishment acknowledged.', components: [] });
        } else {
          await interaction.reply({ content: '❌ Forum channel not found for this user.', ephemeral: true });
        }
      }

      if (action === 'reviewed') {
        await interaction.update({
          components: [
            new (require('discord.js').ActionRowBuilder)().addComponents(
              new (require('discord.js').ButtonBuilder)().setCustomId('done').setLabel('✅ Reviewed by Head Management').setStyle(require('discord.js').ButtonStyle.Success).setDisabled(true)
            )
          ]
        });
      }

      if (action === 'evidence') {
        await interaction.reply({ content: '📎 Evidence request sent to Management Team.', ephemeral: true });
      }

      if (action === 'appeal') {
        await interaction.reply({ content: '📩 Appeal process started — Management Team will contact you.', ephemeral: true });
      }
    }
  }
};
