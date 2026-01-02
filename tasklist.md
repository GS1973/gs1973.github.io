# Website Improvement Task List
**Generated:** 2026-01-02
**Website:** https://smitblockchainops.nl (BKIND Cardano Stake Pool)

## ✅ Completed Tasks

- [x] Refactor Bech32 logic to use @scure/base library (2026-01-02)
- [x] Fix deprecated substr() to use slice() (2026-01-02)
- [x] Remove duplicate POOL_BECH32 constant (2026-01-02)
- [x] Add transaction confirmation waiting for better UX (2026-01-02)

---

## 🔴 High Priority

### 1. Deploy Updated Cloudflare Worker
**Status:** URGENT
**Description:** The worker code was updated to allow `/txs/{hash}` endpoint, but needs deployment to Cloudflare.
**Action Required:**
- Deploy `cloudflare-worker.js` to Cloudflare Workers
- Via Wrangler: `wrangler deploy cloudflare-worker.js`
- Or via Cloudflare Dashboard: Workers & Pages → blockfrost-proxy → Update code
**Impact:** Transaction confirmation won't work until deployed

### 2. Monitor CDN Dependencies
**Status:** Ongoing
**Description:** Regularly check `lucid-cardano` and `@scure/base` for security updates.
**Current Versions:**
- `lucid-cardano@0.10.7`
- `@scure/base@1.1.5`
**Action Required:**
- Set up quarterly review process
- Check npm/GitHub for security advisories
- Test updates in development before deploying

---

## 🟡 Medium Priority

### 3. Remove Global Window Pollution
**File:** `app.js:5`
**Description:** `window.LucidCardano = { Lucid, Blockfrost }` explicitly exposes library to global scope.
**Action Required:**
- Verify if any external scripts rely on this
- If not, remove the line to keep modules scoped
- Test wallet connection after removal

### 4. Implement CSS Variables
**File:** `styles.css`
**Description:** Colors like `#28a745`, `rgba(255, 255, 255, 0.35)` are hardcoded throughout CSS.
**Action Required:**
- Define CSS custom properties at `:root`
- Example: `--color-success: #28a745`, `--color-primary: rgba(255, 255, 255, 0.35)`
- Replace hardcoded values with `var(--color-success)`
**Impact:** Easier theming and maintenance

### 5. Fix Hardcoded Year in Banner
**File:** `index.html:17`
**Description:** "A happy and innovative 2026!" will need manual updates.
**Options:**
- Make dynamic with JavaScript: `new Date().getFullYear()`
- Remove the year entirely
- Change to generic message

### 6. Add Error Tracking/Analytics
**Description:** No visibility into production errors unless users report them.
**Options:**
- Implement basic console error tracking
- Use privacy-respecting analytics (e.g., Plausible, Simple Analytics)
- Log critical errors to a simple endpoint
**Impact:** Better understanding of user issues

---

## 🟢 Low Priority (Nice to Have)

### 7. Image Optimization
**Files:** `images/header.jpg`, `images/logo.png`
**Description:** Convert to WebP format for faster load times.
**Action Required:**
- Convert images to WebP with fallbacks
- Modern browsers have excellent WebP support
- Use `<picture>` element for fallback to PNG/JPG
**Impact:** Marginal performance improvement for typical connections

### 8. Robust Rate Limiting
**File:** `cloudflare-worker.js:20`
**Description:** In-memory rate limiting isn't shared across Cloudflare edge nodes.
**Current:** `MAX_REQUESTS: 30` per minute per isolate
**Action Required:**
- Migrate to Cloudflare KV for shared state
- Or use Cloudflare's native Rate Limiting rules
**Impact:** Only relevant if traffic increases significantly

### 9. Review Banner Animation
**File:** `styles.css:381-386`
**Description:** The fadeInOut animation on top banner might annoy repeat visitors.
**Action Required:**
- Consider reducing frequency
- Or remove animation entirely
- Or hide banner after first visit (localStorage)
**Impact:** Minor UX improvement

---

## 📋 Notes

### Backup Files Available
All recent changes have diff files for easy reversion:
- `refactor_bech32_2026-01-02.diff` (3.0KB)
- `add_tx_confirmation_app_2026-01-02.diff` (3.6KB)
- `add_tx_confirmation_worker_2026-01-02.diff` (414 bytes)

### Reversion Instructions
```bash
# Revert bech32 refactoring
git revert 85ebe93

# Revert transaction confirmation
git revert 0df92b2

# Or apply diff in reverse
git apply -R refactor_bech32_2026-01-02.diff
```

### Security Posture
✅ **Current Status:** Strong
- API key properly hidden via Cloudflare Worker proxy
- Strict CSP and CORS policies
- Path whitelisting prevents proxy abuse
- No critical vulnerabilities identified

---

**Last Updated:** 2026-01-02
**Next Review:** 2026-04-01 (Quarterly dependency check)
