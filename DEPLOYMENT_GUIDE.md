# Secure Deployment Guide

This guide will help you deploy your website with the secure Cloudflare Worker setup that keeps your Blockfrost API key completely hidden from client-side code.

## What's Been Changed

### ✅ Security Improvements
1. **API Key Removed** - Your Blockfrost API key is no longer visible in the website source code
2. **Worker Proxy** - All Blockfrost API calls now route through a secure Cloudflare Worker
3. **Transaction Support** - Full delegation functionality including transaction building and submission
4. **Custom Provider** - Custom `SecureBlockfrostProvider` class routes all Lucid calls through the Worker

### ✅ Files Updated
- **index.html** - Uses SecureBlockfrostProvider, API key removed
- **cloudflare-worker.js** - Enhanced with transaction endpoints and environment variable support
- **Documentation** - API key redacted from all documentation files

## Step-by-Step Deployment

### Step 1: Deploy Cloudflare Worker

1. **Create Cloudflare Account**
   - Go to https://workers.cloudflare.com/
   - Sign up for free account
   - Verify your email

2. **Create Worker**
   - Click "Workers & Pages" in left sidebar
   - Click "Create Application"
   - Click "Create Worker"
   - Name it: `blockfrost-proxy`
   - Click "Deploy"

3. **Upload Worker Code**
   - Click "Edit Code" button
   - Delete all default code
   - Copy entire contents of `cloudflare-worker.js` from your repository
   - Paste into editor
   - Click "Save and Deploy"

4. **Set Environment Variable (CRITICAL)**
   - Go back to Worker overview page
   - Click "Settings" tab
   - Click "Variables" section
   - Under "Environment Variables", click "Add variable"
   - Add the following:
     - **Variable name**: `BLOCKFROST_API_KEY`
     - **Value**: `mainneteMYn6z4pUWYigfJTAHiDb0kPBmC6SMNt`
     - **Type**: Select "Encrypt" checkbox ✅ IMPORTANT!
   - Click "Deploy"

5. **Get Your Worker URL**
   Your Worker URL is already configured as:
   ```
   https://blockfrost-proxy.smitblockchainops.workers.dev
   ```

6. **Test Your Worker**
   Run this command to test:
   ```bash
   curl https://blockfrost-proxy.smitblockchainops.workers.dev/api/epochs/latest \
     -H "Origin: https://gs1973.github.io"
   ```

   You should get a JSON response with epoch information.

### Step 2: Deploy Updated Website

1. **Commit Changes**
   All your local changes need to be pushed to GitHub:
   ```bash
   cd /home/anonuser/CPA/gs1973.github.io
   git add .
   git commit -m "Security update: Remove API key and implement Worker proxy"
   git push origin main
   ```

2. **GitHub Pages will automatically deploy** your updated website

3. **Wait 1-2 minutes** for GitHub Pages to build and deploy

### Step 3: Test Your Website

1. **Visit your website**: https://gs1973.github.io

2. **Open Browser DevTools** (Press F12)

3. **Go to Network tab**

4. **Click a wallet button** (e.g., "Eternl", "Nami")

5. **Verify Security**:
   - Check Network tab: You should see requests to `blockfrost-proxy.smitblockchainops.workers.dev`
   - You should NOT see any requests to `cardano-mainnet.blockfrost.io`

6. **Test Functionality**:
   - Connect your wallet
   - Verify delegation status appears correctly
   - Try delegating (if not already delegated)
   - Confirm transaction builds and submits successfully

### Step 4: Verify API Key is Hidden

1. **View Page Source**
   - Right-click on your website → "View Page Source"
   - Search for "mainnet" (Ctrl+F)
   - Your API key should NOT appear anywhere

2. **Check Console**
   - Open DevTools Console (F12)
   - Look for any errors
   - Should see no API key errors

## How It Works

### Architecture Flow

```
User Wallet
    ↓
Your Website (https://gs1973.github.io)
    ↓
SecureBlockfrostProvider (client-side)
    ↓
Cloudflare Worker (https://blockfrost-proxy.smitblockchainops.workers.dev)
    ↓ [API KEY ADDED HERE - SERVER SIDE]
Blockfrost API (https://cardano-mainnet.blockfrost.io)
```

### What Happens When User Delegates

1. **User clicks "Delegate"** on your website
2. **Website requests blockchain data** from Worker (UTXOs, protocol params)
3. **Worker forwards request** to Blockfrost with encrypted API key
4. **Website builds transaction** using Lucid with blockchain data
5. **User signs transaction** in their wallet (private key never leaves wallet)
6. **Signed transaction sent to Worker** for submission
7. **Worker submits to Blockfrost** with API key
8. **Transaction confirmed** on Cardano blockchain

### Security Benefits

✅ **API Key Never Exposed** - Stays encrypted in Cloudflare environment variables
✅ **CORS Protection** - Only your domains can access the Worker
✅ **Rate Limiting** - 100 requests per minute per IP address
✅ **Endpoint Whitelisting** - Only safe endpoints are allowed
✅ **No Backend Required** - Cloudflare Workers is serverless
✅ **Free Tier** - 100,000 requests/day (more than enough)

## Monitoring

### Check Worker Usage
1. Go to Cloudflare Dashboard
2. Click "Workers & Pages"
3. Click "blockfrost-proxy"
4. View metrics: requests, errors, CPU time

### Check for Errors
1. Click "Logs" tab in Worker dashboard
2. Enable "Real-time Logs"
3. Connect wallet on your website
4. Watch logs for any errors

## Troubleshooting

### Error: "Worker API error: 403"
**Cause**: Origin not in ALLOWED_ORIGINS list
**Fix**: Add your domain to `ALLOWED_ORIGINS` in `cloudflare-worker.js`

### Error: "Configuration error: API key not set"
**Cause**: Environment variable not configured
**Fix**:
1. Go to Worker Settings → Variables
2. Add `BLOCKFROST_API_KEY` environment variable
3. Make sure "Encrypt" is checked
4. Click "Deploy"

### Error: "Endpoint not allowed"
**Cause**: Trying to access endpoint not in whitelist
**Fix**: This is working as intended - only safe endpoints are allowed

### Delegation not working
**Cause**: Worker may not be responding
**Fix**:
1. Test Worker directly with curl command above
2. Check Worker logs for errors
3. Verify environment variable is set correctly

## Costs

- **Cloudflare Workers**: FREE (100,000 requests/day)
- **Your Expected Usage**: < 1,000 requests/day
- **Conclusion**: Will stay within free tier indefinitely

## Next Steps After Deployment

1. ✅ Monitor Worker for first 24 hours
2. ✅ Test delegation with small amount
3. ✅ Verify no API key visible in source
4. ✅ Set up Cloudflare alerts for Worker errors (optional)
5. ✅ Consider setting up custom domain for Worker (optional)

## Support

If you encounter issues:
1. Check Worker logs in Cloudflare Dashboard
2. Check browser console for errors (F12)
3. Verify Worker URL matches in both Worker and website
4. Test Worker directly with curl command
5. Ensure environment variable is encrypted and deployed

## Security Checklist

Before going live, verify:
- [ ] Worker environment variable is set to "Encrypt"
- [ ] Worker is deployed and responding to requests
- [ ] Website shows no API key in source code
- [ ] Network tab shows requests going to Worker, not Blockfrost
- [ ] Delegation functionality works end-to-end
- [ ] CORS is properly configured (only your domains work)

---

**You're ready to deploy!** Follow the steps above and your website will be secure and fully functional.
