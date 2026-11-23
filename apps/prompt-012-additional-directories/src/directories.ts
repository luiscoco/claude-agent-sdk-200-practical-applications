import path from 'node:path';
import { readFile, realpath, stat } from 'node:fs/promises';

export const root=path.resolve(import.meta.dirname,'..');
export async function directoryConfiguration(grantShared:boolean,loadProjectSettings:boolean){
  if(typeof grantShared!=='boolean'||typeof loadProjectSettings!=='boolean')throw new Error('Choose both configuration options explicitly.');
  const cwd=await realpath(path.join(root,'fixtures/project'));
  const shared=await realpath(path.join(root,'fixtures/shared'));
  const fixtures=await Promise.all(['project/README.md','shared/prices.txt','private/notes.txt'].map(async file=>{
    const absolute=await realpath(path.join(root,'fixtures',file));
    const exists=(await stat(absolute)).isFile();
    return {file,absolute,exists};
  }));
  return {cwd,additionalDirectories:grantShared?[shared]:[],settingSources:loadProjectSettings?['project' as const]:[],fixtures};
}

export async function fixtureContent(file:string){
  return readFile(path.join(root,'fixtures',file),'utf8');
}
