import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const blockedDirectory=new Set(['node_modules','runs','recordings','.venv','venv','__pycache__','test-results','playwright-report','.aws','.azure','.foundry']);
const blockedFile=/\.(?:mp4|mov|mkv|avi|webm|mp3|wav|m4a|flac|zip|7z|rar|tar|gz|exe|dll|pem|key|p12|pfx|pyc|log)$/i;
const secret=/sk-ant-[A-Za-z0-9_-]{15,}|(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/;
const issues=[],files=[];
async function scan(directory){for(const entry of await fs.readdir(directory,{withFileTypes:true})){
 if(entry.name==='.git')continue;
 const file=path.join(directory,entry.name),relative=path.relative(root,file).replaceAll('\\','/');
 if(entry.isSymbolicLink()){issues.push({file:relative,reason:'symlink must be reviewed'});continue}
 if(blockedDirectory.has(entry.name)||entry.name==='.claude'&&!relative.includes('/fixtures/')||blockedFile.test(entry.name)||entry.name==='.env'||entry.name.startsWith('.env.')&&entry.name!=='.env.example'||/credentials\.json$/i.test(entry.name)){issues.push({file:relative,reason:'private/generated/media file'});continue}
 if(entry.isDirectory()){await scan(file);continue}
 const bytes=await fs.readFile(file);if(bytes.length>5*1024*1024)issues.push({file:relative,reason:'over 5 MiB'});
 if(!/\.(png|jpe?g|webp|gif|ico|pdf|woff2?|ttf)$/i.test(entry.name)){
  const content=bytes.toString('utf8');if(secret.test(content))issues.push({file:relative,reason:'credential-like content'});
  if(/C:(?:\\+|\/)Users(?:\\+|\/)luisc|C:(?:\\+|\/)Claude Agent SDK Master/i.test(content))issues.push({file:relative,reason:'private absolute workspace path'});
 }
 files.push({file:relative,bytes:bytes.length});
}}
await scan(root);
const catalog=JSON.parse(await fs.readFile(path.join(root,'docs/prompt-catalog.json'),'utf8'));
const apps=(await fs.readdir(path.join(root,'apps'))).filter(name=>/^prompt-\d+-/.test(name));
const ids=apps.map(name=>Number(/^prompt-(\d+)-/.exec(name)[1]));
if(apps.length!==200||new Set(ids).size!==200||Array.from({length:200},(_,i)=>i+1).some(number=>!ids.includes(number)))issues.push({reason:'expected every prompt from 1 through 200 exactly once'});
for(const lesson of catalog.lessons){
 for(const directory of ['src','public'])try{await fs.access(path.join(root,lesson.path,directory))}catch{issues.push({file:lesson.path+'/'+directory,reason:'required directory missing'})}
 try{await fs.access(path.join(root,lesson.path,'README.md'))}catch{issues.push({file:lesson.path,reason:'README missing'})}
 try{const pkg=JSON.parse(await fs.readFile(path.join(root,lesson.path,'package.json'),'utf8'));const lock=JSON.parse(await fs.readFile(path.join(root,lesson.path,'package-lock.json'),'utf8'));if(pkg.name!==lock.name)issues.push({file:lesson.path,reason:'package/lock name mismatch'})}catch(error){if(lesson.runtime==='Node.js')issues.push({file:lesson.path,reason:'Node package/lock missing or malformed'})}
}
for(const file of ['README.md','docs/PROMPT_INDEX.md']){
 const content=await fs.readFile(path.join(root,file),'utf8');
 for(const match of content.matchAll(/\]\(([^)]+)\)/g)){const href=match[1];if(/^https?:|^#/.test(href))continue;try{await fs.access(path.resolve(root,path.dirname(file),href.split('#')[0]))}catch{issues.push({file,reason:'broken link: '+href})}}
}
const summary={passed:issues.length===0,applications:apps.length,files:files.length,totalBytes:files.reduce((sum,row)=>sum+row.bytes,0),largestFileBytes:Math.max(...files.map(row=>row.bytes)),issues};
console.log(JSON.stringify(summary,null,2));if(issues.length)process.exitCode=1;
