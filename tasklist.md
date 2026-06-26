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
      `wasm-unsafe-eval`; `script-src`/`connect-src` are now `self` (2026-06-26)
- [x] Remove the dead `cloudflare-worker.js` from the repo; it is no longer
      referenced by the site (kept in git history) (2026-06-26)
- [x] Turn the top banner into a static DRep link to Cexplorer, replacing the
      hardcoded seasonal message and dropping the `fadeInOut` animation
      (resolves the former hardcoded-year and banner-animation items) (2026-06-26)
- [x] Refactor Bech32 logic to use @scure/base library (2026-01-02, since removed with the wallet flow)
- [x] Fix deprecated substr() to use slice() (2026-01-02)
- [x] Remove duplicate POOL_BECH32 constant (2026-01-02)
- [x] Add transaction confirmation waiting for better UX (2026-01-02, since removed with the wallet flow)

---

## 📌 Kept by decision

### Cloudflare Worker — kept deployed
**Status:** Intentionally retained
**Description:** The website code no longer references the worker
(`blockfrost-proxy.smitblockchainops.workers.dev`) — it was removed together
with the in-browser delegation flow. The worker itself is kept deployed on
purpose, in case future website functionality needs an on-chain data source.
Source and deploy notes are archived outside this repo (`~/SBO`).

---

## 🟡 Medium Priority

### 1. Implement CSS Variables
**File:** `styles.css`
**Description:** Colors like `#28a745`, `#FFD700`, `rgba(...)` are hardcoded throughout CSS.
**Action Required:**
- Define CSS custom properties at `:root`
- Replace hardcoded values with `var(--...)`
**Impact:** Easier theming and maintenance

---

## 🟢 Low Priority (Nice to Have)

### 2. Image Optimization
**Files:** `images/header.jpg`, `images/logo.png`
**Description:** Convert to WebP with `<picture>` fallback for faster loads.

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
