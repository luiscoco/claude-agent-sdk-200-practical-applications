export const sourceDomains = ['code.claude.com', 'platform.claude.com'];
export const defaultQuestion =
  'Claude Agent SDK TypeScript query outputFormat structured output official documentation';
export const researchSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    findings: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          summary: { type: 'string', minLength: 1, maxLength: 300 },
          sourceUrls: { type: 'array', minItems: 1, maxItems: 2, items: { type: 'string' } },
        },
        required: ['summary', 'sourceUrls'],
      },
    },
    note: { type: 'string', maxLength: 240 },
  },
  required: ['findings', 'note'],
};
export type Hit = { title: string; url: string };
export type Finding = { summary: string; sourceUrls: string[] };
export function validatedQuestion(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 200)
    throw new Error('INVALID_QUESTION · Enter between 1 and 200 characters.');
  return value.trim();
}
export function sourceUrl(value: unknown) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      sourceDomains.includes(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function actualSearch(response: unknown) {
  const value = response as {
    query?: unknown;
    durationSeconds?: unknown;
    searchCount?: unknown;
    results?: Array<
      string | { tool_use_id: string; content: Array<{ title: string; url: string }> }
    >;
  } | null;
  const hits: Hit[] = [];
  if (Array.isArray(value?.results))
    for (const result of value.results) {
      if (typeof result === 'string' || !Array.isArray(result?.content)) continue;
      for (const hit of result.content)
        if (typeof hit?.title === 'string' && typeof hit.url === 'string')
          hits.push({ title: hit.title, url: hit.url });
    }
  return {
    query: value?.query ?? null,
    durationSeconds: value?.durationSeconds ?? null,
    searchCount: value?.searchCount ?? null,
    hits,
  };
}
export function verifyFindings(value: unknown, hits: Hit[]) {
  const candidate = value as { findings?: unknown; note?: unknown } | null;
  if (
    !candidate ||
    !Array.isArray(candidate.findings) ||
    candidate.findings.length > 3 ||
    typeof candidate.note !== 'string' ||
    candidate.note.length > 240
  )
    return {
      valid: false,
      findings: [] as Finding[],
      note: '',
      checks: ['STRUCTURE_INVALID · Inspect the actual structured output.'],
    };
  const known = new Set(hits.map((hit) => sourceUrl(hit.url)).filter(Boolean));
  const checks: string[] = [];
  const findings: Finding[] = [];
  for (const entry of candidate.findings) {
    if (
      typeof entry?.summary !== 'string' ||
      !entry.summary.trim() ||
      entry.summary.length > 300 ||
      !Array.isArray(entry.sourceUrls) ||
      entry.sourceUrls.length < 1 ||
      entry.sourceUrls.length > 2
    ) {
      checks.push(
        'FINDING_INVALID · A finding requires a brief summary and one or two source URLs.',
      );
      continue;
    }
    if (entry.sourceUrls.some((url: unknown) => !sourceUrl(url) || !known.has(sourceUrl(url)))) {
      checks.push(
        'SOURCE_NOT_OBSERVED · A citation must match an actual approved-domain search hit.',
      );
      continue;
    }
    findings.push({ summary: entry.summary, sourceUrls: entry.sourceUrls });
  }
  return { valid: checks.length === 0, findings, note: candidate.note, checks };
}
