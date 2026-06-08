// Extend OpenNext's global CloudflareEnv with our D1 binding
declare global {
  interface CloudflareEnv {
    DB: D1Database;
    AUTH_SECRET: string;
    AUTH_GOOGLE_ID: string;
    AUTH_GOOGLE_SECRET: string;
    AUTH_FACEBOOK_ID: string;
    AUTH_FACEBOOK_SECRET: string;
    TWILIO_ACCOUNT_SID: string;
    TWILIO_AUTH_TOKEN: string;
    TWILIO_PHONE_NUMBER: string;
  }
}

export {};
