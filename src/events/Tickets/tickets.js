const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

// Configuration - À MODIFIER
const TICKET_CONFIG = {
    categoryId: '1386913142122221571',
    closedCategoryId: '1401126086896521298',
    staffRoleId: '1386878029338378352',
    logChannelId: '1401123568846245908',
    maxTicketsPerUser: 3,
    autoDeleteAfter: 7 * 24 * 60 * 60 * 1000,
    ticketNamePrefix: 'ticket-',
    transcriptFolder: './transcripts/',
    dataFile: './data/tickets.json'
};

// Fonction utilitaire pour nettoyer les noms de salon
function sanitizeChannelName(displayName) {
    return displayName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50)
        || 'utilisateur';
}

// Stockage des tickets actifs
let activeTickets = new Map();
let ticketStats = {
    created: 0,
    closed: 0,
    deleted: 0
};

// Créer les dossiers nécessaires
async function ensureFolders() {
    try {
        await fs.mkdir(TICKET_CONFIG.transcriptFolder, { recursive: true });
        await fs.mkdir(path.dirname(TICKET_CONFIG.dataFile), { recursive: true });
    } catch (error) {
        console.error('Erreur création dossiers:', error);
    }
}

// Sauvegarder les données
async function saveTicketData() {
    try {
        const data = {
            tickets: Object.fromEntries(activeTickets),
            stats: ticketStats,
            lastSaved: new Date().toISOString()
        };
        await fs.writeFile(TICKET_CONFIG.dataFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error('❌ Erreur sauvegarde données tickets:', error);
    }
}

// Charger les données
async function loadTicketData() {
    try {
        const dataExists = await fs.access(TICKET_CONFIG.dataFile).then(() => true).catch(() => false);
        if (!dataExists) {
            await saveTicketData();
            return;
        }

        const fileContent = await fs.readFile(TICKET_CONFIG.dataFile, 'utf-8');
        const data = JSON.parse(fileContent);
        
        activeTickets = new Map(Object.entries(data.tickets || {}));
        ticketStats = data.stats || { created: 0, closed: 0, deleted: 0 };

        // Convertir les dates
        for (const [channelId, ticket] of activeTickets) {
            if (ticket.createdAt) ticket.createdAt = new Date(ticket.createdAt);
            if (ticket.closedAt) ticket.closedAt = new Date(ticket.closedAt);
        }
    } catch (error) {
        console.error('❌ Erreur chargement données tickets:', error);
        activeTickets = new Map();
        ticketStats = { created: 0, closed: 0, deleted: 0 };
    }
}

// Nettoyer les tickets invalides
async function cleanupInvalidTickets(client) {
    let cleanedCount = 0;
    const ticketsToDelete = [];
    
    for (const [channelId] of activeTickets) {
        const channel = client.channels.cache.get(channelId);
        if (!channel) {
            ticketsToDelete.push(channelId);
            cleanedCount++;
        }
    }
    
    ticketsToDelete.forEach(channelId => activeTickets.delete(channelId));
    if (cleanedCount > 0) await saveTicketData();
}

// Récupérer tous les messages d'un canal
async function fetchAllMessages(channel) {
    let messages = [];
    let lastId;
    
    while (true) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;
        
        const fetched = await channel.messages.fetch(options);
        if (fetched.size === 0) break;
        
        messages = messages.concat(Array.from(fetched.values()));
        lastId = fetched.lastKey();
    }
    
    return messages.reverse();
}

module.exports = (client) => {
    // Initialisation
    (async () => {
        await ensureFolders();
        await loadTicketData();
        client.once('ready', async () => {
            await cleanupInvalidTickets(client);
            console.log('✅ Système de tickets chargé avec sauvegarde JSON');
        });
    })();
    
    // Gestionnaire de commandes
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        const isAdmin = message.member?.permissions.has(PermissionFlagsBits.Administrator);
        
        // Commande de setup
        if (message.content === '!setup-tickets' && isAdmin) {
            const embed = new EmbedBuilder()
                .setTitle('🎫 Système de Support')
                .setDescription(`Cliquez sur le bouton ci-dessous pour créer un ticket de support.\n\n**Notre équipe vous répondra rapidement !**`)
                .setColor('#0099ff');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket')
                    .setLabel('Créer un ticket')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🎫')
            );

            await message.channel.send({ embeds: [embed], components: [row] });
            await message.delete().catch(() => {});
        }

        // Commande de statistiques
        if (message.content === '!ticket-stats' && isAdmin) {
            const embed = new EmbedBuilder()
                .setTitle('📊 Statistiques des Tickets')
                .addFields(
                    { name: '🆕 Créés', value: ticketStats.created.toString(), inline: true },
                    { name: '🔒 Fermés', value: ticketStats.closed.toString(), inline: true },
                    { name: '🗑️ Supprimés', value: ticketStats.deleted.toString(), inline: true },
                    { name: '📋 Actifs', value: activeTickets.size.toString(), inline: true }
                )
                .setColor('#ffa500')
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        }

        // Commande de sauvegarde
        if (message.content === '!save-tickets' && isAdmin) {
            await saveTicketData();
            await message.reply('💾 Données sauvegardées manuellement !');
        }

        // Commande de nettoyage
        if (message.content === '!cleanup-tickets' && isAdmin) {
            await cleanupInvalidTickets(client);
            await message.reply('🧹 Nettoyage des tickets invalides terminé !');
        }

        // Commande de liste des tickets
        if (message.content === '!tickets' && isAdmin) {
            if (activeTickets.size === 0) {
                return message.reply('📭 Aucun ticket actif.');
            }

            const embed = new EmbedBuilder()
                .setTitle('🎫 Tickets Actifs')
                .setColor('#0099ff')
                .setTimestamp();

            let fieldCount = 0;

            for (const [channelId, ticket] of activeTickets) {
                const ticketChannel = client.channels.cache.get(channelId);
                if (!ticketChannel) continue;

                try {
                    const ticketUser = await client.users.fetch(ticket.userId);
                    const member = await message.guild.members.fetch(ticket.userId).catch(() => null);
                    const displayName = member?.displayName || ticketUser.username;
                    const status = ticket.status === 'closed' ? '🔒' : '🟢';
                    const createdAt = new Date(ticket.createdAt).toLocaleDateString('fr-FR');
                    
                    if (fieldCount < 25) {
                        embed.addFields({
                            name: `${status} ${ticketChannel.name}`,
                            value: `👤 ${displayName} (${ticketUser.tag})\n📅 ${createdAt}`,
                            inline: true
                        });
                        fieldCount++;
                    }
                } catch (error) {
                    console.error(`Erreur récupération utilisateur ${ticket.userId}:`, error);
                }
            }

            embed.setFooter({ text: `Total: ${activeTickets.size} tickets` });
            await message.reply({ embeds: [embed] });
        }
    });

    // Gestion des interactions
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;

        try {
            switch (interaction.customId) {
                case 'create_ticket': await handleCreateTicket(interaction, client); break;
                case 'close_ticket': await handleCloseTicket(interaction); break;
                case 'confirm_close': await handleConfirmClose(interaction, client); break;
                case 'cancel_close': await handleCancelClose(interaction); break;
                case 'reopen_ticket': await handleReopenTicket(interaction, client); break;
                case 'delete_ticket': await handleDeleteTicket(interaction); break;
                case 'confirm_delete': await handleConfirmDelete(interaction); break;
                case 'cancel_delete': await handleCancelDelete(interaction); break;
            }
        } catch (error) {
            console.error(`❌ Erreur interaction ${interaction.customId}:`, error);
            const errorMessage = { content: '❌ Une erreur est survenue. Veuillez réessayer.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    });

    // Auto-suppression des tickets fermés
    setInterval(async () => {
        const now = Date.now();
        const ticketsToDelete = [];
        
        for (const [channelId, ticket] of activeTickets) {
            if (ticket.status === 'closed' && ticket.closedAt) {
                const timeSinceClose = now - ticket.closedAt.getTime();
                if (timeSinceClose > TICKET_CONFIG.autoDeleteAfter) {
                    const channel = client.channels.cache.get(channelId);
                    if (channel) {
                        try {
                            await channel.delete();
                            ticketsToDelete.push(channelId);
                            ticketStats.deleted++;
                        } catch (error) {
                            console.error('Erreur auto-suppression:', error);
                        }
                    } else {
                        ticketsToDelete.push(channelId);
                    }
                }
            }
        }
        
        if (ticketsToDelete.length > 0) {
            ticketsToDelete.forEach(channelId => activeTickets.delete(channelId));
            await saveTicketData();
        }
    }, 60 * 60 * 1000);

    // Sauvegarde périodique
    setInterval(async () => await saveTicketData(), 5 * 60 * 1000);
};

// --- FONCTIONS DE GESTION ---

async function handleCreateTicket(interaction, client) {
    
    await interaction.deferReply({ ephemeral: true });
    const { user, guild } = interaction;

    // Vérification de la configuration
    const category = guild.channels.cache.get(TICKET_CONFIG.categoryId);
    if (!category || category.type !== ChannelType.GuildCategory) {
        return interaction.editReply('❌ Catégorie de tickets introuvable!');
    }

    const staffRole = guild.roles.cache.get(TICKET_CONFIG.staffRoleId);
    if (!staffRole) {
        return interaction.editReply('❌ Rôle staff introuvable!');
    }

    // Vérifier limite de tickets
    const userTickets = [...activeTickets.values()].filter(
        t => t.userId === user.id && t.status !== 'closed'
    );
    if (userTickets.length >= TICKET_CONFIG.maxTicketsPerUser) {
        return interaction.editReply(`❌ Vous avez déjà ${TICKET_CONFIG.maxTicketsPerUser} tickets ouverts!`);
    }

    // Création du salon
    const member = await guild.members.fetch(user.id).catch(() => null);
    const displayName = member?.displayName || user.username;
    const sanitizedName = sanitizeChannelName(displayName);
    let channelName = `${TICKET_CONFIG.ticketNamePrefix}${sanitizedName}`;
    
    // Garantir un nom unique
    let counter = 1;
    while (guild.channels.cache.some(ch => 
        ch.type === ChannelType.GuildText && 
        ch.name === channelName
    )) {
        channelName = `${TICKET_CONFIG.ticketNamePrefix}${sanitizedName}-${counter}`;
        counter++;
    }

    const ticketChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: TICKET_CONFIG.categoryId,
        permissionOverwrites: [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { 
                id: user.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.EmbedLinks
                ]
            },
            { 
                id: TICKET_CONFIG.staffRoleId,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.EmbedLinks,
                    PermissionFlagsBits.ManageMessages
                ]
            }
        ]
    });

    // Sauvegarde des données
    const ticketData = {
        userId: user.id,
        channelId: ticketChannel.id,
        createdAt: new Date(),
        status: 'open',
        displayName,
        sanitizedName
    };
    activeTickets.set(ticketChannel.id, ticketData);
    ticketStats.created++;
    await saveTicketData();

    // Message de bienvenue
    const welcomeEmbed = new EmbedBuilder()
        .setTitle('🎫 Nouveau Ticket')
        .setDescription(`\nSalut ! Notre équipe a été notifiée et vous répondra bientôt.\n\nMerci de nous décrire votre demande de manière **détaillée**\n `)
        .setColor('#00ff00');

    const ticketRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Fermer le ticket')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒')
    );

    await ticketChannel.send({ 
        content: `${user}`,
        embeds: [welcomeEmbed],
        components: [ticketRow]
    });

    // MODIFICATION ICI : Message de confirmation avec mention du salon
    await interaction.editReply(`✅ Ticket créé : ${ticketChannel}`);
    // Après la création du ticket
    await notifyTicketCreation(ticketChannel, user, client);
}

async function handleCloseTicket(interaction) {
    const { user, channel } = interaction;
    const ticket = activeTickets.get(channel.id);
    
    if (!ticket) {
        return interaction.reply({ 
            content: '❌ Ce n\'est pas un ticket valide.', 
            ephemeral: true 
        });
    }

    // Vérifier permissions
    const isOwner = ticket.userId === user.id;
    const isStaff = interaction.member.roles.cache.has(TICKET_CONFIG.staffRoleId);

    if (!isOwner && !isStaff) {
        return interaction.reply({ 
            content: '❌ Vous ne pouvez pas fermer ce ticket.', 
            ephemeral: true 
        });
    }

    // Confirmation
    const confirmEmbed = new EmbedBuilder()
        .setTitle('🔒 Fermer le ticket')
        .setDescription('Voulez-vous vraiment fermer ce ticket ?')
        .setColor('#ff9900');

    const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('confirm_close')
            .setLabel('Confirmer')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('✅'),
        new ButtonBuilder()
            .setCustomId('cancel_close')
            .setLabel('Annuler')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❌')
    );

    await interaction.reply({
        embeds: [confirmEmbed],
        components: [confirmRow],
        ephemeral: true
    });
}

async function handleConfirmClose(interaction, client) {
    const { channel, user } = interaction;
    const ticket = activeTickets.get(channel.id);
    if (!ticket) return interaction.reply({ content: '❌ Ticket non trouvé', ephemeral: true });
    
    await interaction.reply({
    content: '🔒 Fermeture en cours...',
    ephemeral: true
    });


    // Création du transcript
    await createTranscript(channel, ticket, user, client);
    
    // Mise à jour des permissions
    await channel.permissionOverwrites.edit(ticket.userId, {
        ViewChannel: false,
        SendMessages: false
    });
    
    // Renommer le ticket en "ticket-fermé-utilisateur"
    const newName = `ticket-fermé-${ticket.sanitizedName}`;
    await channel.setName(newName);
    
    // Déplacement vers catégorie fermée
    const closedCategory = channel.guild.channels.cache.get(TICKET_CONFIG.closedCategoryId);
    if (closedCategory?.type === ChannelType.GuildCategory) {
        await channel.setParent(closedCategory);
    }

    // Message de fermeture
    const closedEmbed = new EmbedBuilder()
        .setTitle('🔒 Ticket Fermé')
        .setDescription(`Ce ticket a été fermé par ${user}`)
        .setColor('#ff0000');

    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('reopen_ticket')
            .setLabel('Rouvrir')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🔓'),
        new ButtonBuilder()
            .setCustomId('delete_ticket')
            .setLabel('Supprimer')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️')
    );

    await channel.send({ embeds: [closedEmbed], components: [actionRow] });
    
    // Mise à jour du statut
    ticket.status = 'closed';
    ticket.closedBy = user.id;
    ticket.closedAt = new Date();
    ticketStats.closed++;
    await saveTicketData();
}

async function createTranscript(channel, ticket, closedBy, client) {
    try {
        const ticketCreator = await client.users.fetch(ticket.userId);
        const messages = await fetchAllMessages(channel);
        
        // Création du contenu
        let content = `=== TRANSCRIPT ===\n`;
        content += `Salon: ${channel.name}\n`;
        content += `ID du salon: ${channel.id}\n`;
        content += `Créé par: ${ticketCreator.tag} (${ticketCreator.id})\n`;
        content += `Créé le: ${ticket.createdAt.toLocaleString('fr-FR')}\n`;
        content += `Fermé par: ${closedBy.tag} (${closedBy.id})\n`;
        content += `Fermé le: ${new Date().toLocaleString('fr-FR')}\n`;
        content += `Total messages: ${messages.length}\n`;
        content += `Serveur: ${channel.guild.name} (${channel.guild.id})\n`;
        content += `\n${'='.repeat(70)}\n\n`;
        
        messages.forEach(msg => {
            const timestamp = msg.createdAt.toLocaleString('fr-FR');
            const author = msg.author.tag;
            content += `[${timestamp}] ${author}: ${msg.content}\n`;
            
            // Ajouter les pièces jointes
            msg.attachments.forEach(att => {
                content += `  ↳ Fichier: ${att.url}\n`;
            });
            
            // Ajouter les embeds
            if (msg.embeds.length > 0) {
                content += `  ↳ Embed: [${msg.embeds[0].title || 'Sans titre'}]\n`;
            }
        });

        content += `\n${'='.repeat(70)}\n`;
        content += `Transcript généré le: ${new Date().toLocaleString('fr-FR')}\n`;
        content += `Généré par: Bot de tickets\n`;

        // Sauvegarde locale
        const fileName = `transcript-${channel.id}.txt`;
        const filePath = path.join(TICKET_CONFIG.transcriptFolder, fileName);
        await fs.writeFile(filePath, content, 'utf-8');

        // Embed minimaliste pour le MP
        const dmEmbed = new EmbedBuilder()
            .setTitle('📋 Transcript de votre ticket')
            .setDescription(`Voici l'historique complet de votre ticket **${channel.name}**`)
            .addFields(
                { name: '🔒 Statut', value: 'Fermé', inline: true },
                { name: '📅 Date de fermeture', value: new Date().toLocaleString('fr-FR'), inline: true }
            )
            .setColor('#0099ff')
            .setTimestamp();

        // Envoi en MP
        try {
            await ticketCreator.send({
                embeds: [dmEmbed],
                files: [{ attachment: filePath, name: fileName }]
            });
        } catch (dmError) {
            console.log(`⚠️ Impossible d'envoyer le transcript en MP à ${ticketCreator.tag}:`, dmError.message);
        }

        // Embed pour le salon de logs
        const logChannel = client.channels.cache.get(TICKET_CONFIG.logChannelId);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle('📋 Transcript de ticket fermé')
                .setDescription(`Ticket **${channel.name}** fermé par ${closedBy}`)
                .addFields(
                    { name: '🆔 ID du ticket', value: channel.id, inline: true },
                    { name: '👤 Créé par', value: ticketCreator.tag, inline: true },
                    { name: '🔒 Fermé par', value: closedBy.tag, inline: true },
                    { name: '📅 Date de création', value: ticket.createdAt.toLocaleString('fr-FR'), inline: true },
                    { name: '📅 Date de fermeture', value: new Date().toLocaleString('fr-FR'), inline: true },
                    { name: '💬 Messages', value: messages.length.toString(), inline: true }
                )
                .setColor('#ff9900')
                .setTimestamp();

            await logChannel.send({
                embeds: [logEmbed],
                files: [{ attachment: filePath, name: fileName }]
            });
        }
    } catch (error) {
        console.error('Erreur création transcript:', error);
        await channel.send('❌ Erreur lors de la création du transcript');
    }
}

async function handleCancelClose(interaction) {
    await interaction.update({
        content: '❌ Fermeture annulée.',
        embeds: [],
        components: []
    });
}

async function handleReopenTicket(interaction, client) {
    const { user, channel } = interaction;
    const ticket = activeTickets.get(channel.id);
    
    if (!ticket) {
        return interaction.reply({ content: '❌ Ticket non trouvé.', ephemeral: true });
    }

    // Vérifier que c'est du staff
    if (!interaction.member.roles.cache.has(TICKET_CONFIG.staffRoleId)) {
        return interaction.reply({ 
            content: '❌ Seul le staff peut rouvrir un ticket.', 
            ephemeral: true 
        });
    }

    // Rendre l'accès au créateur
    await channel.permissionOverwrites.edit(ticket.userId, {
        ViewChannel: true,
        SendMessages: true
    });
    
    // Remettre dans la catégorie active
    const category = channel.guild.channels.cache.get(TICKET_CONFIG.categoryId);
    if (category?.type === ChannelType.GuildCategory) {
        await channel.setParent(category);
    }

    // Récupérer le membre actuel (le propriétaire du ticket)
    const owner = await channel.guild.members.fetch(ticket.userId).catch(() => null);
    const displayName = owner?.displayName || owner?.user?.username || "user";
    
    // Créer un nom de canal propre avec le format "ticket-username"
    let cleanName = `ticket-${sanitizeChannelName(displayName)}`;
    
    // Garantir un nom unique
    let counter = 1;
    const guild = channel.guild;
    while (guild.channels.cache.some(ch => 
        ch.type === ChannelType.GuildText && 
        ch.name === cleanName
    )) {
        cleanName = `ticket-${sanitizeChannelName(displayName)}-${counter}`;
        counter++;
    }

    // Renommer le canal
    await channel.setName(cleanName)
        .catch(e => console.error('Erreur renommage ticket:', e));

    // Message de réouverture
    const reopenEmbed = new EmbedBuilder()
        .setTitle('🔓 Ticket Rouvert')
        .setDescription(`Ce ticket a été rouvert par ${user}\n\nNouveau nom: \`${cleanName}\``)
        .setColor('#00ff00');

    const ticketRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Fermer le ticket')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒')
    );

    await interaction.reply({
        embeds: [reopenEmbed],
        components: [ticketRow]
    });

    // Marquer comme ouvert
    ticket.status = 'open';
    delete ticket.closedBy;
    delete ticket.closedAt;
    await saveTicketData();
}

async function handleDeleteTicket(interaction) {
    const { user, channel } = interaction;
    const ticket = activeTickets.get(channel.id);
    
    if (!ticket) {
        return interaction.reply({ content: '❌ Ticket non trouvé.', ephemeral: true });
    }

    // Vérifier que c'est du staff
    if (!interaction.member.roles.cache.has(TICKET_CONFIG.staffRoleId)) {
        return interaction.reply({ 
            content: '❌ Seul le staff peut supprimer un ticket.', 
            ephemeral: true 
        });
    }

    // Confirmation de suppression
    const deleteEmbed = new EmbedBuilder()
        .setTitle('🗑️ Supprimer définitivement')
        .setDescription('⚠️ Cette action est irréversible !')
        .setColor('#ff0000');

    const deleteRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('confirm_delete')
            .setLabel('Oui, supprimer')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('💀'),
        new ButtonBuilder()
            .setCustomId('cancel_delete')
            .setLabel('Annuler')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❌')
    );

    await interaction.reply({
        embeds: [deleteEmbed],
        components: [deleteRow]
    });
}

async function handleConfirmDelete(interaction) {
    const { channel } = interaction;
    const ticket = activeTickets.get(channel.id);
    
    if (!ticket) {
        return interaction.reply({ content: '❌ Ticket non trouvé.', ephemeral: true });
    }

    await interaction.reply('🗑️ Suppression définitive...');

    // Supprimer de la liste
    activeTickets.delete(channel.id);
    ticketStats.deleted++;
    await saveTicketData();

    // Supprimer le salon
    await channel.delete();
}

async function handleCancelDelete(interaction) {
    await interaction.update({
        content: '❌ Suppression annulée.',
        embeds: [],
        components: []
    });
}

async function notifyTicketCreation(ticketChannel, user, client) {
    const notificationChannelId = '1401216183709077535'; // Remplacez par l'ID du salon de notifications
    const modRoleId = TICKET_CONFIG.staffRoleId; // Utilise le rôle staff déjà configuré
    
    const notificationChannel = client.channels.cache.get(notificationChannelId);
    if (!notificationChannel) {
        console.error('Salon de notification introuvable');
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle('🎫 Nouveau Ticket')
        .addFields(
            { name: 'Auteur', value: `${user}`, inline: true },
            { name: 'Salon', value: `[Accéder au ticket](https://discord.com/channels/${ticketChannel.guild.id}/${ticketChannel.id})`, inline: true }
        )
        .setColor('#00ff00')
        .setTimestamp();

    await notificationChannel.send({
        content: `<@&${modRoleId}>`,
        embeds: [embed]
    });
}