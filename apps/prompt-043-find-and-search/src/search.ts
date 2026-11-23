import { z } from 'zod';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
export const SearchSchema = z.strictObject({
  files: z.array(z.string()),
  matches: z.array(
    z.strictObject({ file: z.string(), line: z.number().int().min(1), code: z.string() }),
  ),
  summary: z.string().min(1),
  error: z.string(),
});
export const jsonSchema = z.toJSONSchema(SearchSchema, { target: 'draft-7' });
export function prepareSearch(mode: unknown) {
  if (mode !== 'matches' && mode !== 'no-results' && mode !== 'invalid-regex')
    throw new Error('INVALID_MODE · Select matching, empty or malformed-regex search.');
  const pattern =
    mode === 'matches'
      ? 'validateDiscount|MAX_DISCOUNT_CENTS'
      : mode === 'no-results'
        ? 'NO_SUCH_DISCOUNT_SYMBOL'
        : '[';
  return { mode, pattern, glob: '**/*.ts' };
}
export async function projectSnapshot(directory: string, pattern: string) {
  const names = (await readdir(directory, { recursive: true }))
    .filter((name) => name.endsWith('.ts'))
    .map((name) => name.replaceAll('\\', '/'))
    .sort();
  const files = await Promise.all(
    names.map(async (name) => ({
      name,
      lines: (await readFile(path.join(directory, name), 'utf8')).split(/\r?\n/),
    })),
  );
  const regex = pattern === '[' ? null : new RegExp(pattern);
  const matches = files.flatMap((file) =>
    file.lines.flatMap((code, index) =>
      regex?.test(code) ? [{ file: file.name, line: index + 1, code }] : [],
    ),
  );
  return { files, matches };
}
export function normalizeSearch(data: z.infer<typeof SearchSchema>, projectDirectory: string) {
  function relativeFile(file: string) {
    const relative = path.isAbsolute(file) ? path.relative(projectDirectory, file) : file;
    return path.posix.normalize(relative.replaceAll('\\', '/')).replace(/^fixtures\/project\//, '');
  }
  return {
    ...data,
    files: data.files.map(relativeFile),
    matches: data.matches.map((match) => ({ ...match, file: relativeFile(match.file) })),
  };
}
export function verifySearch(
  data: z.infer<typeof SearchSchema>,
  snapshot: Awaited<ReturnType<typeof projectSnapshot>>,
  projectDirectory: string,
) {
  const normalized = normalizeSearch(data, projectDirectory);
  const reportedFiles = [...normalized.files].sort();
  const actualFiles = snapshot.files.map((file) => file.name);
  const filesMatched = JSON.stringify(reportedFiles) === JSON.stringify(actualFiles);
  const actualMatches = snapshot.matches.map((match) => ({
    file: match.file,
    line: match.line,
    code: match.code.trim(),
  }));
  const reportedMatches = normalized.matches.map((match) => ({
    file: match.file,
    line: match.line,
    code: match.code.trim(),
  }));
  const sort = (matches: typeof actualMatches) =>
    matches.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  const matchesMatched =
    JSON.stringify(sort(reportedMatches)) === JSON.stringify(sort(actualMatches));
  return { filesMatched, matchesMatched };
}

export function searchOutcome(
  calls: Array<{ id: string; name: string }>,
  results: Array<{ toolUseId: string; isError: boolean }>,
) {
  const grepCalls = calls.filter((call) => call.name === 'Grep');
  const finalResult = results.find((result) => result.toolUseId === grepCalls.at(-1)?.id);
  return {
    searchCompleted: Boolean(finalResult),
    searchFailed: Boolean(finalResult?.isError),
    hadSearchError: results.some(
      (result) => result.isError && grepCalls.some((call) => call.id === result.toolUseId),
    ),
  };
}
