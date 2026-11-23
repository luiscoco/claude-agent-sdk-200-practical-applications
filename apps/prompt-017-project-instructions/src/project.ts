import path from 'node:path';
import {readFile, realpath} from 'node:fs/promises';

export const root = path.resolve(import.meta.dirname, '..');
export const projectDirectory = path.join(root, 'fixtures/project');
const targets = {
  typescript: {file:'src/component-request.ts', title:'Learning dashboard', identifier:'learningDashboardWidget', ruleApplies:true},
  documentation: {file:'docs/guide.md', title:'Student guide', identifier:'studentGuide', ruleApplies:false}
};

export async function selectedTarget(name: string) {
  if (!Object.hasOwn(targets, name)) throw new Error('INVALID_TARGET · Select the TypeScript or documentation fixture.');
  const target = targets[name as keyof typeof targets];
  return {...target, absolute:await realpath(path.join(projectDirectory, target.file))};
}

export async function expectedMarkers(loadProjectSettings: boolean, ruleApplies: boolean) {
  const project = await readFile(path.join(projectDirectory, 'CLAUDE.md'), 'utf8');
  const rule = await readFile(path.join(projectDirectory, '.claude/rules/typescript.md'), 'utf8');
  return {
    projectMarker: loadProjectSettings ? project.match(/projectMarker is (\S+)/)?.[1] ?? 'UNKNOWN' : 'UNKNOWN',
    ruleMarker: loadProjectSettings && ruleApplies ? rule.match(/ruleMarker is (\S+)/)?.[1] ?? 'UNKNOWN' : 'UNKNOWN'
  };
}
