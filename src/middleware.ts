/**
 * Route protection.
 *
 * This is defence in depth, not the enforcement point. Middleware only
 * checks that a session cookie exists — server actions and pages must
 * still call the guards in src/lib/auth/guards.ts, which is where real
 * ownership and role checks happen.
 *
 * Runs on the Edge runtime, so it imports the edge-safe config only.
 * Importing the full config pulls in pg and bcryptjs and fails at
 * request time with "edge runtime does not support Node.js 'crypto'".
 */
import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { edgeAuthConfig } from "@/lib/auth/config.edge";

// Middleware only reads the JWT; it never signs anyone in.
const { auth } = NextAuth(edgeAuthConfig);

const PROTECTED_PREFIXES = [
  "/settings",
  "/scenarios/new",
  "/campaigns/new",
  "/warbands/new",
  "/forge",
];

/** Signed-in users have no business on login/register. */
const AUTH_PAGES = ["/login", "/register", "/forgot-password"];

function isProtected(pathname: string): boolean {
  if (PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  // Edit routes: /scenarios/<slug>/edit, /campaigns/<id>/edit, etc.
  return /^\/(scenarios|campaigns|warbands)\/[^/]+\/edit\/?$/.test(pathname);
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const signedIn = !!req.auth?.user;

  if (!signedIn && isProtected(pathname)) {
    const url = new URL("/login", req.nextUrl);
    // Preserve the destination so login can return the user to it.
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (signedIn && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Skip static assets and the Auth.js endpoints themselves.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.\\w+$).*)"],
};
