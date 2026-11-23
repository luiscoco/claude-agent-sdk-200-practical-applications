import { test, expect } from '@playwright/test';
test('local success, invalid input and repair operate on real files',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.getByRole('button',{name:'Verify locally',exact:true}).click();
  await expect(page.locator('#verification-status')).toHaveText('Local verifier only');
  await expect(page.locator('#stat-total')).toHaveText('50');
  const response=await page.request.get(await page.locator('#download-json').getAttribute('href')||'');
  expect((await response.json()).actual).toEqual({count:5,total:50,min:5,max:15});
  await page.locator('#invalid-fixture').click();await page.locator('#run-agent').click();
  await expect(page.locator('#failure')).toContainText('Line 3');
  await expect(page.locator('#downloads')).toBeHidden();await expect(page.locator('#stat-total')).toHaveText('—');
  await page.locator('#valid-fixture').click();await page.locator('#verify-local').click();
  await expect(page.locator('#stat-total')).toHaveText('50');
  await page.screenshot({path:'recordings/application-verified.png',fullPage:true});
  expect(errors).toEqual([]);
});
test('source is actual project code, navigation and original assets work',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Real source code'}).click();
  await expect(page.locator('#source-code')).toContainText('for await (const message of run)');
  await page.screenshot({path:'recordings/actual-source.png'});
  await page.getByRole('button',{name:'Main infographic'}).click();
  await expect(page.locator('.lesson-image')).toBeVisible();
  expect(await page.locator('.lesson-image').evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>1000)).toBeTruthy();
  await page.getByRole('button',{name:'Lesson cover'}).click();await expect(page.locator('.cover-image')).toBeVisible();
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Application',exact:false}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
test('server rejects malformed requests and arbitrary source paths',async({request})=>{
  expect((await request.post('/api/runs',{data:{mode:'other',text:'1'}})).status()).toBe(400);
  expect((await request.get('/api/source?file=.env')).status()).toBe(404);
});
test('live model result has observed Read evidence and independently verified statistics',async({page})=>{
  test.skip(process.env.LIVE_AGENT_TEST!=='1','Explicit live test opt-in; consumes API credit.');
  await page.goto('/');await page.locator('#run-agent').click();
  await expect(page.locator('#verification-status')).toHaveText('Claude result verified',{timeout:190_000});
  await expect(page.locator('#stat-total')).toHaveText('50');
  await expect(page.locator('[data-event="tool_completed"]')).toHaveCount(1);
  await page.screenshot({path:'recordings/live-claude-verified.png',fullPage:true});
});
