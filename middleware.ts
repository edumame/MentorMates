import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/app/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/relay-V6f6")) {
    return handlePosthog(request);
  }

  // update user's auth session
  return await updateSession(request);
}

function handlePosthog(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hostname = url.pathname.startsWith("/relay-V6f6/static/")
    ? "us-assets.i.posthog.com"
    : "us.i.posthog.com";
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("host", hostname);

  url.protocol = "https";
  url.hostname = hostname;
  url.port = "443";
  url.pathname = url.pathname.replace(/^\/relay-V6f6/, "");

  return NextResponse.rewrite(url, {
    headers: requestHeaders,
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
