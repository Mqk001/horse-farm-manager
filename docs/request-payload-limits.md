# Incoming request and payload limits — October 17, 2026

Implemented locally; not pushed or deployed. Prior command-execution and cryptography changes remain intact.

## Limits and enforcement

| Limit | Value | Enforcement |
| --- | --- | --- |
| Request body | 65536 bytes (64 KiB) | src/middleware.ts invokes src/lib/request-limits.ts before route/action handlers or authentication/password/database work. Checks Content-Length, then independently counts actual streamed bytes; missing or misleading lengths do not bypass the byte count. Includes JSON, multipart and URL-encoded form envelope overhead. |
| Server Actions | 64kb | next.config.js experimental.serverActions.bodySizeLimit, as a second framework boundary. This applies to Server Actions, not App Router API JSON handlers; APIs are protected by middleware. |
| JSON nesting | 10 object/array containers | Lexical scan before JSON.parse, respecting quoted strings/escapes. Applies to unknown/unused fields too. |
| Array length | 100 items per array | Iterative structural validation after bounded JSON parsing. No current endpoint supports bulk input; top-level API JSON must be an object. |
| Object width | 100 properties per object | Structural validator. |
| Total JSON complexity | 1000 values/nodes | Structural validator, across the entire body. |
| String field length | 10000 JavaScript string units | JSON and form validator; narrower domain schemas still apply. |
| Field/key names | 100 JavaScript string units | JSON and form validator. |
| Form entries | 50, including duplicate names and framework metadata | Bounded multipart/URL-encoded parsing followed by validateFormData. |
| Uploaded files | 0: uploads unsupported | Non-string FormData values rejected, including empty files. API multipart/binary bodies rejected as unsupported media. No photo/file-upload feature exists to preserve. A future upload route needs explicit separate limits. |
| Request compression | Not supported | Content-Encoding other than identity rejected, preventing compressed-body expansion at application parsing. |
| Body receipt time | 10 seconds within middleware | Streaming read deadline; slow/incomplete body yields 408 when the application boundary can respond. |

Existing/tightened domain field limits: horse/farm/task-care names and rider/provider names at most 100, signup name 80, email 254, password 128, general task title 300, horse markings 200, notes 10000, IDs 100 and activity timestamps 40. Care creation date is exactly 10 characters and parsed as a calendar date. Care and Team actions validate all FormData fields before using them, even when invoked directly in a test, and provider/notes/assignment IDs have explicit maxima. Repeated form fields count toward the 50-entry limit.

## Parsing and clear errors

src/lib/request-limits.ts reads the cloned request stream with a byte budget before JSON/form parsing, rather than trusting Content-Length or calling request.json first. It buffers only the accepted body bytes in application code. Form parsing receives the bounded byte array; React Flight numbered multipart JSON fields and text/plain JSON action envelopes receive the same structural checks. The original request branch remains available to the handler. Stream cancellation is not awaited on limit errors, avoiding tee cancellation deadlocks.

Middleware returns JSON `{error: "..."}` with 413 for size/complexity/field/upload limits, 400 for malformed JSON/form/UTF-8 or non-object API JSON, 415 for unsupported media/compression, and 408 for a read deadline. Examples: `Request body exceeds 64 KiB.`, `An array exceeds 100 items.`, `JSON nesting exceeds 10 levels.`, `File uploads are not supported.`

Care form/dialog clients validate local FormData and show size errors before invoking actions. Horse/activity clients display server error text instead of replacing 413 responses with a generic save error. Framework-generated action errors can still use Next.js's response format; middleware supplies the clear boundary response before framework parsing for supported app requests.

## Scope and infrastructure boundary

The middleware matcher covers app pages, actions and API routes; generated Next static/image assets and favicon are excluded. Upstream hosting/reverse-proxy HTTP header/framing and transport buffers remain outside the application parser's control. This is a per-request parsing/size boundary, not a complete DDoS defense or global concurrency cap. Next's middleware body-clone configuration is not treated as a rejection limit: it can truncate data rather than reject a request, so it was not lowered as a substitute for actual byte validation. The 64-KiB guard is enforced on bytes exposed to application middleware. Higher-level infrastructure limits/timeouts may reject a request first.

## Verification

- tests/request-limits.ts passed: exact byte boundary, declared oversize, lying/missing lengths, streamed overflow, nesting depth, arrays, object width, node count, oversized strings, malformed JSON, compression, forms and files.
- tests/request-limits-http.mjs passed against local production HTTP: 413/400/415 status and explanatory JSON, chunked body overflow without Content-Length, multipart file rejection, oversized action form, and valid JSON reaching the route handler.
- Existing care-history and farm-task HTTP suites passed: authenticated writes and multipart Server Actions continue to work after middleware reads a clone.
- Production build/type checks and git diff --check passed.
- Disposable SQLite/local HTTP only; provider email and Google credentials disabled. No production request floods, fixtures, secret retrieval or data changes.

Reference: Next.js Server Action bodySizeLimit: https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions#bodysizelimit
