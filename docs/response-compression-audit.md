# Response compression verification

Compression was already enabled; no application/runtime change was necessary.

## Enforcement and negotiation

- Production uses Vercel CDN's automatic gzip/Brotli compression. Its documented compressible MIME types include application/json and text content. Browsers send Accept-Encoding automatically; app fetch calls need no manual compression/decompression code.
- next.config.js does not disable compression. The installed Next.js 15.5.27 default is `compress: true`. Its bundled compression implementation uses a 1,024-byte default threshold for known-length bodies, filters by compressible MIME type, and skips responses with an existing Content-Encoding. Unknown-length streams cannot always be filtered by final size before streaming starts.
- Production edge minimum size is managed by Vercel, not configured here. No exact edge threshold is claimed. A 29-byte JSON response was observed to stay uncompressed.
- No application gzip wrapper, global Content-Encoding header, or binary compression layer was added. This keeps the hosting/framework layer responsible and avoids duplicate compression.

Sources:
- https://vercel.com/docs/how-vercel-cdn-works/compression
- https://nextjs.org/docs/13/app/api-reference/next-config-js/compress
- Installed code: node_modules/next/dist/server/config-shared.js and node_modules/next/dist/compiled/compression/index.js.

## Live measurements

Read-only requests to https://getreinwell.com after deployment of 023eb28. Sizes are raw HTTP response body bytes, excluding headers/TLS framing; the client used Node HTTPS without automatic decompression.

| Response | Accept-Encoding | Content-Encoding | Body bytes | Reduction |
| --- | --- | --- | ---: | ---: |
| Homepage | identity | none | 9,967 | baseline |
| Homepage | gzip | gzip | 2,897 | 70.9% |
| Homepage | br | br | 3,064 | 69.3% |
| Homepage | gzip, br | br | 3,064 | 69.3% |
| Homepage | gzip;q=0, br;q=0, identity;q=1 | none | 9,967 | 0% |
| /api/me (unauthenticated 401 JSON) | identity / gzip / br / gzip, br | none | 29 | intentionally small |

All decoded bodies matched their identity responses byte-for-byte. API JSON parsed successfully. Brotli was selected when both algorithms were offered; in this particular measurement gzip happened to produce fewer bytes. The savings above are existing behavior, not a before/after improvement from this audit.

## Controlled JSON and safeguards

`tests/response-compression.mjs` exercises the compression implementation shipped with this installed Next version using a temporary local HTTP fixture server. It adds no production endpoints, reads no farm data, and writes no database records.

- JSON: 7,101 → 367 bytes (94.8% reduction); decoded bytes identical and JSON parses.
- Plain text: 15,000 → 83 bytes; decoded bytes identical.
- Small JSON unchanged; image/png unchanged.
- Existing gzip payload unchanged on the wire, and one decompression restores the JSON (no double compression).
- Explicit gzip exclusion respected; Vary includes Accept-Encoding on local compressed responses.

Verification commands:

```
node tests/response-compression.mjs
node tests/response-compression.mjs https://getreinwell.com
```

Both passed. Large authenticated production JSON was not exercised: the live API measurement is an unauthenticated error response, while large JSON compression was tested against the installed local framework. The edge documentation confirms JSON is supported, but this does not substitute for measuring a signed-in farm response.

Only the test script and this report were added locally. No new deployment is required for the existing compression behavior.
