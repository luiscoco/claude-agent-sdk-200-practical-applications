import 'dotenv/config';
import { runApproval } from './agent.js';
import { ClassroomQuestions, answerSchema } from './questions.js';

const questions = new ClassroomQuestions();
const controller = new AbortController();
let answerTimer: ReturnType<typeof setInterval> | undefined;
try {
  const topic = process.argv[3] || 'MCP';
  const action = process.argv[2] || 'allow';
  const answer = answerSchema.parse(
    action === 'revise'
      ? { action, content: process.argv[4] || `Reviewed ${topic} classroom note.\n` }
      : { action },
  );
  answerTimer = setInterval(() => {
    const pending = questions.current();
    if (pending) questions.answer(pending.id, answer);
  }, 50);
  const report = await runApproval(questions, controller, { topic });
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified) process.exitCode = 1;
} catch (error) {
  let message = error instanceof Error ? error.message : 'Approval callback demonstration failed.';
  if (process.env.ANTHROPIC_API_KEY)
    message = message.replaceAll(process.env.ANTHROPIC_API_KEY, '[REDACTED]');
  console.error(message);
  process.exitCode = 1;
} finally {
  clearInterval(answerTimer);
  controller.abort();
  questions.cancel();
}
