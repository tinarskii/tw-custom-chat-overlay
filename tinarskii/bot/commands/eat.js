export default {
  name: "eat",
  description: "What do you want to eat?",
  alias: ["กินไร"],
  args: [],
  execute: async (client, meta) => {
    let foods = [
      "ข้าว",
      "ก๋วยเตี๋ยว",
      "ส้มตำ",
      "ไก่ทอด",
      "ขนมจีน",
      "สเต็ก",
      "ไก่ย่าง",
      "หมูกระทะ",
      "หมูทอด",
      "หมูสะเต๊ะ",
      "หมูกรอบ",
      "หมูย่าง",
      "หมูทอดกรอบ",
      "หมูสามชั้น",
      "หมูสับ",
    ];
    let food = foods[Math.floor(Math.random() * foods.length)];
    await client.chat.say(meta.channel, `🍲 กิน ${food}`);
  },
};
