/**
 * Full Auth.js instance (Node runtime). Adds the DB-backed Credentials
 * provider on top of the edge-safe authConfig. Import { auth } here from
 * server components / actions / route handlers.
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./config";
import { getProfileByEmail } from "@/lib/db/queries/profiles";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const profile = await getProfileByEmail(email);
        if (!profile) {
          // Hash a dummy to keep timing roughly constant against enumeration.
          await bcrypt.compare(password, "$2a$10$invalidinvalidinvalidinvalidin");
          return null;
        }

        const ok = await bcrypt.compare(password, profile.passwordHash);
        if (!ok) return null;

        return {
          id: profile.id,
          email: profile.email,
          name: profile.fullName ?? profile.email,
          role: profile.role,
        };
      },
    }),
  ],
});
