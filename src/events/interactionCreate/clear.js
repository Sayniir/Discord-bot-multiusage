// moderation.js - Module pour les commandes de modération
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

class ModerationBot {
    constructor(client) {
        this.client = client;
    }

    async init() {
        // La commande est déjà enregistrée sous le nom 'clearmessage'
        // Cette méthode peut être utilisée pour initialiser d'autres fonctionnalités
        console.log('ModerationBot initialisé - Commande clearmessage prête');
    }

    async handleClearMessageCommand(interaction) {
        // Vérification des permissions (double sécurité)
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return await interaction.reply({
                content: '❌ Vous n\'avez pas la permission de gérer les messages.',
                ephemeral: true
            });
        }

        // Vérifier que le bot a les permissions nécessaires
        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return await interaction.reply({
                content: '❌ Je n\'ai pas la permission de gérer les messages dans ce serveur.',
                ephemeral: true
            });
        }

        const amount = interaction.options.getInteger('nombre');
        const user = interaction.options.getUser('utilisateur');

        // Validation supplémentaire
        if (amount < 1 || amount > 100) {
            return await interaction.reply({
                content: '❌ Le nombre de messages doit être entre 1 et 100.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // Récupérer les messages (limite augmentée pour une meilleure sélection)
            const fetchLimit = Math.min(amount * 2, 100); // Récupérer plus pour filtrer
            const messages = await interaction.channel.messages.fetch({ limit: fetchLimit });
            let filtered = Array.from(messages.values());

            // Filtrer par utilisateur si spécifié
            if (user) {
                filtered = filtered.filter(msg => msg.author.id === user.id);
            }

            // Limiter au nombre demandé
            const toDelete = filtered.slice(0, amount);

            // Vérifier s'il y a des messages à supprimer
            if (toDelete.length === 0) {
                return await interaction.editReply({
                    content: user 
                        ? `❌ Aucun message récent de ${user.tag} trouvé dans les ${fetchLimit} derniers messages` 
                        : '❌ Aucun message à supprimer'
                });
            }

            // Séparer les messages récents (< 14 jours) des anciens
            const now = Date.now();
            const twoWeeksAgo = now - (14 * 24 * 60 * 60 * 1000); // 14 jours en millisecondes
            
            const recentMessages = toDelete.filter(msg => msg.createdTimestamp > twoWeeksAgo);
            const oldMessages = toDelete.filter(msg => msg.createdTimestamp <= twoWeeksAgo);

            let deletedCount = 0;

            // Suppression en masse pour les messages récents
            if (recentMessages.length > 0) {
                try {
                    await interaction.channel.bulkDelete(recentMessages, true);
                    deletedCount += recentMessages.length;
                } catch (bulkError) {
                    console.error('Erreur suppression en masse:', bulkError);
                    // Fallback: suppression individuelle
                    for (const msg of recentMessages) {
                        try {
                            await msg.delete();
                            deletedCount++;
                        } catch (err) {
                            console.error(`Erreur suppression message ${msg.id}:`, err);
                        }
                    }
                }
            }

            // Suppression individuelle pour les messages anciens
            if (oldMessages.length > 0) {
                const deletePromises = oldMessages.map(async (msg) => {
                    try {
                        await msg.delete();
                        deletedCount++;
                    } catch (err) {
                        console.error(`Erreur suppression message ancien ${msg.id}:`, err);
                    }
                });
                
                await Promise.allSettled(deletePromises);
            }

            // Créer l'embed de confirmation
            const embed = new EmbedBuilder()
                .setColor(deletedCount > 0 ? '#00ff00' : '#ffaa00')
                .setDescription(
                    deletedCount > 0 
                        ? `🗑️ ${deletedCount} message${deletedCount > 1 ? 's' : ''} supprimé${deletedCount > 1 ? 's' : ''}${user ? ` de ${user.tag}` : ''}`
                        : `⚠️ Aucun message n'a pu être supprimé${user ? ` de ${user.tag}` : ''}`
                )
                .setFooter({ 
                    text: `Action effectuée par ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL({ size: 32 })
                })
                .setTimestamp();

            // Ajouter des détails si suppression partielle
            if (deletedCount < toDelete.length) {
                embed.addFields({
                    name: '⚠️ Information',
                    value: `${toDelete.length - deletedCount} message(s) n'ont pas pu être supprimés (probablement trop anciens ou permissions insuffisantes)`,
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });

            // Log de modération (optionnel - vous pouvez configurer un canal de logs)
            this.logModerationAction(interaction, 'CLEAR_MESSAGES', {
                deletedCount,
                targetUser: user,
                requestedAmount: amount
            });

            // Supprimer automatiquement la confirmation après 10 secondes
            setTimeout(() => {
                interaction.deleteReply().catch(err => {
                    if (err.code !== 10008) { // Ignore "Unknown Message" error
                        console.error('Erreur suppression réponse:', err);
                    }
                });
            }, 10000);

        } catch (error) {
            console.error('Erreur suppression messages:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setDescription('❌ Une erreur est survenue lors de la suppression des messages')
                .addFields({
                    name: 'Détails de l\'erreur',
                    value: `\`${error.message}\``,
                    inline: false
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }

    // Méthode pour enregistrer les actions de modération (optionnelle)
    async logModerationAction(interaction, action, details = {}) {
        try {
            // Vous pouvez configurer un canal de logs ici
            const logChannelId = process.env.MODERATION_LOG_CHANNEL; // ou depuis une config
            if (!logChannelId) return;

            const logChannel = interaction.guild.channels.cache.get(logChannelId);
            if (!logChannel) return;

            const logEmbed = new EmbedBuilder()
                .setColor('#ffa500')
                .setTitle('📋 Action de Modération')
                .addFields(
                    { name: 'Action', value: action, inline: true },
                    { name: 'Modérateur', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
                    { name: 'Canal', value: `${interaction.channel.name} (${interaction.channel.id})`, inline: true }
                )
                .setTimestamp();

            // Ajouter des détails spécifiques
            if (details.deletedCount !== undefined) {
                logEmbed.addFields({ name: 'Messages supprimés', value: details.deletedCount.toString(), inline: true });
            }
            if (details.targetUser) {
                logEmbed.addFields({ name: 'Utilisateur ciblé', value: `${details.targetUser.tag} (${details.targetUser.id})`, inline: true });
            }
            if (details.requestedAmount) {
                logEmbed.addFields({ name: 'Nombre demandé', value: details.requestedAmount.toString(), inline: true });
            }

            await logChannel.send({ embeds: [logEmbed] });
        } catch (error) {
            console.error('Erreur logging modération:', error);
        }
    }

    // Méthode utilitaire pour vérifier les permissions
    checkPermissions(interaction, requiredPermissions) {
        const memberPermissions = interaction.member.permissions;
        const botPermissions = interaction.guild.members.me.permissions;

        const missingMemberPerms = requiredPermissions.filter(perm => !memberPermissions.has(perm));
        const missingBotPerms = requiredPermissions.filter(perm => !botPermissions.has(perm));

        return {
            member: missingMemberPerms,
            bot: missingBotPerms,
            hasAll: missingMemberPerms.length === 0 && missingBotPerms.length === 0
        };
    }
}

module.exports = ModerationBot;