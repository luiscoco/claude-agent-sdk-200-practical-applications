export function configuredTools(mode: unknown) {
  if (mode !== 'scoped' && mode !== 'none')
    throw new Error('INVALID_MODE · Select scoped tools or an empty tool set.');
  return mode === 'scoped' ? ['Read', 'Glob', 'Grep'] : [];
}
const descriptions: Record<string, string> = {
  Read: 'Read a supplied local source file',
  Glob: 'Locate paths with file patterns',
  Grep: 'Search file contents',
};
export function capabilityReport(availableTools: string[]) {
  return availableTools.map((name) => ({
    name,
    capability: descriptions[name] || 'Available tool reported by native initialization',
  }));
}
export function requireTool(availableTools: string[], requested: string) {
  if (!availableTools.includes(requested))
    throw new Error('TOOL_UNAVAILABLE · Native inventory does not include ' + requested + '.');
  return requested;
}
