/**
 * Cloudflare Worker - Blockfrost API Proxy
 *
 * This worker acts as a secure proxy between your website and Blockfrost API,
 * keeping your API key hidden from client-side code.
 *
 * Deploy this to Cloudflare Workers at: workers.cloudflare.com
 */

// ⚠️ IMPORTANT: Set this as an environment variable in Cloudflare Dashboard
// DO NOT commit your actual API key here
const BLOCKFROST_API_KEY = 'YOUR_BLOCKFROST_API_KEY_HERE';
const BLOCKFROST_BASE_URL = 'https://cardano-mainnet.blockfrost.io/api/v0';

// Allowed origins - UPDATE THIS to match your website domain
const ALLOWED_ORIGINS = [
  'https://gs1973.github.io',
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
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return handleCORS(request);
  }

  // Check origin
  const origin = request.headers.get('Origin');
  if (!ALLOWED_ORIGINS.includes(origin)) {
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

    const response = await fetch(blockfrostUrl, {
      method: request.method,
      headers: {
        'project_id': BLOCKFROST_API_KEY,
        'Content-Type': 'application/json',
      },
    });

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
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return new Response('Forbidden', { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers: {
      ...getCORSHeaders(origin),
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

function getCORSHeaders(origin) {
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
  // Whitelist of allowed Blockfrost endpoints
  const allowedPatterns = [
    /^accounts\/stake[0-9a-z]+$/, // Account info for delegation checking
    /^txs\/[0-9a-f]+$/, // Transaction submission
    /^epochs\/latest$/, // Latest epoch info
    /^pools\/pool[0-9a-z]+$/, // Pool information
  ];

  return allowedPatterns.some(pattern => pattern.test(endpoint));
}
