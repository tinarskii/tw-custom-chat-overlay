import { db } from "../client.js";

export default {
  name: "nickname",
  description: "Change or show your nickname (as shown on screen)",
  alias: ["nick", "name"],
  args: [
    {
      name: "nickname",
      description: "Your new nickname",
      required: false,
    },
  ],
  execute: async (client, meta, message, args) => {
    let name = args.join(" ");

    // Check current nickname
    if (!args[0]) {
      let stmt = db.prepare("SELECT nickname FROM bot WHERE user = ?");
      let { nickname } = stmt.get(meta.userID);
      await client.chat.say(
        meta.channel,
        `ชื่อของเจ้าคือ ${nickname ?? meta.user}`,
      );
      return;
    }

    // Reset nickname
    if (name === "--reset") {
      let stmt = db.prepare("UPDATE bot SET nickname = ? WHERE user = ?");
      stmt.run(null, meta.userID);
      await client.chat.say(meta.channel, `ชื่อเล่นถูกลบแล้ว`);
      return;
    }

    // Check if name is too long
    if (name.length > 32) {
      await client.chat.say(meta.channel, `ชื่อยาวไป`);
      return;
    }

    // Check if name is in english or thai
    if (!name.match(/^[a-zA-Z0-9ก-๙ ]+$/)) {
      await client.chat.say(
        meta.channel,
        `ชื่อต้องเป็นภาษาอังกฤษหรือไทยเท่านั้น`,
      );
      return;
    }

    // Update name
    let stmt = db.prepare("UPDATE bot SET nickname = ? WHERE user = ?");
    stmt.run(name, meta.userID);
    await client.chat.say(meta.channel, `เปลี่ยนชื่อเป็น ${name}`);
    client.io.emit("feed", ({ type: "normal", icon: "✍️", message: `${meta.user} (${name})`, action: `Rename` }));
  },
};
