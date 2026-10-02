/* ================= BidHaul — admin panel script ================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const money = (n) => '₹' + Number(n).toLocaleString('en-IN');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (t) => new Date(t).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

const store = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } },
  del: (k) => { try { sessionStorage.removeItem(k); } catch { /* ignore */ } }
};
let token = store.get('bh_token');
let auctions = [];
let categories = [];

async function api(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(opts.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !url.endsWith('/login')) { logout(); throw new Error('Session expired'); }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2500);
}

/* ---------- auth ---------- */
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#loginErr').textContent = '';
  try {
    const r = await api('/api/admin/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target))) });
    token = r.token; store.set('bh_token', token);
    showApp();
  } catch (err) { $('#loginErr').textContent = err.message; }
});
function logout() {
  token = null; store.del('bh_token');
  $('#appView').classList.add('hidden'); $('#loginView').classList.remove('hidden');
}
$('#logoutBtn').addEventListener('click', logout);

async function showApp() {
  $('#loginView').classList.add('hidden'); $('#appView').classList.remove('hidden');
  try {
    categories = await (await fetch('/api/categories')).json();
    $('#catSelect').innerHTML = categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    await go('dashboard');
  } catch (e) { /* handled by api */ }
}

/* ---------- navigation ---------- */
const titles = { dashboard: 'Dashboard', auctions: 'Auctions', bids: 'Bids', users: 'Users', messages: 'Messages', subscribers: 'Subscribers' };
async function go(view) {
  $$('.sidebar nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  $$('.view').forEach((v) => v.classList.toggle('hidden', v.id !== 'view-' + view));
  $('#viewTitle').textContent = titles[view];
  $('#topActions').innerHTML = view === 'auctions' ? '<button class="btn-red" id="newAuctionBtn">+ New auction</button>' : '';
  $('#sidebar').classList.remove('open');
  const loaders = { dashboard: loadDashboard, auctions: loadAuctions, bids: loadBids, users: loadUsers, messages: loadMessages, subscribers: loadSubscribers };
  await loaders[view]();
  refreshUnread();
}
$$('.sidebar nav button').forEach((b) => b.addEventListener('click', () => go(b.dataset.view)));
$('#menuBtn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

async function refreshUnread() {
  try { const s = await api('/api/admin/summary'); $('#unreadCount').textContent = s.unread || ''; } catch { /* ignore */ }
}

/* ---------- dashboard ---------- */
async function loadDashboard() {
  const [s, bids] = await Promise.all([api('/api/admin/summary'), api('/api/admin/bids')]);
  const cards = [
    ['Total auctions', s.auctions], ['Live auctions', s.live], ['Bids placed', s.bids], ['Registered users', s.users],
    ['Messages', `${s.messages}${s.unread ? ` <small style="font-size:13px;color:#d71920">(${s.unread} new)</small>` : ''}`],
    ['Subscribers', s.subscribers], ['Current listing value', money(s.totalValue)]
  ];
  $('#stats').innerHTML = cards.map(([l, v]) => `<div class="stat"><span>${l}</span><strong>${v}</strong></div>`).join('');
  $('#latestBids').innerHTML = bidRows(bids.slice(0, 6));
}

function bidRows(bids) {
  return `<tr><th>Auction</th><th>User ID</th><th>Bidder</th><th>Email</th><th>Amount</th><th>Time</th></tr>` +
    (bids.length ? bids.map((b) => `<tr><td class="title">${esc(b.auctionTitle)}</td><td>${b.userId ? `<span class="uid">${esc(b.userId)}</span>` : '<span class="muted">—</span>'}</td><td>${esc(b.name)}</td><td>${esc(b.email)}</td><td><b>${money(b.amount)}</b></td><td>${fmtDate(b.at)}</td></tr>`).join('')
      : `<tr><td colspan="6" class="empty-row">No bids yet. Place one from the website to see it here.</td></tr>`);
}

$('#resetBtn').addEventListener('click', async () => {
  if (!confirm('Reset all data to the demo defaults? This deletes bids, messages and subscribers.')) return;
  await api('/api/admin/reset', { method: 'POST' });
  toast('Demo data restored'); go('dashboard');
});
document.addEventListener('click', (e) => { if (e.target.dataset.goto) go(e.target.dataset.goto); });

/* ---------- auctions ---------- */
async function loadAuctions() {
  auctions = await api('/api/admin/auctions');
  renderAuctions();
}
function renderAuctions() {
  const q = $('#auctionSearch').value.toLowerCase();
  const list = auctions.filter((a) => `${a.title} ${a.location} ${a.category}`.toLowerCase().includes(q));
  const catName = (id) => (categories.find((c) => c.id === id) || {}).name || id;
  $('#auctionTable').innerHTML = `<tr><th></th><th>Title</th><th>Category</th><th>Current bid</th><th>Bids</th><th>Ends</th><th>Status</th><th></th></tr>` +
    (list.length ? list.map((a) => {
      const live = a.endsAt > Date.now();
      return `<tr>
        <td class="thumb"><img src="${esc(a.image)}" alt="" onerror="this.style.visibility='hidden'" /></td>
        <td><div class="title">${esc(a.title)}</div><small class="muted">${esc(a.location)}</small></td>
        <td>${esc(catName(a.category))}</td>
        <td><b>${money(a.currentBid)}</b></td>
        <td>${a.bidCount}</td>
        <td>${fmtDate(a.endsAt)}</td>
        <td><span class="tag ${live ? 'live' : 'ended'}">${live ? 'Live' : 'Ended'}</span></td>
        <td class="actions"><button class="btn-sm" data-edit="${a.id}">Edit</button><button class="btn-sm del" data-del="${a.id}">Delete</button></td>
      </tr>`;
    }).join('') : `<tr><td colspan="8" class="empty-row">No auctions found.</td></tr>`);
}
$('#auctionSearch').addEventListener('input', renderAuctions);

document.addEventListener('click', async (e) => {
  if (e.target.id === 'newAuctionBtn') openForm();
  if (e.target.dataset.edit) openForm(auctions.find((a) => a.id === Number(e.target.dataset.edit)));
  if (e.target.dataset.del) {
    const a = auctions.find((x) => x.id === Number(e.target.dataset.del));
    if (!confirm(`Delete "${a.title}"? Its bids will also be removed.`)) return;
    await api('/api/admin/auctions/' + a.id, { method: 'DELETE' });
    toast('Auction deleted'); loadAuctions();
  }
  if (e.target.matches('[data-close]') || e.target.id === 'auctionModal') $('#auctionModal').classList.remove('open');
});

const toLocalInput = (t) => { const d = new Date(t); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

function openForm(a) {
  const f = $('#auctionForm');
  f.reset(); $('#formErr').textContent = '';
  $('#formTitle').textContent = a ? 'Edit auction' : 'New auction';
  const v = a || { endsAt: Date.now() + 7 * 864e5 };
  ['id', 'title', 'category', 'location', 'year', 'hours', 'startingBid', 'image', 'description'].forEach((k) => {
    if (v[k] !== undefined && v[k] !== null) f.elements[k].value = v[k];
  });
  f.elements.endsAt.value = toLocalInput(v.endsAt);
  previewImg();
  $('#auctionModal').classList.add('open');
  f.elements.title.focus();
}
function previewImg() {
  const url = $('#auctionForm').elements.image.value.trim();
  $('#imgPreview').innerHTML = url ? `<img src="${esc(url)}" alt="preview" onerror="this.remove()" />` : '';
}
$('#auctionForm').elements.image.addEventListener('change', previewImg);

$('#auctionForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  const id = body.id; delete body.id;
  body.endsAt = new Date(body.endsAt).toISOString();
  try {
    await api('/api/admin/auctions' + (id ? '/' + id : ''), { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
    $('#auctionModal').classList.remove('open');
    toast(id ? 'Auction updated' : 'Auction created');
    loadAuctions();
  } catch (err) { $('#formErr').textContent = err.message; }
});

/* ---------- bids ---------- */
async function loadBids() { $('#bidTable').innerHTML = bidRows(await api('/api/admin/bids')); }

/* ---------- users ---------- */
let users = [];
async function loadUsers() {
  users = await api('/api/admin/users');
  renderUsers();
}
function renderUsers() {
  const q = $('#userSearch').value.toLowerCase();
  const list = users.filter((u) => `${u.userId} ${u.name} ${u.email} ${u.phone}`.toLowerCase().includes(q));
  $('#userTable').innerHTML = `<tr><th>User ID</th><th>Name</th><th>Email</th><th>Mobile</th><th>Bids</th><th>Joined</th></tr>` +
    (list.length ? list.map((u) => `<tr><td><span class="uid">${esc(u.userId)}</span></td><td class="title">${esc(u.name)}</td>
      <td><a href="mailto:${esc(u.email)}">${esc(u.email)}</a></td><td>${esc(u.phone || '—')}</td><td>${u.bids}</td><td>${fmtDate(u.createdAt)}</td></tr>`).join('')
      : `<tr><td colspan="6" class="empty-row">${users.length ? 'No users match your search.' : 'No users yet. Accounts created on the website appear here.'}</td></tr>`);
}
$('#userSearch').addEventListener('input', renderUsers);

/* ---------- messages ---------- */
async function loadMessages() {
  const list = await api('/api/admin/messages');
  $('#messageList').innerHTML = list.length ? list.map((m) => `
    <div class="msg ${m.read ? '' : 'unread'}">
      <div class="msg-head">
        <div><strong>${esc(m.name)}</strong> · <a href="mailto:${esc(m.email)}">${esc(m.email)}</a>${m.phone ? ' · ' + esc(m.phone) : ''}<br /><small class="muted">${esc(m.type)} · ${fmtDate(m.at)}</small></div>
        <div class="actions">${m.read ? '' : `<button class="btn-sm" data-read="${m.id}">Mark read</button>`}<button class="btn-sm del" data-delmsg="${m.id}">Delete</button></div>
      </div>
      <p>${esc(m.message)}</p>
    </div>`).join('') : '<div class="panel empty-row">No messages yet. Submissions from the “Sell your equipment” form appear here.</div>';
}
document.addEventListener('click', async (e) => {
  if (e.target.dataset.read) { await api(`/api/admin/messages/${e.target.dataset.read}/read`, { method: 'PATCH' }); loadMessages(); refreshUnread(); }
  if (e.target.dataset.delmsg && confirm('Delete this message?')) { await api('/api/admin/messages/' + e.target.dataset.delmsg, { method: 'DELETE' }); loadMessages(); refreshUnread(); }
});

/* ---------- subscribers ---------- */
async function loadSubscribers() {
  const list = await api('/api/admin/subscribers');
  $('#subTable').innerHTML = `<tr><th>Email</th><th>Subscribed</th></tr>` +
    (list.length ? list.map((s) => `<tr><td>${esc(s.email)}</td><td>${fmtDate(s.at)}</td></tr>`).join('') : `<tr><td colspan="2" class="empty-row">No subscribers yet.</td></tr>`);
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('#auctionModal').classList.remove('open'); });

/* ---------- boot ---------- */
if (token) showApp();
