# BidHaul — Heavy Equipment Auction Website

A full-stack auction website: a public frontend (HTML, CSS, JavaScript), a Node.js + Express backend, and an admin panel.

## Quick start

```bash
# 1. Install Node.js 18+ from https://nodejs.org
# 2. In this folder:
npm install
npm start
```

- Website: http://localhost:3000
- Admin panel: http://localhost:3000/admin (username `admin`, password `admin123`)

To change the port or admin login, set environment variables before starting:

```bash
PORT=8080 ADMIN_USER=haresh ADMIN_PASS=StrongPass123 npm start
```

(On Windows PowerShell: `$env:ADMIN_PASS="StrongPass123"; npm start`)

## Folder structure

```
bidhaul/
├── package.json
├── server/
│   ├── server.js      # Express server + REST API
│   ├── seed.js        # demo data (auctions, reviews, news…)
│   └── data/db.json   # created automatically on first run (the database)
├── public/            # website
│   ├── index.html
│   ├── css/style.css
│   └── js/main.js
└── admin/             # admin panel
    ├── index.html
    ├── admin.css
    └── admin.js
```

## Features

**Website**
- Sticky header with a category dropdown, mega-menus and a mobile burger menu
- Hero with a tabbed search card (Keywords / Equipment / Auction Results) and popular categories
- "Bid With Confidence" banner
- Live auction grid with filters, sorting, keyword search and live countdowns
- Bidder accounts: register to get a user ID (e.g. `BH1001`), log in with the ID or email, and see your bids under "My account"
- Auction detail popup with specs, a bid form (login required) (validated on the server), minimum bid increments and bid history
- Testimonials, partner strip, a dark "Working capital" section with animated counters, and news cards
- "Sell your equipment" contact form and a newsletter signup, both saved to the backend
- Responsive down to phone width

**Admin panel** (`/admin`)
- Dashboard with stats and the latest bids
- Create, edit and delete auctions (image URL, category, starting bid, end date)
- View registered users with their user IDs, and see which user placed each bid
- View all bids, contact messages (mark as read or delete) and subscribers
- Reset demo data

## API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/auctions?q=&category=&sort=&status=` | List auctions (`sort`: ending, newest, price_asc, price_desc; `status`: live, ended, all) |
| GET | `/api/auctions/:id` | Auction detail and recent bids |
| POST | `/api/auctions/:id/bid` | `{ amount }` (logged-in user, Bearer token) |
| POST | `/api/users/register` | `{ name, email, phone, password }` → `{ token, user }` (user gets an ID like `BH1001`) |
| POST | `/api/users/login` | `{ login, password }`, where `login` is the user ID or email → `{ token, user }` |
| GET | `/api/users/me` | Logged-in user's profile and bids (Bearer token) |
| GET | `/api/categories`, `/api/testimonials`, `/api/partners`, `/api/news`, `/api/stats` | Content |
| POST | `/api/contact` | `{ name, email, phone, type, message }` |
| POST | `/api/newsletter` | `{ email }` |
| POST | `/api/admin/login` | `{ username, password }` → `{ token }` |
| GET/POST/PUT/DELETE | `/api/admin/auctions[/:id]` | Manage auctions (Bearer token) |
| GET | `/api/admin/bids`, `/api/admin/users`, `/api/admin/messages`, `/api/admin/subscribers`, `/api/admin/summary` | Admin data |

## Notes

- Images are photos from Wikimedia Commons stored in `public/images/` (licences and sources in `public/images/CREDITS.txt`). Replace them with your own images in the admin panel or in `server/seed.js`.
- Data is stored in `server/data/db.json`. Delete that file to reset. For production, swap it for PostgreSQL or MongoDB, hash the admin password, and add email verification and password reset for user accounts.
# bidhaul
