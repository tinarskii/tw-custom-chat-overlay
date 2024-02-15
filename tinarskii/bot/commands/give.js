import { db, initBank } from "../client.js";

export default {
  name: "give",
  description: "Give money to someone else",
  alias: ["transfer"],
  args: [
    {
      name: "user",
      description: "The user you want to give money",
      required: true,
    },
    {
      name: "amount",
      description: "The amount of money you want to give",
      required: true,
    },
  ],
  execute: async (client, meta, message, args) => {
    let amount = Math.trunc(parseInt(args[1]));
    let target = args[0];

    // Check if amount is valid
    if (isNaN(amount) || amount < 0) {
      await client.chat.say(meta.channel, `ใส่ตังเข้ามาด้วย`);
      return;
    }

    // Check if user has enough money
    let stmt = db.prepare("SELECT money FROM bot WHERE user = ?");
    let balance = stmt.get(meta.userID);
    if (amount > balance.money) {
      await client.chat.say(meta.channel, `เองมีตังไม่พอ`);
      return;
    }

    // Check if target is valid
    let targetUser = await client.api.users.getUserByName(target);
    if (!targetUser) {
      await client.chat.say(meta.channel, `ไม่พบผู้ใช้ ${args[0]}`);
      return;
    }
    let targetID = targetUser.id;
    initBank(targetID);

    // Transfer money
    stmt = db.prepare("UPDATE bot SET money = money - ? WHERE user = ?");
    stmt.run(amount, meta.userID);
    stmt = db.prepare("UPDATE bot SET money = money + ? WHERE user = ?");
    stmt.run(amount, targetID);
    await client.chat.say(meta.channel, `โอน ${amount} กีบ ให้ ${target}`);
    client.io.emit("feed", {
      type: "normal",
      icon: "📩",
      message: `${meta.user} ➡ ${target}`,
      action: `${amount} KEEB`,
    });
  },
};
