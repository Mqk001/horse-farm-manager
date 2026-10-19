import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/local-client';
import sharp from 'sharp';
import bcrypt from 'bcryptjs';
const require = createRequire(import.meta.url), modulePath = process.env.PLAYWRIGHT_MODULE_PATH ?? 'playwright';
const { chromium } = require(modulePath), { expect } = require(modulePath + '/test');
const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3188';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
assert.ok(process.env.TEST_DATABASE_URL?.startsWith('file:/private/tmp/'));
const db = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
const farms=[], users=[]; let browser;
try {
 for(const label of ['Photo farm', 'Foreign farm']) farms.push(await db.farm.create({data:{name:label,code:`photo-${label}-${Date.now()}`}}));
 async function makeUser(role, farm) {
  const user=await db.user.create({data:{name:role,email:`photo-${role.toLowerCase()}-${Date.now()}@example.test`,password:await bcrypt.hash('Horse-photo-test-123',10),emailVerifiedAt:new Date()}});users.push(user.id);
  await db.farmMember.create({data:{farmId:farm.id,userId:user.id,role}});return user;
 }
 const manager=await makeUser('MANAGER',farms[0]),staff=await makeUser('STAFF',farms[0]),foreign=await makeUser('MANAGER',farms[1]);
 browser=await chromium.launch({headless:true,...(process.env.TEST_CHROME_PATH?{executablePath:process.env.TEST_CHROME_PATH}:{})});
 async function session(user,farm) {
  const context=await browser.newContext({viewport:{width:390,height:844}});
  assert.equal((await context.request.post(base+'/api/auth/login',{headers:{origin:base},data:{email:user.email,password:'Horse-photo-test-123'}})).status(),200);
  await context.addCookies([{name:'reinwell_farm',value:farm.id,url:base}]);return context;
 }
 const context=await session(manager,farms[0]),staffContext=await session(staff,farms[0]),foreignContext=await session(foreign,farms[1]);
 async function request(context,path,options={}) {
  const cookie=(await context.cookies()).map(value=>`${value.name}=${value.value}`).join('; ');
  return context.request.fetch(base+path,{...options,headers:{origin:base,Cookie:cookie,...options.headers}});
 }
 const page=await context.newPage(), errors=[];page.on('pageerror',error=>errors.push(error.message));
 const left=await sharp({create:{width:640,height:640,channels:3,background:'#e00000'}}).png().toBuffer();
 const source=await sharp({create:{width:1280,height:640,channels:3,background:'#00d000'}}).composite([{input:left,left:0,top:0}]).jpeg().toBuffer();
 async function selectCrop(position='End') {
  await page.getByLabel('Choose horse photo').setInputFiles({name:'horse.jpg',mimeType:'image/jpeg',buffer:source});
  const dialog=page.getByRole('dialog',{name:'Crop horse photo'});await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Use photo',exact:true})).toBeInViewport();
  await dialog.getByLabel('Horizontal position').focus();await page.keyboard.press(position);
  if (process.env.TEST_SCREENSHOT_PATH) await page.screenshot({path:process.env.TEST_SCREENSHOT_PATH});
  await dialog.getByRole('button',{name:'Use photo',exact:true}).click();
  await expect(page.getByAltText('Cropped horse photo preview')).toBeVisible();
 }
 await page.goto(base+'/horses/new');await page.getByLabel('Name',{exact:true}).fill('Photo test horse');
 await page.getByLabel('Choose horse photo').setInputFiles({name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});
 await expect(page.locator('p[role=alert]')).toContainText('Choose a JPEG');
 await selectCrop();
 await page.route('**/api/horses/*/photo',route=>route.request().method()==='POST'?route.fulfill({status:500,contentType:'application/json',body:'{"error":"Simulated photo save failure"}'}):route.continue());
 await page.getByRole('button',{name:'Create profile',exact:true}).click();
 await expect(page.locator('p[role=alert]')).toContainText('Profile saved, but the photo could not be saved');
 assert.equal(await db.horse.count({where:{farmId:farms[0].id,name:'Photo test horse'}}),1);
 const horse=await db.horse.findFirstOrThrow({where:{farmId:farms[0].id,name:'Photo test horse'}});
 await page.unroute('**/api/horses/*/photo');await page.getByRole('button',{name:'Create profile',exact:true}).click();
 await expect(page.getByRole('heading',{name:horse.name,level:1,exact:true})).toBeVisible();
 assert.equal(await db.horse.count({where:{farmId:farms[0].id,name:horse.name}}),1,'Retry updates the already-created horse');
 const image=page.getByAltText(horse.name+' photo');await expect(image).toBeVisible();await expect.poll(()=>image.evaluate(el=>el.naturalWidth)).toBe(640);
 let stored=await db.horsePhoto.findUniqueOrThrow({where:{horseId:horse.id}});const originalVersion=stored.version;
 let pixels=await sharp(stored.data).raw().toBuffer({resolveWithObject:true});let center=(320*pixels.info.width+320)*pixels.info.channels;
 assert.ok(pixels.data[center+1]>150&&pixels.data[center]<40,'Chosen right-hand green crop was persisted');
 await page.reload();await expect(page.getByAltText(horse.name+' photo')).toBeVisible();
 await page.goto(base+'/horses');await expect(page.getByAltText(horse.name+' photo')).toBeVisible();
 const endpoint=`/api/horses/${horse.id}/photo`;
 assert.equal((await (await browser.newContext()).request.get(base+endpoint)).status(),401);
 let response=await request(staffContext,endpoint);assert.equal(response.status(),200);assert.match(response.headers()['cache-control'],/private, no-store/);assert.equal(response.headers()['content-type'],'image/webp');
 assert.equal((await request(staffContext,endpoint,{method:'DELETE'})).status(),403);
 assert.equal((await request(staffContext,endpoint,{method:'POST',headers:{'Content-Type':'image/jpeg'},data:source})).status(),403);
 assert.equal((await request(foreignContext,endpoint)).status(),404);assert.equal((await request(foreignContext,endpoint,{method:'DELETE'})).status(),404);
 assert.equal((await request(context,endpoint,{method:'POST',headers:{'Content-Type':'image/jpeg'},data:Buffer.from('<svg/>')})).status(),400);
 assert.equal((await request(context,endpoint,{method:'POST',headers:{'Content-Type':'image/jpeg'},data:Buffer.alloc(256*1024+1)})).status(),413);
 assert.equal((await request(context,endpoint,{method:'POST',headers:{'Content-Type':'image/png'},data:source})).status(),415);
 assert.equal((await request(context,'/api/horses/'+horse.id,{method:'PUT',headers:{'Content-Type':'application/json'},data:{notes:'x'.repeat(66000)}})).status(),413,'Other request limits stay 64KiB');
 await page.goto(base+`/horses/${horse.id}/edit`);await selectCrop('Home');await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await expect(page.getByRole('heading',{name:horse.name,level:1,exact:true})).toBeVisible();stored=await db.horsePhoto.findUniqueOrThrow({where:{horseId:horse.id}});assert.notEqual(stored.version,originalVersion);
 await page.goto(base+`/horses/${horse.id}/edit`);await page.getByRole('button',{name:'Remove photo',exact:true}).click();
 await expect(page.getByText('Photo will be removed when you save.')).toBeVisible();assert.ok(await db.horsePhoto.findUnique({where:{horseId:horse.id}}));
 await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByRole('heading',{name:horse.name,level:1,exact:true})).toBeVisible();
 assert.equal(await db.horsePhoto.findUnique({where:{horseId:horse.id}}),null);assert.equal((await db.horse.findUniqueOrThrow({where:{id:horse.id}})).photo,null);assert.equal((await request(context,endpoint)).status(),404);
 const valid=await sharp({create:{width:640,height:640,channels:3,background:'#555'}}).jpeg().toBuffer();assert.equal((await request(context,endpoint,{method:'POST',headers:{'Content-Type':'image/jpeg'},data:valid})).status(),200);
 await db.horse.delete({where:{id:horse.id}});assert.equal(await db.horsePhoto.count({where:{horseId:horse.id}}),0,'Horse deletion cleans up stored image');
 assert.deepEqual(errors,[]);
 console.log('PASS: mobile crop/preview, exact chosen pixels saved, create retry without duplicates, replace/reload/cards, manager/staff/farm isolation, file and request limits, staged removal and cascade cleanup.');
} finally {
 await browser?.close();await db.farm.deleteMany({where:{id:{in:farms.map(farm=>farm.id)}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect();
}
