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
- [x] Remove the dead `cloudflare-worker.js` from the repo; it is no longer
      referenced by the site (kept in git history) (2026-06-26)
- [x] Refactor Bech32 logic to use @scure/base library (2026-01-02, since removed with the wallet flow)
- [x] Fix deprecated substr() to use slice() (2026-01-02)
- [x] Remove duplicate POOL_BECH32 constant (2026-01-02)
- [x] Add transaction confirmation waiting for better UX (2026-01-02, since removed with the wallet flow)

---

## 🔴 Pending (external — not in this repo)

### Decommission the Cloudflare Worker
**Status:** Pending (manual, Cloudflare dashboard)
**Description:** The site no longer calls `blockfrost-proxy.smitblockchainops.workers.dev`.
The worker source has been removed from this repo; the deployed worker is now
unused and can be deleted.
**Action Required:**
- Cloudflare dashboard → Workers & Pages → `blockfrost-proxy` → Delete
**Impact:** Removes an unused public endpoint; no effect on the site.

---

## 🟡 Medium Priority

### 1. Implement CSS Variables
**File:** `styles.css`
**Description:** Colors like `#28a745`, `#FFD700`, `rgba(...)` are hardcoded throughout CSS.
**Action Required:**
- Define CSS custom properties at `:root`
- Replace hardcoded values with `var(--...)`
**Impact:** Easier theming and maintenance

### 2. Fix Hardcoded Year in Banner
**File:** `index.html`
**Description:** "A happy and innovative 2026!" needs manual updates each year.
**Options:**
- Make dynamic with JavaScript: `new Date().getFullYear()`
- Remove the year entirely
- Change to a generic message

---

## 🟢 Low Priority (Nice to Have)

### 3. Image Optimization
**Files:** `images/header.jpg`, `images/logo.png`
**Description:** Convert to WebP with `<picture>` fallback for faster loads.

### 4. Review Banner Animation
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
