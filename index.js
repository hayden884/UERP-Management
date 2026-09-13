const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { token } = require('./config.json'); // or .env

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages
  ]
});

client.commands = new Collection();

// Load Commands
const fs = require('fs');
const path = require('path');

function loadCommands(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) loadCommands(fullPath);
    else if (file.endsWith('.js')) {
      const cmd = require(fullPath);
      client.commands.set(cmd.data.name, cmd);
    }
  }
}
loadCommands(path.join(__dirname, 'commands'));

// Load Events
const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
  const event = require(path.join(eventsPath, file));
  if (event.once) client.once(event.name, (...args) => event.execute(...args));
  else client.on(event.name, (...args) => event.execute(...args));
}

client.login(process.env.DISCORD_TOKEN);
