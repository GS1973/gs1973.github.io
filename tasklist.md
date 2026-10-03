# Website Improvement Task List
**Website:** https://smitblockchainops.nl (BKIND Cardano Stake Pool)

## ✅ Completed Tasks

- [x] Delegation from the site, without third-party libraries: `delegate.js`
      builds the delegation transaction in the browser (its CBOR written out),
      the holder signs it in their own wallet over CIP-30, and the signatures
      and fee are checked before it is sent. Only Eternl, Gero, Lace, Typhon and
      VESPR, each tested with a real transaction. A Delegate button for every
      pool in the pool list, BKIND included by the same rules (2026-09-27)
- [x] Self-host Roboto Condensed: no request to Google on any page; CSP
      `style-src`/`font-src` are `self` (2026-09-27)
- [x] The page refuses to run inside another site's frame (2026-09-27)
- [x] Deploy actions pinned to commit hashes (2026-09-27)

The entries of 2026-06-26 below describe the wallet flow of that time (with
third-party libraries and a proxy), which was removed then; the delegation of
2026-09-27 above replaces it.

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
- [x] Delete the Cloudflare Worker that proxied Blockfrost: nothing used it
      any more (2026-10-03)
- [x] Turn the top banner into a static DRep link to Cexplorer, replacing the
      hardcoded seasonal message and dropping the `fadeInOut` animation
      (resolves the former hardcoded-year and banner-animation items) (2026-06-26)
- [x] Refactor Bech32 logic to use @scure/base library (2026-01-02, since removed with the wallet flow)
- [x] Fix deprecated substr() to use slice() (2026-01-02)
- [x] Remove duplicate POOL_BECH32 constant (2026-01-02)
- [x] Add transaction confirmation waiting for better UX (2026-01-02, since removed with the wallet flow)

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
- Delegation transactions (stake to a pool, vote to a DRep) are built in the page (`delegate.js`, no library) and signed in the visitor's own wallet over CIP-30; the fee is capped at 1 ADA
- Strict CSP, no cookies
- No client-side dependency on external CDNs

---

**Last Updated:** 2026-10-03
