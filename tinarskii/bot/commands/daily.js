import { db, initBank } from "../client.js";

export default {
  name: "daily",
  description: "Give daily money (100 Keeb)",
  alias: [],
  args: [],
  execute: async (client, meta) => {
    initBank(meta.userID);

    // Find last daily (Int)
    let stmt = db.prepare("SELECT lastDaily FROM bot WHERE user = ?");
    let lastDaily = stmt.get(meta.userID);

    // Check if user has claimed daily
    if (lastDaily) {
      let lastDailyDate = new Date(lastDaily.lastDaily);
      let currentDate = new Date();
      if (
        lastDailyDate.getDate() === currentDate.getDate() &&
        lastDailyDate.getMonth() === currentDate.getMonth() &&
        lastDailyDate.getFullYear() === currentDate.getFullYear()
      ) {
        await client.chat.say(meta.channel, `เองรับเงินไปแล้ววันนี้แล้วนะ`);
        return;
      }
    }

    // Claim daily (Add money, Update lastDaily)
    stmt = db.prepare("UPDATE bot SET money = money + 100 WHERE user = ?");
    stmt.run(meta.userID);
    stmt = db.prepare("UPDATE bot SET lastDaily = ? WHERE user = ?");
    stmt.run(Number(new Date()), meta.userID);

    await client.chat.say(meta.channel, `รับ 100 กีบ`);
    client.io.emit("feed", ({ type: "normal", icon: "☀️", message: `System ➡ ${meta.user}`, action: `+ 100 KEEB` }));
  },
};
