import 'dotenv/config';
import { runClarification } from './agent.js';
import { ClassroomQuestions } from './questions.js';
import { answerSchema, nativeQuestionSchema } from './clarification.js';
const questions = new ClassroomQuestions(),
  controller = new AbortController();
let timer: ReturnType<typeof setInterval> | undefined;
try {
  const action = process.argv[2] || 'select';
  if (!['select', 'text'].includes(action))
    throw new Error('Choose select or text for the scripted classroom answer.');
  const textAnswer =
    action === 'text'
      ? answerSchema.parse({
          action,
          text: process.argv[5] || 'Focus on testing with a short live demo.',
        })
      : null;
  timer = setInterval(() => {
    const pending = questions.current();
    if (!pending) return;
    const question = nativeQuestionSchema.parse(pending.payload.input).questions[0];
    const labels = question.options
      .slice(0, question.multiSelect ? 2 : 1)
      .map((option) => option.label);
    questions.answer(pending.id, textAnswer || { action: 'select', labels });
  }, 50);
  const report = await runClarification(questions, controller, {
    style: process.argv[3] || 'single',
    topic: process.argv[4] || 'MCP',
  });
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified) process.exitCode = 1;
} catch (error) {
  let message = error instanceof Error ? error.message : 'Native clarification failed.';
  if (process.env.ANTHROPIC_API_KEY)
    message = message.replaceAll(process.env.ANTHROPIC_API_KEY, '[REDACTED]');
  console.error(message);
  process.exitCode = 1;
} finally {
  clearInterval(timer);
  controller.abort();
  questions.cancel();
}
