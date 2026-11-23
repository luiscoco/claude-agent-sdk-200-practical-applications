/** The application verifies arithmetic independently of the language model. */
export interface Statistics { count: number; total: number; min: number; max: number }

export class LessonError extends Error {
  constructor(public code: string, message: string, public line?: number) {
    super(message); this.name = 'LessonError';
  }
}

export function parseNumbers(text: string): number[] {
  if (Buffer.byteLength(text, 'utf8') > 16_384) throw new LessonError('INPUT_TOO_LARGE', 'Use a small classroom file, at most 16 KB.');
  const values: number[] = [];
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const value = raw.trim();
    if (!value) continue;
    if (!/^[+-]?\d+$/.test(value)) throw new LessonError('INVALID_NUMBER', `Line ${index + 1}: “${value.slice(0,45)}” is not an integer.`, index + 1);
    const number = Number(value);
    if (!Number.isSafeInteger(number)) throw new LessonError('UNSAFE_INTEGER', `Line ${index + 1}: this integer is outside JavaScript's safe range.`, index + 1);
    values.push(number);
  }
  if (!values.length) throw new LessonError('EMPTY_INPUT', 'Add at least one integer, one per line.');
  if (values.length > 50) throw new LessonError('TOO_MANY_VALUES', 'This teaching example accepts at most 50 numbers.');
  return values;
}

export function calculateStatistics(values: number[]): Statistics {
  if (!values.length) throw new LessonError('EMPTY_INPUT', 'No numbers to calculate.');
  let total = 0;
  for (const value of values) {
    if (!Number.isSafeInteger(value) || !Number.isSafeInteger(total + value)) throw new LessonError('UNSAFE_TOTAL', 'The calculation exceeds the safe integer range.');
    total += value;
  }
  return { count: values.length, total, min: Math.min(...values), max: Math.max(...values) };
}

export function validateModelResult(raw: unknown, expected: Statistics): Statistics {
  if (!raw || typeof raw !== 'object') throw new LessonError('INVALID_MODEL_RESULT', 'The model did not return a statistics object.');
  const candidate = raw as Record<string, unknown>;
  for (const key of ['count', 'total', 'min', 'max'] as const) {
    if (typeof candidate[key] !== 'number' || !Number.isSafeInteger(candidate[key])) throw new LessonError('INVALID_MODEL_RESULT', `The model's ${key} must be a safe integer.`);
    if (candidate[key] !== expected[key]) throw new LessonError('RESULT_MISMATCH', `Verification rejected ${key}: model returned ${candidate[key]}, independently calculated ${expected[key]}.`);
  }
  return { ...expected };
}
