import { NextResponse } from "next/server";

// Basic Auth credentials (hardcoded as requested)
const BASIC_AUTH_USER = "StepsApp";
const BASIC_AUTH_PASS = "StepsAdmin@2026";

export function middleware(request) {
  const authHeader = request.headers.get("authorization");

  if (authHeader) {
    const [scheme, encoded] = authHeader.split(" ");
    if (scheme === "Basic" && encoded) {
      try {
        const decoded = Buffer.from(encoded, "base64").toString("utf8");
        const [user, pass] = decoded.split(":");

        if (user === BASIC_AUTH_USER && pass === BASIC_AUTH_PASS) {
          // Credentials are valid, continue
          return NextResponse.next();
        }
      } catch {
        // fall through to 401
      }
    }
  }

  // If no/invalid credentials, send 401 to trigger browser Basic Auth prompt
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Steps Robotics", charset="UTF-8"',
    },
  });
}

// Apply to all routes in this Next.js app
export const config = {
  matcher: ["/:path*"],
};


