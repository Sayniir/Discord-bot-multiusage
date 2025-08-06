const { Client, IntentsBitField, EmbedBuilder, ActivityType } = require("discord.js");

let status = [
    {
        name: "Nah, i'd win",
        type: ActivityType.Custom,
    },
    {
        name: "the best streamer",
        type: ActivityType.Streaming,
        url: "https://www.twitch.tv/anyme023",
    },
    {
        name: "with the best bot",
        type: ActivityType.Playing,
    },
    {
        name: "the best community",
        type: ActivityType.Competing,
    },
    {
        name: "#lopsa",
        type: ActivityType.Listening,
    }
]

module.exports = (client) => {
    console.log(`✅ Connecté en tant que ${client.user.tag}`);

    setInterval(() => {
        let random = Math.floor(Math.random() * status.length);
        client.user.setActivity(status[random].name, {
            type: status[random].type,
            url: status[random].url
        });
    }, 100000);

    client.user.setStatus('online');
}