# Cloudflare Worker Setup Guide

This guide will help you deploy the Blockfrost API proxy to Cloudflare Workers to secure your API key.

## Prerequisites
- A Cloudflare account (free tier is sufficient)
- Your Blockfrost API key

## Step-by-Step Setup

### 1. Create Cloudflare Account
1. Go to https://workers.cloudflare.com/
2. Click "Sign Up" (it's free)
3. Verify your email

### 2. Create a New Worker
1. Log in to Cloudflare Dashboard
2. Click "Workers & Pages" in the left sidebar
3. Click "Create Application"
4. Click "Create Worker"
5. Give it a name: `blockfrost-proxy` (or any name you prefer)
6. Click "Deploy"

### 3. Edit the Worker Code
1. After deployment, click "Edit Code"
2. Delete all the default code
3. Copy the entire contents of `cloudflare-worker.js` from this repository
4. Paste it into the Cloudflare editor
5. Click "Save and Deploy"

### 4. Set Environment Variables (Secure Method)
1. Go back to your Worker's page
2. Click "Settings" tab
3. Click "Variables"
4. Under "Environment Variables", click "Add variable"
5. Add:
   - **Variable name**: `BLOCKFROST_API_KEY`
   - **Value**: Your actual Blockfrost API key (e.g., `mainneteMYn6z4pUWYigfJTAHiDb0kPBmC6SMNt`)
   - **Type**: Select "Encrypt" for security
6. Click "Save"

### 5. Update the Worker Code to Use Environment Variable
1. Go back to "Edit Code"
2. Change this line:
   ```javascript
   const BLOCKFROST_API_KEY = 'YOUR_BLOCKFROST_API_KEY_HERE';
   ```
   To:
   ```javascript
   const BLOCKFROST_API_KEY = env.BLOCKFROST_API_KEY;
   ```
3. Also update the function signature:
   ```javascript
   async function handleRequest(request, env) {
   ```
   And:
   ```javascript
   addEventListener('fetch', event => {
     event.respondWith(handleRequest(event.request, event.env));
   });
   ```
4. Click "Save and Deploy"

### 6. Get Your Worker URL
After deployment, your worker will have a URL like:
```
https://blockfrost-proxy.YOUR-SUBDOMAIN.workers.dev
```

Copy this URL - you'll need it for the next step!

### 7. Test Your Worker
Test that it's working:
```bash
curl https://blockfrost-proxy.YOUR-SUBDOMAIN.workers.dev/api/epochs/latest \
  -H "Origin: https://gs1973.github.io"
```

You should get a JSON response with epoch information.

### 8. Update Your Website
Now update your `index.html` to use the Worker instead of calling Blockfrost directly.

Find this line in your website code:
```javascript
const response = await fetch(
  `https://cardano-mainnet.blockfrost.io/api/v0/accounts/${rewardAddress}`,
  {
    headers: {
      'project_id': BLOCKFROST_API_KEY
    }
  }
);
```

Replace it with:
```javascript
const response = await fetch(
  `https://blockfrost-proxy.YOUR-SUBDOMAIN.workers.dev/api/accounts/${rewardAddress}`
);
```

**Note**: Remove the `project_id` header - the Worker handles authentication!

### 9. Remove the API Key from Your Website
Delete or comment out this line from `index.html`:
```javascript
const BLOCKFROST_API_KEY = 'mainneteMYn6z4pUWYigfJTAHiDb0kPBmC6SMNt';
```

## Security Benefits

✅ **API Key Hidden**: No longer visible in client-side code
✅ **Rate Limiting**: Built-in protection against abuse (100 requests/minute per IP)
✅ **CORS Protection**: Only your website can use the proxy
✅ **Endpoint Whitelisting**: Only specific safe endpoints are allowed
✅ **Free**: Cloudflare Workers free tier includes 100,000 requests/day

## Monitoring

Monitor your Worker usage:
1. Go to Cloudflare Dashboard
2. Click "Workers & Pages"
3. Click your worker name
4. View metrics: requests, errors, CPU time

## Troubleshooting

**Error: "Forbidden"**
- Check that your website origin is in the `ALLOWED_ORIGINS` array in the Worker code

**Error: "Rate limit exceeded"**
- Increase `RATE_LIMIT.maxRequests` in the Worker code
- Or wait 1 minute and try again

**Error: "Endpoint not allowed"**
- Add the endpoint pattern to `isAllowedEndpoint()` function in Worker code

## Cost
- **Free tier**: 100,000 requests/day
- **Paid tier**: $5/month for 10 million requests

For your stake pool website, the free tier should be more than sufficient!

## Next Steps

After deploying the Worker, I'll help you update your website code to use it.
