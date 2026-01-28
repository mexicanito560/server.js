const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.DZ_KEY || "DZisthegoat";
const DB_FILE = path.join(__dirname, "db.json");

const app = express();
app.use(cors());
app.use(express.json());

let clients = [];

let db = {
  totalExec: 0,
  todayExec: 0,
  lastDay: new Date().toDateString(),
  users: {} // userId: { firstSeen }
};

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function loadDB() {
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE));
  } else saveDB();
}
loadDB();

function ensureToday() {
  const today = new Date().toDateString();
  if (db.lastDay !== today) {
    db.todayExec = 0;
    db.lastDay = today;
  }
}

function broadcast() {
  const today = new Date().toDateString();
  let newUsersToday = 0;

  for (const id in db.users) {
    if (db.users[id].firstSeen === today) newUsersToday++;
  }

  const payload = {
    totalUses: db.totalExec,
    todayUses: db.todayExec,
    newUsers: newUsersToday
  };

  clients.forEach(res =>
    res.write(`data: ${JSON.stringify(payload)}\n\n`)
  );
}

function authKey(req, res, next) {
  if (req.headers["x-key"] !== SECRET_KEY)
    return res.status(403).json({ ok: false });
  next();
}

/* ================= EXEC ================= */

app.post("/exec", authKey, (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ ok: false });

  ensureToday();

  if (!db.users[userId]) {
    db.users[userId] = {
      firstSeen: new Date().toDateString()
    };
  }

  db.totalExec++;
  db.todayExec++;

  saveDB();
  broadcast();

  res.json({ ok: true });
});

/* ================= EVENTS ================= */

app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  broadcast();
  clients.push(res);

  req.on("close", () => {
    clients = clients.filter(c => c !== res);
  });
});

app.listen(PORT, () =>
  console.log("API activa en puerto", PORT)
);
