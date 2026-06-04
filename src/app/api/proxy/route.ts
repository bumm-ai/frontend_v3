import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = 'https://api.bumm.io';

// Origins permitted to call this proxy cross-origin. The app itself is
// same-origin and needs no CORS header at all; we only echo back an explicit
// allow-listed origin (never `*`, which would let any site drive the backend
// through us — and `*` is incompatible with credentialed requests anyway).
const ALLOWED_ORIGINS = new Set(
  [
    process.env.NEXT_PUBLIC_SITE_URL,
    'https://bumm.io',
    'https://www.bumm.io',
    'https://app.bumm.io',
    'http://localhost:3000',
  ].filter(Boolean) as string[],
);

function corsHeaders(request: NextRequest, base: HeadersInit): HeadersInit {
  const origin = request.headers.get('origin');
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return base;
  return {
    ...base,
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id',
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint') || 'health/';
  
  try {
    console.log(`🔄 Proxying GET request to: ${BACKEND_URL}/${endpoint}`);
    
    const response = await fetch(`${BACKEND_URL}/${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log(`📡 Backend response: ${response.status} ${response.statusText}`);
    
    const data = await response.text();
    
    // Determine correct Content-Type
    const contentType = response.headers.get('content-type') || 'application/json';
    
    return new NextResponse(data, {
      status: response.status,
      statusText: response.statusText,
      headers: corsHeaders(request, { 'Content-Type': contentType }),
    });
  } catch (error) {
    console.error('❌ Proxy error:', error);
    return NextResponse.json(
      { error: 'Proxy error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint') || '';
  
  try {
    console.log(`🔄 Proxying POST request to: ${BACKEND_URL}/${endpoint}`);
    
    const body = await request.text();
    const userId = request.headers.get('x-user-id');
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (userId) {
      headers['x-user-id'] = userId;
    }
    
    const response = await fetch(`${BACKEND_URL}/${endpoint}`, {
      method: 'POST',
      headers,
      body,
    });
    
    console.log(`📡 Backend response: ${response.status} ${response.statusText}`);
    
    const data = await response.text();
    
    // Determine correct Content-Type
    const contentType = response.headers.get('content-type') || 'application/json';
    
    return new NextResponse(data, {
      status: response.status,
      statusText: response.statusText,
      headers: corsHeaders(request, { 'Content-Type': contentType }),
    });
  } catch (error) {
    console.error('❌ Proxy error:', error);
    return NextResponse.json(
      { error: 'Proxy error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
