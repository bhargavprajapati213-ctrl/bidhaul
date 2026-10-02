/* ================= BidHaul — public site script ================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const money = (n) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FALLBACK_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 100'%3E%3Crect width='160' height='100' fill='%23d5d9de'/%3E%3Cpath d='M30 70h70l10-20h20v20h10v8H30z' fill='%239aa3ad'/%3E%3Ccircle cx='50' cy='78' r='8' fill='%236b7280'/%3E%3Ccircle cx='120' cy='78' r='8' fill='%236b7280'/%3E%3C/svg%3E";

window.imgFallback = (img) => { img.onerror = null; img.src = FALLBACK_IMG; };
let currentAuction = null, pendingAuction = null;
const state = { q: '', category: '', sort: 'ending', status: 'live', categories: [], auctions: [] };
let countdownTimer = null;

async function api(url, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth.token) headers.Authorization = 'Bearer ' + auth.token;
  const res = await fetch(url, { headers, ...opts });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && auth.token && url.startsWith('/api/') && !url.startsWith('/api/users/login')) setSession(null);
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

/* ---------- bidder accounts ---------- */
const auth = { token: null, user: null };
function setSession(session) {
  auth.token = session ? session.token : null;
  auth.user = session ? session.user : null;
  localStorageSafe('bh_session', session ? JSON.stringify(session) : '');
  renderUserButton();
}
function restoreSession() {
  try {
    const saved = JSON.parse(localStorageSafe('bh_session') || 'null');
    if (saved && saved.token) { auth.token = saved.token; auth.user = saved.user; }
  } catch { /* ignore */ }
  renderUserButton();
  if (auth.token) api('/api/users/me').then((r) => { auth.user = r.user; renderUserButton(); }).catch(() => {});
}
function renderUserButton() {
  const btn = $('#loginBtn');
  if (auth.user) {
    btn.classList.add('user-btn');
    btn.innerHTML = `<span class="avatar-sm">${esc(auth.user.name[0].toUpperCase())}</span>${esc(auth.user.userId)}`;
    btn.title = auth.user.name;
  } else {
    btn.classList.remove('user-btn');
    btn.textContent = 'Log In';
    btn.title = '';
  }
}
function openAuth(mode = 'login') {
  $$('.auth-tab').forEach((t) => t.classList.toggle('active', t.dataset.auth === mode));
  $('#loginForm').classList.toggle('hidden', mode !== 'login');
  $('#registerForm').classList.toggle('hidden', mode !== 'register');
  $('#loginMsg').textContent = ''; $('#registerMsg').textContent = '';
  openModal('#loginModal');
  setTimeout(() => $(mode === 'login' ? '#loginForm input' : '#registerForm input').focus(), 50);
}
async function submitAuth(form, url, msgEl, onDone) {
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true;
  msgEl.className = 'form-msg';
  msgEl.textContent = 'Please wait…';
  try {
    const r = await api(url, { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    setSession(r);
    form.reset();
    onDone(r);
  } catch (e) {
    msgEl.className = 'form-msg err';
    msgEl.textContent = e.message;
  } finally {
    btn.disabled = false;
  }
}
async function openAccount(justRegistered = false) {
  closeModals();
  openModal('#accountModal');
  const box = $('#accountBody');
  const u = auth.user;
  box.innerHTML = `
    <h3>${justRegistered ? 'Account created 🎉' : 'My account'}</h3>
    <div class="uid-hero">
      <div class="muted" style="font-size:13px">Your user ID</div>
      <div class="uid-badge">${esc(u.userId)}</div>
      ${justRegistered ? '<p class="muted" style="font-size:13px;margin-top:8px">Save this ID. You can log in with it or with your email.</p>' : ''}
    </div>
    <div class="acct-info">
      <div><span>Name</span>${esc(u.name)}</div>
      <div><span>Email</span>${esc(u.email)}</div>
      ${u.phone ? `<div><span>Mobile</span>${esc(u.phone)}</div>` : ''}
    </div>
    <h4 style="font-size:14px;margin-top:16px">My bids</h4>
    <ul class="my-bids" id="myBids"><li class="muted">Loading…</li></ul>
    <button class="btn-outline" id="logoutBtn" style="margin-top:16px;width:100%">Log out</button>`;
  try {
    const { bids } = await api('/api/users/me');
    $('#myBids').innerHTML = bids.length ? bids.map((b) => `
      <li><span>${esc(b.title)}<br /><small class="muted">${new Date(b.at).toLocaleString('en-IN')}</small></span>
        <span style="text-align:right"><b>${money(b.amount)}</b><br /><small class="${b.leading ? 'lead' : 'out'}">${b.leading ? (b.live ? 'Highest bid' : 'Won') : 'Outbid'}</small></span></li>`).join('')
      : '<li class="muted">No bids yet. Open an auction to place your first bid.</li>';
  } catch (e) {
    $('#myBids').innerHTML = `<li class="muted">${esc(e.message)}</li>`;
  }
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 3000);
}

/* ---------- time helpers ---------- */
function timeLeft(endsAt) {
  const ms = endsAt - Date.now();
  if (ms <= 0) return { text: 'Ended', ms: 0 };
  const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
  const text = d > 0 ? `${d}d ${h}h ${m}m` : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return { text, ms };
}
const endsLabel = (t) => 'ENDS ' + new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();

/* ---------- categories ---------- */
async function loadCategories() {
  state.categories = await api('/api/categories');
  const cats = state.categories;
  $('#catMenu').innerHTML = cats.map((c) => `<a href="#auctions" data-cat="${c.id}"><span>${c.icon}</span>${esc(c.name)}</a>`).join('');
  $('#chips').innerHTML = cats.slice(0, 6).map((c) => `<button type="button" class="chip" data-cat="${c.id}">${c.icon} ${esc(c.name)}</button>`).join('');
  $('#filterPills').innerHTML = `<button class="pill active" data-cat="">All</button>` + cats.map((c) => `<button class="pill" data-cat="${c.id}">${esc(c.name)}</button>`).join('');
  $('#searchCat').innerHTML += cats.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
}

function setCategory(cat) {
  state.category = cat;
  $$('.pill').forEach((p) => p.classList.toggle('active', p.dataset.cat === cat));
  $$('.chip').forEach((p) => p.classList.toggle('active', p.dataset.cat === cat && cat !== ''));
  loadAuctions();
}

/* ---------- auctions ---------- */
async function loadAuctions() {
  const grid = $('#auctionGrid');
  grid.innerHTML = '<div class="skeleton"></div>'.repeat(4);
  const params = new URLSearchParams({ q: state.q, category: state.category, sort: state.sort, status: state.status });
  try {
    state.auctions = await api('/api/auctions?' + params);
    renderAuctions();
  } catch (e) {
    grid.innerHTML = `<div class="empty">Could not load auctions. Is the server running?</div>`;
  }
}

function renderAuctions() {
  const list = state.auctions;
  const catName = (state.categories.find((c) => c.id === state.category) || {}).name;
  const parts = [];
  if (state.status === 'ended') parts.push('auction results');
  if (catName) parts.push(catName);
  if (state.q) parts.push(`“${state.q}”`);
  $('#resultInfo').innerHTML = `${list.length} ${state.status === 'ended' ? 'completed' : 'live'} auction${list.length === 1 ? '' : 's'}${parts.length ? ' · ' + esc(parts.join(' · ')) : ''}${(state.q || state.category || state.status !== 'live') ? ' · <a href="#auctions" class="link-red" id="clearFilters">Clear filters</a>' : ''}`;

  if (!list.length) {
    $('#auctionGrid').innerHTML = `<div class="empty">No auctions match your search. Try another keyword or category.</div>`;
    return;
  }
  $('#auctionGrid').innerHTML = list.map((a) => {
    const tl = timeLeft(a.endsAt);
    const urgent = tl.ms > 0 && tl.ms < 864e5;
    return `
    <article class="card reveal" data-id="${a.id}" tabindex="0">
      <div class="card-img">
        <img src="${esc(a.image)}" alt="${esc(a.title)}" loading="lazy" onerror="imgFallback(this)" />
        <span class="badge ${urgent ? 'urgent' : ''}"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          <span class="cd" data-ends="${a.endsAt}">${urgent ? tl.text : (tl.ms ? endsLabel(a.endsAt) : 'ENDED')}</span></span>
      </div>
      <div class="card-body">
        <h3 class="card-title">${esc(a.title)}</h3>
        <div class="card-loc">${esc(a.location)}</div>
        <div class="card-foot"><span class="price">${money(a.currentBid)}</span><span class="bids">${a.bidCount} bids</span></div>
      </div>
    </article>`;
  }).join('');
  observeReveal();
}

/* ---------- auction detail modal ---------- */
async function openAuction(id) {
  currentAuction = id;
  openModal('#auctionModal');
  const box = $('#auctionDetail');
  box.innerHTML = '<div style="padding:60px;text-align:center" class="muted">Loading…</div>';
  try {
    const a = await api('/api/auctions/' + id);
    const { increment } = await api('/api/increment/' + a.currentBid);
    const min = a.currentBid + increment;
    const cat = (state.categories.find((c) => c.id === a.category) || {}).name || a.category;
    const live = a.endsAt > Date.now();
    box.innerHTML = `
      <div class="detail">
        <div class="detail-img"><img src="${esc(a.image)}" alt="" onerror="imgFallback(this)" /></div>
        <div class="detail-body">
          <h3>${esc(a.title)}</h3>
          <div class="specs">
            <div><span>Category</span>${esc(cat)}</div>
            <div><span>Location</span>${esc(a.location)}</div>
            <div><span>Year</span>${esc(a.year || '—')}</div>
            <div><span>Usage</span>${esc(a.hours || '—')}</div>
          </div>
          <p class="muted" style="font-size:14px">${esc(a.description)}</p>
          <div class="bid-box">
            <div class="bid-top">
              <div><div class="muted" style="font-size:12px">Current bid · ${a.bidCount} bids</div><div class="big" id="dPrice">${money(a.currentBid)}</div></div>
              <div style="text-align:right"><div class="muted" style="font-size:12px">Time left</div><div class="countdown cd" data-ends="${a.endsAt}" data-full="1">${timeLeft(a.endsAt).text}</div></div>
            </div>
            ${live ? `
            ${auth.user ? `
            <form class="bid-form" id="bidForm" data-id="${a.id}">
              <div class="bidding-as">Bidding as <b>${esc(auth.user.name)}</b> · <span class="uid-badge">${esc(auth.user.userId)}</span></div>
              <label>Your bid (min ${money(min)})<input name="amount" type="number" min="${min}" step="1" value="${min}" required /></label>
              <button class="btn-red" type="submit">Place Bid</button>
              <p class="form-msg" id="bidMsg"></p>
            </form>` : `
            <div class="bid-form">
              <p class="muted" style="font-size:14px">Log in with your user ID to place a bid.</p>
              <button class="btn-red" type="button" data-auth-open="login">Log In to Bid</button>
              <button class="btn-outline" type="button" data-auth-open="register">Create a free account</button>
            </div>`}` : `<p class="muted">This auction has ended. Final price: <b>${money(a.currentBid)}</b></p>`}
          </div>
          <div class="history">
            <h4>Recent bids</h4>
            <ul>${a.history.length ? a.history.map((h) => `<li><span>${h.userId ? `<b>${esc(h.userId)}</b> · ` : ''}${esc(h.name)} · ${new Date(h.at).toLocaleString('en-IN')}</span><b>${money(h.amount)}</b></li>`).join('') : '<li>No bids yet — be the first!</li>'}</ul>
          </div>
        </div>
      </div>`;
  } catch (e) {
    box.innerHTML = `<div style="padding:60px;text-align:center">${esc(e.message)}</div>`;
  }
}

async function submitBid(form) {
  const msg = $('#bidMsg');
  const btn = form.querySelector('button');
  const body = Object.fromEntries(new FormData(form));
  btn.disabled = true;
  msg.className = 'form-msg';
  msg.textContent = 'Placing bid…';
  try {
    const r = await api(`/api/auctions/${form.dataset.id}/bid`, { method: 'POST', body: JSON.stringify(body) });
    msg.className = 'form-msg ok';
    msg.textContent = `You're the highest bidder at ${money(r.auction.currentBid)}!`;
    toast('Bid placed successfully 🎉');
    setTimeout(() => openAuction(form.dataset.id), 1200);
    loadAuctions();
  } catch (e) {
    msg.className = 'form-msg err';
    msg.textContent = e.message;
    if (!auth.user) setTimeout(() => openAuth('login'), 800); // session expired
  } finally {
    btn.disabled = false;
  }
}

function localStorageSafe(k, v) {
  try { return v === undefined ? localStorage.getItem(k) : localStorage.setItem(k, v); } catch { return null; }
}

/* ---------- live countdowns ---------- */
function tickCountdowns() {
  $$('.cd[data-ends]').forEach((el) => {
    const ends = Number(el.dataset.ends);
    const tl = timeLeft(ends);
    if (el.dataset.full || (tl.ms > 0 && tl.ms < 864e5)) el.textContent = tl.text;
    else if (!tl.ms) el.textContent = 'ENDED';
  });
}

/* ---------- other sections ---------- */
async function loadTestimonials() {
  const list = await api('/api/testimonials');
  $('#testimonials').innerHTML = list.map((t) => `
    <div class="t-card reveal">
      <div class="stars">${'★'.repeat(t.rating)}</div>
      <p>“${esc(t.text)}”</p>
      <div class="t-person"><div class="avatar">${esc(t.name.split(' ').map((w) => w[0]).join(''))}</div>
        <div><strong>${esc(t.name)}</strong><span>${esc(t.role)}</span></div></div>
    </div>`).join('');
}
async function loadPartners() {
  const list = await api('/api/partners');
  $('#partners').innerHTML = list.map((p) => `<div>${esc(p)}</div>`).join('');
}
async function loadNews() {
  const list = await api('/api/news');
  $('#newsGrid').innerHTML = list.map((n) => `
    <a href="#news" class="news-card reveal">
      <div class="n-img"><img src="${esc(n.image)}" alt="" loading="lazy" onerror="imgFallback(this)" /></div>
      <div class="n-meta">${esc(n.tag)} · ${new Date(n.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
      <h3>${esc(n.title)}</h3>
      <span class="link-red">Read More →</span>
    </a>`).join('');
}
async function loadStats() {
  const s = await api('/api/stats');
  $('#statSold').textContent = 'Over ' + s.itemsSold.toLocaleString();
}

/* ---------- forms ---------- */
async function handleForm(form, url, msgEl) {
  const btn = form.querySelector('button');
  const body = Object.fromEntries(new FormData(form));
  btn.disabled = true;
  msgEl.className = 'form-msg';
  msgEl.textContent = 'Sending…';
  try {
    const r = await api(url, { method: 'POST', body: JSON.stringify(body) });
    msgEl.className = 'form-msg ok';
    msgEl.textContent = r.message;
    form.reset();
  } catch (e) {
    msgEl.className = 'form-msg err';
    msgEl.textContent = e.message;
  } finally {
    btn.disabled = false;
  }
}

/* ---------- modal ---------- */
function openModal(sel) { $(sel).classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeModals() { $$('.modal.open').forEach((m) => m.classList.remove('open')); document.body.style.overflow = ''; }

/* ---------- reveal & counters ---------- */
const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: 0.1 }) : null;
function observeReveal() { $$('.reveal:not(.in)').forEach((el) => (io ? io.observe(el) : el.classList.add('in'))); }

function animateCounters() {
  const els = $$('[data-count]');
  const run = (el) => {
    const target = Number(el.dataset.count); const start = performance.now();
    const step = (t) => {
      const p = Math.min((t - start) / 1400, 1);
      el.textContent = Math.floor(target * (1 - Math.pow(1 - p, 3))).toLocaleString() + (p === 1 && target >= 1000 ? '+' : '');
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if (!io) return els.forEach(run);
  const cio = new IntersectionObserver((en) => en.forEach((e) => { if (e.isIntersecting) { run(e.target); cio.unobserve(e.target); } }), { threshold: 0.5 });
  els.forEach((el) => cio.observe(el));
}

/* ---------- events ---------- */
function bindEvents() {
  // category dropdown
  $('#catBtn').addEventListener('click', (e) => { e.stopPropagation(); $('#catMenu').classList.toggle('open'); });
  document.addEventListener('click', () => $('#catMenu').classList.remove('open'));

  // mobile nav
  $('#burger').addEventListener('click', () => $('#nav').classList.toggle('open'));
  $$('#nav a').forEach((a) => a.addEventListener('click', () => $('#nav').classList.remove('open')));

  // delegated clicks for any [data-cat] / [data-status] link
  document.addEventListener('click', (e) => {
    const catEl = e.target.closest('[data-cat]');
    if (catEl) {
      if (catEl.classList.contains('pill')) return setCategory(catEl.dataset.cat);
      state.status = 'live';
      setCategory(catEl.dataset.cat);
      $('#auctions').scrollIntoView({ behavior: 'smooth' });
      return;
    }
    const stEl = e.target.closest('[data-status]');
    if (stEl) { state.status = stEl.dataset.status; loadAuctions(); }
    if (e.target.id === 'clearFilters') {
      e.preventDefault();
      state.q = ''; state.status = 'live'; $('#searchInput').value = ''; setCategory('');
    }
    const card = e.target.closest('.card');
    if (card) openAuction(card.dataset.id);
    if (e.target.matches('[data-close]') || e.target.classList.contains('modal')) closeModals();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModals();
    if (e.key === 'Enter' && e.target.classList.contains('card')) openAuction(e.target.dataset.id);
  });

  // search tabs
  $$('.tab').forEach((tab) => tab.addEventListener('click', () => {
    $$('.tab').forEach((t) => t.classList.toggle('active', t === tab));
    const mode = tab.dataset.tab;
    $('#searchInput').classList.toggle('hidden', mode === 'equipment');
    $('#searchCat').classList.toggle('hidden', mode !== 'equipment');
    $('#searchInput').placeholder = mode === 'results' ? 'Search completed auctions' : 'Search for Vehicles, Auctions and Locations';
  }));

  $('#searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const mode = $('.tab.active').dataset.tab;
    state.status = mode === 'results' ? 'ended' : 'live';
    if (mode === 'equipment') { state.q = ''; setCategory($('#searchCat').value); }
    else { state.q = $('#searchInput').value.trim(); loadAuctions(); }
    $('#auctions').scrollIntoView({ behavior: 'smooth' });
  });

  $('#searchToggle').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => $('#searchInput').focus(), 400);
  });

  $('#sortSel').addEventListener('change', (e) => { state.sort = e.target.value; loadAuctions(); });
  $('#viewAll').addEventListener('click', () => { state.q = ''; state.status = 'live'; $('#searchInput').value = ''; setCategory(''); });
  $('#loginBtn').addEventListener('click', () => (auth.user ? openAccount() : openAuth('login')));
  $$('.auth-tab').forEach((t) => t.addEventListener('click', () => openAuth(t.dataset.auth)));
  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-auth-open]');
    if (opener) { pendingAuction = $('#auctionModal').classList.contains('open') ? currentAuction : null; openAuth(opener.dataset.authOpen); }
    if (e.target.id === 'logoutBtn') { setSession(null); closeModals(); toast('Logged out'); }
  });
  const afterAuth = (registered) => {
    if (pendingAuction) { const id = pendingAuction; pendingAuction = null; closeModals(); openAuction(id); toast(`Welcome, ${auth.user.name}!`); }
    else openAccount(registered);
  };
  $('#loginForm').addEventListener('submit', (e) => { e.preventDefault(); submitAuth(e.target, '/api/users/login', $('#loginMsg'), () => afterAuth(false)); });
  $('#registerForm').addEventListener('submit', (e) => { e.preventDefault(); submitAuth(e.target, '/api/users/register', $('#registerMsg'), () => afterAuth(true)); });

  // bid form (rendered dynamically)
  document.addEventListener('submit', (e) => {
    if (e.target.id === 'bidForm') { e.preventDefault(); submitBid(e.target); }
  });
  $('#contactForm').addEventListener('submit', (e) => { e.preventDefault(); handleForm(e.target, '/api/contact', $('#contactMsg')); });
  $('#newsletterForm').addEventListener('submit', (e) => { e.preventDefault(); handleForm(e.target, '/api/newsletter', $('#newsMsg')); });
}

/* ---------- init ---------- */
(async function init() {
  $('#year').textContent = new Date().getFullYear();
  bindEvents();
  restoreSession();
  animateCounters();
  try { await loadCategories(); } catch { /* grid will show error */ }
  loadAuctions();
  Promise.allSettled([loadTestimonials(), loadPartners(), loadNews(), loadStats()]).then(observeReveal);
  countdownTimer = setInterval(tickCountdowns, 1000);
  $$('.section-head, .split, .contact-wrap').forEach((el) => el.classList.add('reveal'));
  observeReveal();
})();
