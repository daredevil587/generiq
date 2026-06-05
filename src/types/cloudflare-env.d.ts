// Extend OpenNext's global CloudflareEnv with our D1 binding
declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }
}

export {};
