import "dotenv/config";
import {StaticAuthProvider} from '@twurple/auth';
import {ChatClient} from '@twurple/chat';
import { ApiClient } from '@twurple/api';
import Database from 'better-sqlite3';

const db = new Database('user.db');
db.pragma('journal_mode = WAL');

const authProvider = new StaticAuthProvider(process.env.CLIENT_ID, process.env.USER_ACCESS_TOKEN, ['user:edit', 'user:read:email', 'chat:read', 'chat:edit', 'channel:moderate']);
const apiClient = new ApiClient({ authProvider });
const chatClient = new ChatClient({authProvider, channels: ['tinarskii']});
chatClient.connect();

chatClient.onConnect(async () => {
    console.log('[Tx] Connected to chat');
});

chatClient.onMessage(async (channel, user, message) => {
    let userID = (await apiClient.users.getUserByName(user)).id;
    if (message === '!balance') {
        let stmt = db.prepare('SELECT money FROM bot WHERE user = ?');
        if (!stmt.get(userID)) {
            initBank(userID)
            stmt = db.prepare('SELECT money FROM bot WHERE user = ?');
        }
        let balance = stmt.get(userID);
        await chatClient.say(channel, `เอ็งมีตัง ${balance.money} กีบ`);
    } else if (message === '!daily') {
        let stmt = db.prepare('SELECT lastDaily FROM bot WHERE user = ?');
        let lastDaily = stmt.get(userID);
        if (lastDaily) {
            let lastDailyDate = new Date(lastDaily.lastDaily);
            let currentDate = new Date();
            if (lastDailyDate.getDate() === currentDate.getDate() && lastDailyDate.getMonth() === currentDate.getMonth() && lastDailyDate.getFullYear() === currentDate.getFullYear()) {
                await chatClient.say(channel, `เองรับเงินไปแล้ววันนี้แล้วนะ`);
                return;
            }
        }
        stmt = db.prepare('UPDATE bot SET money = money + 100 WHERE user = ?');
        stmt.run(userID);
        stmt = db.prepare('UPDATE bot SET lastDaily = ? WHERE user = ?');
        stmt.run(Number(new Date()), userID);
        await chatClient.say(channel, `รับ 100 กีบ`);
    } else if (message.startsWith('!gamble')) {
        let amount = parseInt(message.split(' ')[1]);
        if (isNaN(amount)) {
            await chatClient.say(channel, `ใส่ตังเข้ามาด้วย`);
            return;
        }
        let stmt = db.prepare('SELECT money FROM bot WHERE user = ?');
        let balance = stmt.get(userID);
        if (amount > balance.money) {
            await chatClient.say(channel, `เองมีตังไม่พอ`);
            return;
        }
        let win = Math.random() > 0.75;
        if (win) {
            // Amount *1.75
            stmt = db.prepare('UPDATE bot SET money = money + ? WHERE user = ?');
            stmt.run(amount * 1.75, userID);
            await chatClient.say(channel, `ชนะ ${amount * 1.75} กีบ เหลือ ${balance.money + amount * 0.75} กีบ`);
        } else {
            // Amount *1.5
            stmt = db.prepare('UPDATE bot SET money = money - ? WHERE user = ?');
            stmt.run(amount * 1.5, userID);
            await chatClient.say(channel, `แพ้ ${amount * 1.5} กีบ เหลือ ${balance.money - amount * 0.5} กีบ`);
        }
    }
});

function initBank(userID) {
    const stmt = db.prepare('INSERT INTO bot (user, money) VALUES (?, ?)');
    stmt.run(userID, 0);
}