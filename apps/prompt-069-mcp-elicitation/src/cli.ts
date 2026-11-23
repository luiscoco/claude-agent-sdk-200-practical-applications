import 'dotenv/config';
import { z } from 'zod';
import { ClassroomQuestions } from './questions.js';
import { runInteraction } from './agent.js';
const settings = z
  .object({
    scenario: z.enum(['accept', 'decline', 'cancel', 'tool-denied']),
    format: z.enum(['brief', 'detailed']),
    topic: z.enum(['MCP', 'Hooks']),
  })
  .parse({
    scenario: process.argv[2] || 'accept',
    format: process.argv[3] || 'brief',
    topic: process.argv[4] || 'MCP',
  });
const questions = new ClassroomQuestions(),
  controller = new AbortController();
const answered = new Set<string>();
const responder = setInterval(() => {
  const question = questions.current();
  if (!question || answered.has(question.id)) return;
  answered.add(question.id);
  if (question.kind === 'agent-clarification')
    questions.answer(question.id, { choice: settings.topic });
  else if (question.kind === 'tool-permission')
    questions.answer(question.id, { approved: settings.scenario !== 'tool-denied' });
  else
    questions.answer(
      question.id,
      settings.scenario === 'decline' || settings.scenario === 'cancel'
        ? { action: settings.scenario }
        : { action: 'accept', format: settings.format },
    );
}, 100);
try {
  const report = await runInteraction(questions, controller);
  console.log(JSON.stringify({ cliClassroomResponses: settings, ...report }, null, 2));
  if (!report.verified) process.exitCode = 1;
} catch (error) {
  let message = error instanceof Error ? error.message : 'Classroom interaction failed.';
  if (process.env.ANTHROPIC_API_KEY)
    message = message.replaceAll(process.env.ANTHROPIC_API_KEY, '[REDACTED]');
  console.error(message);
  process.exitCode = 1;
} finally {
  clearInterval(responder);
  controller.abort();
}
