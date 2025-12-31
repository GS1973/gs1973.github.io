# Security Implementation Guide

This guide contains the security improvements for your Cardano delegation website.

## Overview

We've created the following security enhancements:

1. ✅ **Cloudflare Worker proxy** - `cloudflare-worker.js`
2. ✅ **Deployment instructions** - `CLOUDFLARE_SETUP.md`
3. **Website code updates** - (detailed below)

## Implementation Steps

### Step 1: Deploy the Cloudflare Worker

Follow the instructions in `CLOUDFLARE_SETUP.md` to:
1. Create a Cloudflare Workers account (free)
2. Deploy the `cloudflare-worker.js` code
3. Set your Blockfrost API key as an encrypted environment variable
4. Get your Worker URL (e.g., `https://blockfrost-proxy.YOUR-SUBDOMAIN.workers.dev`)

### Step 2: Update Your Website Code

After deploying the Worker, you need to make these changes to `index.html`:

#### Change 1: Set Your Worker URL

Find this line (around line 580):
```javascript
const WORKER_URL = null;
```

Replace with your actual Worker URL:
```javascript
const WORKER_URL = 'https://blockfrost-proxy.YOUR-SUBDOMAIN.workers.dev';
```

#### Change 2: Add Secure API Helper Function

Add this function after the `showMessage` function (around line 598):

```javascript
/**
 * Makes a secure API call to Blockfrost (via Worker proxy)
 * @param {string} endpoint - The Blockfrost API endpoint
 * @returns {Promise<Object>} - The API response
 */
async function secureBlockfrostFetch(endpoint) {
	// Input validation
	if (!endpoint || typeof endpoint !== 'string') {
		throw new Error('Invalid endpoint');
	}

	// Sanitize endpoint - prevent injection attacks
	const sanitizedEndpoint = endpoint.replace(/[^a-zA-Z0-9/_-]/g, '');

	if (WORKER_URL) {
		// Use secure Worker proxy (recommended)
		const response = await fetch(`${WORKER_URL}/api/${sanitizedEndpoint}`);
		if (!response.ok) {
			throw new Error(`API error: ${response.status}`);
		}
		return response.json();
	} else {
		// Fallback to direct API (for backwards compatibility)
		console.warn('SECURITY WARNING: Using direct Blockfrost API. Deploy Worker for better security.');
		const response = await fetch(
			`https://cardano-mainnet.blockfrost.io/api/v0/${sanitizedEndpoint}`,
			{
				headers: { 'project_id': BLOCKFROST_API_KEY }
			}
		);
		if (!response.ok) {
			throw new Error(`API error: ${response.status}`);
		}
		return response.json();
	}
}
```

#### Change 3: Update Delegation Status Check

Find this code (around line 640):
```javascript
const response = await fetch(
	`https://cardano-mainnet.blockfrost.io/api/v0/accounts/${rewardAddress}`,
	{
		headers: {
			'project_id': BLOCKFROST_API_KEY
		}
	}
);

if (response.ok) {
	const accountInfo = await response.json();
```

Replace with:
```javascript
const accountInfo = await secureBlockfrostFetch(`accounts/${rewardAddress}`);
if (accountInfo) {
```

#### Change 4: Remove the API Key (Optional but Recommended)

After confirming the Worker is working, remove this line (around line 582):
```javascript
const BLOCKFROST_API_KEY = 'mainneteMYn6z4pUWYigfJTAHiDb0kPBmC6SMNt';
```

And update the secure fetch function to remove the fallback code.

### Step 3: Add Additional Security (SRI Hash)

For extra security, we should add SRI (Subresource Integrity) hash to the Lucid library import.

Find this line (around line 571):
```javascript
import { Lucid, Blockfrost } from "https://unpkg.com/lucid-cardano@0.10.7/web/mod.js";
```

This is currently loading from a CDN without verification. For maximum security:

**Option A: Self-host the library** (Recommended)
1. Download the Lucid library
2. Host it in your repository
3. Import from your own domain

**Option B: Keep using CDN but verify**
Use a specific commit hash instead of version tag:
```javascript
import { Lucid, Blockfrost } from "https://cdn.jsdelivr.net/npm/lucid-cardano@0.10.7/+esm";
```

JSDelivr provides better CDN security than unpkg.

## Testing Your Security Updates

After implementing the changes:

### Test 1: Worker is Being Used
1. Open browser DevTools (F12)
2. Go to Network tab
3. Connect your wallet
4. You should see requests to your Worker URL, NOT to `blockfrost.io`

### Test 2: API Key Not Exposed
1. View page source (Right-click → View Page Source)
2. Search for your Blockfrost API key
3. If you removed it properly, it should NOT appear

### Test 3: Functionality Still Works
1. Click "Delegate" button
2. Connect wallet
3. Verify delegation status appears correctly
4. Test delegation (if not already delegated)

## Security Improvements Summary

### Before
- ❌ API key visible in source code
- ❌ Anyone can copy and abuse your API quota
- ❌ No rate limiting
- ❌ No request validation

### After
- ✅ API key hidden in Cloudflare Worker environment
- ✅ Only your website can use the proxy (CORS protection)
- ✅ Rate limiting (100 requests/minute per IP)
- ✅ Endpoint whitelisting (only safe endpoints allowed)
- ✅ Input sanitization prevents injection attacks
- ✅ Free tier: 100,000 requests/day

## Monitoring

After deployment, monitor your Worker:
1. Cloudflare Dashboard → Workers & Pages → Your Worker
2. Check metrics: requests, errors, CPU usage
3. Set up alerts for unusual activity

## Cost

- **Cloudflare Workers**: Free tier (100,000 requests/day)
- **Your current usage**: Probably < 1,000/day
- **Conclusion**: Should stay within free tier indefinitely

## Need Help?

If you encounter any issues:
1. Check the Cloudflare Worker logs for errors
2. Verify the Worker URL is correct in your website
3. Test the Worker directly with curl:
   ```bash
   curl https://YOUR-WORKER-URL.workers.dev/api/epochs/latest
   ```
4. Ensure CORS is configured correctly (check `ALLOWED_ORIGINS` in Worker)

## Next Steps

1. Deploy the Worker following `CLOUDFLARE_SETUP.md`
2. Update your website with the changes above
3. Test thoroughly
4. Remove the old API key from the code
5. Commit and push the secure version

Once you've deployed the Worker and have your Worker URL, I can help you make the specific code changes to your `index.html` file.
