export interface Env {
  ENVIRONMENT: string;
}

export default {
  async fetch(request: Request, env: Env, _ctx: any): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', environment: env.ENVIRONMENT }), {
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('Cloudflare Edge Worker operational', { status: 200 });
  },
};

