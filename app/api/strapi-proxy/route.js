import { NextResponse } from "next/server";

const STRAPI_BASE = process.env.NEXT_PUBLIC_STRAPI_URL || "http://3.6.27.148/strapi";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  const params = {};
  
  // Copy all other query params to pass to Strapi
  searchParams.forEach((value, key) => {
    if (key !== "path") {
      params[key] = value;
    }
  });

  if (!path) {
    return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
  }

  try {
    // Ensure STRAPI_BASE doesn't end with /
    const baseUrl = STRAPI_BASE.endsWith('/') ? STRAPI_BASE.slice(0, -1) : STRAPI_BASE;
    const apiPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${baseUrl}/api${apiPath}`);
    
    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const res = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Strapi API Error:", res.status, errorText);
      return NextResponse.json(
        { error: "Upstream error", status: res.status, details: errorText },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error("Proxy failed:", err);
    return NextResponse.json(
      { error: "Proxy failed", details: err.message },
      { status: 500 }
    );
  }
}

