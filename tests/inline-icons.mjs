import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Home, CalendarDays, Menu, Plus, Sparkles, Users, Clock3, AlertCircle } from 'lucide-react';
for (const [name, Icon] of Object.entries({ Home, CalendarDays, Menu, Plus, Sparkles, Users, Clock3, AlertCircle })) {
  const html = renderToStaticMarkup(createElement(Icon, { 'aria-hidden': true }));
  assert.match(html, /^<svg\b/);
  assert.doesNotMatch(html, /<(img|image|use)\b|https?:\/\/(?!www\.w3\.org)/);
  assert.ok(Buffer.byteLength(html) < 2048);
  console.log(`PASS ${name}: ${Buffer.byteLength(html)} bytes, inline SVG, no external graphic request`);
}
