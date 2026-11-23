import path from 'node:path';
import type {SettingSource} from '@anthropic-ai/claude-agent-sdk';

export const root=path.resolve(import.meta.dirname,'..');
export const configHome=path.join(root,'fixtures/user-config');
process.env.CLAUDE_CONFIG_DIR=configHome;

const modes:Record<string,SettingSource[]|undefined>={
  default:undefined,
  user:['user'],
  project:['project'],
  local:['local'],
  team:['user','project'],
  all:['user','project','local'],
  off:[]
};

export function sourcesFor(mode:string){
  if(!Object.hasOwn(modes,mode))throw new Error('INVALID_SOURCE_SELECTION · Select one of the provided setting-source modes.');
  return modes[mode];
}

export async function inspectSettings(mode:string){
  const selection=sourcesFor(mode);
  const cwd=path.join(root,'fixtures/project');
  const {resolveSettings}=await import('@anthropic-ai/claude-agent-sdk');
  const options=selection===undefined?{cwd}:{cwd,settingSources:selection};
  const resolved=await resolveSettings(options);
  const cleanupPeriodDays=resolved.effective.cleanupPeriodDays??null;
  const origin=resolved.effective.env?.LESSON_SETTING_ORIGIN??null;
  const provenance=resolved.provenance.cleanupPeriodDays??null;
  const sources=resolved.sources.map(source=>({
    source:source.source,
    path:source.path??null,
    cleanupPeriodDays:source.settings.cleanupPeriodDays??null,
    origin:source.settings.env?.LESSON_SETTING_ORIGIN??null
  }));
  return {mode,selection:selection??null,optionOmitted:selection===undefined,cwd,configHome,cleanupPeriodDays,origin,provenance,sources,sdkApi:'resolveSettings',sdkVersion:'0.3.322',checkedAt:new Date().toISOString()};
}
