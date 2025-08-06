module.exports = async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'hey') {
        await interaction.reply(`Hey ${interaction.user.displayName || interaction.user.username} !`);
    }

    else if (interaction.commandName === 'ping') {
        await interaction.reply(`🏓 Latence : ${Date.now() - interaction.createdTimestamp}ms`);
    }

    else if (interaction.commandName === 'add') {
        const num1 = interaction.options.getNumber('num1');
        const num2 = interaction.options.getNumber('num2');
        const sum = num1 + num2;
        await interaction.reply(`➕ ${num1} + ${num2} = ${sum}`);
    }
}