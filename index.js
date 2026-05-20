const mineflayer = require('mineflayer');
const Movements = require('mineflayer-pathfinder').Movements;
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { GoalBlock } = require('mineflayer-pathfinder').goals;

const config = require('./settings.json');
const express = require('express');

const app = express();

app.get('/', (req, res) => {
  res.send('Bot is running perfectly!');
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`[Web Server] Started on port ${PORT}`);
});

let isBotRunning = false;
let rotationInterval;

function createBot() {
   if (isBotRunning) {
      console.log('[Anti-Double] A bot instance is already running. Blocking duplicate login.');
      return;
   }
   
   isBotRunning = true;

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
         console.log(`[Auth] Executed register command.`);
      }
      if (message.includes('/login') || message.includes('قم بتسجيل الدخول')) {
         const password = config.utils['auto-auth'].password;
         bot.chat(`/login ${password}`);
         console.log(`[Auth] Executed login command.`);
      }
   });

   bot.once('spawn', () => {
      console.log('\x1b[33m[AfkBot] Bot joined the server\x1b[0m');
      
      const mcData = require('minecraft-data')(bot.version);
      const defaultMove = new Movements(bot, mcData);

      if (config.utils['chat-messages'].enabled) {
         console.log('[INFO] Started chat-messages module');
         const messages = config.utils['chat-messages']['messages'];

         if (config.utils['chat-messages'].repeat) {
            // ✅ إصلاح القوس هنا أيضاً لتفادي كراش السطر 90 القديم
            const delay = config.utils['chat-messages']['repeat-delay'];
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
            console.log(`\x1b[32m[Afk Bot] Moving safely to target location (${pos.x}, ${pos.y}, ${pos.z})\x1b[0m`);
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

   let hitCooldown = false;
   bot.on('health', () => {
      if (!hitCooldown && config.position.enabled && bot.pathfinder) {
         hitCooldown = true;
         setTimeout(() => {
            console.log('\x1b[35m[AfkBot] Bot was hit! Re-fixing path to target...\x1b[0m');
            bot.pathfinder.stop(); 
            stopRotating();
            const mcData = require('minecraft-data')(bot.version);
            const defaultMove = new Movements(bot, mcData);
            bot.pathfinder.setMovements(defaultMove);
            bot.pathfinder.setGoal(new GoalBlock(config.position.x, config.position.y, config.position.z));
            hitCooldown = false;
         }, 1000); 
      }
   });

   bot.on('goal_reached', () => {
      console.log(`\x1b[32m[AfkBot] Bot arrived at target location successfully.\x1b[0m`);
      if (config.utils['anti-afk'].enabled) {
         startRotating(); 
         if (config.utils['anti-afk'].sneak) bot.setControlState('sneak', true);
      }
   });

   bot.on('death', () => {
      console.log(`\x1b[33m[AfkBot] Bot died and respawned.\x1b[0m`);
      if (rotationInterval) clearInterval(rotationInterval);
   });

   bot.on('end', () => {
      isBotRunning = false; 
      if (rotationInterval) clearInterval(rotationInterval);
      console.log(`[AfkBot] Connection lost. Safe destroying old hooks...`);
      
      try {
         bot.removeAllListeners();
         bot.quit();
      } catch (e) {}

      // ✅ تم وضع تايمر 10 ثوانٍ كاملة هنا (10000 مللي ثانية) بناءً على طلبك لمنع التداخل
      console.log(`[AfkBot] Reconnecting safely in 10 seconds...`);
      setTimeout(() => {
         createBot();
      }, 10000); 
   });

   bot.on('kicked', (reason) => {
      isBotRunning = false;
      if (rotationInterval) clearInterval(rotationInterval);
      console.log(`\x1b[33m[AfkBot] Bot was kicked. Reason: \n${reason}\x1b[0m`);
   });
   
   bot.on('error', (err) => {
      console.log(`\x1b[31m[ERROR] ${err.message}\x1b[0m`);
   });
}

createBot();
