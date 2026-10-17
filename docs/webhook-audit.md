# Incoming webhook audit — October 17, 2026

## Result

No incoming third-party event webhook endpoints exist in this checkout. No sender-signature verifier or event replay store was added because no provider event receiver was found. No webhook can be reported as newly secured. This audit covers repository-defined routes/configuration, not endpoints implemented by other services or independently configured outside this repository.

Reviewed all 21 src/app/api route modules, middleware, Next configuration, application server actions, provider integration code, package manifest and environment-variable example. Searches covered webhook/event/delivery naming and common provider signature headers/SDK verification methods. There are no Pages Router APIs, catch-all provider receivers, custom HTTP server, Supabase edge-function receivers or routing rewrites forwarding events to a hidden webhook in this checkout.

## Endpoint and integration inventory

| Entry point | Purpose | Webhook status / existing authentication |
| --- | --- | --- |
| src/lib/email.ts | Outbound Resend verification, invitation and password-reset email calls | Sends HTTPS requests with server API key. No delivery/bounce/complaint/inbound event receiver exists. RESEND_API_KEY is not a webhook signing secret. |
| /api/auth/google/callback | Browser OAuth authorization-code redirect | Not an event webhook or shared-secret raw-body HMAC endpoint. Signed 10-minute flow cookie, state/origin binding, PKCE, nonce, Google SDK code exchange and ID-token signature/audience/issuer/expiry checks. Clears flow cookie after callback. Authorization-code reuse is rejected by the provider; no webhook event-ID mechanism applies here. |
| /api/auth/google; /api/auth/google/start | OAuth availability/start | App/browser endpoints, not provider event delivery. Start enforces configured origin and sets signed flow cookie. |
| /api/auth/verify-email | User consumes verification-link token | Not a Resend callback. Validates token format/expiry and atomically consumes the token. |
| /api/auth/forgot-password; /api/auth/reset-password; /api/auth/resend-verification | User account recovery and email issuance | Not provider events. Reset consumes a hashed one-time expiring token; mail is outbound. |
| /api/auth/login; /api/auth/signup; /api/auth/logout | User authentication | Not webhooks; normal account/session/rate-limit behavior applies. |
| /api/invitations; /api/invitations/accept | Manager sends invite / signed-in invitee accepts | Not email-provider events. Invitation acceptance checks authenticated email, expiry, prior acceptance/revocation and atomically claims invitation under farm lock. |
| /api/me | Current user/farm data | Authenticated app query; not a webhook. |
| /api/farms; /api/farms/active | Create/select farm | User session and farm access; not provider delivery. |
| /api/horses; /api/horses/[id]; /api/rides; /api/washes | Farm records and activity | App/session/farm authorization; not webhooks. |
| /api/team/[id]; /api/team/revision | Manager access controls / team revision | Active-farm manager authorization; not provider events. |

No Stripe/payment webhook integration, Resend/Svix webhook receiver, or other third-party event consumer was found in dependencies, route handlers or configuration. Ordinary API session/origin checks must not be described as provider-signature verification.

## Validation and changes

- Source/route/integration review completed; no webhook handler required a code fix.
- Existing tests/google-token.mjs passed using disposable settings and simulated provider transport: Google's actual SDK rejected an attacker-signed token, wrong audience/issuer, expired token, nonce mismatch and missing identity/verification claims.
- This test is evidence for the OAuth boundary only, not for a webhook or a live provider delivery.
- Added this report only. Pending command-execution/cryptography work remains intact. No production endpoints, accounts, provider settings, secrets or data were changed.

## Requirements for a future event receiver

When a specific provider webhook is implemented, use that provider's documented signature mechanism/official SDK, preserve the raw request bytes before parsing JSON, require a dedicated server-side webhook signing secret, reject missing/invalid signatures and stale signed timestamps before side effects, and use a durable unique provider/event-ID receipt with transactional or retry-safe processing. Record an event as successfully processed atomically with its database effects; external side effects need an outbox/idempotency strategy. A timestamp window alone does not stop duplicate events inside the window. Do not add a generic signature check without a real provider format and receiver to test.
