export const examples = {
  arithmetic:{prompt:'What is 7 multiplied by 6? Reply with just the number.',expected:'42'},
  greeting:{prompt:'Translate Hello into Spanish. Reply with just the translated word.',expected:'Hola'}
};

export function validatePrompt(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('EMPTY_PROMPT · Enter a question before starting the query.');
  const prompt = value.trim();
  if (prompt.length > 2000) throw new Error('PROMPT_TOO_LONG · Use at most 2000 characters for this first-query lab.');
  return prompt;
}
