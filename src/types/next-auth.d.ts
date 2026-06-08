import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    phone?: string | null;
  }

  interface Session {
    user: {
      id: string;
      phone?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    phone?: string | null;
  }
}
