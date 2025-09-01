# 🚀 Discord Bot Multi-Usage

Un bot Discord complet et modulable, développé avec **Node.js** et **Discord.js**, offrant de nombreuses fonctionnalités : modération, musique, système de niveaux, tickets, auto-réponse, et bien plus encore.

---

## ✨ Fonctionnalités

- 🔧 **Modération**
  - `/ban`, `/kick`, `/timeout`, `/clear`  
- 🎶 **Musique**
  - Lecture de musique via YouTube/Spotify
  - Gestion de file d’attente, pause, skip, stop
- 📈 **Système de niveaux**
  - Gain d’XP et montée en niveau
  - Carte de profil personnalisée
- 🎫 **Tickets**
  - Création et gestion de tickets privés
- 👋 **Bienvenue & Auto-roles**
  - Message de bienvenue avec image personnalisée
  - Attribution automatique de rôles
- 💬 **Réponses automatiques**
  - Système d’auto-réponse pour certains mots/phrases
- ⚡ **Commandes diverses**
  - `/ping` pour tester la latence
  - Commandes aléatoires

---

## 📂 Structure du projet

```
Discord-bot-multiusage-master/
│── package.json
│── src/
│   ├── index.js              # Fichier principal
│   ├── commands/             # Commandes (modération, utilitaires...)
│   ├── events/               # Événements (tickets, musique, levels, welcome...)
│   ├── handlers/             # Gestion des events et commandes
│   └── utils/                # Fonctions utilitaires
```

---

## ⚙️ Installation

### 1. Cloner le projet
```bash
git clone https://github.com/USERNAME/Discord-bot-multiusage.git
cd Discord-bot-multiusage
```

### 2. Installer les dépendances
```bash
npm install
```

### 3. Configurer l’environnement
Créer un fichier `.env` à la racine du projet et ajouter vos informations :

```env
TOKEN=ton_token_discord
CLIENT_ID=ton_client_id
GUILD_ID=ton_guild_id   # optionnel si tu veux enregistrer les commandes globales
```

### 4. Lancer le bot
```bash
npm start
```

---

## 🛠️ Technologies utilisées

- [Node.js](https://nodejs.org/)  
- [Discord.js](https://discord.js.org/)  
- [@discordjs/voice](https://www.npmjs.com/package/@discordjs/voice) – (Musique)  
- [yt-search](https://www.npmjs.com/package/yt-search) & [ytdl-core](https://www.npmjs.com/package/ytdl-core) – (YouTube)  

---

## 📌 Roadmap

- [ ] Ajout d’un dashboard web (React + Express)  
- [ ] Commandes de configuration avancée en slash  
- [ ] Support multi-guild amélioré  
- [ ] Plus de commandes fun  

---

## 🤝 Contribuer

Les contributions sont les bienvenues !  
Forkez le projet, créez une branche, puis ouvrez une **pull request**.

---

## 📜 Licence

Ce projet est sous licence MIT – voir le fichier [LICENSE](LICENSE).
