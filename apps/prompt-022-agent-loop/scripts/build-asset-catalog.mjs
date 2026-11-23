import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const workspace=path.resolve(import.meta.dirname,'../../..');
const catalog=JSON.parse(await fs.readFile(path.join(workspace,'output/infographics/catalog.json'),'utf8'));
const selected=JSON.parse(await fs.readFile(path.join(workspace,'output/infographics/series-011-200-manifest.json'),'utf8'));
const entries=[];
for(const item of catalog){
 let image=selected.find(s=>s.number===item.number)?.image;
 if(!image){const prefix=`prompt-${String(item.number).padStart(2,'0')}-`;const files=(await fs.readdir(path.join(workspace,'output/infographics'))).filter(f=>f.startsWith(prefix)&&f.endsWith('.png'));if(files.length!==1)throw Error('Ambiguous original asset for '+item.number);image='output/infographics/'+files[0];}
 const buffer=await fs.readFile(path.join(workspace,image));
 entries.push({...item,image,sha256:createHash('sha256').update(buffer).digest('hex'),implementation:item.number===22?'course-labs/prompt-022-agent-loop':null,status:item.number===22?'pilot implemented; instructor review pending':'planned'});
}
if(entries.length!==200||new Set(entries.map(e=>e.number)).size!==200)throw Error('Expected exactly 200 unique prompt assets');
await fs.writeFile(path.join(workspace,'course-labs/asset-catalog.json'),JSON.stringify({generatedAt:new Date().toISOString(),assets:entries},null,2));
console.log('Catalogued 200 original infographics with SHA-256 hashes.');
