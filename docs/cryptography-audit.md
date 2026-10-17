# Cryptography audit — October 17, 2026

## Findings and replacements

No MD5, SHA-1, MD4, DES/3DES, RC4, ECB encryption, hardcoded encryption/signing keys, fixed IVs, Math.random-based security tokens, or custom cryptographic algorithm was found in first-party application code. No application symmetric encryption is currently implemented, so there was no cipher/mode/IV to replace. Environment example secrets are empty; actual production secret values were not retrieved. Dependency/lockfile integrity hashes are not password hashes; an incidental `Md5` substring inside a SHA-512 integrity string is not MD5 usage. This source audit is not a full transitive-dependency or infrastructure cryptographic certification.

| Finding/site | Before | Replacement |
| --- | --- | --- |
| src/app/api/auth/signup/route.ts | bcrypt cost 12, while allowing 128 characters; UTF-8 passwords exceeding bcrypt's 72-byte limit are silently truncated | Shared Node crypto.scrypt password hashing covering the entire accepted password |
| src/lib/password-reset.ts | Same bcrypt truncation risk during reset | Shared scrypt hashing; existing token expiry, one-use consumption and session revocation retained |
| src/lib/google-account.ts | bcrypt cost 12 for random unusable local password | Same shared scrypt writer, keeping new account password formats consistent |
| src/app/api/auth/login/route.ts | bcrypt-only verification | Versioned scrypt verification; legacy bcrypt verification limited to 72 UTF-8 bytes; successful verified legacy login rehashes to scrypt with a conditional update that cannot overwrite a concurrent reset/password change |
| prisma/seed.ts | Known shared password, one reused bcrypt cost-10 hash, password printed to console | Distinct operator-supplied SEED_OWNER_PASSWORD/SEED_STAFF_PASSWORD, at least 12 characters each; independently salted scrypt; validation/hashing before destructive seed writes; no password output; failure sets nonzero exit status |

bcrypt at cost 12 is a slow password hash, not a broken primitive. The concrete weakness was accepting inputs that bcrypt could not fully verify; migration also moves new storage to a modern memory-hard option. Test-only bcrypt cost-4/10 fixtures remain for fast isolated tests and explicit legacy-migration coverage. They are not production password writers.

## New password implementation

`src/lib/passwords.ts` calls Node's asynchronous `crypto.scrypt` directly, with N=32768 (2^15), r=8, p=3, a fresh 16-byte crypto.randomBytes salt, and a 32-byte derived key. This is OWASP's 32-MiB memory/CPU-balanced scrypt profile. maxmem is capped at 64 MiB per derivation. No new dependency, custom KDF, custom cipher or prehash construction was introduced. Parameters are fixed and versioned, not accepted from a request or arbitrary stored hash; the strict encoded-format parser rejects unknown parameters, malformed/noncanonical encodings and unsupported hashes. Derived bytes are compared with crypto.timingSafeEqual.

Password paths retain their existing 8–128 character policy; hashing/verification bounds inputs to 128 JavaScript string units. scrypt distinguishes suffixes after byte 72, including multibyte Unicode. The hash helper also supports shorter existing passwords only for migration, not signup/reset policy relaxation.

## Compatibility and rollout

- No schema migration: the existing password string holds the versioned encoded hash.
- Existing bcrypt hashes remain supported and are upgraded only after a correct password and verified-email check.
- Rehash uses an update predicate containing the previous hash and sessionVersion. A concurrent password reset wins; a failed compare-and-swap does not issue a session. Two simultaneous first legacy logins may require retrying one login.
- Legacy inputs exceeding 72 UTF-8 bytes fail rather than authenticating an unverifiable suffix. Those users need the existing password-reset flow to establish a full-length scrypt password. Stored bcrypt data cannot reveal what the original discarded suffix was.
- Password reset continues to revoke old sessions. Login-time rehash preserves sessionVersion and farm/Google identity; no AUTH_SECRET or Google secret rotation was performed.
- scrypt is deliberately costly. One local hash took approximately 116 ms on the development machine; this is not a production capacity benchmark. The profile uses about 32 MiB per active derivation; Node's thread pool and existing login/reset rate controls remain relevant to deployment capacity.
- Source changes are local, not pushed/deployed in this audit. Once scrypt hashes exist, rollback must keep a scrypt-capable verifier or require password recovery; a bcrypt-only binary cannot authenticate them.

## Cryptography retained after review

| Site | Primitive and purpose | Assessment |
| --- | --- | --- |
| src/lib/session.ts | Web Crypto HMAC-SHA-256 sign/verify, AUTH_SECRET from server environment, seven-day expiry and sessionVersion | Standard library MAC, not custom hashing/encryption; no embedded fallback key; retained for session compatibility |
| src/lib/google-oauth.ts | Node HMAC-SHA-256 for signed short-lived flow cookie; timingSafeEqual; SDK S256 PKCE, nonce/state and provider token verification | Appropriate standard primitives and official Google OAuth library; retained |
| src/lib/password-reset.ts | SHA-256 digest of 32-byte random bearer token; 30-minute expiry/one-use | High-entropy token hashing, not password hashing; retained |
| src/lib/login-rate-limit.ts; src/app/api/auth/forgot-password/route.ts; src/app/api/auth/resend-verification/route.ts | SHA-256 of rate-limit identifiers | Non-password indexing, retained |
| src/lib/team-revision.ts | SHA-256 of scoped team state | Change detection, not authentication or encryption; retained |
| src/app/api/auth/signup/route.ts; src/app/api/auth/resend-verification/route.ts; src/app/api/invitations/route.ts | crypto.randomBytes(32) | Cryptographic verification/invitation tokens, retained |
| src/app/api/farms/route.ts | crypto.randomBytes(4) farm code | Unique display/workspace identifier, not proof of membership or authorization; retained |
| src/lib/google-account.ts | crypto.randomBytes(48) | Unguessable generated password before slow hashing; retained |

Session/OAuth token serialization is application-specific, but signing uses standard HMAC implementations; no homegrown cryptographic primitive was found. Replacing a correctly used MAC with an unrelated cipher would not improve its security.

## Verification

- tests/passwords.ts: scrypt format/native interoperability, random salts, long/Unicode suffix distinctions, malformed/unbounded parameter rejection, legacy success/failure and overlong legacy rejection passed.
- tests/password-reset.ts: scrypt password replacement, reset-token hashing/expiry/rotation/replay/concurrency, session revocation, mocked delivery and farm/Google preservation passed.
- tests/password-reset-http.ts: real local production HTTP legacy-login upgrade, repeat scrypt login, reset/replay, invalidated old session, full-length password success and suffix mismatch rejection passed.
- tests/google-auth.ts: OAuth tampering/expiry/origin, PKCE, account creation, identity linking and membership/password preservation passed using disposable provider settings.
- Production build, TypeScript checks, existing command-execution guard tests and git diff --check passed.
- All mutation tests used disposable SQLite and local HTTP. Email delivery and live Google credentials were disabled for the HTTP server. The destructive seed was inspected but not run. No production users, secrets, sessions or data were changed.

## Primary references

- OWASP Password Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- Node 24 crypto.scrypt and timingSafeEqual: https://nodejs.org/docs/latest-v24.x/api/crypto.html
