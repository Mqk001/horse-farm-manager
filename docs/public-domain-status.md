# Public domain setup (October 16, 2026)

Project: prj_cXzNTAtaplyE8be2OmOBxhm0wHUc, team_S6GrTDpAB3DwSTyXQCtqOJRW.

- Added getreinwell.com as a production domain.
- Added www.getreinwell.com with a 308 redirect to https://getreinwell.com.
- Network Solutions remains authoritative (ns81/ns82.worldnic.com).
- Website DNS saved: A @ = 64.29.17.1, A www = 216.198.79.1, TTL 15 minutes.
  Both addresses were returned by Vercel's project-specific recommendedIPv4.
- Root was initially saved as 216.198.79.1 but authoritative nameservers continued
  returning the parking record. Re-saved with the other rank-one recommended IP.
- Resend DKIM, rsend/send CNAMEs and DMARC preserved. DKIM and send still resolve.
- www HTTPS is valid and responds with Vercel's 308 redirect.
- Root DNS publication and HTTPS are pending at last check: authoritative DNS
  still returns 208.91.197.27; browser reaches a certificate error. No security
  warning or certificate validation was bypassed. Registrar explicitly reports
  successful save and advises up to 24 hours for publication.
- Existing reinwell.vercel.app remains available.
- Custom auth derives verification/invitation URLs from request origin. No
  database, credential or paid SSL change was needed.

Next check: verify root DNS matches the saved value, Vercel's domain config is
not misconfigured, and https://getreinwell.com serves Reinwell with valid HTTPS.
Then verify www redirects and an unauthenticated /api/me returns 401. A fresh
login will be required on the new hostname because sessions are host-scoped.

Permission release: 042352e00752cb7804cee9dae4fa5a2a63a04919,
production deployment dpl_5gqf5tt4jCBK9JMwqR5YkFYK8Hes, READY. Existing manager
browser session loads correctly; no error/fatal logs returned for this release.
Unrelated local feature/schema changes remain uncommitted and undeployed.

## Follow-up verification

The root domain now resolves to Vercel and serves valid HTTPS (307 to /login).
Vercel reports misconfigured=false and verified=true. Browser successfully
opened https://getreinwell.com/login with Reinwell login/signup controls.
www HTTPS still correctly returns 308 to the root. Some authoritative checks
continued returning the parking IP during this transition, so regional DNS
caches may temporarily differ. New hostname login has not yet been performed.
