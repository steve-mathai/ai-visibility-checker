# Security policy

## Reporting a vulnerability

Please open a private GitHub security advisory on this repository (Security tab, "Report a vulnerability"). Do not open a public issue for a vulnerability. We aim to acknowledge reports within a few days.

## Supported versions

Only the `main` branch is supported.

## Trust model

This is an anonymous tool: anyone can submit a public URL and the server fetches it. The server treats the audited site, and everything the browser posts back, as untrusted.

- **SSRF controls.** Only http(s) on ports 80 and 443, no credentials in URLs. Hostnames are resolved once, every resolved address must be public (private, loopback, link-local, CGNAT, metadata, documentation, multicast, 6to4, Teredo and NAT64 ranges are refused), and the connection is pinned to exactly those validated addresses so DNS rebinding cannot swap them. Redirects (max 5) are re-checked on every hop. DNS lookups, response size (after decompression) and total time are bounded.
- **Rate limiting.** Per client, via a key-value store (Upstash or Vercel KV when configured, otherwise a bounded in-memory store per instance). The client key comes from `x-vercel-forwarded-for` when present; the last value of `x-forwarded-for` only when `TRUST_PROXY=1` (set it only behind a proxy you control); otherwise `x-real-ip`; otherwise one shared bucket. Client-supplied forwarding headers are never trusted on their own. Each instance also caps in-flight work (6 audits, 3 summaries).
- **AI summary.** `/api/audit` signs a token over the exact data sent to the model; `/api/summary` only accepts reports with a valid, unexpired (24 h) token, so the endpoint cannot be used to run arbitrary prompts. Results are cached per URL for 24 h and a global daily budget applies. Page text is passed to the model inside a delimited, untrusted data block.
- **Output.** Fix snippets escape page-derived text for HTML and `<script>` contexts. Security headers (CSP, HSTS, frame denial, nosniff, referrer and permissions policies) are set in `next.config.ts`.

## Environment variables

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Enables the AI summary. Without it the summary is off. |
| `SUMMARY_SIGNING_SECRET` | Key for summary tokens. If unset, derived from `ANTHROPIC_API_KEY`. |
| `SUMMARY_DAILY_LIMIT` | Global AI summaries per day (default 300). |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Shared store for rate limits and the summary cache. |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Vercel KV equivalents of the two above. |
| `TRUST_PROXY` | Set to `1` to key rate limits on the last `x-forwarded-for` entry. |

## Known residual risks

- Egress filtering is the operator's job. The application blocks private destinations itself, but a network-level egress policy for the deployment is still recommended as a second layer.
- Without a key-value store, rate limits and the summary cache are per instance, so the effective limit scales with the number of instances.
- Fixed-window limits allow a burst of up to twice the limit across a window boundary.
- The CSP allows inline scripts, because the pages are statically prerendered and a nonce would force dynamic rendering.
