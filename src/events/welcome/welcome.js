const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');


// Enregistrer la police personnalisée
registerFont(path.join(__dirname, '../assets/fonts/DejaVuSans-Bold.ttf'), { family: 'DejaVu Sans' });

module.exports = async (member) => {
    try {
        // Dimensions
        const padding = 40;
        const canvasWidth = 1000;
        const canvasHeight = 450;
        const canvas = createCanvas(canvasWidth, canvasHeight);
        const ctx = canvas.getContext('2d');

        // Fond dégradé sombre
        const gradient = ctx.createLinearGradient(canvasWidth, 0, 0, canvasHeight);

        gradient.addColorStop(0, '#0F2027');
        gradient.addColorStop(1, '#2C5364');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Coordonnées
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;

        // Avatar
        const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 512 });
        const avatar = await loadImage(avatarURL);

        const avatarSize = 180;
        const avatarX = centerX;
        const avatarY = centerY - 90;

        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
        ctx.restore();

        // Bordure avatar
        ctx.strokeStyle = '#b9b9b9ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarSize / 2 + 3, 0, Math.PI * 2);
        ctx.stroke();

        // Texte de bienvenue
        ctx.fillStyle = '#ffffff';
        let fontSize = 48;
        const maxWidth = canvasWidth - (padding * 2) - 40;
        let welcomeText = `Bienvenue ${member.user.displayName} sur le serveur !`;

        ctx.font = `bold ${fontSize}px "DejaVu Sans"`;
        while (ctx.measureText(welcomeText).width > maxWidth && fontSize > 24) {
            fontSize -= 2;
            ctx.font = `bold ${fontSize}px "DejaVu Sans"`;
        }

        ctx.textAlign = 'center';
        ctx.fillText(welcomeText, centerX, centerY + 60);

        // Texte nombre de membres
        ctx.font = `36px "DejaVu Sans"`;
        ctx.fillStyle = '#e1eaf0ff';
        const memberText = `tu es le ${member.guild.memberCount.toLocaleString('fr-FR')}ème membre.`;
        ctx.fillText(memberText, centerX, centerY + 110);

        // Ligne décorative
        ctx.strokeStyle = '#207dacff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX - 150, centerY + 130);
        ctx.lineTo(centerX + 150, centerY + 130);
        ctx.stroke();

        // Buffer image
        const buffer = canvas.toBuffer('image/png');
        const attachment = new AttachmentBuilder(buffer, {
            name: 'welcome.png',
            description: 'Image de bienvenue personnalisée'
        });

        // Envoi dans le salon
        const channel = member.guild.channels.cache.get('1386740759608426496'); // Assure-toi que c’est bien le bon ID
        if (channel && channel.isTextBased()) {
            await channel.send({
                content: `${member}`,
                files: [attachment]
            });
        }

    } catch (error) {
        console.error('Erreur lors de la création de l\'image de bienvenue :', error);

        // Fallback Embed
        const welcomeEmbed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setDescription(`**Bienvenue ${member.user.displayName} sur le serveur !**\n\ntu es le ${member.guild.memberCount.toLocaleString('fr-FR')}ème membre.`)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setTimestamp();

        const channel = member.guild.channels.cache.get('1386740759608426496');
        if (channel && channel.isTextBased()) {
            await channel.send({
                content: `${member}`,
                embeds: [welcomeEmbed]
            });
        }
    }
}
