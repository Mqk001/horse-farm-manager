# Horse photos: upload, crop and private delivery

Implemented and tested locally. Not pushed, migrated on production or deployed.

## Flow

Managers can add a photo on a new horse profile or change/remove it while editing
an existing profile. Choose JPEG, PNG or WebP (up to 8 MiB, 24 megapixels,
minimum 100 pixels on each side). The crop dialog offers drag positioning plus
keyboard-accessible horizontal, vertical and zoom sliders. Cancel keeps the
previous selection. Use photo stages a preview; Save changes/Create profile
persists it. Removal is also staged until saving. Existing unsaved-change guards
cover photo changes. HEIC, SVG, GIF and other formats are not supported.

The cropped image appears on the horse's profile and directory card. Reserved
square dimensions and initials fallback prevent layout changes and broken images.
Image loading failures fall back to initials; replacing a photo changes its version
URL. Only the app's own authorized image URLs are rendered; arbitrary external
values in the legacy Horse.photo field are ignored.

If profile creation succeeds but image upload fails, the UI says so and stays on
the form. Retrying updates that same horse ID, rather than creating another horse.
Profile and photo persistence are two requests; profile field changes may already
be saved if the photo fails. The previous saved photo stays intact on a rejected
upload. An ambiguous network failure requires checking the persisted profile.

## Storage choice

One compact image per horse, stored as bytes in a dedicated HorsePhoto table in
the existing database, separate from ordinary horse queries. This keeps delivery
private with the app's existing farm/session authorization and requires no new
storage provider, credentials or paid integration. No original files, filenames,
base64 database strings, EXIF/GPS metadata or public bucket are retained.

This is deliberately for compact profile photos, not galleries or original-resolution
media. Large farms/photo galleries should move binary storage to a private object
store; its interface can retain this authenticated delivery endpoint. Private
no-store image responses currently cost a database read on each browser reload;
there is no cross-user CDN cache or public photo URL.

## Boundaries

- Browser decodes/crops the original locally and sends only a 640×640 JPEG,
  recompressing as necessary to stay at or below 256 KiB.
- The exact POST /api/horses/:id/photo endpoint accepts raw image/jpeg up to
  262144 actual streamed bytes. Middleware and route both apply a byte budget,
  compressed-body rejection and receipt deadline. All other requests retain their
  existing 64 KiB limit. Multipart files and JSON/base64 photos remain unsupported.
- Route checks current active membership, manager role and farm ownership before
  image processing. Sharp 0.35.5 validates JPEG content, maximum decoded pixels
  (1,048,576), exact square dimensions (640×640), and strict decode warnings. Its
  processing deadline is five seconds. Output is re-encoded to metadata-free
  640×640 WebP, with a final 256 KiB cap; its SHA256 content version updates the URL.
- Saving/removing runs in a transaction under the existing farm write lock,
  rechecks manager access, changes the Horse.photo reference and upserts/deletes
  the image atomically. Replacing does not accumulate old files. Deleting a horse
  cascades its photo row.
- GET requires an active member of the owning farm, including staff. Nonmembers
  and members of other farms cannot read photos. Responses use image/webp,
  X-Content-Type-Options:nosniff and Cache-Control:private,no-store.
- The PostgreSQL migration enables RLS on HorsePhoto, revokes public, anon and
  authenticated grants, permits only the existing postgres server role, and adds
  a 256 KiB database size constraint. No production schema/data changed in this task.

## Verification

- `node --import tsx tests/horse-photo.ts`: real image decode/re-encode, metadata
  stripping, stable/changing version hashes, malformed/truncated/non-JPEG/oversized
  content, incorrect dimensions and decoded-pixel limits.
- `tests/horse-photos-browser.mjs`: mobile upload/crop/preview, pixel-level check
  that the selected green side of a two-color source is stored, failed image-save
  retry without duplicate horses, persisted profile/card images after reload,
  replacement, staged removal, deletion cleanup, anonymous/staff/other-farm
  permissions, bad types/content and body caps. Disposable SQLite and local
  production-mode build only. Optional TEST_SCREENSHOT_PATH saves the crop view.
- `tests/horse-photo-migration.mjs`: actual PostgreSQL via temporary PGlite,
  migration execution, RLS/grant denial to public API roles, database size
  constraint and cascade deletion. PGlite is not an application dependency.
- Existing request-limits unit and HTTP suites passed; production build and
  TypeScript passed. No production photos/accounts used for testing.

Local browser setup: `TEST_DATABASE_URL=file:/private/tmp/<disposable>.db`,
`TEST_BASE_URL=http://127.0.0.1:3188`, same DATABASE_URL on the local server with
an AUTH_SECRET of 32+ characters; optional PLAYWRIGHT_MODULE_PATH/TEST_CHROME_PATH.
Push schema.local.prisma to the empty disposable database first.

Postgres test: set PGLITE_MODULE to an isolated @electric-sql/pglite@0.5.10
installation's dist/index.js file URL, then run tests/horse-photo-migration.mjs.

## Release

Apply only the additive Prisma migration
20261019010000_horse_photos/migration.sql using the project's existing schema
release process before deploying the matching code. Do not replay the baseline
or reset/seed production. No new environment variables or storage accounts are
needed. Then push/deploy and verify upload/read/reload with a consenting real
farm manager. Existing horse photos are unaffected until someone saves a new photo.

Image-processing references: [Sharp constructor](https://sharp.pixelplumbing.com/api-constructor/)
and [metadata/output handling](https://sharp.pixelplumbing.com/api-output/).
