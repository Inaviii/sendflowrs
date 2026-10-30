declare namespace Cloudflare {
  interface GlobalProps {
    mainModule: typeof import('./index');
  }
  interface Env {
    GIFTS: KVNamespace;
    ASSETS: Fetcher;
    CREATE_LIMIT: RateLimit;
  }
}
