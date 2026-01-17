import { NextResponse } from "next/server";

const STRAPI_BASE = process.env.NEXT_PUBLIC_STRAPI_URL || "http://3.6.27.148/strapi";

const ALLOWED_HOSTS = [
  new URL(STRAPI_BASE).host,
  "steps-robotics-dev.s3.ap-south-1.amazonaws.com",
  "s3.ap-south-1.amazonaws.com",
];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  try {
    const target = new URL(url);

    if (!ALLOWED_HOSTS.includes(target.host)) {
      return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
    }

    const res = await fetch(target.toString(), { cache: "no-store" });

    if (!res.ok) {
      const text = await res.text();
      console.error("S3 ERROR:", res.status, text);
      return NextResponse.json(
        { error: "Upstream error", status: res.status, details: text },
        { status: res.status }
      );
    }

    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const buffer = await res.arrayBuffer();

    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Proxy failed:", err);
    return NextResponse.json({ error: "Proxy failed" }, { status: 500 });
  }
}
