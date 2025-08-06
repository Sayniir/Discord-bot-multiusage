const { Client, Interaction, ApplicationCommandOptionType, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'ban',
    description: 'Bans a user from the server.',
    options: [
        {
            name: 'user',
            description: 'The user to ban',
            type: ApplicationCommandOptionType.User,
            required: true,
        },
        {
            name: 'reason',
            description: 'The reason for the ban',
            type: ApplicationCommandOptionType.String,
            required: false,
        }
    ],
    default_member_permissions: PermissionFlagsBits.Administrator.toString(), // Visible uniquement pour les admins
    permissionsRequired: [PermissionFlagsBits.BanMembers],
    botPermissions: [PermissionFlagsBits.BanMembers],

    /**
     * @param {Client} client 
     * @param {Interaction} interaction 
     */
    callback: async (client, interaction) => {
        try {
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
                    content: 'You cannot ban the bot.',
                });
            }

            if (targetUser.id === interaction.user.id) {
                return interaction.editReply({
                    content: 'You cannot ban yourself.',
                });
            }

            if (targetUser.id === interaction.guild.ownerId) {
                return interaction.editReply({
                    content: 'You cannot ban the server owner.',
                });
            }

            const targetUserRolePosition = targetMember.roles.highest.position;
            const requestingUserRolePosition = interaction.member.roles.highest.position;
            const botRolePosition = interaction.guild.members.me.roles.highest.position;

            if (requestingUserRolePosition <= targetUserRolePosition) {
                return interaction.editReply({
                    content: 'You cannot ban this user because they have a higher or equal role than you.',
                });
            }

            if (botRolePosition <= targetUserRolePosition) {
                return interaction.editReply({
                    content: 'I cannot ban this user because they have a higher or equal role than me.',
                });
            }

            // Bannir l'utilisateur
            await targetMember.ban({ reason });

            await interaction.editReply({
                content: `✅ Successfully banned **${targetUser.tag}** for: *${reason}*`,
            });

        } catch (error) {
            console.error('Error while banning user:', error);

            const errorMessage = {
                content: 'An error occurred while trying to ban the user.'
            };

            if (interaction.replied || interaction.deferred) {
                return interaction.editReply(errorMessage);
            } else {
                return interaction.reply(errorMessage);
            }
        }
    }
};
