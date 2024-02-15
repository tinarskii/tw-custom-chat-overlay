export default {
  name: "help",
  description: "Give daily money (100 Keeb)",
  alias: [],
  args: [],
  execute: async (client, meta, message, args) => {
    await client.chat.say(meta.channel, `📚 ดูคำสั่งได้ที่ : https://bot.tinarskii.com/commands`);
  },
};
