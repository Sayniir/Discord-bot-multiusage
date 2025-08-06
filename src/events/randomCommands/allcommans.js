const { Client, Interaction, ApplicationCommandOptionType, PermissionFlagsBits } = require('discord.js');

// L'interaction handler principal
module.exports = async (client, interaction) => {
    const action = interaction.commandName
    const member = interaction.options.getMember('user'); // option type: USER
    const reason = interaction.options.getString('reason') || 'Aucune raison fournie';

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isCommand()) return;
        
        try {
            switch (interaction.commandName) {
                case 'ping': await handlePing(interaction); break;
                case 'ban': await handleBan(interaction); break;
                case 'unban': await handleUnban(interaction); break;
                case 'timeout': await handleTimeout(interaction); break;
            }
        } catch (error) {
            console.error(`Erreur commande ${interaction.commandName}:`, error);
            await interaction.reply({ content: '❌ Une erreur est survenue', ephemeral: true });
        }
    });

// Fonction unban
async function handleUnban(interaction, client) {
    try {
        const userId = interaction.options.getString('userid');
        const unbanReason = interaction.options.getString('reason') || 'Aucune raison fournie';

        await interaction.deferReply();

        // Vérifier si l'ID est valide
        if (!/^\d{17,19}$/.test(userId)) {
            return interaction.editReply({
                content: '❌ ID utilisateur invalide. Veuillez fournir un ID Discord valide.',
            });
        }

        // Vérifier si l'utilisateur est banni
        let bannedUser;
        try {
            const bans = await interaction.guild.bans.fetch();
            bannedUser = bans.get(userId);
            
            if (!bannedUser) {
                return interaction.editReply({
                    content: '❌ Cet utilisateur n\'est pas banni sur ce serveur.',
                });
            }
        } catch (error) {
            return interaction.editReply({
                content: '❌ Erreur lors de la vérification des bannissements.',
            });
        }

        // Débannir l'utilisateur
        await interaction.guild.members.unban(userId, unbanReason);

        await interaction.editReply({
            content: `✅ **${bannedUser.user.tag}** (${userId}) a été débanni avec succès pour : *${unbanReason}*`,
        });

    } catch (error) {
        console.error('Erreur lors du débannissement :', error);

        const errorMessage = {
            content: '❌ Une erreur est survenue lors du débannissement de l\'utilisateur.'
        };

        if (interaction.replied || interaction.deferred) {
            return interaction.editReply(errorMessage);
        } else {
            return interaction.reply(errorMessage);
        }
    }
}

// Fonction untimeout
async function handleUntimeout(interaction, client) {
    try {
        const targetUser = interaction.options.getUser('user');
        const untimeoutReason = interaction.options.getString('reason') || 'Aucune raison fournie';

        await interaction.deferReply();

        let targetMember;
        try {
            targetMember = await interaction.guild.members.fetch(targetUser.id);
        } catch (error) {
            return interaction.editReply({
                content: '❌ Utilisateur non trouvé sur ce serveur.',
            });
        }

        // Vérifier si l'utilisateur est en timeout
        if (!targetMember.communicationDisabledUntil) {
            return interaction.editReply({
                content: '❌ Cet utilisateur n\'est pas en timeout.',
            });
        }

        // Retirer le timeout
        await targetMember.timeout(null, untimeoutReason);

        await interaction.editReply({
            content: `✅ Le timeout de **${targetUser.tag}** a été retiré pour : *${untimeoutReason}*`,
        });

    } catch (error) {
        console.error('Erreur lors de la levée du timeout :', error);

        const errorMessage = {
            content: '❌ Une erreur est survenue lors de la levée du timeout.'
        };

        if (interaction.replied || interaction.deferred) {
            return interaction.editReply(errorMessage);
        } else {
            return interaction.reply(errorMessage);
        }
    }
}

// Fonction slowmode
async function handleSlowmode(interaction, client) {
    try {
        const duration = interaction.options.getInteger('duree');
        const slowmodeReason = interaction.options.getString('reason') || 'Aucune raison fournie';
        const channel = interaction.channel;

        await interaction.deferReply();

        // Appliquer le slowmode
        await channel.setRateLimitPerUser(duration, slowmodeReason);

        if (duration === 0) {
            await interaction.editReply({
                content: `✅ Mode lent désactivé dans ${channel} pour : *${slowmodeReason}*`,
            });
        } else {
            // Formater la durée
            let durationText;
            if (duration < 60) {
                durationText = `${duration} seconde${duration > 1 ? 's' : ''}`;
            } else if (duration < 3600) {
                const minutes = Math.floor(duration / 60);
                const seconds = duration % 60;
                durationText = `${minutes} minute${minutes > 1 ? 's' : ''}${seconds > 0 ? ` et ${seconds} seconde${seconds > 1 ? 's' : ''}` : ''}`;
            } else {
                const hours = Math.floor(duration / 3600);
                const minutes = Math.floor((duration % 3600) / 60);
                durationText = `${hours} heure${hours > 1 ? 's' : ''}${minutes > 0 ? ` et ${minutes} minute${minutes > 1 ? 's' : ''}` : ''}`;
            }

            await interaction.editReply({
                content: `⏱️ Mode lent configuré à ${durationText} dans ${channel} pour : *${slowmodeReason}*`,
            });
        }

    } catch (error) {
        console.error('Erreur lors de la configuration du slowmode :', error);

        const errorMessage = {
            content: '❌ Une erreur est survenue lors de la configuration du mode lent.'
        };

        if (interaction.replied || interaction.deferred) {
            return interaction.editReply(errorMessage);
        } else {
            return interaction.reply(errorMessage);
        }
    }
}

// Fonction lock
async function handleLock(interaction, client) {
    try {
        const targetChannel = interaction.options.getChannel('salon') || interaction.channel;
        const lockReason = interaction.options.getString('reason') || 'Aucune raison fournie';

        await interaction.deferReply();

        // Récupérer le rôle @everyone
        const everyoneRole = interaction.guild.roles.everyone;

        // Vérifier les permissions actuelles
        const currentPermissions = targetChannel.permissionOverwrites.cache.get(everyoneRole.id);
        
        if (currentPermissions && currentPermissions.deny.has(PermissionFlagsBits.SendMessages)) {
            return interaction.editReply({
                content: `❌ ${targetChannel} est déjà verrouillé.`,
            });
        }

        // Verrouiller le salon
        await targetChannel.permissionOverwrites.edit(everyoneRole, {
            SendMessages: false
        }, { reason: lockReason });

        await interaction.editReply({
            content: `🔒 ${targetChannel} a été verrouillé pour : *${lockReason}*`,
        });

    } catch (error) {
        console.error('Erreur lors du verrouillage :', error);

        const errorMessage = {
            content: '❌ Une erreur est survenue lors du verrouillage du salon.'
        };

        if (interaction.replied || interaction.deferred) {
            return interaction.editReply(errorMessage);
        } else {
            return interaction.reply(errorMessage);
        }
    }
}

// Fonction unlock
async function handleUnlock(interaction, client) {
    try {
        const targetChannel = interaction.options.getChannel('salon') || interaction.channel;
        const unlockReason = interaction.options.getString('reason') || 'Aucune raison fournie';

        await interaction.deferReply();

        // Récupérer le rôle @everyone
        const everyoneRole = interaction.guild.roles.everyone;

        // Vérifier les permissions actuelles
        const currentPermissions = targetChannel.permissionOverwrites.cache.get(everyoneRole.id);
        
        if (!currentPermissions || !currentPermissions.deny.has(PermissionFlagsBits.SendMessages)) {
            return interaction.editReply({
                content: `❌ ${targetChannel} n'est pas verrouillé.`,
            });
        }

        // Déverrouiller le salon
        await targetChannel.permissionOverwrites.edit(everyoneRole, {
            SendMessages: null
        }, { reason: unlockReason });

        await interaction.editReply({
            content: `🔓 ${targetChannel} a été déverrouillé pour : *${unlockReason}*`,
        });

    } catch (error) {
        console.error('Erreur lors du déverrouillage :', error);

        const errorMessage = {
            content: '❌ Une erreur est survenue lors du déverrouillage du salon.'
        };

        if (interaction.replied || interaction.deferred) {
            return interaction.editReply(errorMessage);
        } else {
            return interaction.reply(errorMessage);
        }
    }
}

// Fonction userinfo
async function handleUserinfo(interaction, client) {
    try {
        const targetUser = interaction.options.getUser('utilisateur') || interaction.user;

        await interaction.deferReply();

        let targetMember;
        try {
            targetMember = await interaction.guild.members.fetch(targetUser.id);
        } catch (error) {
            return interaction.editReply({
                content: '❌ Utilisateur non trouvé sur ce serveur.',
            });
        }

        const joinedAt = targetMember.joinedAt ? `<t:${Math.floor(targetMember.joinedAt.getTime() / 1000)}:F>` : 'Inconnu';
        const createdAt = `<t:${Math.floor(targetUser.createdAt.getTime() / 1000)}:F>`;
        const roles = targetMember.roles.cache
            .filter(role => role.id !== interaction.guild.id)
            .sort((a, b) => b.position - a.position)
            .map(role => role.toString())
            .slice(0, 10);

        const embed = {
            title: `Informations de ${targetUser.tag}`,
            thumbnail: { url: targetUser.displayAvatarURL() },
            color: targetMember.displayHexColor === '#000000' ? 0x99AAB5 : parseInt(targetMember.displayHexColor.slice(1), 16),
            fields: [
                { name: '👤 Utilisateur', value: `${targetUser.toString()}\n\`${targetUser.id}\``, inline: true },
                { name: '📅 Création du compte', value: createdAt, inline: true },
                { name: '📥 Rejoint le serveur', value: joinedAt, inline: true },
                { name: `🎭 Rôles [${roles.length}]`, value: roles.length > 0 ? roles.join(' ') : 'Aucun rôle', inline: false }
            ],
            footer: { text: `ID: ${targetUser.id}` },
            timestamp: new Date().toISOString()
        };

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Erreur lors de la récupération des informations utilisateur :', error);

        const errorMessage = {
            content: '❌ Une erreur est survenue lors de la récupération des informations.'
        };

        if (interaction.replied || interaction.deferred) {
            return interaction.editReply(errorMessage);
        } else {
            return interaction.reply(errorMessage);
        }
    }
}

// Fonction serverinfo
async function handleServerinfo(interaction, client) {
    try {
        await interaction.deferReply();

        const guild = interaction.guild;
        const owner = await guild.fetchOwner();
        const createdAt = `<t:${Math.floor(guild.createdAt.getTime() / 1000)}:F>`;

        const embed = {
            title: guild.name,
            thumbnail: { url: guild.iconURL() || '' },
            color: 0x5865F2,
            fields: [
                { name: '👑 Propriétaire', value: owner.toString(), inline: true },
                { name: '📅 Créé le', value: createdAt, inline: true },
                { name: '👥 Membres', value: guild.memberCount.toString(), inline: true },
                { name: '🔊 Salons vocaux', value: guild.channels.cache.filter(c => c.type === 2).size.toString(), inline: true },
                { name: '💬 Salons textuels', value: guild.channels.cache.filter(c => c.type === 0).size.toString(), inline: true },
                { name: '🎭 Rôles', value: guild.roles.cache.size.toString(), inline: true },
                { name: '😀 Emojis', value: guild.emojis.cache.size.toString(), inline: true },
                { name: '🚀 Niveau de boost', value: `Niveau ${guild.premiumTier} (${guild.premiumSubscriptionCount} boosts)`, inline: true },
                { name: '🔒 Niveau de vérification', value: ['Aucun', 'Faible', 'Moyen', 'Élevé', 'Maximum'][guild.verificationLevel], inline: true }
            ],
            footer: { text: `ID: ${guild.id}` },
            timestamp: new Date().toISOString()
        };

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Erreur lors de la récupération des informations serveur :', error);

        const errorMessage = {
            content: '❌ Une erreur est survenue lors de la récupération des informations du serveur.'
        };

        if (interaction.replied || interaction.deferred) {
            return interaction.editReply(errorMessage);
        } else {
            return interaction.reply(errorMessage);
        }
    }
}

// Fonction avatar
async function handleAvatar(interaction, client) {
    try {
        const targetUser = interaction.options.getUser('utilisateur') || interaction.user;

        await interaction.deferReply();

        const avatarURL = targetUser.displayAvatarURL({ size: 2048, dynamic: true });

        const embed = {
            title: `Avatar de ${targetUser.tag}`,
            image: { url: avatarURL },
            color: 0x5865F2,
            footer: { text: `Demandé par ${interaction.user.tag}` },
            timestamp: new Date().toISOString()
        };

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Erreur lors de la récupération de l\'avatar :', error);

        const errorMessage = {
            content: '❌ Une erreur est survenue lors de la récupération de l\'avatar.'
        };

        if (interaction.replied || interaction.deferred) {
            return interaction.editReply(errorMessage);
        } else {
            return interaction.reply(errorMessage);
        }
    }
}



// Fonction ping
async function handlePing(interaction, client) {
    await interaction.deferReply();

    const reply = await interaction.fetchReply();
    const ping = reply.createdTimestamp - interaction.createdTimestamp;

    await interaction.editReply(`🏓 Pong ! Latence : ${ping}ms | Ping WebSocket : ${client.ws.ping}ms`);
}

// Fonction ban
async function handleBan(interaction, member, reason, client) {
    try {
        const targetUser = interaction.options.getUser('user');
        const banReason = interaction.options.getString('reason') || 'Aucune raison fournie';

        await interaction.deferReply();

        // Récupérer le membre du serveur
        let targetMember;
        try {
            targetMember = await interaction.guild.members.fetch(targetUser.id);
        } catch (error) {
            return interaction.editReply({
                content: '❌ Utilisateur non trouvé sur ce serveur.',
            });
        }

        // Vérifications de sécurité
        if (targetUser.id === client.user.id) {
            return interaction.editReply({
                content: '❌ Vous ne pouvez pas bannir le bot.',
            });
        }

        if (targetUser.id === interaction.user.id) {
            return interaction.editReply({
                content: '❌ Vous ne pouvez pas vous bannir vous-même.',
            });
        }

        if (targetUser.id === interaction.guild.ownerId) {
            return interaction.editReply({
                content: '❌ Vous ne pouvez pas bannir le propriétaire du serveur.',
            });
        }

        const targetUserRolePosition = targetMember.roles.highest.position;
        const requestingUserRolePosition = interaction.member.roles.highest.position;
        const botRolePosition = interaction.guild.members.me.roles.highest.position;

        if (requestingUserRolePosition <= targetUserRolePosition) {
            return interaction.editReply({
                content: '❌ Vous ne pouvez pas bannir cet utilisateur car il a un rôle supérieur ou égal au vôtre.',
            });
        }

        if (botRolePosition <= targetUserRolePosition) {
            return interaction.editReply({
                content: '❌ Je ne peux pas bannir cet utilisateur car il a un rôle supérieur ou égal au mien.',
            });
        }

        // Envoyer un message privé avant de bannir
        try {
            await targetUser.send({
                content: `🚫 Vous avez été banni du serveur **${interaction.guild.name}** pour : *${banReason}*\n\nSi vous pensez que cette sanction est injustifiée, vous pouvez contacter l'équipe de modération.`
            });
        } catch (error) {
            console.log('Impossible d\'envoyer un MP à l\'utilisateur avant le bannissement');
        }

        // Bannir l'utilisateur
        await targetMember.ban({ reason: banReason });

        await interaction.editReply({
            content: `✅ **${targetUser.tag}** a été banni avec succès pour : *${banReason}*`,
        });

    } catch (error) {
        console.error('Erreur lors du bannissement :', error);

        const errorMessage = {
            content: '❌ Une erreur est survenue lors du bannissement de l\'utilisateur.'
        };

        if (interaction.replied || interaction.deferred) {
            return interaction.editReply(errorMessage);
        } else {
            return interaction.reply(errorMessage);
        }
    }
}

// Fonction kick
async function handleKick(interaction, member, reason, client) {
    try {
        const targetUser = interaction.options.getUser('user');
        const kickReason = interaction.options.getString('reason') || 'Aucune raison fournie';

        await interaction.deferReply();

        // Récupérer le membre du serveur
        let targetMember;
        try {
            targetMember = await interaction.guild.members.fetch(targetUser.id);
        } catch (error) {
            return interaction.editReply({
                content: '❌ Utilisateur non trouvé sur ce serveur.',
            });
        }

        // Vérifications de sécurité
        if (targetUser.id === client.user.id) {
            return interaction.editReply({
                content: '❌ Vous ne pouvez pas expulser le bot.',
            });
        }

        if (targetUser.id === interaction.user.id) {
            return interaction.editReply({
                content: '❌ Vous ne pouvez pas vous expulser vous-même.',
            });
        }

        if (targetUser.id === interaction.guild.ownerId) {
            return interaction.editReply({
                content: '❌ Vous ne pouvez pas expulser le propriétaire du serveur.',
            });
        }

        const targetUserRolePosition = targetMember.roles.highest.position;
        const requestingUserRolePosition = interaction.member.roles.highest.position;
        const botRolePosition = interaction.guild.members.me.roles.highest.position;

        if (requestingUserRolePosition <= targetUserRolePosition) {
            return interaction.editReply({
                content: '❌ Vous ne pouvez pas expulser cet utilisateur car il a un rôle supérieur ou égal au vôtre.',
            });
        }

        if (botRolePosition <= targetUserRolePosition) {
            return interaction.editReply({
                content: '❌ Je ne peux pas expulser cet utilisateur car il a un rôle supérieur ou égal au mien.',
            });
        }

        // Vérifier si l'utilisateur peut être expulsé
        if (!targetMember.kickable) {
            return interaction.editReply({
                content: '❌ Je ne peux pas expulser cet utilisateur.',
            });
        }

        // Envoyer un message privé avant d'expulser
        try {
            await targetUser.send({
                content: `👋 Vous avez été expulsé du serveur **${interaction.guild.name}** pour : *${kickReason}*\n\nVous pouvez rejoindre à nouveau le serveur si vous avez un lien d'invitation.`
            });
        } catch (error) {
            console.log('Impossible d\'envoyer un MP à l\'utilisateur avant l\'expulsion');
        }

        // Expulser l'utilisateur
        await targetMember.kick(kickReason);

        await interaction.editReply({
            content: `✅ **${targetUser.tag}** a été expulsé avec succès pour : *${kickReason}*`,
        });

    } catch (error) {
        console.error('Erreur lors de l\'expulsion :', error);

        const errorMessage = {
            content: '❌ Une erreur est survenue lors de l\'expulsion de l\'utilisateur.'
        };

        if (interaction.replied || interaction.deferred) {
            return interaction.editReply(errorMessage);
        } else {
            return interaction.reply(errorMessage);
        }
    }
}

// Fonction warn
async function handleWarn(interaction, member, reason, client) {
    try {
        const targetUser = interaction.options.getUser('user');
        const warnReason = interaction.options.getString('reason') || 'Aucune raison fournie';

        await interaction.deferReply();

        // Récupérer le membre du serveur
        let targetMember;
        try {
            targetMember = await interaction.guild.members.fetch(targetUser.id);
        } catch (error) {
            return interaction.editReply({
                content: '❌ Utilisateur non trouvé sur ce serveur.',
            });
        }

        // Vérifications de sécurité
        if (targetUser.id === client.user.id) {
            return interaction.editReply({
                content: '❌ Vous ne pouvez pas avertir le bot.',
            });
        }

        if (targetUser.id === interaction.user.id) {
            return interaction.editReply({
                content: '❌ Vous ne pouvez pas vous avertir vous-même.',
            });
        }

        if (targetUser.id === interaction.guild.ownerId) {
            return interaction.editReply({
                content: '❌ Vous ne pouvez pas avertir le propriétaire du serveur.',
            });
        }

        const targetUserRolePosition = targetMember.roles.highest.position;
        const requestingUserRolePosition = interaction.member.roles.highest.position;

        if (requestingUserRolePosition <= targetUserRolePosition) {
            return interaction.editReply({
                content: '❌ Vous ne pouvez pas avertir cet utilisateur car il a un rôle supérieur ou égal au vôtre.',
            });
        }

        // Envoyer un message privé à l'utilisateur (optionnel)
        try {
            await targetUser.send({
                content: `⚠️ Vous avez reçu un avertissement sur le serveur **${interaction.guild.name}** pour : *${warnReason}*`
            });
        } catch (error) {
            // L'utilisateur a peut-être désactivé les MPs
            console.log('Impossible d\'envoyer un MP à l\'utilisateur');
        }

        // Ici vous pourriez sauvegarder l'avertissement dans une base de données
        // Pour cet exemple, on se contente de répondre

        await interaction.editReply({
            content: `⚠️ **${targetUser.tag}** a été averti avec succès pour : *${warnReason}*`,
        });

    } catch (error) {
        console.error('Erreur lors de l\'avertissement :', error);

        const errorMessage = {
            content: '❌ Une erreur est survenue lors de l\'avertissement de l\'utilisateur.'
        };

        if (interaction.replied || interaction.deferred) {
            return interaction.editReply(errorMessage);
        } else {
            return interaction.reply(errorMessage);
        }
    }
}

// Fonction timeout
async function handleTimeout(interaction, member, duration, reason, client) {
    try {
        const targetUser = interaction.options.getUser('user');
        const timeoutDuration = interaction.options.getInteger('duree') || 60;
        const timeoutReason = interaction.options.getString('reason') || 'Aucune raison fournie';

        await interaction.deferReply();

        // Récupérer le membre du serveur
        let targetMember;
        try {
            targetMember = await interaction.guild.members.fetch(targetUser.id);
        } catch (error) {
            return interaction.editReply({
                content: '❌ Utilisateur non trouvé sur ce serveur.',
            });
        }

        // Vérifications de sécurité
        if (targetUser.id === client.user.id) {
            return interaction.editReply({
                content: '❌ Vous ne pouvez pas mettre le bot en timeout.',
            });
        }

        if (targetUser.id === interaction.user.id) {
            return interaction.editReply({
                content: '❌ Vous ne pouvez pas vous mettre en timeout vous-même.',
            });
        }

        if (targetUser.id === interaction.guild.ownerId) {
            return interaction.editReply({
                content: '❌ Vous ne pouvez pas mettre le propriétaire du serveur en timeout.',
            });
        }

        const targetUserRolePosition = targetMember.roles.highest.position;
        const requestingUserRolePosition = interaction.member.roles.highest.position;
        const botRolePosition = interaction.guild.members.me.roles.highest.position;

        if (requestingUserRolePosition <= targetUserRolePosition) {
            return interaction.editReply({
                content: '❌ Vous ne pouvez pas mettre cet utilisateur en timeout car il a un rôle supérieur ou égal au vôtre.',
            });
        }

        if (botRolePosition <= targetUserRolePosition) {
            return interaction.editReply({
                content: '❌ Je ne peux pas mettre cet utilisateur en timeout car il a un rôle supérieur ou égal au mien.',
            });
        }

        // Vérifier si l'utilisateur peut être mis en timeout
        if (!targetMember.moderatable) {
            return interaction.editReply({
                content: '❌ Je ne peux pas mettre cet utilisateur en timeout.',
            });
        }

        // Vérifier les limites de durée (Discord limite à 28 jours max)
        const maxTimeout = 28 * 24 * 60; // 28 jours en minutes
        if (timeoutDuration > maxTimeout) {
            return interaction.editReply({
                content: '❌ La durée du timeout ne peut pas dépasser 28 jours (40320 minutes).',
            });
        }

        if (timeoutDuration < 1) {
            return interaction.editReply({
                content: '❌ La durée du timeout doit être d\'au moins 1 minute.',
            });
        }

        // Calculer le temps d'expiration
        const timeoutMs = timeoutDuration * 60 * 1000; // Convertir en millisecondes

        // Mettre l'utilisateur en timeout
        await targetMember.timeout(timeoutMs, timeoutReason);

        // Formater la durée pour l'affichage
        let durationText;
        if (timeoutDuration < 60) {
            durationText = `${timeoutDuration} minute${timeoutDuration > 1 ? 's' : ''}`;
        } else if (timeoutDuration < 1440) {
            const hours = Math.floor(timeoutDuration / 60);
            const minutes = timeoutDuration % 60;
            durationText = `${hours} heure${hours > 1 ? 's' : ''}${minutes > 0 ? ` et ${minutes} minute${minutes > 1 ? 's' : ''}` : ''}`;
        } else {
            const days = Math.floor(timeoutDuration / 1440);
            const hours = Math.floor((timeoutDuration % 1440) / 60);
            durationText = `${days} jour${days > 1 ? 's' : ''}${hours > 0 ? ` et ${hours} heure${hours > 1 ? 's' : ''}` : ''}`;
        }

        await interaction.editReply({
            content: `🔇 **${targetUser.tag}** a été mis en timeout pour ${durationText} pour : *${timeoutReason}*`,
        });

    } catch (error) {
        console.error('Erreur lors du timeout :', error);

        const errorMessage = {
            content: '❌ Une erreur est survenue lors de la mise en timeout de l\'utilisateur.'
        };

        if (interaction.replied || interaction.deferred) {
            return interaction.editReply(errorMessage);
        } else {
            return interaction.reply(errorMessage);
        }
    }
}}