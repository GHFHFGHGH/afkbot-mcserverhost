const mineflayer = require('mineflayer');
const Movements = require('mineflayer-pathfinder').Movements;
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { GoalBlock } = require('mineflayer-pathfinder').goals;

const config = require('./settings.json');
const express = require('express');

const app = express();

app.get('/', (req, res) => {
  res.send('Bot Server is Running Safely!');
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`[Web Server] Started on port ${PORT}`);
});

let rotationInterval;

function createBot() {
   const bot = mineflayer.createBot({
      username: config['bot-account']['username'],
      password: config['bot-account']['password'],
      auth: config['bot-account']['type'],
      host: config.server.ip,
      port: config.server.port,
      version: config.server.version,
      checkTimeoutInterval: 60 * 1000 
   });

   bot.loadPlugin(pathfinder);
   bot.settings.colorsEnabled = false;

   function startRotating() {
      if (rotationInterval) clearInterval(rotationInterval);
      let angle = 0;
      rotationInterval = setInterval(() => {
         if (bot && bot.entity) {
            angle += 0.5;
            bot.look(angle, 0);
         }
      }, 200);
   }

   function stopRotating() {
      if (rotationInterval) {
         clearInterval(rotationInterval);
         rotationInterval = null;
      }
   }

   bot.on('chat', (username, message) => {
      if (message.includes('/register')) {
         const password = config.utils['auto-auth'].password;
         bot.chat(`/register ${password} ${password}`);
      }
      if (message.includes('/login') || message.includes('قم بتسجيل الدخول')) {
         const password = config.utils['auto-auth'].password;
         bot.chat(`/login ${password}`);
      }
   });

   bot.once('spawn', () => {
      console.log('\x1b[33m[AfkBot] Bot joined the server\x1b[0m');
      
      const mcData = require('minecraft-data')(bot.version);
      const defaultMove = new Movements(bot, mcData);

      if (config.utils['chat-messages'].enabled) {
         const messages = config.utils['chat-messages']['messages'];
         if (config.utils['chat-messages'].repeat) {
            const delay = config.utils['chat-messages']['repeat-delay'] || 60;
            let i = 0;
            setInterval(() => {
               if(bot && bot.chat) {
                  bot.chat(`${messages[i]}`);
                  i = (i + 1) % messages.length;
               }
            }, delay * 1000);
         } else {
            messages.forEach((msg) => msg && bot.chat(msg));
         }
      }

      setTimeout(() => {
         const pos = config.position;
         if (config.position.enabled) {
            stopRotating(); 
            bot.pathfinder.setMovements(defaultMove);
            bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
         } else {
            if (config.utils['anti-afk'].enabled) {
               startRotating();
               if (config.utils['anti-afk'].sneak) bot.setControlState('sneak', true);
            }
         }
      }, 5000); 
   });

   bot.on('goal_reached', () => {
      if (config.utils['anti-afk'].enabled) {
         startRotating(); 
         if (config.utils['anti-afk'].sneak) bot.setControlState('sneak', true);
      }
   });

   bot.on('death', () => {
      if (rotationInterval) clearInterval(rotationInterval);
   });

   // ❌ تم إزالة دالة createBot() تماماً من هنا بناءً على طلبك لمنع أي دخول مزدوج
   bot.on('end', () => {
      if (rotationInterval) clearInterval(rotationInterval);
      console.log(`[AfkBot] Connection ended completely. No auto-reconnect will trigger.`);
      try {
         bot.removeAllListeners();
         bot.quit();
      } catch (e) {}
   });

   bot.on('error', (err) => console.log(`[ERROR] ${err.message}`));
}

// التشغيل الأساسي والوحيد للمشروع
createBot();
