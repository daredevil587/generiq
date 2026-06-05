import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function getDB(): Promise<D1Database> {
  const ctx = await getCloudflareContext({ async: true });
  return ctx.env.DB;
}
