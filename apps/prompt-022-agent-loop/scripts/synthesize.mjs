import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const out=path.join(root,'recordings/audio');await fs.mkdir(out,{recursive:true});
const lesson=JSON.parse(await fs.readFile(path.join(root,'scripts/lesson-plan.json'),'utf8'));
const key=process.env.INWORLD_API_KEY;if(!key)throw Error('Set INWORLD_API_KEY in the process environment.');
for(const scene of lesson.scenes){
  const file=path.join(out,scene.id+'.mp3');try{if((await fs.stat(file)).size>1000)continue;}catch{}
  const response=await fetch('https://api.inworld.ai/tts/v1/voice',{method:'POST',headers:{Authorization:'Basic '+key,'Content-Type':'application/json'},body:JSON.stringify({...lesson.settings,text:scene.text,timestampType:'WORD'}),signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw Error(`Inworld returned HTTP ${response.status}`);
  const result=await response.json();if(!result.audioContent)throw Error('No audio content returned');
  await fs.writeFile(file,Buffer.from(result.audioContent,'base64'));
  await fs.writeFile(path.join(out,scene.id+'.json'),JSON.stringify({text:scene.text,timestampInfo:result.timestampInfo},null,2));
  console.log('Narrated '+scene.id);
}
await fs.writeFile(path.join(root,'recordings/inworld-settings.json'),JSON.stringify({...lesson.settings,languageOmitted:true},null,2));
