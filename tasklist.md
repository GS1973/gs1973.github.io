# Website Improvement Task List
**Website:** https://smitblockchainops.nl (BKIND Cardano Stake Pool)

## ✅ Completed Tasks

- [x] Drop third-party wallet support: the Delegate button now opens an
      informational modal explaining why connecting a wallet to a website is
      not supported, and instructs visitors to delegate to pool BKIND directly
      from the wallet of their choice (pool ID shown, click-to-copy) (2026-06-26)
- [x] Remove all in-browser delegation machinery from `app.js` — wallet
      connection, lucid-cardano, @scure/base, Blockfrost proxy calls (2026-06-26)
- [x] Tighten CSP: drop `cdn.jsdelivr.net`, the Blockfrost proxy origin and
      `wasm-unsafe-eval`; `script-src`/`connect-src` are now `'self'` (2026-06-26)
- [x] Refactor Bech32 logic to use @scure/base library (2026-01-02, now removed with the wallet flow)
- [x] Fix deprecated substr() to use slice() (2026-01-02)
- [x] Remove duplicate POOL_BECH32 constant (2026-01-02)
- [x] Add transaction confirmation waiting for better UX (2026-01-02, now removed with the wallet flow)

---

## 🔴 High Priority

### 1. Decommission the Cloudflare Worker
**Status:** Pending (manual)
**Description:** The site no longer calls `blockfrost-proxy.smitblockchainops.workers.dev`.
`cloudflare-worker.js` is kept in the repo as a record of what is still deployed.
**Action Required:**
- Undeploy the worker in the Cloudflare dashboard (Workers & Pages → blockfrost-proxy → Delete)
- After undeploy, remove `cloudflare-worker.js` from the repo
**Impact:** Removes an unused public endpoint; no effect on the site until then.

---

## 🟡 Medium Priority

### 2. Implement CSS Variables
**File:** `styles.css`
**Description:** Colors like `#28a745`, `#FFD700`, `rgba(...)` are hardcoded throughout CSS.
**Action Required:**
- Define CSS custom properties at `:root`
- Replace hardcoded values with `var(--...)`
**Impact:** Easier theming and maintenance

### 3. Fix Hardcoded Year in Banner
**File:** `index.html`
**Description:** "A happy and innovative 2026!" needs manual updates each year.
**Options:**
- Make dynamic with JavaScript: `new Date().getFullYear()`
- Remove the year entirely
- Change to a generic message

---

## 🟢 Low Priority (Nice to Have)

### 4. Image Optimization
**Files:** `images/header.jpg`, `images/logo.png`
**Description:** Convert to WebP with `<picture>` fallback for faster loads.

### 5. Review Banner Animation
**File:** `styles.css`
**Description:** The `fadeInOut` animation on the top banner may annoy repeat
visitors. Consider reducing frequency, removing it, or hiding the banner after
the first visit (localStorage).

---

## 📋 Notes

### Security Posture
✅ **Current Status:** Strong
- No third-party scripts: `script-src 'self'`, `connect-src 'self'`
- No wallet connection / no client-side transaction building
- Strict CSP, no cookies
- No client-side dependency on external CDNs

---

**Last Updated:** 2026-06-26
