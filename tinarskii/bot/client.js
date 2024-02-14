import "dotenv/config";
import {StaticAuthProvider} from '@twurple/auth';
import {ChatClient} from '@twurple/chat';
import {ApiClient} from '@twurple/api';
import Database from 'better-sqlite3';
import express from 'express';
const db = new Database('user.db');
db.pragma('journal_mode = WAL');

// Express
const app = express();
app.get('/', (req, res) => {
  res.send('Hello World!');
});
app.get('/api/getNicknameList', (req, res) => {
  let stmt = db.prepare('SELECT user, nickname FROM bot');
  let nicknames = stmt.all();
  res.send(nicknames);
});
app.get('/api/getNickname', (req, res) => {
  let userID = req.query.userID;
  let stmt = db.prepare('SELECT nickname FROM bot WHERE user = ?');
  let nickname = stmt.get(userID);
  res.send(nickname);
});
app.listen(process.env.PORT ?? 8080, () => {
  console.log(`[Tx-API] Listening http://localhost:${process.env.PORT ?? 8080}`);
});

async function refreshToken() {
  console.log(`[Tx] Renewing Access Token`);
  let headers = new Headers();
  headers.append(`Content-Type`, `application/json`);
  let body = {
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: encodeURIComponent(process.env.REFRESH_TOKEN),
  };

  const request = new Request("https://id.twitch.tv/oauth2/token", {
    method: "POST", headers: headers, body: JSON.stringify(body),
  });
  const response = await fetch(request);

  const responseData = await response.json();

  let newAccessToken = responseData.access_token;
  let newRefreshToken = responseData.refresh_token;
  if (!newAccessToken || !newRefreshToken) {
    throw new Error();
  } else {
    process.env.USER_ACCESS_TOKEN = newAccessToken;
    process.env.REFRESH_TOKEN = newRefreshToken;
  }
}
async function isTwitchTokenValid(token) {
  let headers = new Headers();
  headers.append(`Authorization`, `OAuth ${token}`);
  const response = await fetch(`https://id.twitch.tv/oauth2/validate`, {
    method: "GET", headers: headers, redirect: "follow",
  });
  let valid = response.status === 200;
  console.log(`[Tx-ValidatedToken] ${valid}`);
  return valid;
}
async function initializeSequence() {
  await refreshToken();
  if (await isTwitchTokenValid(process.env.USER_ACCESS_TOKEN)) {
    await createListener();
  } else {
    console.log(`[Tx] Initializing Failed`);
    throw new Error();
  }
}
async function createListener() {
  const authProvider = new StaticAuthProvider(process.env.CLIENT_ID, process.env.USER_ACCESS_TOKEN, ['user:edit', 'user:read:email', 'chat:read', 'chat:edit', 'channel:moderate']);
  const apiClient = new ApiClient({authProvider});
  const chatClient = new ChatClient({authProvider, channels: ['tinarskii']});
  chatClient.connect();

  chatClient.onConnect(async () => {
    console.log('[Tx] Connected to chat');
  });

  chatClient.onMessage(async (channel, user, message) => {
    let userID = (await apiClient.users.getUserByName(user)).id;
    let args = message.split(' ').splice(1);

    if (message.startsWith('!balance') || message.startsWith('!bal')) {
      let user = await apiClient.users.getUserByName(args[0] ?? userID);
      userID = user.id;

      // Init bank
      initBank(userID);

      // Get balance
      let stmt = db.prepare('SELECT money FROM bot WHERE user = ?');
      let balance = stmt.get(userID);

      await chatClient.say(channel, `เอ็งมีตัง ${balance.money} กีบ`);
    }
    else if (message.startsWith('!daily')) {
      initBank(userID);

      // Find last daily (Int)
      let stmt = db.prepare('SELECT lastDaily FROM bot WHERE user = ?');
      let lastDaily = stmt.get(userID);

      // Check if user has claimed daily
      if (lastDaily) {
        let lastDailyDate = new Date(lastDaily.lastDaily);
        let currentDate = new Date();
        if (lastDailyDate.getDate() === currentDate.getDate() && lastDailyDate.getMonth() === currentDate.getMonth() && lastDailyDate.getFullYear() === currentDate.getFullYear()) {
          await chatClient.say(channel, `เองรับเงินไปแล้ววันนี้แล้วนะ`);
          return;
        }
      }

      // Claim daily (Add money, Update lastDaily)
      stmt = db.prepare('UPDATE bot SET money = money + 100 WHERE user = ?');
      stmt.run(userID);
      stmt = db.prepare('UPDATE bot SET lastDaily = ? WHERE user = ?');
      stmt.run(Number(new Date()), userID);

      await chatClient.say(channel, `รับ 100 กีบ`);
    }
    else if (message.startsWith('!gamble') || message.startsWith('!bet')) {
      let amount = Math.trunc(parseInt(args[0]));

      // Check if amount is valid
      if (isNaN(amount) || amount < 0) {
        await chatClient.say(channel, `ใส่ตังเข้ามาด้วย`);
        return;
      }

      // Check if user has enough money
      let stmt = db.prepare('SELECT money FROM bot WHERE user = ?');
      let balance = stmt.get(userID);
      if (amount > balance.money) {
        await chatClient.say(channel, `เองมีตังไม่พอ`);
        return;
      }

      // Win Condition
      let win = Math.random() > 0.75;
      if (win) {
        // Gain amount * 1.75
        stmt = db.prepare('UPDATE bot SET money = money + ? WHERE user = ?');
        stmt.run(amount * 1.75, userID);
        await chatClient.say(channel, `ชนะ ${amount * 1.75} กีบ เหลือ ${balance.money + amount * 0.75} กีบ`);
      } else {
        // Loss amount * 1.5
        stmt = db.prepare('UPDATE bot SET money = money - ? WHERE user = ?');
        stmt.run(amount * 1.5, userID);
        await chatClient.say(channel, `แพ้ ${amount * 1.5} กีบ เหลือ ${balance.money - amount * 0.5} กีบ`);
      }
    }
    else if (message.startsWith('!give') || message.startsWith('!transfer') || message.startsWith('!send')) {
      let amount = Math.trunc(parseInt(args[1]));
      let target = args[0];

      // Check if amount is valid
      if (isNaN(amount) || amount < 0) {
        await chatClient.say(channel, `ใส่ตังเข้ามาด้วย`);
        return;
      }

      // Check if user has enough money
      let stmt = db.prepare('SELECT money FROM bot WHERE user = ?');
      let balance = stmt.get(userID);
      if (amount > balance.money) {
        await chatClient.say(channel, `เองมีตังไม่พอ`);
        return;
      }

      // Check if target is valid
      let targetID = (await apiClient.users.getUserByName(target)).id;
      if (!targetID) {
        initBank(targetID);
      }

      // Transfer money
      stmt = db.prepare('UPDATE bot SET money = money - ? WHERE user = ?');
      stmt.run(amount, userID);
      stmt = db.prepare('UPDATE bot SET money = money + ? WHERE user = ?');
      stmt.run(amount, targetID);
      await chatClient.say(channel, `โอน ${amount} กีบ ให้ ${target}`);
    }
    else if (message.startsWith('!weekly')) {
      initBank(userID);

      // Find last weekly (Int)
      let stmt = db.prepare('SELECT lastWeekly FROM bot WHERE user = ?');
      let lastWeekly = stmt.get(userID);

      // Check if user has claimed weekly
      if (lastWeekly) {
        let lastWeeklyDate = new Date(lastWeekly.lastWeekly);
        let currentDate = new Date();
        if (lastWeeklyDate.getDate() === currentDate.getDate() && lastWeeklyDate.getMonth() === currentDate.getMonth() && lastWeeklyDate.getFullYear() === currentDate.getFullYear()) {
          await chatClient.say(channel, `เองรับเงินไปแล้วสัปดาห์นี้แล้วนะ`);
          return;
        }
      }

      // Claim weekly (Add money, Update lastWeekly)
      stmt = db.prepare('UPDATE bot SET money = money + 500 WHERE user = ?');
      stmt.run(userID);
      stmt = db.prepare('UPDATE bot SET lastWeekly = ? WHERE user = ?');
      stmt.run(Number(new Date()), userID);

      await chatClient.say(channel, `รับ 500 กีบ`);
    }
    else if (message.startsWith('!nickname') || message.startsWith('!name') || message.startsWith('!rename')) {
      let name = args.join(' ');

      // Check current nickname
      if (!args[0]) {
        let stmt = db.prepare('SELECT nickname FROM bot WHERE user = ?');
        let {nickname} = stmt.get(userID);
        await chatClient.say(channel, `ชื่อของเจ้าคือ ${nickname ?? user}`);
        return;
      }

      // Reset nickname
      if (name === '--reset') {
        let stmt = db.prepare('UPDATE bot SET nickname = ? WHERE user = ?');
        stmt.run(null, userID);
        await chatClient.say(channel, `ชื่อเล่นถูกลบแล้ว`);
        return;
      }

      // Check if name is too long
      if (name.length > 32) {
        await chatClient.say(channel, `ชื่อยาวไป`);
        return;
      }

      // Check if name is in english or thai
      if (!name.match(/^[a-zA-Z0-9ก-๙ ]+$/)) {
        await chatClient.say(channel, `ชื่อต้องเป็นภาษาอังกฤษหรือไทยเท่านั้น`);
        return;
      }

      // Update name
      let stmt = db.prepare('UPDATE bot SET nickname = ? WHERE user = ?');
      stmt.run(name, userID);
      await chatClient.say(channel, `เปลี่ยนชื่อเป็น ${name}`);
    }
    else if (message.startsWith('!help') || message.startsWith('!commands')) {
      await chatClient.say(channel, `ดูได้ที่ https://bot.tinarskii.com/commands`);
    }
    else if (message.startsWith('!รัก') || message.startsWith('!love')) {
      let lovePercent = Math.floor(Math.random() * 101);
      await chatClient.say(channel, `${user} 💘 ${args[0] || user} ${lovePercent}%`);
    }
    else if (message.startsWith('!กระทืบ') || message.startsWith('!stomp')) {
      let stompTimes = Math.floor(Math.random() * 1000);
      await chatClient.say(channel, `${user} 👣 ${args[0] || user} ${stompTimes} ครั้ง`);
    }
    else if (message.startsWith('!กินไร') || message.startsWith('!eat')) {
      let foods = ['ข้าว', 'ก๋วยเตี๋ยว', 'ส้มตำ', 'ไก่ทอด', 'ขนมจีน', 'สเต็ก', 'ไก่ย่าง', 'หมูกระทะ', 'หมูทอด', 'หมูสะเต๊ะ', 'หมูกรอบ', 'หมูย่าง', 'หมูทอดกรอบ', 'หมูสามชั้น', 'หมูสับ'];
      let food = foods[Math.floor(Math.random() * foods.length)];
      await chatClient.say(channel, `🍲 กิน ${food}`);
    }
    else if (message.startsWith('!เกลียด') || message.startsWith('!้hate')) {
      let hatePercent = Math.floor(Math.random() * 101);
      await chatClient.say(channel, `${user} ?? ${args[0] || user} ${hatePercent}%`);
    }
  });
}
function initBank(userID) {
  let stmt = db.prepare('SELECT money FROM bot WHERE user = ?');
  if (!stmt.get(userID)) {
    stmt = db.prepare('INSERT INTO bot (user, money) VALUES (?, ?)');
    stmt.run(userID, 0);
  }
}

// Init twitch bot
await initializeSequence();
