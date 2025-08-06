const { Client, Interaction, ApplicationCommandOptionType, PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: 'timeout',
  description: 'Timeout a user.',
  options: [
    {
      name: 'user',
      description: 'The user you want to timeout.',
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: 'duration',
      description: 'Timeout duration in minutes (5, 30, 60, etc).',
      type: ApplicationCommandOptionType.Integer,
      required: true,
      min_value: 1,
      max_value: 40320 // 28 jours en minutes
    },
    {
      name: 'reason',
      description: 'The reason for the timeout.',
      type: ApplicationCommandOptionType.String,
    },
  ],
  permissionsRequired: [PermissionFlagsBits.MuteMembers],
  botPermissions: [PermissionFlagsBits.MuteMembers],

  /**
   * @param {Client} client
   * @param {Interaction} interaction
   */
  callback: async (client, interaction) => {
    try {
      const targetUser = interaction.options.getUser('user');
      const durationInMinutes = interaction.options.getInteger('duration');
      const reason = interaction.options.getString('reason') || 'No reason provided';

      await interaction.deferReply();

      // Récupérer le membre du serveur
      let targetMember;
      try {
        targetMember = await interaction.guild.members.fetch(targetUser.id);
      } catch (error) {
        return interaction.editReply("That user doesn't exist in this server.");
      }

      // Vérifications de sécurité
      if (targetUser.bot) {
        return interaction.editReply("I can't timeout a bot.");
      }

      if (targetUser.id === interaction.user.id) {
        return interaction.editReply("You can't timeout yourself.");
      }

      if (targetUser.id === interaction.guild.ownerId) {
        return interaction.editReply("You can't timeout the server owner.");
      }

      // Convertir les minutes en millisecondes pour Discord
      const msDuration = durationInMinutes * 60 * 1000;

      // Validation (Discord limite à 28 jours max)
      if (msDuration < 5000) { // Minimum 5 secondes
        return interaction.editReply('Timeout duration cannot be less than 5 seconds (use minimum 1 minute).');
      }
      
      if (msDuration > 2.419e9) { // Maximum 28 jours
        return interaction.editReply('Timeout duration cannot be more than 28 days (40320 minutes).');
      }

      // Vérification des rôles
      const targetUserRolePosition = targetMember.roles.highest.position;
      const requestUserRolePosition = interaction.member.roles.highest.position;
      const botRolePosition = interaction.guild.members.me.roles.highest.position;

      if (targetUserRolePosition >= requestUserRolePosition) {
        return interaction.editReply("You can't timeout that user because they have the same/higher role than you.");
      }

      if (targetUserRolePosition >= botRolePosition) {
        return interaction.editReply("I can't timeout that user because they have the same/higher role than me.");
      }

      // Timeout l'utilisateur
      try {
        // Formater la durée pour l'affichage
        let displayDuration;
        if (durationInMinutes >= 1440) { // Plus d'un jour
          const days = Math.floor(durationInMinutes / 1440);
          const remainingMinutes = durationInMinutes % 1440;
          displayDuration = `${days} day${days > 1 ? 's' : ''}`;
          if (remainingMinutes > 0) {
            displayDuration += ` and ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`;
          }
        } else if (durationInMinutes >= 60) { // Plus d'une heure
          const hours = Math.floor(durationInMinutes / 60);
          const remainingMinutes = durationInMinutes % 60;
          displayDuration = `${hours} hour${hours > 1 ? 's' : ''}`;
          if (remainingMinutes > 0) {
            displayDuration += ` and ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`;
          }
        } else {
          displayDuration = `${durationInMinutes} minute${durationInMinutes > 1 ? 's' : ''}`;
        }

        if (targetMember.isCommunicationDisabled()) {
          await targetMember.timeout(msDuration, reason);
          await interaction.editReply(
            `${targetMember}'s timeout has been updated to ${displayDuration}\nReason: ${reason}`
          );
          return;
        }

        await targetMember.timeout(msDuration, reason);
        await interaction.editReply(
          `${targetMember} was timed out for ${displayDuration}.\nReason: ${reason}`
        );
      } catch (error) {
        console.log(`There was an error when timing out: ${error}`);
        await interaction.editReply('An error occurred while trying to timeout the user.');
      }

    } catch (error) {
      console.error('Error in timeout command:', error);
      
      const errorMessage = 'An error occurred while processing the timeout command.';
      
      if (interaction.replied || interaction.deferred) {
        return interaction.editReply(errorMessage);
      } else {
        return interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  }
};