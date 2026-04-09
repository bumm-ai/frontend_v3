import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://127.0.0.1:8080'; 

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleRequest(request, resolvedParams.path, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleRequest(request, resolvedParams.path, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleRequest(request, resolvedParams.path, 'PUT');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleRequest(request, resolvedParams.path, 'PATCH');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleRequest(request, resolvedParams.path, 'DELETE');
}

/*export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  // Handle CORS preflight requests
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id',
      'Access-Control-Max-Age': '86400',
    },
  });
}*/

async function handleRequest(
  request: NextRequest,
  pathSegments: string[],
  method: string
) {
  try {
    const path = pathSegments.join('/');
    // Preserve query string (e.g. ?confirm=true for deploy endpoint).
    const search = request.nextUrl.search;
    const url = `${BACKEND_URL}/${path}${search}`;

    console.log(`🔄 Proxying ${method} request to: ${url}`);
    
    // Get headers from original request
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Forward Authorization header (JWT Bearer)
    const authorization = request.headers.get('Authorization');
    if (authorization) {
      (headers as Record<string, string>)['Authorization'] = authorization;
    }

    // Forward legacy x-user-id header (backward compat)
    const userId = request.headers.get('x-user-id');
    if (userId) {
      (headers as Record<string, string>)['x-user-id'] = userId;
    }
    
    // Get request body
    let body: string | undefined;
    if (method !== 'GET') {
      body = await request.text();
    }
    
    // Make request to backend
    const response = await fetch(url, {
      method,
      headers,
      body,
    });
    
    console.log(`📡 Backend response: ${response.status} ${response.statusText}`);
    
    // Get response data
    const data = await response.text();
    
    // Return response with correct headers
    return new NextResponse(data, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id',
      },
    });
  } catch (error) {
    console.error('❌ Proxy error:', error);
    return NextResponse.json(
      { error: 'Proxy error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
