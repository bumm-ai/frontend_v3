import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = 'https://api.bumm.io';

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
      headers: {
        'Content-Type': contentType,
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
      headers: {
        'Content-Type': contentType,
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
