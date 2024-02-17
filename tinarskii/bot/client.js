import "dotenv/config";
import { StaticAuthProvider } from "@twurple/auth";
import { ChatClient } from "@twurple/chat";
import { ApiClient } from "@twurple/api";
import Database from "better-sqlite3";
import express from "express";
import { readdirSync } from "fs";
import { Server } from "socket.io";
import { createServer } from "http";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

export const db = new Database("user.db");
db.pragma("journal_mode = WAL");

const __dirname = dirname(fileURLToPath(import.meta.url));
let commands = new Map();
let prefix = "!";

// Express Web Server
const app = express();
const server = createServer(app);
const io = new Server(server);

// app.get("/", (req, res) => {
//   res.send("Hello World!");
// });
app.get("/api/nickname", (req, res) => {
  let userID = req.query.userID;
  let stmt = db.prepare("SELECT nickname FROM bot WHERE user = ?");
  let nickname = stmt.get(userID);
  res.send(nickname);
});
app.get("/api/nickname/all", (req, res) => {
  let stmt = db.prepare("SELECT user, nickname FROM bot");
  let nicknames = stmt.all();
  res.send(nicknames);
});
app.get("/api/commands", (req, res) => {
  let commandList = [];
  for (let command of commands.values()) {
    commandList.push({
      name: command.name,
      description: command.description,
      alias: command.alias,
      args: command.args,
    });
  }
  res.send(commandList);
});
app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "/app/feed.html"));
});
app.get("/socket.io/socket.io.js", (req, res) => {
  res.sendFile(__dirname + "/node_modules/socket.io/client-dist/socket.io.js");
});
server.listen(process.env.PORT ?? 8080, () => {
  console.log(
    `[Tx-API] Listening http://localhost:${process.env.PORT ?? 8080}`,
  );
});
io.on("connection", (socket) => {
  console.log("[Tx-SocketIO] A user connected");
  socket.on("connect_error", (err) => {
    console.log(`connect_error due to ${err.message}`);
  });
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
    method: "POST",
    headers: headers,
    body: JSON.stringify(body),
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
    method: "GET",
    headers: headers,
    redirect: "follow",
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
  const authProvider = new StaticAuthProvider(
    process.env.CLIENT_ID,
    process.env.USER_ACCESS_TOKEN,
    [
      "user:edit",
      "user:read:email",
      "chat:read",
      "chat:edit",
      "channel:moderate",
      "moderation:read"
    ],
  );
  const apiClient = new ApiClient({ authProvider });
  const chatClient = new ChatClient({ authProvider, channels: ["tinarskii"] });
  chatClient.connect();

  chatClient.onConnect(async () => {
    // Load commands from /command
    let commandFiles = readdirSync("./commands").filter((file) =>
      file.endsWith(".js"),
    );
    for (let file of commandFiles) {
      let command = (await import(`./commands/${file}`)).default;
      commands.set(command.name, command);
      console.log(`[Tx] Loaded command: ${command.name}`);
    }
    console.log("[Tx] Connected to chat");
  });

  chatClient.onMessage(async (channel, user, message) => {
    let userID = (await apiClient.users.getUserByName(user)).id;
    let args = message.split(" ").splice(1);

    if (message.startsWith(prefix)) {
      let commandName = message.split(" ")[0].slice(1);
      for (let command of commands.values()) {
        if (command.alias.includes(commandName)) {
          commandName = command.name;
          break;
        }
      }
      let command = commands.get(commandName);
      if (command.modsOnly) {
        let channel = (await apiClient.channels.getchannelinfo(channel)).id;
        let mods = await apiClient.moderation.checkUserMod(channel, userID);
        if (!mods) {
          await chatClient.say(channel, `คุณไม่มีสิทธิ์ในการเปลี่ยนเกม`);
          return;
        }
      }
      if (command) {
        command.execute(
          { chat: chatClient, api: apiClient, io },
          { channel, user, userID, commands },
          message,
          args,
        );
      }
    }
  });
}

export function initBank(userID) {
  let stmt = db.prepare("SELECT money FROM bot WHERE user = ?");
  if (!stmt.get(userID)) {
    stmt = db.prepare("INSERT INTO bot (user, money) VALUES (?, ?)");
    stmt.run(userID, 0);
  }
}

// Init twitch bot
await initializeSequence();
