import assert from 'node:assert/strict';
import { careWeek, validCalendarDate, careHref } from '../src/lib/care-calendar';
const week = careWeek('2026-10-21');
assert.equal(week.start.toISOString(),'2026-10-19T00:00:00.000Z');
assert.equal(week.end.toISOString(),'2026-10-26T00:00:00.000Z');
assert.equal(week.days.length,7); assert.equal(week.days[6].getUTCDay(),0);
assert.equal(week.previous,'2026-10-12'); assert.equal(week.next,'2026-10-26');
assert.equal(careWeek('2027-01-01').start.toISOString(),'2026-12-28T00:00:00.000Z');
for(const date of ['2026-03-08','2026-11-01','2024-02-29']) {
 const result=careWeek(date); assert.equal(result.end.getTime()-result.start.getTime(),7*86400000);
}
for(const invalid of ['2026-02-30','not-a-date','2026-1-01','0001-01-01','9999-01-01','2026-10-19<script>']) assert.equal(validCalendarDate(invalid),null);
assert.equal(careWeek('invalid',new Date('2026-10-20T23:59:00Z')).start.toISOString(),week.start.toISOString());
const url=new URL(careHref({view:'week',week:'2026-10-19',horseId:'horse&other=evil',assigned:'mine'}),'https://example.test');
assert.equal(url.searchParams.get('horseId'),'horse&other=evil');assert.equal(url.searchParams.get('other'),null);
assert.equal(url.searchParams.get('week'),'2026-10-19');assert.equal(careHref({view:'list',week:'2026-10-19',assigned:'wrong'}),'/care');
console.log('PASS: UTC Monday/Sunday boundaries, DST/leap/year transitions, invalid dates, fallback and safe filter-preserving links.');
