export default {
  name: "shoutout",
  description: "Shoutout to someone!",
  alias: ["so"],
  args: [{
    name: "user",
    description: "The user you want to shoutout",
    required: true,
  }],
  execute: async (client, meta) => {
    // Get list of mods
    let mods = await client.api.chat.getGlobalBadges(meta.channelID);

  },
};
