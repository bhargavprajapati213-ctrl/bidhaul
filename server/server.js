/**
 * BidHaul backend — Node.js + Express
 * - Serves the public website (/public) and the admin panel (/admin)
 * - REST API with JSON-file storage (server/data/db.json)
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const seed = require('./seed');

const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
const DB_FILE = path.join(__dirname, 'data', 'db.json');

/* ---------- tiny JSON database ---------- */
function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
let db = loadDB();
db.users ||= []; // databases created before accounts existed
const save = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
const nextId = (list) => (list.reduce((m, x) => Math.max(m, x.id), 0) + 1);

/* ---------- app ---------- */
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));

const clean = (s, max = 500) => String(s ?? '').trim().slice(0, max);
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/* ---------- bidder accounts ---------- */
// Passwords are stored as scrypt hashes. Login tokens are signed with a secret kept in
// server/data/secret.key, so users stay logged in across server restarts.
const SECRET_FILE = path.join(__dirname, 'data', 'secret.key');
if (!fs.existsSync(SECRET_FILE)) fs.writeFileSync(SECRET_FILE, crypto.randomBytes(32).toString('hex'));
const SECRET = fs.readFileSync(SECRET_FILE, 'utf8').trim();

const hashPassword = (pw, salt = crypto.randomBytes(16).toString('hex')) =>
  salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
function checkPassword(pw, stored) {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(pw, salt, 64);
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
}
const sign = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('hex');
function userToken(user) {
  const data = `${user.userId}.${Date.now() + 30 * 864e5}`; // valid 30 days
  return `${data}.${sign(data)}`;
}
function userFromToken(token) {
  const [userId, exp, sig] = String(token || '').split('.');
  if (!sig || sig.length !== 64 || Number(exp) < Date.now()) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(`${userId}.${exp}`)))) return null;
  return db.users.find((u) => u.userId === userId) || null;
}
function userAuth(req, res, next) {
  req.user = userFromToken((req.headers.authorization || '').replace('Bearer ', ''));
  if (!req.user) return res.status(401).json({ error: 'Please log in to continue' });
  next();
}
const nextUserId = () => 'BH' + (db.users.reduce((m, u) => Math.max(m, Number(u.userId.slice(2))), 1000) + 1);
const publicUser = (u) => ({ userId: u.userId, name: u.name, email: u.email, phone: u.phone, createdAt: u.createdAt });

app.post('/api/users/register', (req, res) => {
  const name = clean(req.body.name, 80);
  const email = clean(req.body.email, 120).toLowerCase();
  const phone = clean(req.body.phone, 20);
  const password = String(req.body.password ?? '');
  if (!name) return res.status(400).json({ error: 'Please enter your name' });
  if (!isEmail(email)) return res.status(400).json({ error: 'Please enter a valid email' });
  if (phone && !/^[+\d][\d\s-]{6,}$/.test(phone)) return res.status(400).json({ error: 'Please enter a valid phone number' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (db.users.some((u) => u.email === email)) return res.status(409).json({ error: 'An account with this email already exists' });
  const user = { userId: nextUserId(), name, email, phone, password: hashPassword(password), createdAt: Date.now() };
  db.users.push(user);
  save();
  res.status(201).json({ token: userToken(user), user: publicUser(user) });
});

// log in with either the user ID (e.g. BH1001) or the email address
app.post('/api/users/login', (req, res) => {
  const login = clean(req.body.login, 120).toLowerCase();
  const password = String(req.body.password ?? '');
  const user = db.users.find((u) => u.email === login || u.userId.toLowerCase() === login);
  if (!user || !checkPassword(password, user.password))
    return res.status(401).json({ error: 'Wrong user ID / email or password' });
  res.json({ token: userToken(user), user: publicUser(user) });
});

app.get('/api/users/me', userAuth, (req, res) => {
  const bids = db.bids.filter((b) => b.userId === req.user.userId).reverse().map((b) => {
    const a = db.auctions.find((x) => x.id === b.auctionId) || {};
    return { auctionId: b.auctionId, title: a.title || '(deleted)', amount: b.amount, at: b.at,
      leading: a.currentBid === b.amount, live: a.endsAt > Date.now() };
  });
  res.json({ user: publicUser(req.user), bids });
});

/* ---------- public API ---------- */
app.get('/api/categories', (req, res) => res.json(db.categories));
app.get('/api/testimonials', (req, res) => res.json(db.testimonials));
app.get('/api/partners', (req, res) => res.json(db.partners));
app.get('/api/news', (req, res) => res.json(db.news));

app.get('/api/stats', (req, res) => {
  res.json({
    liveAuctions: db.auctions.filter((a) => a.endsAt > Date.now()).length,
    totalBids: db.auctions.reduce((s, a) => s + a.bidCount, 0),
    itemsSold: 100000 + db.auctions.filter((a) => a.endsAt <= Date.now()).length
  });
});

// GET /api/auctions?q=&category=&sort=ending|price_asc|price_desc|newest&status=live|ended
app.get('/api/auctions', (req, res) => {
  const { q = '', category = '', sort = 'ending', status = 'live' } = req.query;
  const term = q.toLowerCase();
  let list = db.auctions.filter((a) => {
    const live = a.endsAt > Date.now();
    if (status === 'live' && !live) return false;
    if (status === 'ended' && live) return false;
    if (category && a.category !== category) return false;
    if (term && !(`${a.title} ${a.location} ${a.category}`.toLowerCase().includes(term))) return false;
    return true;
  });
  const sorters = {
    ending: (a, b) => a.endsAt - b.endsAt,
    price_asc: (a, b) => a.currentBid - b.currentBid,
    price_desc: (a, b) => b.currentBid - a.currentBid,
    newest: (a, b) => b.id - a.id
  };
  list.sort(sorters[sort] || sorters.ending);
  res.json(list);
});

app.get('/api/auctions/:id', (req, res) => {
  const a = db.auctions.find((x) => x.id === Number(req.params.id));
  if (!a) return res.status(404).json({ error: 'Auction not found' });
  const history = db.bids.filter((b) => b.auctionId === a.id).slice(-10).reverse()
    .map((b) => ({ amount: b.amount, userId: b.userId || null, name: b.name.replace(/(.).+/, '$1***'), at: b.at }));
  res.json({ ...a, history });
});

app.post('/api/auctions/:id/bid', userAuth, (req, res) => {
  const a = db.auctions.find((x) => x.id === Number(req.params.id));
  if (!a) return res.status(404).json({ error: 'Auction not found' });
  if (a.endsAt <= Date.now()) return res.status(400).json({ error: 'This auction has ended' });

  const { userId, name, email } = req.user;
  const amount = Number(req.body.amount);
  const minBid = a.currentBid + increment(a.currentBid);

  if (!Number.isFinite(amount) || amount < minBid)
    return res.status(400).json({ error: `Minimum bid is ₹${minBid.toLocaleString('en-IN')}` });

  a.currentBid = Math.round(amount);
  a.bidCount += 1;
  // soft close: bids in the last 2 minutes extend the auction by 2 minutes
  if (a.endsAt - Date.now() < 120000) a.endsAt = Date.now() + 120000;
  db.bids.push({ id: nextId(db.bids), auctionId: a.id, userId, name, email, amount: a.currentBid, at: Date.now() });
  save();
  res.json({ ok: true, auction: a, nextMinBid: a.currentBid + increment(a.currentBid) });
});

function increment(price) {
  if (price < 1000000) return 10000;     // < ₹10 lakh
  if (price < 5000000) return 25000;     // < ₹50 lakh
  if (price < 10000000) return 50000;    // < ₹1 crore
  if (price < 25000000) return 100000;   // < ₹2.5 crore
  return 250000;
}
app.get('/api/increment/:price', (req, res) => res.json({ increment: increment(Number(req.params.price)) }));

app.post('/api/contact', (req, res) => {
  const name = clean(req.body.name, 80);
  const email = clean(req.body.email, 120);
  const phone = clean(req.body.phone, 30);
  const type = clean(req.body.type, 30) || 'General';
  const message = clean(req.body.message, 2000);
  if (!name || !isEmail(email) || !message)
    return res.status(400).json({ error: 'Name, valid email and message are required' });
  db.messages.push({ id: nextId(db.messages), name, email, phone, type, message, at: Date.now(), read: false });
  save();
  res.json({ ok: true, message: 'Thanks! Our team will contact you within one business day.' });
});

app.post('/api/newsletter', (req, res) => {
  const email = clean(req.body.email, 120).toLowerCase();
  if (!isEmail(email)) return res.status(400).json({ error: 'Please enter a valid email' });
  if (!db.subscribers.find((s) => s.email === email)) {
    db.subscribers.push({ email, at: Date.now() });
    save();
  }
  res.json({ ok: true, message: 'Subscribed! Watch your inbox for new auctions.' });
});

/* ---------- admin auth (simple bearer token) ---------- */
const sessions = new Map(); // token -> expiry
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username !== ADMIN_USER || password !== ADMIN_PASS)
    return res.status(401).json({ error: 'Invalid username or password' });
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, Date.now() + 8 * 60 * 60 * 1000);
  res.json({ token });
});
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const exp = sessions.get(token);
  if (!exp || exp < Date.now()) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

/* ---------- admin API ---------- */
app.get('/api/admin/summary', auth, (req, res) => {
  res.json({
    auctions: db.auctions.length,
    live: db.auctions.filter((a) => a.endsAt > Date.now()).length,
    bids: db.bids.length,
    messages: db.messages.length,
    unread: db.messages.filter((m) => !m.read).length,
    subscribers: db.subscribers.length,
    users: db.users.length,
    totalValue: db.auctions.reduce((s, a) => s + a.currentBid, 0)
  });
});

app.get('/api/admin/auctions', auth, (req, res) => res.json([...db.auctions].sort((a, b) => b.id - a.id)));

function auctionFromBody(b, existing = {}) {
  const startingBid = Number(b.startingBid ?? existing.startingBid ?? 0);
  return {
    title: clean(b.title ?? existing.title, 150),
    category: clean(b.category ?? existing.category, 40),
    location: clean(b.location ?? existing.location, 80),
    image: clean(b.image ?? existing.image, 500),
    year: Number(b.year ?? existing.year) || null,
    hours: clean(b.hours ?? existing.hours, 40),
    description: clean(b.description ?? existing.description, 3000),
    startingBid,
    currentBid: existing.currentBid && existing.bidCount ? existing.currentBid : startingBid,
    endsAt: b.endsAt ? new Date(b.endsAt).getTime() : existing.endsAt
  };
}

app.post('/api/admin/auctions', auth, (req, res) => {
  const data = auctionFromBody(req.body);
  if (!data.title || !data.category || !data.startingBid || !data.endsAt)
    return res.status(400).json({ error: 'Title, category, starting bid and end date are required' });
  const a = { id: nextId(db.auctions), bidCount: 0, ...data };
  db.auctions.push(a);
  save();
  res.status(201).json(a);
});

app.put('/api/admin/auctions/:id', auth, (req, res) => {
  const idx = db.auctions.findIndex((x) => x.id === Number(req.params.id));
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  db.auctions[idx] = { ...db.auctions[idx], ...auctionFromBody(req.body, db.auctions[idx]) };
  save();
  res.json(db.auctions[idx]);
});

app.delete('/api/admin/auctions/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  db.auctions = db.auctions.filter((x) => x.id !== id);
  db.bids = db.bids.filter((b) => b.auctionId !== id);
  save();
  res.json({ ok: true });
});

app.get('/api/admin/bids', auth, (req, res) => {
  res.json([...db.bids].reverse().map((b) => ({
    ...b, auctionTitle: (db.auctions.find((a) => a.id === b.auctionId) || {}).title || '(deleted)'
  })));
});

app.get('/api/admin/messages', auth, (req, res) => res.json([...db.messages].reverse()));
app.patch('/api/admin/messages/:id/read', auth, (req, res) => {
  const m = db.messages.find((x) => x.id === Number(req.params.id));
  if (!m) return res.status(404).json({ error: 'Not found' });
  m.read = true; save(); res.json(m);
});
app.delete('/api/admin/messages/:id', auth, (req, res) => {
  db.messages = db.messages.filter((x) => x.id !== Number(req.params.id));
  save(); res.json({ ok: true });
});

app.get('/api/admin/users', auth, (req, res) => {
  res.json([...db.users].reverse().map((u) => ({
    ...publicUser(u), bids: db.bids.filter((b) => b.userId === u.userId).length
  })));
});

app.get('/api/admin/subscribers', auth, (req, res) => res.json([...db.subscribers].reverse()));

app.post('/api/admin/reset', auth, (req, res) => {
  delete require.cache[require.resolve('./seed')]; // re-run so end dates are fresh
  db = { ...JSON.parse(JSON.stringify(require('./seed'))), users: db.users };
  save(); res.json({ ok: true });
});

/* ---------- fallbacks ---------- */
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.get('/admin/*', (req, res) => res.sendFile(path.join(__dirname, '..', 'admin', 'index.html')));

app.listen(PORT, () => {
  console.log(`\n  BidHaul running →  http://localhost:${PORT}`);
  console.log(`  Admin panel     →  http://localhost:${PORT}/admin  (${ADMIN_USER} / ${ADMIN_PASS})\n`);
});
