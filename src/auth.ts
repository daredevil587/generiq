import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import Credentials from "next-auth/providers/credentials";
import { D1Adapter } from "@auth/d1-adapter";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// In-memory OTP store for local dev (D1 not available outside Cloudflare runtime)
export const localOtpStore = new Map<string, { otp: string; expires: Date }>();

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  // getCloudflareContext() only works inside a Cloudflare Workers runtime.
  // In local Next.js dev (Node.js / Edge sim) it throws — catch and fall back to process.env.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cfEnv: Record<string, any> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any = null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = await (getCloudflareContext as unknown as () => Promise<any>)();
    cfEnv = ctx?.env ?? {};
    db = cfEnv.DB ?? null;
  } catch {
    // Not running in Cloudflare Workers — use process.env for local development
  }

  const env = (key: string): string => cfEnv[key] ?? process.env[key] ?? "";
  const isCloudflare = db !== null;

  // Returns true only when a credential looks real (not a placeholder/empty value).
  const isRealCred = (val: string) =>
    val.length > 8 && !["placeholder", "test", "your_", "xxx", "changeme"].some(p => val.toLowerCase().startsWith(p));

  // Build providers list — only include OAuth providers if credentials are configured
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const providers: any[] = [];

  const googleId = env("AUTH_GOOGLE_ID");
  const googleSecret = env("AUTH_GOOGLE_SECRET");
  if (isRealCred(googleId) && isRealCred(googleSecret)) {
    providers.push(Google({ clientId: googleId, clientSecret: googleSecret }));
  }

  const fbId = env("AUTH_FACEBOOK_ID");
  const fbSecret = env("AUTH_FACEBOOK_SECRET");
  if (isRealCred(fbId) && isRealCred(fbSecret)) {
    providers.push(Facebook({ clientId: fbId, clientSecret: fbSecret }));
  }

  providers.push(
    Credentials({
      id: "phone-otp",
      name: "Phone Number",
      credentials: {
        phone: { label: "Phone Number", type: "text" },
        otp: { label: "OTP", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.otp) return null;

        const phone = credentials.phone as string;
        const otp = credentials.otp as string;

        if (isCloudflare && db) {
          // Production: verify OTP from D1
          const d1 = db as D1Database;
          const verification = await d1
            .prepare(
              "SELECT * FROM verification_tokens WHERE identifier = ? AND token = ? AND expires > datetime('now')"
            )
            .bind(phone, otp)
            .first<{ identifier: string; token: string; expires: string }>();

          if (!verification) return null;

          await d1
            .prepare("DELETE FROM verification_tokens WHERE identifier = ? AND token = ?")
            .bind(phone, otp)
            .run();

          let user = await d1
            .prepare("SELECT * FROM users WHERE phone = ?")
            .bind(phone)
            .first<{ id: string; phone: string; name?: string; email?: string; image?: string }>();

          if (!user) {
            const id = crypto.randomUUID();
            await d1
              .prepare("INSERT INTO users (id, phone) VALUES (?, ?)")
              .bind(id, phone)
              .run();
            user = { id, phone };
          }

          return {
            id: user.id,
            name: user.name || null,
            email: user.email || null,
            image: user.image || null,
            phone: user.phone,
          };
        } else {
          // Local dev: verify OTP from in-memory store
          const stored = localOtpStore.get(phone);
          if (!stored) return null;
          if (stored.otp !== otp) return null;
          if (stored.expires < new Date()) { localOtpStore.delete(phone); return null; }

          localOtpStore.delete(phone);
          return {
            id: `local-${phone}`,
            name: null,
            email: null,
            image: null,
            phone,
          };
        }
      },
    })
  );

  return {
    adapter: db ? D1Adapter(db) : undefined,
    providers,
    callbacks: {
      async session({ session, user, token }) {
        if (session.user) {
          if (user) {
            session.user.id = user.id;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (session.user as any).phone = (user as any).phone ?? null;
          } else if (token) {
            session.user.id = token.sub as string;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (session.user as any).phone = (token.phone as string | null) ?? null;
          }
        }
        return session;
      },
      async jwt({ token, user }) {
        if (user) {
          token.id = user.id;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          token.phone = (user as any).phone ?? null;
        }
        return token;
      },
    },
    session: {
      strategy: "jwt",
    },
    secret: env("AUTH_SECRET"),
  };
});
