const { Client, Interaction, ApplicationCommandOptionType, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'kick',
    description: 'kicks a user from the server.',
    options: [
        {
            name: 'user',
            description: 'The user to kick',
            type: ApplicationCommandOptionType.User, // Changé de Mentionable à User
            required: true,
        },
        {
            name: 'reason',
            description: 'The reason for the kick',
            type: ApplicationCommandOptionType.String,
            required: false,
        }
    ],
    permissionsRequired: [PermissionFlagsBits.kickMembers],
    botPermissions: [PermissionFlagsBits.kickMembers],

    /**
     * @param {Client} client 
     * @param {Interaction} interaction 
     */
    callback: async (client, interaction) => {
        try {
            // Récupération correcte de l'utilisateur
            const targetUser = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';

            await interaction.deferReply();

            // Récupérer le membre du serveur
            let targetMember;
            try {
                targetMember = await interaction.guild.members.fetch(targetUser.id);
            } catch (error) {
                return interaction.editReply({
                    content: 'User not found in this server.',
                });
            }

            // Vérifications de sécurité
            if (targetUser.id === client.user.id) {
                return interaction.editReply({
                    content: 'You cannot kick the bot.',
                });
            }

            if (targetUser.id === interaction.user.id) {
                return interaction.editReply({
                    content: 'You cannot kick yourself.',
                });
            }

            if (targetUser.id === interaction.guild.ownerId) {
                return interaction.editReply({
                    content: 'You cannot kick the server owner.',
                });
            }

            // Vérification des permissions et rôles
            const targetUserRolePosition = targetMember.roles.highest.position;
            const requestingUserRolePosition = interaction.member.roles.highest.position;
            const botRolePosition = interaction.guild.members.me.roles.highest.position;

            // L'utilisateur qui fait la commande doit avoir un rôle plus élevé que la cible
            if (requestingUserRolePosition <= targetUserRolePosition) {
                return interaction.editReply({
                    content: 'You cannot kick this user because they have a higher or equal role than you.',
                });
            }

            // Le bot doit avoir un rôle plus élevé que la cible
            if (botRolePosition <= targetUserRolePosition) {
                return interaction.editReply({
                    content: 'I cannot kick this user because they have a higher or equal role than me.',
                });
            }

            // kicknir l'utilisateur
            await targetMember.kick({ reason });
            
            await interaction.editReply({
                content: `✅ Successfully kickned **${targetUser.tag}** for: *${reason}*`,
            });

        } catch (error) {
            console.error('Error while kickning user:', error);
            
            const errorMessage = interaction.replied || interaction.deferred 
                ? { content: 'An error occurred while trying to kick the user.' }
                : { content: 'An error occurred while trying to kick the user.'};
                
            if (interaction.replied || interaction.deferred) {
                return interaction.editReply(errorMessage);
            } else {
                return interaction.reply(errorMessage);
            }
        }
    }
};