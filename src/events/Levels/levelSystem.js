const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
  AttachmentBuilder,
  MessageFlags,
  PermissionsBitField,
} = require("discord.js");
const fs = require("fs").promises;
const path = require("path");
const { createCanvas, loadImage } = require("canvas");

// Configuration
const LEVELS_CONFIG = {
  dataFile: "./data/levels.json",
  xpCooldown: 60 * 1000,
  dropDuration: 120000,
};

// Système de permissions
const requiredPermissions = {
  ban: PermissionFlagsBits.BanMembers,
  warn: PermissionFlagsBits.KickMembers,
  kick: PermissionFlagsBits.KickMembers,
  timeout: PermissionFlagsBits.ModerateMembers,
  unban: PermissionFlagsBits.BanMembers,
  untimeout: PermissionFlagsBits.ModerateMembers,
  slowmode: PermissionFlagsBits.ManageChannels,
  lock: PermissionFlagsBits.ManageChannels,
  unlock: PermissionFlagsBits.ManageChannels,
  userinfo: null,
  serverinfo: null,
  avatar: null,
  ping: null,
};

async function checkPermissions(interaction, permission) {
  if (!interaction.inGuild()) {
    await interaction.reply({
      content: "❌ Cette commande n'est utilisable que dans un serveur",
      ephemeral: true,
    });
    return false;
  }

  const member = interaction.member;
  const bot = interaction.guild.members.me;

  if (permission && !member.permissions.has(permission)) {
    await interaction.reply({
      content: `❌ Vous n'avez pas la permission requise: \`${permission}\``,
      ephemeral: true,
    });
    return false;
  }

  if (permission && !bot.permissions.has(permission)) {
    await interaction.reply({
      content: `❌ Je n'ai pas la permission: \`${permission}\``,
      ephemeral: true,
    });
    return false;
  }

  return true;
}

// Seuils d'XP pour 100 niveaux
const LEVEL_THRESHOLDS = [
  100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700, 3250, 3850, 4500, 5200,
  5950, 6750, 7600, 8500, 9450, 10450, 11500, 12600, 13750, 14950, 16200, 17500,
  18850, 20250, 21700, 23200, 24750, 26350, 28000, 29700, 31450, 33250, 35100,
  37000, 38950, 40950, 43000, 45100, 47250, 49450, 51700, 54000, 56350, 58750,
  61200, 63700, 66250, 68850, 71500, 74200, 76950, 79750, 82600, 85500, 88450,
  91450, 94500, 97600, 100750, 103950, 107200, 110500, 113850, 117250, 120700,
  124200, 127750, 131350, 135000, 138700, 142450, 146250, 150100, 154000,
  157950, 161950, 166000, 170100, 174250, 178450, 182700, 187000, 191350,
  195750, 200200, 204700, 209250, 213850, 218500, 223200, 227950, 232750,
  237600, 242500, 247450, 252450, 257500,
];

// Données
let levelsData = {};
let activeDrops = new Map();

// Initialisation des dossiers
async function ensureLevelsFolders() {
  try {
    await fs.mkdir(path.dirname(LEVELS_CONFIG.dataFile), { recursive: true });
  } catch (error) {
    console.error("Erreur création dossiers niveaux:", error);
  }
}

// Charger les données
async function loadLevelsData() {
  try {
    const data = await fs.readFile(LEVELS_CONFIG.dataFile, "utf-8");
    levelsData = JSON.parse(data);
  } catch (error) {
    levelsData = {};
  }
}

// Sauvegarder les données
async function saveLevelsData() {
  try {
    await fs.writeFile(
      LEVELS_CONFIG.dataFile,
      JSON.stringify(levelsData, null, 2),
      "utf-8"
    );
  } catch (error) {
    console.error("Erreur sauvegarde niveaux:", error);
  }
}

// Obtenir les données utilisateur
function getUserData(guildId, userId) {
  if (!levelsData[guildId]) levelsData[guildId] = {};
  if (!levelsData[guildId][userId]) {
    levelsData[guildId][userId] = { xp: 0, lastMessage: 0 };
    saveLevelsData().catch(console.error);
  }
  return levelsData[guildId][userId];
}

// Calculer le niveau
function calculateLevel(xp) {
  let level = 0;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }

  const currentLevelXP = level > 0 ? LEVEL_THRESHOLDS[level - 1] : 0;
  const nextLevelXP =
    level < LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[level] : currentLevelXP;
  const progress = xp - currentLevelXP;
  const requiredXP = nextLevelXP - currentLevelXP;
  const progressPercentage = Math.round((progress / requiredXP) * 100);

  return {
    level,
    currentXP: xp,
    nextLevelXP,
    currentLevelXP,
    requiredXP,
    progress,
    progressPercentage,
  };
}

// Modifier l'XP d'un utilisateur
async function modifyXP(guildId, userId, amount) {
  const userData = getUserData(guildId, userId);
  userData.xp = Math.max(0, userData.xp + amount);
  await saveLevelsData();
}

// Créer la carte de niveau
async function createLevelCard(member, levelData) {
  const canvas = createCanvas(1000, 400);
  const ctx = canvas.getContext("2d");

  // === FOND GRADIENT DOUX ===
  const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bg.addColorStop(0, "#0f172a");
  bg.addColorStop(1, "#1e293b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // === BOÎTE GÉNÉRALE CENTRALE ===
  const boxX = 40,
    boxY = 40,
    boxW = 920,
    boxH = 320,
    radius = 40;
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.beginPath();
  ctx.moveTo(boxX + radius, boxY);
  ctx.lineTo(boxX + boxW - radius, boxY);
  ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + radius);
  ctx.lineTo(boxX + boxW, boxY + boxH - radius);
  ctx.quadraticCurveTo(
    boxX + boxW,
    boxY + boxH,
    boxX + boxW - radius,
    boxY + boxH
  );
  ctx.lineTo(boxX + radius, boxY + boxH);
  ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - radius);
  ctx.lineTo(boxX, boxY + radius);
  ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
  ctx.closePath();
  ctx.fill();

  // === AVATAR À GAUCHE ===
  try {
    const avatar = await loadImage(
      member.displayAvatarURL({ extension: "png", size: 256 })
    );
    ctx.save();
    ctx.beginPath();
    ctx.arc(160, 200, 100, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatar, 60, 100, 200, 200);
    ctx.restore();
  } catch {
    ctx.fillStyle = "#38bdf8";
    ctx.font = "60px Arial";
    ctx.textAlign = "center";
    ctx.fillText("👤", 160, 220);
  }

  // === INFOS AU CENTRE ===
  const centerX = 300;
  ctx.fillStyle = "#f1f5f9";
  ctx.font = 'bold 42px "Segoe UI", sans-serif';
  ctx.textAlign = "left";
  ctx.fillText(member.displayName, centerX, 130);
  ctx.font = '30px "Segoe UI", sans-serif';
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(`Niveau ${levelData.level}`, centerX, 170);

  // === BARRE DE PROGRESSION ===
  const barX = centerX;
  const barY = 210;
  const barW = 600;
  const barH = 40;
  const barR = barH / 2;
  const progress = (levelData.progress / levelData.requiredXP) * barW;

  // Fond
  ctx.fillStyle = "#334155";
  ctx.beginPath();
  ctx.moveTo(barX + barR, barY);
  ctx.lineTo(barX + barW - barR, barY);
  ctx.quadraticCurveTo(barX + barW, barY, barX + barW, barY + barR);
  ctx.lineTo(barX + barW, barY + barH - barR);
  ctx.quadraticCurveTo(
    barX + barW,
    barY + barH,
    barX + barW - barR,
    barY + barH
  );
  ctx.lineTo(barX + barR, barY + barH);
  ctx.quadraticCurveTo(barX, barY + barH, barX, barY + barH - barR);
  ctx.lineTo(barX, barY + barR);
  ctx.quadraticCurveTo(barX, barY, barX + barR, barY);
  ctx.closePath();
  ctx.fill();

  // Remplissage
  const fillW = Math.max(barR * 2, progress);
  const fillG = ctx.createLinearGradient(barX, barY, barX + fillW, barY);
  fillG.addColorStop(0, "#38bdf8");
  fillG.addColorStop(1, "#0ea5e9");
  ctx.fillStyle = fillG;
  ctx.beginPath();
  ctx.moveTo(barX + barR, barY);
  ctx.lineTo(barX + fillW - barR, barY);
  ctx.quadraticCurveTo(barX + fillW, barY, barX + fillW, barY + barR);
  ctx.lineTo(barX + fillW, barY + barH - barR);
  ctx.quadraticCurveTo(
    barX + fillW,
    barY + barH,
    barX + fillW - barR,
    barY + barH
  );
  ctx.lineTo(barX + barR, barY + barH);
  ctx.quadraticCurveTo(barX, barY + barH, barX, barY + barH - barR);
  ctx.lineTo(barX, barY + barR);
  ctx.quadraticCurveTo(barX, barY, barX + barR, barY);
  ctx.closePath();
  ctx.fill();

  // Texte XP
  ctx.fillStyle = "#cbd5e1";
  ctx.font = '20px "Segoe UI", sans-serif';
  ctx.fillText(
    `${levelData.progressPercentage}% │ ${levelData.progress} / ${levelData.requiredXP} XP`,
    barX,
    barY + 70
  );

  // === BADGE DE NIVEAU À DROITE ===
  const badgeX = 880,
    badgeY = 100,
    badgeR = 35;
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
  ctx.fillStyle = "#0ea5e91a";
  ctx.fill();
  ctx.strokeStyle = "#0ea5e9";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.font = 'bold 28px "Segoe UI", sans-serif';
  ctx.fillStyle = "#0ea5e9";
  ctx.textAlign = "center";
  ctx.fillText(levelData.level.toString(), badgeX, badgeY + 10);

  return new AttachmentBuilder(canvas.toBuffer(), { name: "level.png" });
}

// Créer l'image du classement
async function createLeaderboardImage(topMembers) {
  const ligneHeight = 90;
  const minHeight = 500;
  const paddingHeight = 180;
  const canvasHeight = Math.max(
    paddingHeight + topMembers.length * ligneHeight,
    minHeight
  );
  const canvas = createCanvas(1200, canvasHeight);
  const ctx = canvas.getContext("2d");

  // Fond dégradé
  const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bg.addColorStop(0, "#0f172a");
  bg.addColorStop(1, "#1e293b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Titre
  ctx.font = 'bold 48px "Segoe UI", sans-serif';
  ctx.fillStyle = "#f1f5f9";
  ctx.textAlign = "center";
  ctx.fillText("🏆 Classement des Niveaux", canvas.width / 2, 80);

  // En-têtes
  ctx.font = 'bold 24px "Segoe UI", sans-serif';
  ctx.fillStyle = "#94a3b8";
  ctx.textAlign = "left";
  ctx.fillText("#", 60, 140);
  ctx.fillText("Membre", 180, 140);
  ctx.fillText("Niveau", 750, 140);
  ctx.fillText("XP", 1000, 140);

  // Ligne décorative
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(50, 150);
  ctx.lineTo(canvas.width - 50, 150);
  ctx.stroke();

  for (let i = 0; i < topMembers.length; i++) {
    const yPos = 180 + i * ligneHeight;
    const member = topMembers[i];

    // Fond arrondi
    const entryX = 50;
    const entryW = canvas.width - 100;
    const entryH = 70;
    const r = 25;
    ctx.fillStyle =
      i % 2 === 0 ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)";
    ctx.beginPath();
    ctx.moveTo(entryX + r, yPos);
    ctx.lineTo(entryX + entryW - r, yPos);
    ctx.quadraticCurveTo(entryX + entryW, yPos, entryX + entryW, yPos + r);
    ctx.lineTo(entryX + entryW, yPos + entryH - r);
    ctx.quadraticCurveTo(
      entryX + entryW,
      yPos + entryH,
      entryX + entryW - r,
      yPos + entryH
    );
    ctx.lineTo(entryX + r, yPos + entryH);
    ctx.quadraticCurveTo(entryX, yPos + entryH, entryX, yPos + entryH - r);
    ctx.lineTo(entryX, yPos + r);
    ctx.quadraticCurveTo(entryX, yPos, entryX + r, yPos);
    ctx.closePath();
    ctx.fill();

    // Position
    ctx.fillStyle = "#38bdf8";
    ctx.textAlign = "left";
    ctx.font = '22px "Segoe UI", sans-serif';
    ctx.fillText(`#${i + 1}`, 60, yPos + 45);

    // Avatar
    try {
      const avatar = await loadImage(member.avatarURL);
      ctx.save();
      const avatarRadius = 26;
      const avatarX = 140;
      const avatarY = yPos + entryH / 2;

      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        avatar,
        avatarX - avatarRadius,
        avatarY - avatarRadius,
        avatarRadius * 2,
        avatarRadius * 2
      );
      ctx.restore();

      // Bordure
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.stroke();
    } catch (err) {
      // Fallback : cercle avec initiale
      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.arc(140, yPos + entryH / 2, 26, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#cbd5e1";
      ctx.textAlign = "center";
      ctx.font = 'bold 26px "Segoe UI", sans-serif';
      ctx.fillText(
        (member.username[0] || "?").toUpperCase(),
        140,
        yPos + entryH / 2 + 10
      );
    }

    // Nom
    ctx.textAlign = "left";
    ctx.fillStyle = "#f1f5f9";
    ctx.font =
      i === 0
        ? 'bold 24px "Segoe UI", sans-serif'
        : '22px "Segoe UI", sans-serif';
    const displayName =
      member.username.length > 22
        ? member.username.slice(0, 20) + "…"
        : member.username;
    ctx.fillText(displayName, 180, yPos + 45);

    // Niveau
    ctx.textAlign = "center";
    ctx.fillStyle = "#f1f5f9";
    ctx.font = '22px "Segoe UI", sans-serif';
    ctx.fillText(member.level.toString(), 780, yPos + 45);

    // XP
    ctx.fillText(member.xp.toLocaleString(), 1020, yPos + 45);
  }

  return new AttachmentBuilder(canvas.toBuffer(), { name: "leaderboard.png" });
}

// === HANDLERS DE MODÉRATION SÉCURISÉS ET CORRIGÉS ===

async function sendReply(
  interaction,
  { content, type = "success", ephemeral = false }
) {
  const icons = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" };
  const embed = new EmbedBuilder()
    .setDescription(`${icons[type]} ${content}`)
    .setColor(
      type === "success"
        ? "#2ecc71"
        : type === "error"
        ? "#e74c3c"
        : type === "warning"
        ? "#f39c12"
        : "#3498db"
    );

  return interaction.reply({
    embeds: [embed],
    ephemeral: ephemeral || type === "error",
  });
}

// Ping amélioré
async function handlePing(interaction) {
  const latency = Date.now() - interaction.createdTimestamp;
  await sendReply(interaction, {
    content: `Pong! 🏓 (Latence: ${latency}ms)`,
    type: "info",
  });
}

// Fonction modération générique
async function moderateMember(interaction, action, options = {}) {
  const { member, reason = "Non spécifiée", duration } = options;
  const actions = {
    ban: {
      permission: PermissionsBitField.Flags.BanMembers,
      execute: () => member.ban({ reason }),
      success: `${member.user.tag} banni`,
      error: "bannissement",
    },
    kick: {
      permission: PermissionsBitField.Flags.KickMembers,
      execute: () => member.kick(reason),
      success: `${member.user.tag} expulsé`,
      error: "expulsion",
    },
    timeout: {
      permission: PermissionsBitField.Flags.ModerateMembers,
      execute: () => member.timeout(duration * 60000, reason),
      success: `${member.user.tag} timeout (${duration} min)`,
      error: "mise en timeout",
    },
  };

  const config = actions[action];

  // Vérifications
  if (!interaction.memberPermissions.has(config.permission)) {
    return sendReply(interaction, {
      content: `Permission refusée. Nécessite: \`${config.permission}\``,
      type: "error",
    });
  }

  if (!member) {
    return sendReply(interaction, {
      content: "Membre introuvable",
      type: "error",
    });
  }

  if (member.id === interaction.user.id) {
    return sendReply(interaction, {
      content: "Auto-modération impossible",
      type: "error",
    });
  }

  try {
    await config.execute();
    await sendReply(interaction, {
      content: `${config.success}. Raison: ${reason}`,
      type: "success",
    });
  } catch (error) {
    console.error(`Erreur ${config.error}:`, error);
    sendReply(interaction, {
      content: `Échec du ${config.error}`,
      type: "error",
    });
  }
}

// Warn avec stockage
const warnings = new Map();

async function handleWarn(interaction, member, reason = "Non spécifiée") {
  if (!member) {
    return sendReply(interaction, {
      content: "Membre introuvable",
      type: "error",
    });
  }

  const key = `${interaction.guildId}-${member.id}`;
  const userWarnings = warnings.get(key) || [];

  userWarnings.push({
    reason,
    date: new Date(),
    moderator: interaction.user.tag,
  });

  warnings.set(key, userWarnings);

  await sendReply(interaction, {
    content: `${member.user.tag} averti (Total: ${userWarnings.length}). Raison: ${reason}`,
    type: "warning",
  });
}

// Ban
async function handleBan(interaction, member, reason = "Non spécifiée") {
  await moderateMember(interaction, "ban", { member, reason });
}

// Kick
async function handleKick(interaction, member, reason = "Non spécifiée") {
  await moderateMember(interaction, "kick", { member, reason });
}

// Timeout
async function handleTimeout(
  interaction,
  member,
  duration,
  reason = "Non spécifiée"
) {
  await moderateMember(interaction, "timeout", { member, reason, duration });
}

// Unban amélioré
async function handleUnban(interaction) {
  const user = interaction.options.getUser("utilisateur");
  if (!user) {
    return sendReply(interaction, {
      content: "Utilisateur non spécifié",
      type: "error",
    });
  }

  try {
    await interaction.guild.bans.remove(user);
    await sendReply(interaction, {
      content: `${user.tag} débanni`,
      type: "success",
    });
  } catch (err) {
    console.error("Erreur unban:", err);
    sendReply(interaction, {
      content: err.message.includes("Unknown Ban")
        ? "Utilisateur non banni"
        : "Erreur inconnue",
      type: "error",
    });
  }
}

// Untimeout
async function handleUntimeout(interaction) {
  const member = interaction.options.getMember("membre");

  if (!member) {
    return sendReply(interaction, {
      content: "Membre introuvable",
      type: "error",
    });
  }

  try {
    await member.disableCommunicationUntil(null);
    await sendReply(interaction, {
      content: `Timeout supprimé pour ${member.user.tag}`,
      type: "success",
    });
  } catch (error) {
    console.error("Erreur untimeout:", error);
    sendReply(interaction, {
      content: error.message.includes("Permissions")
        ? "Permissions insuffisantes"
        : "Erreur système",
      type: "error",
    });
  }
}

// Slowmode avec limites
async function handleSlowmode(interaction) {
  const seconds = interaction.options.getInteger("secondes") || 0;

  if (seconds > 21600) {
    return sendReply(interaction, {
      content: "Durée maximale: 6 heures (21600s)",
      type: "error",
    });
  }

  try {
    await interaction.channel.setRateLimitPerUser(seconds);
    await sendReply(interaction, {
      content: `Slowmode: ${seconds}s`,
      type: seconds > 0 ? "warning" : "success",
    });
  } catch (err) {
    console.error("Erreur slowmode:", err);
    sendReply(interaction, {
      content: "Permissions manquantes",
      type: "error",
    });
  }
}

// Lock/Unlock
async function toggleChannelLock(interaction, lock = true) {
  try {
    await interaction.channel.permissionOverwrites.edit(interaction.guild.id, {
      SendMessages: lock ? false : null,
    });

    await sendReply(interaction, {
      content: lock ? "🔒 Salon verrouillé" : "🔓 Salon déverrouillé",
      type: "success",
    });
  } catch (err) {
    console.error(lock ? "Erreur lock:" : "Erreur unlock:", err);
    sendReply(interaction, {
      content: `Permissions manquantes`,
      type: "error",
    });
  }
}

async function handleClearMessageCommand(interaction) {
  // Vérification des permissions (double sécurité)
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return await interaction.reply({
      content: "❌ Vous n'avez pas la permission de gérer les messages.",
      ephemeral: true,
    });
  }

  // Vérifier que le bot a les permissions nécessaires
  if (
    !interaction.guild.members.me.permissions.has(
      PermissionFlagsBits.ManageMessages
    )
  ) {
    return await interaction.reply({
      content:
        "❌ Je n'ai pas la permission de gérer les messages dans ce serveur.",
      ephemeral: true,
    });
  }

  const amount = interaction.options.getInteger("nombre");
  const user = interaction.options.getUser("utilisateur");

  // Validation supplémentaire
  if (amount < 1 || amount > 100) {
    return await interaction.reply({
      content: "❌ Le nombre de messages doit être entre 1 et 100.",
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // Récupérer les messages (limite augmentée pour une meilleure sélection)
    const fetchLimit = Math.min(amount * 2, 100); // Récupérer plus pour filtrer
    const messages = await interaction.channel.messages.fetch({
      limit: fetchLimit,
    });
    let filtered = Array.from(messages.values());

    // Filtrer par utilisateur si spécifié
    if (user) {
      filtered = filtered.filter((msg) => msg.author.id === user.id);
    }

    // Limiter au nombre demandé
    const toDelete = filtered.slice(0, amount);

    // Vérifier s'il y a des messages à supprimer
    if (toDelete.length === 0) {
      return await interaction.editReply({
        content: user
          ? `❌ Aucun message récent de ${user.tag} trouvé dans les ${fetchLimit} derniers messages`
          : "❌ Aucun message à supprimer",
      });
    }

    // Séparer les messages récents (< 14 jours) des anciens
    const now = Date.now();
    const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000; // 14 jours en millisecondes

    const recentMessages = toDelete.filter(
      (msg) => msg.createdTimestamp > twoWeeksAgo
    );
    const oldMessages = toDelete.filter(
      (msg) => msg.createdTimestamp <= twoWeeksAgo
    );

    let deletedCount = 0;

    // Suppression en masse pour les messages récents
    if (recentMessages.length > 0) {
      try {
        await interaction.channel.bulkDelete(recentMessages, true);
        deletedCount += recentMessages.length;
      } catch (bulkError) {
        console.error("Erreur suppression en masse:", bulkError);
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
      .setColor(deletedCount > 0 ? "#00ff00" : "#ffaa00")
      .setDescription(
        deletedCount > 0
          ? `🗑️ ${deletedCount} message${deletedCount > 1 ? "s" : ""} supprimé${
              deletedCount > 1 ? "s" : ""
            }${user ? ` de ${user.tag}` : ""}`
          : `⚠️ Aucun message n'a pu être supprimé${
              user ? ` de ${user.tag}` : ""
            }`
      )
      .setFooter({
        text: `Action effectuée par ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL({ size: 32 }),
      })
      .setTimestamp();

    // Ajouter des détails si suppression partielle
    if (deletedCount < toDelete.length) {
      embed.addFields({
        name: "⚠️ Information",
        value: `${
          toDelete.length - deletedCount
        } message(s) n'ont pas pu être supprimés (probablement trop anciens ou permissions insuffisantes)`,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });

    // Log de modération (optionnel - vous pouvez configurer un canal de logs)
    if (typeof logModerationAction === "function") {
      logModerationAction(interaction, "CLEAR_MESSAGES", {
        deletedCount,
        targetUser: user,
        requestedAmount: amount,
      });
    }

    // Supprimer automatiquement la confirmation après 10 secondes
    setTimeout(() => {
      interaction.deleteReply().catch((err) => {
        if (err.code !== 10008) {
          // Ignore "Unknown Message" error
          console.error("Erreur suppression réponse:", err);
        }
      });
    }, 10000);
  } catch (error) {
    console.error("Erreur suppression messages:", error);

    const errorEmbed = new EmbedBuilder()
      .setColor("#ff0000")
      .setDescription(
        "❌ Une erreur est survenue lors de la suppression des messages"
      )
      .addFields({
        name: "Détails de l'erreur",
        value: `\`${error.message}\``,
        inline: false,
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function logModerationAction(interaction, action, details = {}) {
  try {
    // Vous pouvez configurer un canal de logs ici
    const logChannelId = process.env.MODERATION_LOG_CHANNEL; // ou depuis une config
    if (!logChannelId) return;

    const logChannel = interaction.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    const logEmbed = new EmbedBuilder()
      .setColor("#ffa500")
      .setTitle("📋 Action de Modération")
      .addFields(
        { name: "Action", value: action, inline: true },
        {
          name: "Modérateur",
          value: `${interaction.user.tag} (${interaction.user.id})`,
          inline: true,
        },
        {
          name: "Canal",
          value: `${interaction.channel.name} (${interaction.channel.id})`,
          inline: true,
        }
      )
      .setTimestamp();

    // Ajouter des détails spécifiques
    if (details.deletedCount !== undefined) {
      logEmbed.addFields({
        name: "Messages supprimés",
        value: details.deletedCount.toString(),
        inline: true,
      });
    }
    if (details.targetUser) {
      logEmbed.addFields({
        name: "Utilisateur ciblé",
        value: `${details.targetUser.tag} (${details.targetUser.id})`,
        inline: true,
      });
    }
    if (details.requestedAmount) {
      logEmbed.addFields({
        name: "Nombre demandé",
        value: details.requestedAmount.toString(),
        inline: true,
      });
    }

    await logChannel.send({ embeds: [logEmbed] });
  } catch (error) {
    console.error("Erreur logging modération:", error);
  }
}

// Méthode utilitaire pour vérifier les permissions
function checkPermissionsUtil(interaction, requiredPermissions) {
  const memberPermissions = interaction.member.permissions;
  const botPermissions = interaction.guild.members.me.permissions;

  const missingMemberPerms = requiredPermissions.filter(
    (perm) => !memberPermissions.has(perm)
  );
  const missingBotPerms = requiredPermissions.filter(
    (perm) => !botPermissions.has(perm)
  );

  return {
    member: missingMemberPerms,
    bot: missingBotPerms,
    hasAll: missingMemberPerms.length === 0 && missingBotPerms.length === 0,
  };
}

// Userinfo enrichi
async function handleUserinfo(interaction) {
  try {
    // Récupération dynamique de l'utilisateur (option ou utilisateur actuel)
    const targetUser =
      interaction.options.getUser("utilisateur") || interaction.user;
    const member = await interaction.guild.members
      .fetch(targetUser.id)
      .catch(() => null);

    if (!member) {
      return sendReply(interaction, {
        content: "❌ Membre introuvable sur ce serveur",
        type: "error",
        ephemeral: true,
      });
    }

    // Formatage des rôles (exclure @everyone)
    const roles = member.roles.cache
      .filter((role) => role.id !== interaction.guild.id)
      .sort((a, b) => b.position - a.position)
      .map((role) => role.toString());

    // Création de l'embed enrichi
    const embed = new EmbedBuilder()
      .setAuthor({
        name: `Profil de ${member.user.tag}`,
        iconURL: member.displayAvatarURL(),
      })
      .setThumbnail(member.displayAvatarURL({ size: 512 }))
      .setColor(member.displayHexColor || "#3498db")
      .addFields(
        { name: "📛 Identifiant", value: member.id, inline: true },
        { name: "🆔 Surnom", value: member.nickname || "Aucun", inline: true },
        {
          name: "🎭 Rôles",
          value: roles.slice(0, 10).join(" ") || "Aucun",
          inline: false,
        },
        {
          name: "📅 Dates",
          value: `Création: <t:${Math.floor(
            member.user.createdTimestamp / 1000
          )}:d>\nArrivée: <t:${Math.floor(member.joinedTimestamp / 1000)}:d>`,
          inline: true,
        },
        {
          name: "⏱️ Statut",
          value: `**Statut:** ${getStatus(
            member.presence?.status
          )}\n**Client:** ${getPlatform(member.presence)}`,
          inline: true,
        }
      )
      .setFooter({
        text: `Demandé par ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL(),
      });

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error("Erreur userinfo:", error);
    sendReply(interaction, {
      content: "❌ Erreur lors de la récupération des informations",
      type: "error",
    });
  }
}

// Fonctions utilitaires pour le statut
function getStatus(status) {
  const statusMap = {
    online: "🟢 En ligne",
    idle: "🌙 Inactif",
    dnd: "⛔ Ne pas déranger",
    offline: "⚫ Hors-ligne",
  };
  return statusMap[status] || "Inconnu";
}

function getPlatform(memberPresence) {
  if (!memberPresence) return "Inconnu";

  const platforms = [];
  if (memberPresence.clientStatus.desktop) platforms.push("💻 Bureau");
  if (memberPresence.clientStatus.mobile) platforms.push("📱 Mobile");
  if (memberPresence.clientStatus.web) platforms.push("🌐 Web");

  return platforms.join(" | ") || "Inconnu";
}

// Serverinfo amélioré
async function handleServerinfo(interaction) {
  const { guild } = interaction;
  const features = {
    PARTNERED: "Partenaire",
    VERIFIED: "Vérifié",
    COMMUNITY: "Communauté",
  };

  const embed = new EmbedBuilder()
    .setTitle(`ℹ️ ${guild.name}`)
    .setThumbnail(guild.iconURL({ size: 512 }))
    .setColor("#9b59b6")
    .addFields(
      {
        name: "👑 Propriétaire",
        value: (await guild.fetchOwner()).user.tag,
        inline: true,
      },
      { name: "👥 Membres", value: guild.memberCount.toString(), inline: true },
      {
        name: "📅 Créé le",
        value: guild.createdAt.toLocaleDateString("fr-FR"),
        inline: true,
      },
      {
        name: "🔊 Salons",
        value: guild.channels.cache.size.toString(),
        inline: true,
      },
      {
        name: "🎭 Rôles",
        value: guild.roles.cache.size.toString(),
        inline: true,
      }
    )
    .setFooter({ text: `ID: ${guild.id}` });

  await interaction.reply({ embeds: [embed] });
}

// Avatar HD
async function handleAvatar(interaction) {
  try {
    // Récupération dynamique de l'utilisateur
    const targetUser =
      interaction.options.getUser("utilisateur") || interaction.user;
    const member = await interaction.guild.members
      .fetch(targetUser.id)
      .catch(() => null);

    const avatarURL =
      member?.displayAvatarURL({
        size: 4096,
        dynamic: true,
        extension: "png",
      }) ||
      targetUser.displayAvatarURL({
        size: 4096,
        dynamic: true,
        extension: "png",
      });

    // Création de l'embed avec menu de formats
    const embed = new EmbedBuilder()
      .setAuthor({
        name: `Avatar de ${targetUser.tag}`,
        iconURL: avatarURL,
      })
      .setDescription(
        [
          `[Télécharger PNG](${avatarURL.replace(
            /\?size=.+$/,
            "?size=4096&format=png"
          )})`,
          `[Télécharger JPG](${avatarURL.replace(
            /\?size=.+$/,
            "?size=4096&format=jpg"
          )})`,
          `[Télécharger WebP](${avatarURL.replace(
            /\?size=.+$/,
            "?size=4096&format=webp"
          )})`,
        ].join(" • ")
      )
      .setImage(avatarURL)
      .setColor("#1abc9c")
      .setFooter({
        text: `Demandé par ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL(),
      });

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error("Erreur avatar:", error);
    sendReply(interaction, {
      content: "❌ Erreur lors de la récupération de l'avatar",
      type: "error",
    });
  }
}

module.exports = (client) => {
  // Initialisation
  (async () => {
    await ensureLevelsFolders();
    await loadLevelsData();
    console.log("Système de niveaux chargé");
  })();

  // Gain d'XP par messages
  client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;

    const guildId = message.guild.id;
    const userId = message.author.id;
    const userData = getUserData(guildId, userId);

    // Cooldown
    const now = Date.now();
    if (now - userData.lastMessage < LEVELS_CONFIG.xpCooldown) return;

    userData.lastMessage = now;

    // Gain d'XP
    const xpGained = Math.floor(Math.random() * 11) + 10;
    userData.xp += xpGained;

    // Vérifier le niveau
    const oldLevel = calculateLevel(userData.xp - xpGained).level;
    const newLevel = calculateLevel(userData.xp).level;

    // Message de niveau
    if (newLevel > oldLevel) {
      await message.channel.send(
        `**GG ${message.author}, tu es maintenant niveau ${newLevel} !**`
      );
    }

    await saveLevelsData();
  });

  // Commandes slash
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    try {
      switch (interaction.commandName) {
        // Commandes de niveau
        case "niveau":
          await handleLevelCommand(interaction);
          break;
        case "classement":
          await handleLeaderboardCommand(interaction);
          break;
        case "dropxp":
          await handleDropXPCommand(interaction);
          break;
        case "adminxp":
          await handleAdminXPCommand(interaction);
          break;

        // Commandes de modération avec permissions
        case "ping":
          if (await checkPermissions(interaction, requiredPermissions.ping)) {
            await handlePing(interaction);
          }
          break;

        case "ban":
          if (await checkPermissions(interaction, requiredPermissions.ban)) {
            const member = interaction.options.getMember("user");
            const reason =
              interaction.options.getString("reason") ||
              "Aucune raison spécifiée";
            await handleBan(interaction, member, reason);
          }
          break;

        case "warn":
          if (await checkPermissions(interaction, requiredPermissions.warn)) {
            const member = interaction.options.getMember("user");
            const reason =
              interaction.options.getString("reason") ||
              "Aucune raison spécifiée";
            await handleWarn(interaction, member, reason);
          }
          break;

        case "kick":
          if (await checkPermissions(interaction, requiredPermissions.kick)) {
            const member = interaction.options.getMember("user");
            const reason =
              interaction.options.getString("reason") ||
              "Aucune raison spécifiée";
            await handleKick(interaction, member, reason);
          }
          break;

        case "timeout":
          if (
            await checkPermissions(interaction, requiredPermissions.timeout)
          ) {
            const member = interaction.options.getMember("user");
            const duration = interaction.options.getInteger("duree") || 60;
            const reason =
              interaction.options.getString("reason") ||
              "Aucune raison spécifiée";
            await handleTimeout(interaction, member, duration, reason);
          }
          break;

        case "unban":
          if (await checkPermissions(interaction, requiredPermissions.unban)) {
            await handleUnban(interaction);
          }
          break;

        case "untimeout":
          if (
            await checkPermissions(interaction, requiredPermissions.untimeout)
          ) {
            await handleUntimeout(interaction);
          }
          break;

        case "slowmode":
          if (
            await checkPermissions(interaction, requiredPermissions.slowmode)
          ) {
            await handleSlowmode(interaction);
          }
          break;

        case "lock":
          if (await checkPermissions(interaction, requiredPermissions.lock)) {
            await handleLock(interaction);
          }
          break;

        case "unlock":
          if (await checkPermissions(interaction, requiredPermissions.unlock)) {
            await handleUnlock(interaction);
          }
          break;

        case "userinfo":
          if (
            await checkPermissions(interaction, requiredPermissions.userinfo)
          ) {
            await handleUserinfo(interaction);
          }
          break;

        case "serverinfo":
          if (
            await checkPermissions(interaction, requiredPermissions.serverinfo)
          ) {
            await handleServerinfo(interaction);
          }
          break;

        case "avatar":
          if (await checkPermissions(interaction, requiredPermissions.avatar)) {
            await handleAvatar(interaction);
          }
          break;
        case "clearmessage":
          if (
            await checkPermissions(
              interaction,
              requiredPermissions.clearmessage
            )
          ) {
            await handleClearMessageCommand(interaction);
          }
          break;
      }
    } catch (error) {
      console.error(`Erreur commande ${interaction.commandName}:`, error);
      await interaction.reply({
        content: "❌ Une erreur est survenue",
        ephemeral: true,
      });
    }
  });

  // Boutons pour drops d'XP
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    const [action, dropId] = interaction.customId.split("-");
    if (action !== "claim_xp") return;

    const dropData = activeDrops.get(dropId);
    if (!dropData) {
      return interaction.reply({ content: "❌ Drop expiré", ephemeral: true });
    }

    // Vérifier expiration
    if (Date.now() > dropData.expiresAt) {
      activeDrops.delete(dropId);
      return interaction.reply({ content: "❌ Drop expiré", ephemeral: true });
    }

    // Vérifier si déjà réclamé
    if (dropData.claimedBy) {
      return interaction.reply({ content: "❌ Déjà réclamé", ephemeral: true });
    }

    // Marquer comme réclamé
    dropData.claimedBy = interaction.user.id;
    activeDrops.set(dropId, dropData);

    // Ajouter l'XP
    await modifyXP(interaction.guild.id, interaction.user.id, dropData.amount);

    // Mettre à jour le message
    const newEmbed = new EmbedBuilder()
      .setTitle("🎁 Drop réclamé!")
      .setDescription(
        `**${dropData.amount} XP** récupérés par ${interaction.user}`
      )
      .setColor("#ff0000");

    const newRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("claimed_xp")
        .setLabel("Déjà réclamé")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

    await interaction.update({ embeds: [newEmbed], components: [newRow] });

    // Confirmation
    await interaction.followUp({
      content: `🎉 +${dropData.amount} XP!`,
      ephemeral: true,
    });
  });

  // --- Gestionnaires de commandes de niveau ---

  async function handleLevelCommand(interaction) {
    const member = interaction.options.getMember("user") || interaction.member;
    const userData = getUserData(interaction.guild.id, member.id);
    const levelData = calculateLevel(userData.xp);

    try {
      const levelCard = await createLevelCard(member, levelData);
      await interaction.reply({ files: [levelCard] });
    } catch (error) {
      console.error("Erreur création carte niveau:", error);
      await interaction.reply({
        content: "❌ Erreur création image",
        ephemeral: true,
      });
    }
  }

  async function handleLeaderboardCommand(interaction) {
    const guildId = interaction.guild.id;
    const guildData = levelsData[guildId];

    if (!guildData || Object.keys(guildData).length === 0) {
      return interaction.reply({
        content: "ℹ️ Aucune donnée",
        ephemeral: true,
      });
    }

    // Préparer les données
    const members = [];
    for (const [userId, data] of Object.entries(guildData)) {
      try {
        const member = await interaction.guild.members.fetch(userId);
        if (member) {
          const levelData = calculateLevel(data.xp);
          members.push({
            id: userId,
            xp: data.xp,
            level: levelData.level,
            username: member.displayName,
            avatarURL: member.displayAvatarURL({ extension: "png", size: 128 }),
          });
        }
      } catch {}
    }

    // Trier et prendre le top 10
    members.sort((a, b) => b.xp - a.xp);
    const topMembers = members.slice(0, 10);

    try {
      const leaderboardImage = await createLeaderboardImage(topMembers);
      await interaction.reply({ files: [leaderboardImage] });
    } catch (error) {
      console.error("Erreur création classement:", error);
      await interaction.reply({
        content: "❌ Erreur création classement",
        ephemeral: true,
      });
    }
  }

  async function handleDropXPCommand(interaction) {
    if (
      !interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)
    ) {
      return interaction.reply({
        content: "❌ Permission requise",
        ephemeral: true,
      });
    }

    const amount = interaction.options.getInteger("montant");
    const dropId = Date.now().toString();
    const expiresAt = Date.now() + LEVELS_CONFIG.dropDuration;

    // Créer le bouton
    const button = new ButtonBuilder()
      .setCustomId(`claim_xp-${dropId}`)
      .setLabel(`Réclamer ${amount} XP`)
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    const embed = new EmbedBuilder()
      .setTitle("🎁 Drop d'XP!")
      .setDescription(
        `**${amount} XP** disponibles!\nPremier arrivé, premier servi!`
      )
      .setColor("#2ecc71")
      .setFooter({ text: "Expire dans 1 minute" });

    await interaction.reply({
      content: "@here Un drop d'XP est disponible!",
      embeds: [embed],
      components: [row],
    });

    // Stocker le drop
    activeDrops.set(dropId, { amount, expiresAt, claimedBy: null });

    // Expiration
    setTimeout(async () => {
      if (activeDrops.has(dropId)) {
        activeDrops.delete(dropId);
        try {
          const expiredEmbed = new EmbedBuilder()
            .setTitle("⏱️ Drop expiré")
            .setDescription(`**${amount} XP** n'ont pas été réclamés!`)
            .setColor("#e74c3c");

          const expiredRow = new ActionRowBuilder().addComponents(
            button
              .setDisabled(true)
              .setLabel("Expiré")
              .setStyle(ButtonStyle.Secondary)
          );

          await interaction.editReply({
            embeds: [expiredEmbed],
            components: [expiredRow],
          });
        } catch {}
      }
    }, LEVELS_CONFIG.dropDuration);
  }

  async function handleAdminXPCommand(interaction) {
    if (
      !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
    ) {
      return interaction.reply({ content: "❌ Admin requis", ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();
    const user =
      interaction.options.getUser("membre") ||
      interaction.options.getUser("source");
    const targetUser = interaction.options.getUser("destinataire");
    const amount = interaction.options.getInteger("montant");

    try {
      let embed;

      switch (subcommand) {
        case "ajouter":
          await modifyXP(interaction.guild.id, user.id, amount);
          embed = new EmbedBuilder()
            .setDescription(`✅ ${amount} XP ajoutés à ${user}`)
            .setColor("#00ff00");
          break;

        case "retirer":
          await modifyXP(interaction.guild.id, user.id, -amount);
          embed = new EmbedBuilder()
            .setDescription(`✅ ${amount} XP retirés à ${user}`)
            .setColor("#ff9900");
          break;

        case "définir":
          const userData = getUserData(interaction.guild.id, user.id);
          userData.xp = Math.max(0, amount);
          await saveLevelsData();
          embed = new EmbedBuilder()
            .setDescription(`✅ XP de ${user} défini à ${amount}`)
            .setColor("#0099ff");
          break;

        case "réinitialiser":
          if (user) {
            const userData = getUserData(interaction.guild.id, user.id);
            userData.xp = 0;
            await saveLevelsData();
            embed = new EmbedBuilder()
              .setDescription(`✅ XP de ${user} réinitialisé`)
              .setColor("#ff9900");
          } else {
            levelsData[interaction.guild.id] = {};
            await saveLevelsData();
            embed = new EmbedBuilder()
              .setDescription("✅ Serveur réinitialisé")
              .setColor("#ff9900");
          }
          break;

        case "transférer":
          const sourceData = getUserData(interaction.guild.id, user.id);
          if (sourceData.xp < amount) {
            return interaction.reply({
              content: `❌ ${user} n'a pas assez d'XP`,
              ephemeral: true,
            });
          }
          sourceData.xp -= amount;
          const targetData = getUserData(interaction.guild.id, targetUser.id);
          targetData.xp += amount;
          await saveLevelsData();
          embed = new EmbedBuilder()
            .setDescription(
              `✅ ${amount} XP transférés de ${user} à ${targetUser}`
            )
            .setColor("#00ff00");
          break;
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      await interaction.reply({
        content: "❌ Erreur opération",
        ephemeral: true,
      });
    }
  }
};
