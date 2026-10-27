import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/local-client';
import bcrypt from 'bcryptjs';
const require=createRequire(import.meta.url),modulePath=process.env.PLAYWRIGHT_MODULE_PATH??'playwright';
const {chromium}=require(modulePath),{expect}=require(modulePath+'/test');
const base=process.env.TEST_BASE_URL??'http://127.0.0.1:3188';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));assert.ok(process.env.TEST_DATABASE_URL?.startsWith('file:/private/tmp/'));
const db=new PrismaClient({datasources:{db:{url:process.env.TEST_DATABASE_URL}}});
const farms=[],users=[];let browser;
const monday=new Date();monday.setUTCHours(0,0,0,0);monday.setUTCDate(monday.getUTCDate()-((monday.getUTCDay()+6)%7));
const day=offset=>new Date(monday.getTime()+offset*86400000+12*3600000);
const date=value=>value.toISOString().slice(0,10);
try {
 for(const name of ['Calendar farm','Other farm'])farms.push(await db.farm.create({data:{name,code:`calendar-${name}-${Date.now()}`}}));
 async function user(role){const user=await db.user.create({data:{name:`Calendar ${role}`,email:`calendar-${role.toLowerCase()}-${Date.now()}@example.test`,password:await bcrypt.hash('Calendar-test-123',10),emailVerifiedAt:new Date()}});users.push(user.id);const member=await db.farmMember.create({data:{userId:user.id,farmId:farms[0].id,role}});return{...user,member};}
 const manager=await user('MANAGER'),staff=await user('STAFF');
 const thunder=await db.horse.create({data:{farmId:farms[0].id,name:'Calendar Thunder'}}),willow=await db.horse.create({data:{farmId:farms[0].id,name:'Calendar Willow'}}),foreign=await db.horse.create({data:{farmId:farms[1].id,name:'Foreign secret horse'}});
 async function care(name,offset,horse=thunder,assignedMemberId=null){return db.vetItem.create({data:{horseId:horse.id,itemName:name,itemType:'FARRIER',nextDueDate:offset===null?null:day(offset),assignedMemberId}});}
 const mondayTask=await care('Monday farrier',0,thunder,staff.member.id);await care('Sunday vet',6);await care('Next Monday vaccine',7);await care('Older overdue visit',-1);await care('Second horse dental',2,willow,manager.member.id);await care('Foreign secret care',0,foreign);await care('Unscheduled finished care',null);
 browser=await chromium.launch({headless:true,...(process.env.TEST_CHROME_PATH?{executablePath:process.env.TEST_CHROME_PATH}:{})});
 async function session(user){const context=await browser.newContext({viewport:{width:1440,height:1000}});assert.equal((await context.request.post(base+'/api/auth/login',{headers:{origin:base},data:{email:user.email,password:'Calendar-test-123'}})).status(),200);await context.addCookies([{name:'reinwell_farm',value:farms[0].id,url:base}]);return context;}
 const context=await session(manager),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/care');await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});const weekLink=page.getByRole('navigation',{name:'Care views'}).getByRole('link',{name:'Week calendar'});await weekLink.click();await expect(page).toHaveURL(/view=week/);
 const calendar=page.getByRole('region',{name:'Weekly care calendar',exact:true});await expect(calendar).toBeVisible();
 await expect(calendar.locator(':scope > div.grid > section')).toHaveCount(7);
 await expect(calendar.getByRole('heading',{name:'Monday farrier',exact:true})).toBeVisible();await expect(calendar.getByRole('heading',{name:'Sunday vet',exact:true})).toBeVisible();
 await expect(calendar.getByText('Next Monday vaccine',{exact:true})).toHaveCount(0);await expect(page.getByText('Foreign secret care',{exact:true})).toHaveCount(0);await expect(calendar.getByText('Unscheduled finished care',{exact:true})).toHaveCount(0);
 await expect(calendar.getByRole('link',{name:'Review overdue care'})).toBeVisible();
 const workload=calendar.getByRole('region',{name:'Weekly workload'});await expect(workload).toContainText('Calendar STAFF');await expect(workload).toContainText('Calendar MANAGER');await expect(workload).toContainText('Unassigned');
 const dayCards=calendar.locator(':scope > div.grid > section');const first=await dayCards.first().boundingBox(),last=await dayCards.last().boundingBox();assert.ok(Math.abs(first.y-last.y)<2,'Desktop shows seven columns');
 if(process.env.TEST_SCREENSHOT_PATH)await calendar.screenshot({path:process.env.TEST_SCREENSHOT_PATH});
 await calendar.getByRole('link',{name:'Next week',exact:true}).click();await expect(calendar.getByRole('heading',{name:'Next Monday vaccine',exact:true})).toBeVisible();await expect(calendar.getByRole('heading',{name:'Monday farrier',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Schedule care',exact:true}).click();const schedule=page.getByRole('dialog',{name:'Schedule care'});await expect(schedule.getByLabel('Next due')).toHaveValue(date(day(7)));await schedule.getByRole('button',{name:'Cancel',exact:true}).click();
 await calendar.getByRole('link',{name:'Previous week',exact:true}).click();await expect(calendar.getByRole('heading',{name:'Monday farrier',exact:true})).toBeVisible();
 await page.getByLabel('Horse',{exact:true}).selectOption(thunder.id);await page.getByLabel('Task assignments').selectOption('unassigned');await page.getByRole('button',{name:'Filter tasks',exact:true}).click();
 await expect(calendar.getByRole('heading',{name:'Sunday vet',exact:true})).toBeVisible();await expect(calendar.getByRole('heading',{name:'Monday farrier',exact:true})).toHaveCount(0);await expect(calendar.getByRole('heading',{name:'Second horse dental',exact:true})).toHaveCount(0);
 assert.equal(new URL(page.url()).searchParams.get('view'),'week');
 await calendar.getByRole('link',{name:'Next week',exact:true}).click();assert.equal(new URL(page.url()).searchParams.get('horseId'),thunder.id);assert.equal(new URL(page.url()).searchParams.get('assigned'),'unassigned');
 await page.getByRole('link',{name:'Clear filters',exact:true}).click();await expect(page.getByLabel('Horse',{exact:true})).toHaveValue('');await expect(page.getByLabel('Task assignments')).toHaveValue('');assert.equal(new URL(page.url()).searchParams.get('view'),'week');
 await calendar.getByRole('link',{name:'This week',exact:true}).click();await expect(calendar.getByRole('heading',{name:'Monday farrier',exact:true})).toBeVisible();
 const article=calendar.getByRole('article').filter({has:page.getByRole('heading',{name:'Monday farrier',exact:true})});
 await article.getByText('Task actions',{exact:true}).click();await article.getByText('Reschedule',{exact:true}).click();await article.getByLabel('New date for Monday farrier').fill(date(day(1)));await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),article.getByRole('button',{name:'Save',exact:true}).click()]);
 await expect.poll(async()=>date((await db.vetItem.findUniqueOrThrow({where:{id:mondayTask.id}})).nextDueDate)).toBe(date(day(1)));
 await expect(calendar.getByRole('heading',{name:'Monday farrier',exact:true})).toBeVisible();
 const moved=calendar.getByRole('article').filter({has:page.getByRole('heading',{name:'Monday farrier',exact:true})});await moved.getByText('Task actions',{exact:true}).click();await moved.getByText('Assign',{exact:true}).click();await moved.getByLabel('Assign Monday farrier',{exact:true}).selectOption(manager.member.id);await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),moved.getByRole('button',{name:'Save assignment',exact:true}).click()]);
 await expect.poll(async()=>(await db.vetItem.findUniqueOrThrow({where:{id:mondayTask.id}})).assignedMemberId).toBe(manager.member.id);await expect(moved.getByRole('heading',{name:'Monday farrier',exact:true})).toBeVisible();await moved.getByText('Task actions',{exact:true}).click();await moved.getByRole('button',{name:'Complete Monday farrier',exact:true}).click();
 await expect.poll(async()=>(await db.vetItem.findUniqueOrThrow({where:{id:mondayTask.id}})).nextDueDate).toBe(null);await expect(calendar.getByRole('heading',{name:'Monday farrier',exact:true})).toHaveCount(0);assert.equal(new URL(page.url()).searchParams.get('view'),'week');
 await page.setViewportSize({width:390,height:844});await page.reload();await expect(calendar).toBeVisible();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Phone has no horizontal overflow');
 const phoneFirst=await dayCards.first().boundingBox(),phoneLast=await dayCards.last().boundingBox();assert.ok(phoneLast.y>phoneFirst.y,'Phone stacks days');
 await page.goto(base+'/care?view=week&week=2026-02-30');await expect(calendar).toBeVisible();await page.goto(base+'/care?view=week&week=2030-01-07');await expect(calendar.getByText('No care scheduled this week.',{exact:false})).toBeVisible();
 const staffPage=await(await session(staff)).newPage();await staffPage.goto(base+'/care?view=week&assigned=mine');await expect(staffPage.getByRole('button',{name:'Schedule care',exact:false})).toHaveCount(0);await expect(staffPage.getByText('Reschedule',{exact:true})).toHaveCount(0);
 assert.deepEqual(errors,[]);
 console.log('PASS: seven-day desktop/mobile calendar, exact week boundaries, safe farm scope, workload, overdue notice, filters/navigation, rescheduling/completion persistence, malformed/empty dates and staff controls.');
}finally{await browser?.close();await db.farm.deleteMany({where:{id:{in:farms.map(farm=>farm.id)}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect();}
