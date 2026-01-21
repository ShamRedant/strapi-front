import { NextResponse } from "next/server";

const STRAPI_BASE = process.env.NEXT_PUBLIC_STRAPI_URL || "http://3.6.27.148/strapi";

export async function GET() {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    strapiBase: STRAPI_BASE,
    nodeEnv: process.env.NODE_ENV,
    testUrl: `${STRAPI_BASE}/api/courses`,
  };

  try {
    const baseUrl = STRAPI_BASE.endsWith('/') ? STRAPI_BASE.slice(0, -1) : STRAPI_BASE;
    const testUrl = `${baseUrl}/api/courses`;
    
    console.log(`[Test] Attempting to fetch: ${testUrl}`);
    
    const res = await fetch(testUrl, {
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    diagnostics.fetchStatus = res.status;
    diagnostics.fetchOk = res.ok;
    
    if (res.ok) {
      const data = await res.json();
      diagnostics.dataReceived = true;
      diagnostics.dataLength = JSON.stringify(data).length;
      diagnostics.courseCount = data?.data?.length || 0;
    } else {
      const errorText = await res.text();
      diagnostics.errorText = errorText.substring(0, 500);
    }

    return NextResponse.json({
      success: res.ok,
      diagnostics,
    });
  } catch (err) {
    diagnostics.error = err.message;
    diagnostics.errorStack = err.stack;
    
    return NextResponse.json({
      success: false,
      diagnostics,
    }, { status: 500 });
  }
}


