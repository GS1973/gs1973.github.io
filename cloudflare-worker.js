/**
 * Cloudflare Worker - Blockfrost API Proxy
 *
 * This worker proxies requests to Blockfrost API and handles CORS.
 * Deploy to: blockfrost-proxy.smitblockchainops.workers.dev
 *
 * Environment variables required:
 * - BLOCKFROST_API_KEY: Your Blockfrost project ID
 */

const BLOCKFROST_BASE_URL = 'https://cardano-mainnet.blockfrost.io/api/v0';

// Rate limiting configuration
const RATE_LIMIT = {
  MAX_REQUESTS: 30,      // Maximum requests per window
  WINDOW_MS: 60000,      // Time window in milliseconds (1 minute)
};

// In-memory rate limit store (resets on worker restart)
const rateLimitStore = new Map();

function getRateLimitKey(request) {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

function isRateLimited(key) {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now - record.windowStart > RATE_LIMIT.WINDOW_MS) {
    // New window
    rateLimitStore.set(key, { windowStart: now, count: 1 });
    return false;
  }

  if (record.count >= RATE_LIMIT.MAX_REQUESTS) {
    return true;
  }

  record.count++;
  return false;
}

const ALLOWED_ORIGINS = [
  'https://gs1973.github.io',
  'https://smitblockchainops.nl',
  'https://www.smitblockchainops.nl'
];

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, project_id',
  'Access-Control-Max-Age': '86400',
};

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  const headers = { ...CORS_HEADERS };

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

function handleOptions(request) {
  const corsHeaders = getCorsHeaders(request);

  if (corsHeaders['Access-Control-Allow-Origin']) {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  return new Response('Forbidden', { status: 403 });
}

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const corsHeaders = getCorsHeaders(request);

  // Check origin
  if (!corsHeaders['Access-Control-Allow-Origin']) {
    return new Response('Forbidden', { status: 403 });
  }

  // Check rate limit
  const rateLimitKey = getRateLimitKey(request);
  if (isRateLimited(rateLimitKey)) {
    return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '60',
        ...corsHeaders,
      },
    });
  }

  // Only allow specific endpoints
  const allowedPaths = [
    /^\/accounts\/stake[a-z0-9]+$/,
    /^\/pools\/pool[a-z0-9]+$/,
    /^\/tx\/submit$/,
    /^\/epochs\/latest\/parameters$/,
    /^\/addresses\/[a-z0-9]+\/utxos$/,
  ];

  const isAllowed = allowedPaths.some(pattern => pattern.test(path));

  if (!isAllowed) {
    return new Response(JSON.stringify({ error: 'Endpoint not allowed' }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }

  // Build Blockfrost request
  const blockfrostUrl = BLOCKFROST_BASE_URL + path;

  const blockfrostHeaders = {
    'project_id': env.BLOCKFROST_API_KEY,
    'Content-Type': 'application/json',
  };

  // For tx/submit, we need to handle CBOR data
  if (path === '/tx/submit' && request.method === 'POST') {
    blockfrostHeaders['Content-Type'] = 'application/cbor';
  }

  try {
    const blockfrostResponse = await fetch(blockfrostUrl, {
      method: request.method,
      headers: blockfrostHeaders,
      body: request.method === 'POST' ? await request.arrayBuffer() : undefined,
    });

    const responseData = await blockfrostResponse.text();

    return new Response(responseData, {
      status: blockfrostResponse.status,
      headers: {
        'Content-Type': blockfrostResponse.headers.get('Content-Type') || 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(JSON.stringify({ error: 'An error occurred while processing your request.' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    return handleRequest(request, env);
  },
};
