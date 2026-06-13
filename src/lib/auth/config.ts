/**
 * Edge-safe Auth.js config. Contains ONLY things that can run in middleware
 * (no bcrypt, no DB). The Credentials provider with the DB-backed authorize()
 * lives in ./index.ts (Node runtime). This split keeps middleware on the edge.
 */

import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/types";

export const authConfig = {
  // Trust the deployment host (required for Auth.js on Vercel/proxies).
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    /** Persist id + role onto the JWT at sign-in. */
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: Role }).role;
      }
      return token;
    },
    /** Expose id + role on the session for the app to read. */
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
    /** Middleware gate: signed-in users may proceed; others are redirected. */
    authorized({ auth, request }) {
      const isLoggedIn = Boolean(auth?.user);
      const { pathname } = request.nextUrl;

      const isPublic =
        pathname === "/login" || pathname.startsWith("/api/auth");

      if (isPublic) return true;
      return isLoggedIn; // false → redirect to signIn page
    },
  },
  providers: [], // real providers are added in ./index.ts
} satisfies NextAuthConfig;
