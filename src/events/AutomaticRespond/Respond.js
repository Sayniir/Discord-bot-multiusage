module.exports = async (message, client) => {


    // anglais

    if(message.content.toLowerCase().includes('hello')){
        await message.react('👋')
        message.channel.send("Hi")
    }
    else if(message.content.toLowerCase().includes('help')){
        await message.channel.send('you can go to <#1386913263345995836>')
    }
    else if(message.content.toLowerCase().includes('rule')){
        await message.channel.send('You can find the rules right here <#1386740813794643978>')
    }    
    else if(message.content.toLowerCase().includes('new')){
        await message.channel.send('You can find the news right here ! <#1386740901329764554>')
    }



    // français

    if(message.content.toLowerCase().includes('Salut')){
        await message.react('👋')
        message.channel.send("Salut")
    }
    else if(message.content.toLowerCase().includes('regle')){
        await message.channel.send('You can find the rules right here <#1386740813794643978>')
    }   
    else if(message.content.toLowerCase().includes('nouveau')){
        await message.channel.send('You can find the news right here ! <#1386740901329764554>')
    } 
    else if(message.content.toLowerCase().includes('aide')){
        await message.channel.send('you can find help right here <#1386913263345995836>')
    }
    else if(message.content.toLowerCase().includes('bite')){
        await message.react('👀')
    }


};