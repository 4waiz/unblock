/**
 * Cloudflare Worker for unblock.kanbanstudios.ae. Static files come straight from the
 * built `dist/` (assets binding); only /api/* runs here.
 */
import { askQwen, MAX_ASK_BODY, type AskEnv } from '../server/ask';

interface Env extends AskEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const json = (status: number, body: unknown) => Response.json(body, { status });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/ask') {
      if (request.method !== 'POST') return json(405, { error: 'method' });
      const raw = await request.text();
      if (raw.length > MAX_ASK_BODY) return json(413, { error: 'too large' });
      const { status, body } = await askQwen(env, raw);
      return json(status, body);
    }
    if (url.pathname.startsWith('/api/')) return json(404, { error: 'not found' });
    return env.ASSETS.fetch(request);
  },
};
