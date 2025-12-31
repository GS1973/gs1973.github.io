/**
 * Cloudflare Worker - Blockfrost API Proxy
 *
 * This worker acts as a secure proxy between your website and Blockfrost API,
 * keeping your API key hidden from client-side code.
 *
 * Deploy this to Cloudflare Workers at: workers.cloudflare.com
 */

const BLOCKFROST_BASE_URL = 'https://cardano-mainnet.blockfrost.io/api/v0';

// Allowed origins - UPDATE THIS to match your website domain
const ALLOWED_ORIGINS = [
  'https://gs1973.github.io',
  'https://smitblockchainops.nl',
  'http://localhost:3000', // For local testing
];

// Rate limiting configuration
const RATE_LIMIT = {
  maxRequests: 100,
  windowMs: 60000, // 1 minute
};

// In-memory rate limiting (resets on worker restart)
const rateLimitStore = new Map();

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request, event.env));
});

async function handleRequest(request, env) {
  // ⚠️ IMPORTANT: BLOCKFROST_API_KEY must be set as environment variable in Cloudflare Dashboard
  const BLOCKFROST_API_KEY = env.BLOCKFROST_API_KEY;

  if (!BLOCKFROST_API_KEY) {
    return new Response('Configuration error: API key not set', { status: 500 });
  }
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return handleCORS(request);
  }

  // Check origin - only reject if origin is present but not in allowed list
  const origin = request.headers.get('Origin');
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return new Response('Forbidden', {
      status: 403,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  // Rate limiting
  const clientIP = request.headers.get('CF-Connecting-IP');
  if (!checkRateLimit(clientIP)) {
    return new Response('Rate limit exceeded', {
      status: 429,
      headers: getCORSHeaders(origin)
    });
  }

  try {
    const url = new URL(request.url);
    const endpoint = url.pathname.replace('/api/', '');

    // Validate endpoint - only allow specific safe endpoints
    if (!isAllowedEndpoint(endpoint)) {
      return new Response('Endpoint not allowed', {
        status: 403,
        headers: getCORSHeaders(origin)
      });
    }

    // Forward request to Blockfrost
    const blockfrostUrl = `${BLOCKFROST_BASE_URL}/${endpoint}`;

    // Build fetch options
    const fetchOptions = {
      method: request.method,
      headers: {
        'project_id': BLOCKFROST_API_KEY,
        'Content-Type': 'application/json',
      },
    };

    // Include body for POST/PUT requests
    if (request.method === 'POST' || request.method === 'PUT') {
      fetchOptions.body = await request.text();
    }

    const response = await fetch(blockfrostUrl, fetchOptions);

    // Return response with CORS headers
    const data = await response.text();
    return new Response(data, {
      status: response.status,
      headers: {
        ...getCORSHeaders(origin),
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...getCORSHeaders(origin),
        'Content-Type': 'application/json',
      },
    });
  }
}

function handleCORS(request) {
  const origin = request.headers.get('Origin');
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return new Response('Forbidden', { status: 403 });
  }

  const headers = {
    ...getCORSHeaders(origin),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Only set max-age if we have CORS headers
  if (origin) {
    headers['Access-Control-Max-Age'] = '86400';
  }

  return new Response(null, {
    status: 204,
    headers,
  });
}

function getCORSHeaders(origin) {
  // Only return CORS headers if origin is present
  if (!origin) {
    return {};
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
  };
}

function checkRateLimit(clientIP) {
  const now = Date.now();
  const clientData = rateLimitStore.get(clientIP) || { count: 0, resetTime: now + RATE_LIMIT.windowMs };

  // Reset if window expired
  if (now > clientData.resetTime) {
    clientData.count = 0;
    clientData.resetTime = now + RATE_LIMIT.windowMs;
  }

  clientData.count++;
  rateLimitStore.set(clientIP, clientData);

  return clientData.count <= RATE_LIMIT.maxRequests;
}

function isAllowedEndpoint(endpoint) {
  // Whitelist of allowed Blockfrost endpoints for delegation functionality
  const allowedPatterns = [
    // Account & Delegation Info
    /^accounts\/stake[0-9a-z]+$/, // Account info for delegation checking

    // Transaction Building & Submission
    /^txs$/, // Transaction submission (POST)
    /^txs\/[0-9a-f]{64}$/, // Transaction status lookup
    /^addresses\/addr[0-9a-z]+\/utxos$/, // Address UTXOs (needed by Lucid)
    /^epochs\/latest\/parameters$/, // Protocol parameters (needed for fees)
    /^epochs\/latest$/, // Latest epoch info

    // Pool Information
    /^pools\/pool[0-9a-z]+$/, // Pool information
    /^pools\/pool[0-9a-z]+\/metadata$/, // Pool metadata
  ];

  return allowedPatterns.some(pattern => pattern.test(endpoint));
}
