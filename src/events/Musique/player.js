// music.js - Module pour la gestion de la musique streaming
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  getVoiceConnection,
} = require("@discordjs/voice");
const ytdl = require("@distube/ytdl-core"); // Version patchée de ytdl-core
const ytSearch = require("yt-search");
const SpotifyWebApi = require("spotify-web-api-node");
const ffmpegStatic = require("ffmpeg-static");
const ytpl = require("ytpl"); // Pour les playlists YouTube
const pLimit = require("p-limit"); // Pour limiter les requêtes parallèles

// Configuration du chemin FFmpeg
if (ffmpegStatic) {
  process.env.FFMPEG_PATH = ffmpegStatic;
} else {
  console.error("ffmpeg-static non trouvé!");
}

// Configuration Spotify
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

// Maps pour stocker les connexions vocales et lecteurs par serveur
const voiceConnections = new Map();
const audioPlayers = new Map();
const queues = new Map();
const voiceChannels = new Map();
const pausedStates = new Map(); // Nouvelle Map pour suivre l'état de pause

class MusicBot {
  constructor(client) {
    this.client = client;
    this.setupEventListeners();
  }

  async init() {
    console.log("🎵 Module musique streaming initialisé");

    if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
      try {
        const data = await spotifyApi.clientCredentialsGrant();
        spotifyApi.setAccessToken(data.body["access_token"]);
        console.log("Spotify API initialisée");

        setInterval(async () => {
          try {
            const data = await spotifyApi.clientCredentialsGrant();
            spotifyApi.setAccessToken(data.body["access_token"]);
          } catch (error) {
            console.error("Erreur renouvellement token Spotify:", error);
          }
        }, 3600000);
      } catch (error) {
        console.warn("⚠️ Erreur initialisation Spotify:", error.message);
      }
    }
  }

  setupEventListeners() {
    this.client.on("interactionCreate", async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      try {
        switch (interaction.commandName) {
          case "play":
            await this.handlePlayCommand(interaction);
            break;
          case "stop":
            await this.handleStopCommand(interaction);
            break;
          case "skip":
            await this.handleSkipCommand(interaction);
            break;
          case "queue":
            await this.handleQueueCommand(interaction);
            break;
          case "nowplaying":
            await this.handleNowPlayingCommand(interaction);
            break;
          case "pause":
            await this.handlePauseCommand(interaction);
            break;
          case "volume":
            await this.handleVolumeCommand(interaction);
            break;
          case "shuffle":
            await this.handleShuffleCommand(interaction);
            break;
          case "clear":
            await this.handleClearCommand(interaction);
            break;
        }
      } catch (error) {
        console.error("Erreur lors du traitement de la commande:", error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content:
              "Une erreur est survenue lors de l'exécution de la commande.",
            ephemeral: true,
          });
        }
      }
    });

    this.client.on("voiceStateUpdate", (oldState, newState) => {
      this.handleVoiceStateUpdate(oldState, newState);
    });
  }

  async handleVolumeCommand(interaction) {
    const guild = interaction.guild;
    const volume = interaction.options.getInteger("niveau");
    const player = audioPlayers.get(guild.id);

    if (!player) {
      return await interaction.reply({
        content: "Aucune musique en cours de lecture.",
        ephemeral: true,
      });
    }

    const volumeLevel = volume / 100;
    if (player.state.resource && player.state.resource.volume) {
      player.state.resource.volume.setVolume(volumeLevel);
    }

    const volumeEmbed = new EmbedBuilder()
      .setColor("#00ff00")
      .setTitle("🔊 Volume ajusté")
      .setDescription(`Volume défini à ${volume}%`);

    await interaction.reply({ embeds: [volumeEmbed] });
  }

  async handleShuffleCommand(interaction) {
    const guild = interaction.guild;
    const queue = queues.get(guild.id);

    if (!queue || queue.length <= 2) {
      return await interaction.reply({
        content: "Pas assez de chansons dans la file pour mélanger.",
        ephemeral: true,
      });
    }

    // Mélanger la queue en gardant la première chanson (en cours)
    const currentSong = queue[0];
    const remainingSongs = queue.slice(1);

    // Algorithme de Fisher-Yates pour mélanger
    for (let i = remainingSongs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remainingSongs[i], remainingSongs[j]] = [
        remainingSongs[j],
        remainingSongs[i],
      ];
    }

    queues.set(guild.id, [currentSong, ...remainingSongs]);

    const shuffleEmbed = new EmbedBuilder()
      .setColor("#ff9900")
      .setTitle("🔀 File d'attente mélangée")
      .setDescription(`${remainingSongs.length} chansons ont été mélangées`);

    await interaction.reply({ embeds: [shuffleEmbed] });
  }

  async handleClearCommand(interaction) {
    const guild = interaction.guild;
    const queue = queues.get(guild.id);

    if (!queue || queue.length <= 1) {
      return await interaction.reply({
        content: "Aucune chanson à supprimer de la file.",
        ephemeral: true,
      });
    }

    const removedCount = queue.length - 1;
    queues.set(guild.id, [queue[0]]); // Garder seulement la chanson actuelle

    const clearEmbed = new EmbedBuilder()
      .setColor("#ff0000")
      .setTitle("🗑️ File d'attente vidée")
      .setDescription(`${removedCount} chanson(s) supprimée(s) de la file`);

    await interaction.reply({ embeds: [clearEmbed] });
  }

  async handlePauseCommand(interaction) {
    const guild = interaction.guild;
    const player = audioPlayers.get(guild.id);

    if (!player) {
      return await interaction.reply({
        content: "Aucune musique en cours de lecture.",
        ephemeral: true,
      });
    }

    const isPaused = pausedStates.get(guild.id) || false;

    if (isPaused) {
      player.unpause();
      pausedStates.set(guild.id, false);

      const resumeEmbed = new EmbedBuilder()
        .setColor("#00ff00")
        .setTitle("▶️ Reprise de la musique")
        .setDescription("La musique a été reprise");

      await interaction.reply({ embeds: [resumeEmbed] });
    } else {
      player.pause();
      pausedStates.set(guild.id, true);

      const pauseEmbed = new EmbedBuilder()
        .setColor("#ffa500")
        .setTitle("⏸️ Musique en pause")
        .setDescription("La musique a été mise en pause");

      await interaction.reply({ embeds: [pauseEmbed] });
    }
  }

  async handlePlayCommand(interaction) {
    const query = interaction.options.getString("recherche");
    const member = interaction.member;
    const guild = interaction.guild;

    if (!member.voice.channel) {
      try {
        const freshMember = await guild.members.fetch(member.id);
        if (!freshMember.voice.channel) {
          throw new Error("Not in voice channel");
        }
      } catch (error) {
        const errorEmbed = new EmbedBuilder()
          .setColor("#ff0000")
          .setTitle("Erreur")
          .setDescription("Vous devez être dans un salon vocal!");
        return await interaction.reply({
          embeds: [errorEmbed],
          ephemeral: true,
        });
      }
    }

    await interaction.deferReply();

    try {
      if (this.isPlaylistLink(query)) {
        const playlistResult = await this.handlePlaylist(query);

        if (playlistResult.error) {
          throw new Error(playlistResult.error);
        }

        if (!playlistResult.songs || playlistResult.songs.length === 0) {
          throw new Error("Aucune chanson trouvée dans la playlist");
        }

        const voiceChannel = member.voice.channel;

        if (!queues.has(guild.id)) queues.set(guild.id, []);
        const queue = queues.get(guild.id);
        const initialLength = queue.length;

        // Ajouter toutes les chansons à la file d'attente
        const songsWithRequester = playlistResult.songs.map((song) => ({
          ...song,
          requestedBy: member.displayName,
        }));

        queue.push(...songsWithRequester);

        const addedEmbed = new EmbedBuilder()
          .setColor("#00ff00")
          .setTitle(`🎵 Playlist ajoutée: ${playlistResult.playlistTitle}`)
          .setDescription(
            `${playlistResult.songs.length} chansons ajoutées à la file d'attente`
          )
          .setFooter({
            text: `La file d'attente contient maintenant ${queue.length} chansons`,
          });

        await interaction.editReply({ embeds: [addedEmbed] });

        if (initialLength === 0) {
          await this.playQueue(guild, voiceChannel);
        }
        return;
      }

      const songInfo = await this.searchSong(query);
      if (!songInfo) {
        const errorEmbed = new EmbedBuilder()
          .setColor("#ff0000")
          .setTitle("Aucun résultat")
          .setDescription(`Aucune musique trouvée pour: "${query}"`);
        return await interaction.editReply({ embeds: [errorEmbed] });
      }

      const voiceChannel = member.voice.channel;

      // Vérifier les permissions
      if (
        !voiceChannel.permissionsFor(this.client.user).has(["Connect", "Speak"])
      ) {
        const errorEmbed = new EmbedBuilder()
          .setColor("#ff0000")
          .setTitle("Permissions insuffisantes")
          .setDescription(
            "Permissions manquantes pour rejoindre/parler dans ce salon"
          );
        return await interaction.editReply({ embeds: [errorEmbed] });
      }

      if (!queues.has(guild.id)) queues.set(guild.id, []);
      const queue = queues.get(guild.id);

      queue.push({
        ...songInfo,
        requestedBy: member.displayName,
      });

      if (queue.length === 1) {
        await this.playQueue(guild, voiceChannel);

        const playingEmbed = new EmbedBuilder()
          .setColor("#00ff00")
          .setTitle("🎵 Lecture en cours")
          .setDescription(`**${songInfo.title}**`)
          .addFields(
            {
              name: "👤 Artiste",
              value: songInfo.artist || "Inconnu",
              inline: true,
            },
            {
              name: "⏱️ Durée",
              value: songInfo.duration || "Inconnue",
              inline: true,
            },
            { name: "🎧 Demandé par", value: member.displayName, inline: true }
          )
          .setThumbnail(songInfo.thumbnail);

        await interaction.editReply({ embeds: [playingEmbed] });
      } else {
        const queuedEmbed = new EmbedBuilder()
          .setColor("#ffa500")
          .setTitle("➕ Ajouté à la file d'attente")
          .setDescription(`**${songInfo.title}**`)
          .addFields(
            { name: "📊 Position", value: `${queue.length}`, inline: true },
            { name: "🎧 Demandé par", value: member.displayName, inline: true }
          )
          .setThumbnail(songInfo.thumbnail);

        await interaction.editReply({ embeds: [queuedEmbed] });
      }
    } catch (error) {
      console.error("Erreur lors de la lecture:", error);

      let errorMessage =
        "Une erreur est survenue lors de la lecture de la musique";
      if (error.message.includes("non supporté")) {
        errorMessage = error.message;
      } else if (error.message.includes("Aucune chanson trouvée")) {
        errorMessage = "Aucune chanson valide trouvée dans la playlist";
      } else if (error.message.includes("Video unavailable")) {
        errorMessage = "Cette vidéo n'est pas disponible";
      }

      const errorEmbed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("Erreur de lecture")
        .setDescription(errorMessage)
        .setFooter({
          text: "Support: YouTube, Spotify (chansons et playlists)",
        });

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }

  isPlaylistLink(query) {
    return (
      query.includes("youtube.com/playlist") ||
      (query.includes("youtube.com/watch?") && query.includes("list=")) ||
      query.includes("open.spotify.com/playlist") ||
      query.includes("open.spotify.com/album")
    );
  }

  async handlePlaylist(query) {
    try {
      if (
        query.includes("youtube.com/playlist") ||
        (query.includes("youtube.com/watch?") && query.includes("list="))
      ) {
        return await this.handleYoutubePlaylist(query);
      }

      if (query.includes("open.spotify.com/playlist")) {
        return await this.handleSpotifyPlaylist(query);
      }

      if (query.includes("open.spotify.com/album")) {
        return await this.handleSpotifyAlbum(query);
      }

      throw new Error("Type de playlist non supporté");
    } catch (error) {
      console.error("Erreur playlist:", error);
      return { error: error.message };
    }
  }

  async handleYoutubePlaylist(url) {
    try {
      const playlist = await ytpl(url, { limit: 100 });

      const songs = playlist.items
        .filter(
          (item) =>
            item && item.title && !item.title.includes("[Private video]")
        )
        .map((item) => ({
          title: item.title,
          artist: item.author?.name || "Inconnu",
          url: item.url,
          duration: this.formatDuration(item.durationSec),
          thumbnail: item.bestThumbnail?.url,
          source: "youtube",
          requestedBy: null,
        }));

      return {
        playlistTitle: playlist.title,
        songs,
      };
    } catch (error) {
      console.error("Erreur YouTube playlist:", error);
      throw new Error(
        "Impossible de charger la playlist YouTube. Vérifiez le lien"
      );
    }
  }

  async handleSpotifyPlaylist(url) {
    try {
      const playlistId = this.extractSpotifyId(url);
      const playlistData = await spotifyApi.getPlaylist(playlistId);
      const tracksData = await spotifyApi.getPlaylistTracks(playlistId, {
        limit: 100,
      });

      const tracks = tracksData.body.items
        .map((item) => item.track)
        .filter((track) => track && track.preview_url !== null);

      const limit = pLimit(3);
      const songs = [];

      const promises = tracks.map((track) =>
        limit(() => this.searchYoutubeForSpotifyTrack(track))
      );

      const results = await Promise.allSettled(promises);

      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          songs.push(result.value);
        }
      }

      return {
        playlistTitle: playlistData.body.name,
        songs,
      };
    } catch (error) {
      console.error("Erreur Spotify playlist:", error);
      throw new Error(
        "Impossible de charger la playlist Spotify. Vérifiez le lien et les permissions"
      );
    }
  }

  async handleSpotifyAlbum(url) {
    try {
      const albumId = this.extractSpotifyId(url);
      const albumData = await spotifyApi.getAlbum(albumId);
      const tracksData = await spotifyApi.getAlbumTracks(albumId, {
        limit: 100,
      });

      const albumCover = albumData.body.images[0]?.url;
      const tracks = tracksData.body.items;

      const limit = pLimit(3);
      const songs = [];

      const promises = tracks.map((track) =>
        limit(() => this.searchYoutubeForSpotifyTrack(track, albumCover))
      );

      const results = await Promise.allSettled(promises);

      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          songs.push(result.value);
        }
      }

      return {
        playlistTitle: albumData.body.name,
        songs,
      };
    } catch (error) {
      console.error("Erreur Spotify album:", error);
      throw new Error(
        "Impossible de charger l'album Spotify. Vérifiez le lien"
      );
    }
  }

  extractSpotifyId(url) {
    return url.split("/").pop().split("?")[0];
  }

  async searchYoutubeForSpotifyTrack(track, thumbnailFallback = null) {
    try {
      const searchQuery = `${track.artists[0].name} ${track.name}`;
      const result = await ytSearch(searchQuery);

      if (result.videos.length > 0) {
        const video =
          result.videos.find((v) => v.seconds < 1200) || result.videos[0];
        return {
          title: track.name,
          artist: track.artists[0].name,
          url: video.url,
          duration: this.formatDuration(video.seconds),
          thumbnail:
            track.album?.images[0]?.url || thumbnailFallback || video.thumbnail,
          source: "spotify",
          requestedBy: null,
        };
      }
      return null;
    } catch (error) {
      console.error("Erreur recherche YouTube pour Spotify:", error);
      return null;
    }
  }

  async searchSong(query) {
    try {
      const requestOptions = {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      };

      if (
        ytdl.validateURL(query) ||
        query.match(
          /youtu\.?be(.com)?\/(watch\?v=|shorts\/|embed\/)?([\w-]{11})/
        )
      ) {
        const info = await ytdl.getInfo(query, { requestOptions });
        return {
          title: info.videoDetails.title,
          artist: info.videoDetails.author.name,
          url: query,
          duration: this.formatDuration(info.videoDetails.lengthSeconds),
          thumbnail: info.videoDetails.thumbnails[0]?.url,
          source: "youtube",
        };
      }

      if (query.includes("spotify.com/track/")) {
        const trackId = query.split("/track/")[1].split("?")[0];
        try {
          const track = await spotifyApi.getTrack(trackId);
          const searchQuery = `${track.body.artists[0].name} ${track.body.name}`;

          const ytResult = await ytSearch(searchQuery);
          if (ytResult.videos.length > 0) {
            const video = ytResult.videos[0];
            return {
              title: track.body.name,
              artist: track.body.artists[0].name,
              url: video.url,
              duration: this.formatDuration(video.seconds),
              thumbnail: track.body.album.images[0]?.url || video.thumbnail,
              source: "spotify",
            };
          }
        } catch (error) {
          console.warn(
            "Erreur Spotify, recherche YouTube directe:",
            error.message
          );
        }
      }

      const result = await ytSearch(query);
      if (result.videos.length > 0) {
        const video =
          result.videos.find((v) => v.seconds < 1800) || result.videos[0];
        return {
          title: video.title,
          artist: video.author.name,
          url: video.url,
          duration: this.formatDuration(video.seconds),
          thumbnail: video.thumbnail,
          source: "youtube",
        };
      }

      return null;
    } catch (error) {
      console.error("Erreur lors de la recherche:", error);
      return null;
    }
  }

  async playQueue(guild, voiceChannel) {
    const queue = queues.get(guild.id);
    if (!queue || queue.length === 0) return;

    const song = queue[0];

    try {
      voiceChannels.set(guild.id, voiceChannel);
      let connection = await this.getOrCreateVoiceConnection(
        guild,
        voiceChannel
      );
      let player = this.getOrCreateAudioPlayer(guild, connection);

      pausedStates.set(guild.id, false);

      const requestOptions = {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
        },
      };

      const stream = ytdl(song.url, {
        filter: "audioonly",
        quality: "highestaudio",
        highWaterMark: 1 << 25,
        requestOptions,
        dlChunkSize: 0,
        begin: 0,
      });

      const resource = createAudioResource(stream, {
        metadata: { title: song.title },
        inlineVolume: true,
      });

      resource.volume?.setVolume(0.5);
      player.play(resource);
    } catch (error) {
      console.error("Erreur lors de la lecture:", error);

      queue.shift();

      if (queue.length > 0) {
        const systemChannel =
          guild.systemChannel ||
          guild.channels.cache.find((ch) => ch.isTextBased());
        if (systemChannel) {
          try {
            await systemChannel.send({
              embeds: [
                new EmbedBuilder()
                  .setColor("#ff9900")
                  .setDescription(
                    `⚠️ Impossible de lire "${song.title}", passage à la suivante`
                  ),
              ],
            });
          } catch (err) {
            console.error("Erreur envoi message:", err);
          }
        }
      } else {
        this.cleanup(guild.id);
      }
    }
  }

  async handleSkipCommand(interaction) {
    const guild = interaction.guild;
    const queue = queues.get(guild.id);

    if (!queue || queue.length === 0) {
      return await interaction.reply({
        content: "Aucune musique en cours de lecture.",
        ephemeral: true,
      });
    }

    if (queue.length <= 1) {
      return await interaction.reply({
        content: "Aucune chanson suivante dans la file.",
        ephemeral: true,
      });
    }

    const skippedSong = queue[0];
    const player = audioPlayers.get(guild.id);
    if (player) player.stop();

    const skipEmbed = new EmbedBuilder()
      .setColor("#ffa500")
      .setTitle("⏭️ Chanson passée")
      .setDescription(`**${skippedSong.title}** a été passée`);

    await interaction.reply({ embeds: [skipEmbed] });
  }

  async handleQueueCommand(interaction) {
    const queue = queues.get(interaction.guild.id);

    if (!queue || queue.length === 0) {
      return await interaction.reply({
        content: "📭 La file d'attente est vide.",
        ephemeral: true,
      });
    }

    const queueList = queue
      .slice(0, 10)
      .map((song, index) => {
        const prefix = index === 0 ? "🎵 **En cours:** " : `${index}. `;
        const requester = song.requestedBy ? ` (${song.requestedBy})` : "";
        return `${prefix}${song.title} - ${
          song.artist || "Inconnu"
        }${requester}`;
      })
      .join("\n");

    const totalDuration = queue.reduce((total, song) => {
      const duration = song.duration || "0:00";
      const parts = duration.split(":");
      let seconds = 0;
      if (parts.length === 2) {
        seconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
      } else if (parts.length === 3) {
        seconds =
          parseInt(parts[0]) * 3600 +
          parseInt(parts[1]) * 60 +
          parseInt(parts[2]);
      }
      return total + seconds;
    }, 0);

    const queueEmbed = new EmbedBuilder()
      .setColor("#0099ff")
      .setTitle("📋 File d'attente")
      .setDescription(queueList)
      .addFields(
        { name: "📊 Total", value: `${queue.length} chanson(s)`, inline: true },
        {
          name: "⏱️ Durée totale",
          value: this.formatDuration(totalDuration),
          inline: true,
        }
      );

    if (queue.length > 10) {
      queueEmbed.setFooter({
        text: `... et ${queue.length - 10} autres chansons`,
      });
    }

    await interaction.reply({ embeds: [queueEmbed] });
  }

  async handleNowPlayingCommand(interaction) {
    const queue = queues.get(interaction.guild.id);

    if (!queue || queue.length === 0) {
      return await interaction.reply({
        content: "Aucune musique en cours de lecture.",
        ephemeral: true,
      });
    }

    const song = queue[0];
    const isPaused = pausedStates.get(interaction.guild.id) || false;
    const statusIcon = isPaused ? "⏸️" : "🎵";
    const statusText = isPaused ? "En pause" : "En cours de lecture";

    const nowPlayingEmbed = new EmbedBuilder()
      .setColor(isPaused ? "#ffa500" : "#00ff00")
      .setTitle(`${statusIcon} ${statusText}`)
      .setDescription(`**${song.title}**`)
      .addFields(
        { name: "👤 Artiste", value: song.artist || "Inconnu", inline: true },
        { name: "⏱️ Durée", value: song.duration || "Inconnue", inline: true },
        {
          name: "🎧 Demandé par",
          value: song.requestedBy || "Inconnu",
          inline: true,
        },
        {
          name: "📱 Source",
          value: song.source === "spotify" ? "Spotify → YouTube" : "YouTube",
          inline: true,
        }
      )
      .setThumbnail(song.thumbnail);

    if (queue.length > 1) {
      nowPlayingEmbed.addFields({
        name: "⏭️ Suivant",
        value: `${queue[1].title} - ${queue[1].artist || "Inconnu"}`,
        inline: false,
      });
    }

    await interaction.reply({ embeds: [nowPlayingEmbed] });
  }

  async handleStopCommand(interaction) {
    const guild = interaction.guild;
    const connection = getVoiceConnection(guild.id);

    if (!connection) {
      return await interaction.reply({
        content: "Je ne suis connecté à aucun salon vocal.",
        ephemeral: true,
      });
    }

    const queue = queues.get(guild.id);
    const songCount = queue ? queue.length : 0;

    queues.delete(guild.id);

    const player = audioPlayers.get(guild.id);
    if (player) player.stop();

    // Supprimer l'état de pause
    pausedStates.delete(guild.id);

    connection.destroy();
    voiceConnections.delete(guild.id);
    audioPlayers.delete(guild.id);
    voiceChannels.delete(guild.id);

    const stopEmbed = new EmbedBuilder()
      .setColor("#ff0000")
      .setTitle("⏹️ Arrêt de la musique")
      .setDescription(`Musique arrêtée et salon vocal quitté.`)
      .setFooter({
        text:
          songCount > 0
            ? `${songCount} chanson(s) supprimée(s) de la file`
            : "",
      });

    await interaction.reply({ embeds: [stopEmbed] });
  }

  async getOrCreateVoiceConnection(guild, voiceChannel) {
    let connection = getVoiceConnection(guild.id);

    if (!connection) {
      connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
      });

      voiceConnections.set(guild.id, connection);

      connection.on(VoiceConnectionStatus.Ready, () => {
        console.log(
          `✅ Connecté au salon vocal "${voiceChannel.name}" sur ${guild.name}`
        );
      });

      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        console.log(`Déconnecté du salon vocal sur ${guild.name}`);

        setTimeout(async () => {
          if (!getVoiceConnection(guild.id)) {
            try {
              const newConnection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
              });
              voiceConnections.set(guild.id, newConnection);
              console.log(`♻️ Reconnexion réussie sur ${guild.name}`);
            } catch (error) {
              console.error("Échec de reconnexion:", error);
              this.cleanup(guild.id);
            }
          }
        }, 5000);
      });

      connection.on("error", (error) => {
        console.error("Erreur de connexion vocale:", error);
        this.cleanup(guild.id);
      });
    }

    return connection;
  }

  getOrCreateAudioPlayer(guild, connection) {
    let player = audioPlayers.get(guild.id);

    if (!player) {
      player = createAudioPlayer();
      audioPlayers.set(guild.id, player);

      player.on(AudioPlayerStatus.Playing, () => {
        console.log(`🎵 Lecture en cours sur ${guild.name}`);
      });

      player.on(AudioPlayerStatus.Paused, () => {
        console.log(`⏸️ Lecture en pause sur ${guild.name}`);
        pausedStates.set(guild.id, true);
      });

      player.on(AudioPlayerStatus.Idle, () => {
        console.log(`⏹️ Lecture terminée sur ${guild.name}`);
        this.playNext(guild);
      });

      player.on("error", (error) => {
        console.error("Erreur du lecteur audio:", error);
        this.playNext(guild);
      });

      connection.subscribe(player);
    }

    return player;
  }

  async playNext(guild) {
    const queue = queues.get(guild.id);
    if (!queue) return;

    const finishedSong = queue.shift();
    console.log(
      `⏭️ Chanson terminée: "${finishedSong?.title}" sur ${guild.name}`
    );

    // Réinitialiser l'état de pause
    pausedStates.set(guild.id, false);

    if (queue.length > 0) {
      const voiceChannel = voiceChannels.get(guild.id);
      if (voiceChannel) {
        setTimeout(async () => {
          await this.playQueue(guild, voiceChannel);
        }, 1000); // Petit délai pour éviter les conflits
      }
    } else {
      console.log(
        `📭 File d'attente vide sur ${guild.name}, déconnexion dans 30s`
      );
      setTimeout(() => {
        if (!queues.get(guild.id)?.length) {
          this.cleanup(guild.id);
          console.log(
            `🚪 Déconnexion automatique (file vide) sur ${guild.name}`
          );
        }
      }, 30000);
    }
  }

  cleanup(guildId) {
    const connection = getVoiceConnection(guildId);
    if (connection) {
      try {
        connection.destroy();
      } catch (error) {
        console.error("Erreur de déconnexion:", error);
      }
    }

    voiceConnections.delete(guildId);
    audioPlayers.delete(guildId);
    queues.delete(guildId);
    voiceChannels.delete(guildId);
    pausedStates.delete(guildId);

    console.log(`🧹 Nettoyage terminé pour le serveur ${guildId}`);
  }

  handleVoiceStateUpdate(oldState, newState) {
    // Si le bot est déplacé ou déconnecté manuellement
    if (oldState.member?.id === this.client.user.id && !newState.channel) {
      this.cleanup(oldState.guild.id);
      console.log(`🔌 Bot déconnecté manuellement sur ${oldState.guild.name}`);
      return;
    }

    // Vérifier si le bot est seul dans le salon
    const voiceChannel = voiceChannels.get(newState.guild.id);
    if (voiceChannel && newState.channelId === voiceChannel.id) {
      const members = voiceChannel.members.filter((member) => !member.user.bot);

      if (members.size === 0) {
        console.log(
          `👤 Plus d'utilisateurs dans le salon sur ${newState.guild.name}`
        );
        setTimeout(() => {
          const currentMembers = voiceChannel.members.filter(
            (member) => !member.user.bot
          );
          if (currentMembers.size === 0) {
            this.cleanup(newState.guild.id);
            console.log(
              `🚪 Déconnexion automatique (salon vide) sur ${newState.guild.name}`
            );
          }
        }, 60000); // 1 minute de délai
      }
    }
  }

  formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";

    seconds = parseInt(seconds);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }

  // Méthode utilitaire pour obtenir des statistiques
  getStats() {
    return {
      activeConnections: voiceConnections.size,
      activeQueues: queues.size,
      totalSongsQueued: Array.from(queues.values()).reduce(
        (total, queue) => total + queue.length,
        0
      ),
    };
  }

  // Méthode pour forcer le nettoyage de tous les serveurs
  cleanupAll() {
    console.log("🧹 Nettoyage général en cours...");
    const guildIds = Array.from(voiceConnections.keys());
    guildIds.forEach((guildId) => this.cleanup(guildId));
    console.log(`🧹 Nettoyage général terminé (${guildIds.length} serveurs)`);
  }
}

module.exports = MusicBot;
