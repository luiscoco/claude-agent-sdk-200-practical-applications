import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'recordings'),work=path.join(out,'render');await fs.mkdir(work,{recursive:true});
const require=createRequire(path.resolve(root,'../../output/prompt-01-video/tools/package.json'));
const ffmpeg=require('ffmpeg-static'),ffprobe=require('ffprobe-static').path;
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const W=1920,H=1080,fps=30,transition=.6;
const branding=JSON.parse(await fs.readFile(path.resolve(root,'../course-branding.json'),'utf8'));
if(!branding.coverCredit?.trim())throw Error('Every cover requires an author credit.');
const creditOverlay=path.join(work,'cover-credit-overlay.png');
const creditCanvas=createCanvas(W,H),credit=creditCanvas.getContext('2d'),layout=branding.coverCreditLayout;
credit.fillStyle='#101b35';credit.strokeStyle='#f5f6fa';credit.lineWidth=2;
credit.beginPath();credit.roundRect(layout.centerX-layout.width/2,layout.top,layout.width,layout.height,layout.cornerRadius);credit.fill();credit.stroke();
credit.font=`400 ${layout.fontSize}px Segoe UI`;credit.fillStyle='white';credit.textAlign='center';credit.textBaseline='middle';
credit.fillText(branding.coverCredit,layout.centerX,layout.top+layout.height/2);
await fs.writeFile(creditOverlay,creditCanvas.toBuffer('image/png'));
async function run(exe,args){return new Promise((resolve,reject)=>{const p=spawn(exe,args,{windowsHide:true});let output='',err='';p.stdout.on('data',d=>output+=d);p.stderr.on('data',d=>err=(err+d).slice(-6000));p.on('error',reject);p.on('close',c=>c===0?resolve(output):reject(Error(err)));});}
async function probe(file){return JSON.parse(await run(ffprobe,['-v','error','-show_format','-show_streams','-of','json',file]));}
const enc=['-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p','-r','30','-threads','4','-c:a','aac','-b:a','192k','-ar','48000','-ac','2'];
const scenes=JSON.parse(await fs.readFile(path.join(out,'recording-manifest.json'),'utf8'));
if(scenes.length!==15)throw Error('All 15 recorded scenes are required before rendering.');
const reuseAudio=process.argv.includes('--reuse-audio'),previous=path.join(work,'previous-export.mp4');
if(reuseAudio)await fs.copyFile(path.join(out,'prompt-022-agent-loop-pilot.mp4'),previous);
const clips=[],captions=[],chapters=[];let clock=0;
function stamp(seconds){let ms=Math.round(seconds*1000);const h=Math.floor(ms/3600000);ms%=3600000;const m=Math.floor(ms/60000);ms%=60000;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(Math.floor(ms/1000)).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;}
for(const [index,s] of scenes.entries()){
  const raw=path.join(root,s.rawVideo),metadata=await probe(raw),rawDuration=Number(metadata.format.duration);
  const duration=Math.ceil((s.audioDuration+.8)*fps)/fps;
  const setupOnly=['code','input','observation','report','download','wrap'].includes(s.kind)?s.actionSeconds:0;
  const active=Math.min(rawDuration,s.activeDuration)-setupOnly,start=Math.max(0,rawDuration-active),rate=duration/active;
  const clip=path.join(work,s.id+'.mp4');
  // Opening slides are source images, never browser recordings containing startup frames.
  const stillAsset=s.kind==='cover'?'cover.png':s.kind==='infographic'?'main-infographic.png':null;
  const refreshStill=stillAsset&&(!process.argv.includes('--reuse-clips')||process.argv.includes('--opening-only'));
  let filter=`setpts=(PTS-STARTPTS)*${rate},fps=30,scale=1920:1080:flags=lanczos,setsar=1,tpad=stop_mode=clone:stop_duration=1`;
  // The verified run's model remains visible in the report; hide the changing configuration sidebar in the course export.
  if(!['cover','infographic'].includes(s.kind))filter+=',drawbox=x=0:y=865:w=189:h=173:color=white:t=fill';
  if(rate<.92)filter+=",drawbox=x=1200:y=12:w=690:h=42:color=0x102039:t=fill,drawtext=text='Live recording - waiting time compressed':fontcolor=white:fontsize=23:x=1215:y=20";
  if(!process.argv.includes('--reuse-clips')&&!stillAsset)await run(ffmpeg,['-y','-v','error','-ss',String(start),'-i',raw,'-i',path.join(out,'audio',s.id+'.mp3'),'-map','0:v:0','-map','1:a:0','-vf',filter,'-af','apad','-t',String(duration),...enc,clip]);
  if(refreshStill){
    const fit='scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x10172d,setsar=1';
    const isCover=s.kind==='cover';
    await run(ffmpeg,['-y','-v','error','-loop','1','-framerate','30','-i',path.join(root,'public/assets',stillAsset),...(isCover?['-loop','1','-framerate','30','-i',creditOverlay]:[]),'-i',path.join(out,'audio',s.id+'.mp3'),...(isCover?['-filter_complex',`[0:v]${fit}[cover];[cover][1:v]overlay=0:0:format=auto[v]`,'-map','[v]','-map','2:a:0']:['-vf',fit]),'-af','apad','-t',String(duration),...enc,clip]);
  }
  const refreshObservation=process.argv.includes('--fix-observation')&&s.kind==='observation';
  if(refreshObservation)await run(ffmpeg,['-y','-v','error','-loop','1','-framerate','30','-i',path.join(out,s.id+'.png'),'-i',path.join(out,'audio',s.id+'.mp3'),'-vf','scale=1920:1080,drawbox=x=0:y=865:w=189:h=173:color=white:t=fill','-af','apad','-t',String(duration),...enc,clip]);
  const first=path.join(work,s.id+'-first.png'),last=path.join(work,s.id+'-last.png');
  if(!process.argv.includes('--reuse-clips')||refreshObservation||refreshStill){
    await run(ffmpeg,['-y','-v','error','-i',clip,'-frames:v','1',first]);
    await run(ffmpeg,['-y','-v','error','-sseof','-0.08','-i',clip,'-frames:v','1',last]);
  }
  clips.push({file:clip,first,last});chapters.push({title:s.title,start:clock,duration,playbackRate:1/rate});
  const alignment=JSON.parse(await fs.readFile(path.join(out,'audio',s.id+'.json'),'utf8')).timestampInfo?.wordAlignment;
  if(alignment?.words){let group='',a=null,z=0;for(let i=0;i<alignment.words.length;i++){const word=alignment.words[i];if(a===null&&word.trim())a=alignment.wordStartTimeSeconds[i];group+=word;z=alignment.wordEndTimeSeconds[i];if((group.length>60&&/\s|[.!?]$/.test(word))||i===alignment.words.length-1){if(group.trim()&&a!==null)captions.push({start:clock+a,end:clock+z,text:group.trim()});group='';a=null;}}}
  clock+=duration+(index<scenes.length-1?transition:0);console.log('Encoded '+s.id);
}
// Same perspective-projected cube geometry as the approved original series.
const original=await fs.readFile(path.resolve(root,'../../output/prompt-01-video/render.mjs'),'utf8');
const functions=original.slice(original.indexOf('function project('),original.indexOf('const ordered=[];')).replace('const nx=28,ny=12','const nx=10,ny=5').replaceAll('4200','1400');
// Imported source is a local, fixed renderer maintained with the course assets.
// Render the brief moving transition at 640×360, then upscale; application footage remains native 1080p.
const CW=640,CH=360;
const geometry=new Function('W','H',functions+'; return {face};')(CW,CH);
async function transitionImage(file){const img=await loadImage(file),small=createCanvas(CW,CH);small.getContext('2d').drawImage(img,0,0,CW,CH);return small;}
const ordered=[];
for(let i=0;i<clips.length;i++){
  ordered.push(clips[i].file);if(i===clips.length-1)break;
  if(process.argv.includes('--opening-only')&&i>1){ordered.push(path.join(work,`cube-${i}.mp4`));continue;}
  const outgoing=await transitionImage(clips[i].last),incoming=await transitionImage(clips[i+1].first),canvas=createCanvas(CW,CH),ctx=canvas.getContext('2d');
  const file=path.join(work,`cube-${i}.mp4`),p=spawn(ffmpeg,['-y','-v','error','-f','image2pipe','-framerate','30','-i','pipe:0','-f','lavfi','-i','anullsrc=r=48000:cl=stereo','-t',String(transition),'-vf','scale=1920:1080:flags=lanczos',...enc,file],{windowsHide:true});
  let err='';p.stderr.on('data',d=>err+=d);const completed=new Promise((resolve,reject)=>{p.on('error',reject);p.on('close',c=>c===0?resolve():reject(Error(err)));});
  for(let f=0;f<fps*transition;f++){
    const t=f/(fps*transition-1),ease=t*t*(3-2*t),angle=-Math.PI/2*ease,zoom=1-.2*Math.sin(Math.PI*t);
    ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#10172d';ctx.fillRect(0,0,CW,CH);
    const order=t<.5?[[incoming,'right'],[outgoing,'front']]:[[outgoing,'front'],[incoming,'right']];
    for(const [im,kind]of order)geometry.face(ctx,im,kind,angle,zoom);
    if(!p.stdin.write(canvas.toBuffer('image/png')))await once(p.stdin,'drain');
  }
  p.stdin.end();await completed;ordered.push(file);console.log('Rendered cube '+(i+1));
}
await fs.writeFile(path.join(work,'concat.txt'),ordered.map(f=>`file '${f.replaceAll('\\','/')}'`).join('\n'));
await run(ffmpeg,['-y','-v','error','-f','concat','-safe','0','-i',path.join(work,'concat.txt'),'-c','copy',path.join(work,'joined.mp4')]);
await fs.writeFile(path.join(out,'narration.srt'),captions.map((c,i)=>`${i+1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join('\n'));
let meta=';FFMETADATA1\ntitle=Prompt 22 - Agent Loop Lab\ncomment=Real application recording. Narration: Inworld Yash.\n';
chapters.forEach((c,i)=>{meta+=`[CHAPTER]\nTIMEBASE=1/1000\nSTART=${Math.round(c.start*1000)}\nEND=${Math.round((chapters[i+1]?.start??clock)*1000)}\ntitle=${c.title}\n`;});
await fs.writeFile(path.join(work,'chapters.txt'),meta);
const output=path.join(out,'prompt-022-agent-loop-pilot.mp4');
await run(ffmpeg,['-y','-v','error','-i',path.join(work,'joined.mp4'),'-i',path.join(out,'narration.srt'),'-f','ffmetadata','-i',path.join(work,'chapters.txt'),...(reuseAudio?['-i',previous]:[]),'-map','0:v:0','-map',reuseAudio?'3:a:0':'0:a:0','-map','1:0','-map_metadata','2','-map_chapters','2','-c:v','copy',...(reuseAudio?['-c:a','copy']:['-af','loudnorm=I=-16:TP=-1.5:LRA=11','-c:a','aac','-b:a','192k','-ar','48000','-ac','2']),'-c:s','mov_text','-metadata:s:s:0','language=eng','-movflags','+faststart',output]);
await fs.writeFile(path.join(out,'timeline.json'),JSON.stringify({width:W,height:H,fps,duration:clock,chapters},null,2));
const validation=await probe(output);await fs.writeFile(path.join(out,'video-validation.json'),JSON.stringify(validation,null,2));
await fs.writeFile(path.join(out,'narration.txt'),scenes.map(s=>s.title+'\n\n'+s.text).join('\n\n'));
console.log(JSON.stringify({output,duration:validation.format.duration,bytes:validation.format.size,streams:validation.streams.map(s=>({type:s.codec_type,codec:s.codec_name,width:s.width,height:s.height,sampleRate:s.sample_rate,channels:s.channels}))}));
