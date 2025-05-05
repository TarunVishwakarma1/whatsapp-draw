import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const sessionToken = request.cookies.get("session_token")?.value
  const userId = request.cookies.get("user_id")?.value

  // Check if the user is authenticated
  const isAuthenticated = sessionToken && userId

  // Get the path of the request
  const path = request.nextUrl.pathname

  // Define public paths that don't require authentication
  const publicPaths = ["/login", "/register", "/forgot-password"]

  // If the user is not authenticated and trying to access a protected route
  if (!isAuthenticated && !publicPaths.includes(path) && path !== "/") {
    const url = new URL("/login", request.url)
    url.searchParams.set("callbackUrl", encodeURI(request.url))
    return NextResponse.redirect(url)
  }

  // If the user is authenticated and trying to access login/register
  if (isAuthenticated && publicPaths.includes(path)) {
    return NextResponse.redirect(new URL("/chat", request.url))
  }

  return NextResponse.next()
}

// Configure the middleware to run on specific paths
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
}
