import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
export async function skill(name: string, body: string, frontmatter = '', scope: 'project' | 'user' = 'project') {
  const directory = scope === 'project' ? path.join(process.env.LAB_WORKSPACE!, '.claude/skills', name)
    : path.join(process.env.CLAUDE_CONFIG_DIR!, 'skills', name);
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, 'SKILL.md');
  await writeFile(file, `---\nname: ${name}\ndescription: Owned classroom queue-formatting skill ${name}.\n${frontmatter}---\n${body}\n`);
  return { directory, file };
}
export async function plugin(name: string) {
  const directory = path.join(process.env.LAB_WORKSPACE!, 'plugins', name);
  await mkdir(path.join(directory, '.claude-plugin'), { recursive: true });
  await writeFile(path.join(directory, '.claude-plugin/plugin.json'), JSON.stringify({ name, version: '1.0.0', description: 'Owned classroom plugin' }));
  await mkdir(path.join(directory, 'skills/greet'), { recursive: true });
  await writeFile(path.join(directory, 'skills/greet/SKILL.md'), `---\nname: greet\ndescription: Return an exact classroom greeting.\n---\nReturn only ${name.toUpperCase()}_GREETING followed by any supplied argument.\n`);
  return directory;
}
