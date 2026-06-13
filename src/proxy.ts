/**
 * Edge proxy (Next.js 16's successor to middleware): gates every route through
 * Auth.js using the edge-safe config (no DB/bcrypt). Unauthenticated users are
 * redirected to /login by the `authorized` callback.
 */

import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/config";

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // Run on all routes except static assets and the image optimizer.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)",
  ],
};
