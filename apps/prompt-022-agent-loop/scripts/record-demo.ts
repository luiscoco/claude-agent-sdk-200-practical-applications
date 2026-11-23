import { chromium, type Page } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'recordings');
await mkdir(out,{recursive:true});
const lesson=JSON.parse(await readFile(path.join(root,'scripts/lesson-plan.json'),'utf8'));
const probe=path.resolve(root,'../../output/prompt-01-video/tools/node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe');
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const timeline:any[]=JSON.parse(await readFile(path.join(out,'recording-manifest.json'),'utf8').catch(()=>'[]'));let liveRun=timeline.find(s=>s.kind==='live')?.liveRun||'';
const redo=(process.env.RECORD_SCENES||'').split(',').filter(Boolean);
for(let i=timeline.length-1;i>=0;i--)if(redo.includes(timeline[i].id))timeline.splice(i,1);
const recordingCss=`
 .sidebar{width:190px;padding:20px 16px}.shell{grid-template-columns:190px minmax(0,1fr)}
 .topbar{height:65px}main{padding:22px 28px}.page-heading{margin-bottom:18px}.page-heading h2{font-size:32px}.page-heading p:not(.eyebrow){font-size:17px}
 .sidebar-copy,.runtime,.sidebar-note{font-size:15px}.panel-heading{padding:15px 20px}.panel-heading h3{font-size:23px}
 .workspace-grid{gap:20px}.editor-wrap{height:178px}.events{height:280px;padding:10px 20px}.event h4{font-size:17px}.event p{font-size:16px}.event time{font-size:12px}.event details,.event pre{font-size:15px}.event pre{max-height:250px}
 .help,.mode-explainer,.chip,.fixture-toolbar>span,.flow-strip,.evidence,.statistics span,.text-button,.timeline-footer{font-size:15px}.button{font-size:17px}.mode-explainer{margin-bottom:14px}.statistics{padding-bottom:12px}.statistics>div{padding:10px 16px}.statistics strong{font-size:32px}.result-panel{margin-top:17px}.evidence{margin-bottom:12px}.downloads{padding-bottom:12px}.result-panel details{font-size:17px}.result-panel pre{font-size:19px}
 .takeaway{display:none}.source-layout{grid-template-columns:140px minmax(0,1fr)}#source-code{font-size:22px;line-height:1.55;max-height:770px}.code-line{white-space:pre-wrap;overflow-wrap:anywhere}.source-tab{font-size:17px}.source-heading{font-size:18px}.source-heading span{font-size:15px}.failure{font-size:22px}
 #recording-title{position:fixed;bottom:12px;left:220px;background:#102039;color:white;border-radius:8px;padding:10px 18px;z-index:900;font:600 20px Segoe UI;box-shadow:0 2px 10px #0002}
 #recording-highlight{position:fixed;border:4px solid #ef2929;border-radius:8px;pointer-events:none;z-index:999;box-shadow:0 0 0 2px #fff9}
`;
async function highlight(page:Page,selector:string){await page.locator(selector).first().scrollIntoViewIfNeeded();await page.evaluate(sel=>{
  document.getElementById('recording-highlight')?.remove();const el=document.querySelector(sel);if(!el)return;const b=el.getBoundingClientRect(),box=document.createElement('div');box.id='recording-highlight';Object.assign(box.style,{left:Math.max(2,b.left-3)+'px',top:Math.max(2,b.top-3)+'px',width:Math.min(innerWidth-b.left-2,b.width+6)+'px',height:Math.min(innerHeight-b.top-5,b.height+6)+'px'});document.body.append(box);
},selector);}
async function code(page:Page,file:string,from:string,to:string){
  await page.evaluate(async ({file})=>{const lesson=(window as any).lesson;lesson.showView('source');await lesson.loadSource(file);},{file});
  const range=await page.locator('.code-line').evaluateAll((rows,{from,to})=>{
    const start=rows.findIndex(r=>r.textContent?.includes(from));let end=rows.findIndex((r,i)=>i>=start&&!!r.textContent?.includes(to));if(end<start)end=start;
    rows.slice(start,end+1).forEach(r=>r.classList.add('focused'));return {start:start+1,end:end+1};
  },{from,to});
  await page.locator(`.code-line[data-line="${range.start}"]`).evaluate(el=>{const pre=el.parentElement!;pre.scrollTop=(el as HTMLElement).offsetTop-pre.offsetTop-24;});
  await highlight(page,`.code-line[data-line="${range.start}"]`);
  return range;
}
try{
for(const scene of lesson.scenes){
  if(timeline.some(s=>s.id===scene.id))continue;
  const duration=Number(execFileSync(probe,['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',path.join(out,'audio',scene.id+'.mp3')],{encoding:'utf8',windowsHide:true}).trim());
  // Recording-only styles; the application retains its strict CSP for normal users.
  const context=await browser.newContext({baseURL:'http://127.0.0.1:43122',bypassCSP:true,viewport:{width:1920,height:1080},recordVideo:{dir:path.join(out,'raw'),size:{width:1920,height:1080}},deviceScaleFactor:1});
  const page=await context.newPage();await page.goto('http://127.0.0.1:43122');await page.locator('#sdk-version').filter({hasText:'0.3.'}).waitFor();
  await page.addStyleTag({content:recordingCss});
  await page.evaluate(title=>{const el=document.createElement('div');el.id='recording-title';el.textContent=title;document.body.append(el);},scene.title);
  const started=Date.now();let range:any;
  if(scene.kind==='cover'||scene.kind==='infographic'){
    await page.evaluate(kind=>{document.body.replaceChildren();const img=document.createElement('img');img.src=kind==='cover'?'/assets/cover.png':'/assets/main-infographic.png';Object.assign(img.style,{width:'100vw',height:'100vh',objectFit:'contain',display:'block'});document.body.style.margin='0';document.body.style.background='#10172d';document.body.append(img);},scene.kind);
    await page.locator('img').evaluate((im:HTMLImageElement)=>im.decode());
  }else if(scene.kind==='code')range=await code(page,scene.file,scene.from,scene.to);
  else if(scene.kind==='input')await highlight(page,'.input-panel');
  else if(scene.kind==='live'){
    await highlight(page,'#run-agent');await page.locator('#run-agent').click();
    await highlight(page,'.timeline-panel');
    await page.locator('#verification-status').filter({hasText:'Claude result verified'}).waitFor({timeout:190000});
    liveRun=await page.evaluate(()=>(window as any).lesson.getRunId());
    const result=await(await page.request.get('/api/runs/'+liveRun)).json();
    await writeFile(path.join(out,'live-run-evidence.json'),JSON.stringify(result,null,2));
    await page.screenshot({path:path.join(out,'live-claude-verified.png'),fullPage:true});
    await highlight(page,'.statistics');
  }else if(['observation','report','download'].includes(scene.kind)){
    if(!liveRun)throw Error('Recording requires an actual completed live run.');
    await page.evaluate(async id=>{await (window as any).lesson.restoreRun(id);},liveRun);
    if(scene.kind==='observation'){
      await page.addStyleTag({content:'.workspace-grid{display:block}.input-panel,.result-panel{display:none}.timeline-panel .events{height:650px}.event pre{max-height:490px;font-size:21px}.event h4{font-size:23px}.event p,.event details{font-size:20px}'});
      await page.locator('[data-event="tool_completed"] details').evaluate((el:HTMLDetailsElement)=>{el.open=true;});
      await page.locator('.events').evaluate(el=>{const row=el.querySelector('[data-event="tool_completed"]') as HTMLElement;el.scrollTop=row.offsetTop-(el as HTMLElement).offsetTop-8;});
      await highlight(page,'[data-event="tool_completed"]');
    }else if(scene.kind==='report')await highlight(page,'.statistics');
    else{
      await page.addStyleTag({content:'.workspace-grid{display:none}.result-panel pre{max-height:570px;overflow:auto}.statistics,.evidence{display:none}'});
      await page.locator('#report-details').evaluate((el:HTMLDetailsElement)=>{el.open=true;});
      await page.locator('#report-json').evaluate(el=>{const pre=el as HTMLElement;const lines=pre.textContent!.split('\n');const line=lines.findIndex(l=>l.includes('"expected"'));pre.scrollTop=Math.max(0,line*30-40);});
      await page.locator('#report-details').scrollIntoViewIfNeeded();await highlight(page,'#report-json');
      const download=page.waitForEvent('download');await page.locator('#download-json').click();await(await download).saveAs(path.join(out,'recorded-download-report.json'));
    }
  }else if(scene.kind==='error'){
    await page.locator('#invalid-fixture').click();await highlight(page,'#numbers');await page.waitForTimeout(2500);await page.locator('#run-agent').click();
    await page.locator('#failure').filter({hasText:'Line 3'}).waitFor();await highlight(page,'#failure');
    await page.screenshot({path:path.join(out,'invalid-input.png'),fullPage:true});
  }else if(scene.kind==='repair'){
    await page.locator('#invalid-fixture').click();await page.waitForTimeout(700);await page.locator('#valid-fixture').click();await page.locator('#verify-local').click();await page.locator('#verification-status').filter({hasText:'Local verifier only'}).waitFor();await highlight(page,'#verification-status');
  }else if(scene.kind==='exercise'){
    await page.locator('#numbers').fill('-4\n6\n0');await highlight(page,'#numbers');await page.waitForTimeout(4000);await page.locator('#verify-local').click();await page.locator('#stat-total').filter({hasText:'2'}).waitFor();await highlight(page,'.statistics');
  }else if(scene.kind==='wrap'){
    await page.evaluate(async id=>{await (window as any).lesson.restoreRun(id);},liveRun);await highlight(page,'.result-panel');
  }
  const actionSeconds=(Date.now()-started)/1000;
  await page.waitForTimeout(Math.max(1500,(duration+.8-actionSeconds)*1000));
  await page.screenshot({path:path.join(out,scene.id+'.png')});
  const activeDuration=(Date.now()-started)/1000;
  const video=page.video()!;await context.close();const file=await video.path();
  const entry={...scene,range,audioDuration:duration,actionSeconds,activeDuration,rawVideo:path.relative(root,file),liveRun:scene.kind==='live'?liveRun:undefined};timeline.push(entry);
  timeline.sort((a,b)=>a.id.localeCompare(b.id));
  await writeFile(path.join(out,'recording-manifest.json'),JSON.stringify(timeline,null,2));console.log('Recorded '+scene.id+' ('+duration.toFixed(1)+'s narration)');
}
}finally{await browser.close();}
