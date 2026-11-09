# ICSSST 2027 – conference website (Node.js)

Website for the **11th International Conference on Solid State Science and Technology (ICSSST 2027)**, 6–8 September 2027, Penang.
Theme: *Malaysia’s High-Tech Era: Innovation in Nanotechnology, AI and Semiconductors*.

Express + SQLite (better-sqlite3). Home page (topics, programme, fees, speakers, venue), registration with email verification or Google sign-in,
participant sign-in with **Ticket2U payment**, admin dashboard, speaker portal, certificates (PDF/ZIP) with public verification.
Typeface: TeX Gyre Pagella (self-hosted, `public/assets/fonts`, GUST Font License).

## Run
```
npm install
cp .env.example .env      # then fill in the values
npm start                 # http://localhost:3000
```
Node 18+ (22 recommended). Behind a reverse proxy set `TRUST_PROXY=1`; for a sub-path set `BASE_PATH=/icssst2027`.
The database is `icssst2027.sqlite` in `DATA_DIR` (default `./data`) – set `DATA_DIR` to a folder outside the app so redeploys keep registrations, and back it up (Admin → Settings → backup).

## Payment with Ticket2U
Ticket2U has no public payment API for outside websites, so the site links out to Ticket2U and reconciles afterwards:

1. In the **Ticket2U organiser dashboard**, create the ICSSST 2027 event with one ticket type per fee category (Non-MASS Members RM 1,200, MASS Members RM 1,000, Students RM 900, Early Bird Local RM 800, International USD 350, Early Bird International USD 300, General Non-Presenting RM 600). Add a custom registration field “ICSSST reference” if you like (Edit Event → Price Settings → Pricing).
2. In **Admin → Settings → Fees & payment**, paste the event link (and, optionally, a separate link per category on each fee line: `Students | RM 900.00 | https://www.ticket2u.com.my/...`). Set the early-bird deadline.
3. Participants register → land on **My registration** → press **Pay with Ticket2U**. After paying they can enter their Ticket2U order number (status “to check”).
4. In **Admin → Payments**, upload the attendee/sales export from Ticket2U. Rows are matched by reference or email and marked **Paid**; the participant gets a confirmation email. Refunded/cancelled/pending rows are skipped; paid rows with no registration are listed.
5. LO / bank-transfer payers: mark them paid or waive the fee on the Participants page.

Ticket2U keeps the money and pays out to the organiser’s bank account on its settlement schedule (by default 7–14 working days after the event; bi-weekly/monthly payouts can be arranged with Ticket2U).

## Programme
`lib/programme.js` holds the draft programme (3 days, 4 rooms). Day 1–3 follow the event dates set in Admin → Settings.

## Admin
`/admin/login` – user `admin`. Set the password with `npm run hash -- "NEW-PASSWORD"` → `ADMIN_HASH`, or change it in Admin → Settings.

## Email and Google sign-in
Zoho SMTP (`SMTP_PASS`, or save it in Admin → Settings). Google sign-in needs `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` with redirect URI `SITE_URL/auth/google/callback`.

## SEO
`/robots.txt`, `/sitemap.xml`, canonical/Open Graph tags and schema.org `Event` data (with fee offers). Verify in Google Search Console with `GOOGLE_SITE_VERIFICATION` or `GOOGLE_VERIFY_FILE`.
