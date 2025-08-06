const { readdirSync } = require("fs");

module.exports = function loadCommands(client) {

    let count = 0;
    const dirsCommands = readdirSync("./commands/");

    for(const dir of dirsCommands) {
        const filesDir = readdirSync(`./commands/${dir}/`).filter(f => f.endsWith(".js"));
        for(const file of filesDir) {
            const command = require(`../commands/${dir}/${file}`);
            client.commands.set(command.data.name, command);
            count++;
        };
    };

    console.log(`[Commands] => ${count} loaded commands`);
};