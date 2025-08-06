const {Guild} = require('discord.js')

module.exports = async (member) => {
    const roleId = '1386748221073653942';

    const role = member.guild.roles.cache.get(roleId);
    if (!role) {
        return console.error('❌ Rôle auto non trouvé !');
    }

    try {
        await member.roles.add(role);
        console.log(`✅ Rôle "${role.name}" ajouté à ${member.user.tag}`);
    } catch (error) {
        console.error(`❌ Impossible d'ajouter le rôle à ${member.user.tag}:`, error);
    }
};