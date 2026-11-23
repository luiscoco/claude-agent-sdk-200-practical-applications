const byId = (id) => document.getElementById(id);
let lastReport;
function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}
async function source(file = 'src/agent.ts') {
  const response = await fetch('/api/source?file=' + encodeURIComponent(file));
  if (!response.ok) throw new Error('Source unavailable.');
  const data = await response.json();
  byId('source-title').textContent = data.file;
  byId('files').replaceChildren();
  byId('source').replaceChildren();
  for (const name of data.files) {
    const button = element('button', name);
    button.className = 'secondary';
    button.onclick = () => source(name);
    byId('files').append(button);
  }
  data.content.split('\n').forEach((line, index) => {
    const row = element('span', line || ' ');
    row.className = 'code-line';
    row.dataset.line = index + 1;
    byId('source').append(row);
  });
}
async function showView(name) {
  document
    .querySelectorAll('.view')
    .forEach((view) => view.classList.toggle('hidden', view.id !== name + '-view'));
  document
    .querySelectorAll('[data-view]')
    .forEach((button) => button.classList.toggle('active', button.dataset.view === name));
  if (name === 'source') await source();
}
document
  .querySelectorAll('[data-view]')
  .forEach((button) => (button.onclick = () => showView(button.dataset.view)));

let jobId = '',
  lastJob,
  currentQuestionId = '',
  watching = false,
  polling = false;
const answeredQuestionIds = new Set();
function showError(message) {
  byId('error').textContent = message;
  byId('error').classList.toggle('hidden', !message);
}
function resetResult() {
  lastReport = undefined;
  for (const id of ['handler-result', 'native-result-value', 'final-result', 'execution-count'])
    byId(id).textContent = '—';
  for (const id of [
    'handler',
    'native-result',
    'final-output',
    'checks',
    'provenance',
    'evidence',
    'tool-results',
    'metadata',
  ])
    byId(id).textContent = 'Awaiting the actual classroom interaction.';
  byId('download').classList.add('hidden');
}
async function submitAnswer(answer) {
  const questionId = currentQuestionId;
  for (const button of byId('question-controls').querySelectorAll('button,select,textarea,input'))
    button.disabled = true;
  try {
    const response = await fetch('/api/jobs/' + jobId + '/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, answer }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    showError('');
    answeredQuestionIds.add(questionId);
    currentQuestionId = '';
    byId('question-panel').classList.add('hidden');
    byId('progress').textContent =
      'Answer submitted. Waiting for the next actual native callback or SDK result.';
  } catch (error) {
    showError(error.message);
    for (const control of byId('question-controls').querySelectorAll(
      'button,select,textarea,input',
    ))
      control.disabled = false;
  }
}
function answerButton(id, label, answer, primary = false) {
  const button = element('button', label);
  button.id = id;
  button.className = primary ? 'primary' : 'secondary';
  button.onclick = () => submitAnswer(typeof answer === 'function' ? answer() : answer);
  byId('question-controls').append(button);
}
function displayQuestion(question) {
  if (!question) {
    currentQuestionId = '';
    byId('question-panel').classList.add('hidden');
    return;
  }
  byId('question-panel').classList.remove('hidden');
  if (currentQuestionId === question.id) return;
  currentQuestionId = question.id;
  const payload = question.payload,
    native = payload.input.questions[0];
  byId('question-controls').replaceChildren();
  byId('question-kind').textContent = native.header + ' · AskUserQuestion';
  byId('question-message').textContent = native.question;
  byId('question-schema').textContent = JSON.stringify(
    { toolName: payload.toolName, toolUseId: payload.toolUseId, multiSelect: native.multiSelect },
    null,
    2,
  );
  for (const [index, option] of native.options.entries()) {
    const text = option.label + ' · ' + option.description;
    if (native.multiSelect) {
      const label = element('label', text);
      label.className = 'option-choice';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = 'choice-' + index;
      input.value = option.label;
      input.dataset.option = 'true';
      label.prepend(input);
      byId('question-controls').append(label);
    } else
      answerButton('choice-' + index, text, { action: 'select', labels: [option.label] }, true);
  }
  if (native.multiSelect)
    answerButton(
      'submit-options',
      'Submit selected options',
      () => ({
        action: 'select',
        labels: Array.from(
          byId('question-controls').querySelectorAll('input[data-option]:checked'),
        ).map((input) => input.value),
      }),
      true,
    );
  const label = element('label', 'Free-text answer');
  label.className = 'revise-editor';
  const editor = document.createElement('textarea');
  editor.id = 'free-answer';
  editor.maxLength = 1000;
  editor.value = 'Focus on testing with a short live demo.';
  label.append(editor);
  byId('question-controls').append(label);
  answerButton('submit-text', 'Submit free-text answer', () => ({
    action: 'text',
    text: editor.value,
  }));
}
function displayReport(report) {
  lastReport = report;
  showError(report.error || '');
  const event = report.callbackEvents[0],
    question = event?.originalInput.questions[0];
  byId('handler-result').textContent = report.callbackEvents.length;
  byId('native-result-value').textContent = event?.answer.action || '—';
  byId('final-result').textContent =
    event?.answer.action === 'select' ? event.answer.labels.length : 0;
  byId('execution-count').textContent = String(Boolean(question?.multiSelect));
  byId('handler').textContent = JSON.stringify(
    question
      ? {
          question: question.question,
          optionLabels: question.options.map((option) => option.label),
          multiSelect: question.multiSelect,
        }
      : null,
    null,
    2,
  );
  byId('native-result').textContent = JSON.stringify(
    {
      answers: event?.updatedInput.answers,
      originalQuestionsPreserved: report.checks.originalQuestionsPreserved,
      nativeAccepted: report.checks.nativeAnswerAccepted,
      modelEchoExact: report.modelEchoExact,
    },
    null,
    2,
  );
  byId('final-output').textContent = JSON.stringify(report.output, null, 2);
  byId('checks').textContent = JSON.stringify(report.checks, null, 2);
  byId('provenance').textContent =
    'The callback preserves the original native questions array and maps the actual question text to selected labels or the exact custom answer.';
  byId('evidence').textContent = JSON.stringify(
    {
      callbackEvents: report.callbackEvents,
      questionHistory: report.questions,
      modelOutput: report.modelOutput,
      modelEchoExact: report.modelEchoExact,
    },
    null,
    2,
  );
  byId('tool-results').textContent = JSON.stringify(
    { calls: report.calls, nativeResults: report.results, argumentHook: report.observedRequests },
    null,
    2,
  );
  byId('metadata').textContent = JSON.stringify(
    {
      checkedAt: report.checkedAt,
      nativeSessionId: report.sessionId,
      resultStatus: report.resultStatus,
    },
    null,
    2,
  );
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
}
function displayJob(job) {
  lastJob = job;
  const active = job.status === 'running' || job.status === 'cancelling';
  watching = active;
  byId('start').disabled = active;
  byId('topic').disabled = active;
  byId('style').disabled = active;
  byId('style').value = job.requestedInput.style;
  byId('topic').value = job.requestedInput.topic;
  byId('cancel-run').disabled = !active;
  const pending = job.pending && !answeredQuestionIds.has(job.pending.id) ? job.pending : null;
  displayQuestion(pending);
  if (job.report && lastReport?.id !== job.report.id) displayReport(job.report);
  byId('status').textContent = pending
    ? 'Awaiting ' + pending.kind
    : job.report?.verified
      ? 'Clarification verified'
      : job.status;
  byId('status').className = 'badge ' + (job.report?.verified ? 'passed' : '');
  byId('progress').textContent = pending
    ? 'Answer the actual native request shown below.'
    : active
      ? 'Waiting for the real model and native question response.'
      : 'Inspect the actual question, answer mapping and recorded native answer.';
  if (job.error) showError(job.error);
}
async function loadJob(id) {
  const response = await fetch('/api/jobs/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved classroom run unavailable.');
  const job = await response.json();
  if (jobId !== id) return;
  displayJob(job);
  return job;
}
async function restore(id) {
  jobId = id;
  resetResult();
  return loadJob(id);
}
byId('start').onclick = async () => {
  byId('start').disabled = true;
  byId('topic').disabled = true;
  byId('style').disabled = true;
  showError('');
  resetResult();
  jobId = '';
  lastJob = undefined;
  watching = false;
  try {
    const response = await fetch('/api/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: byId('topic').value, style: byId('style').value }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    jobId = result.id;
    watching = true;
    byId('cancel-run').disabled = false;
    byId('status').textContent = 'Starting actual SDK query';
    byId('progress').textContent = 'Waiting for the actual native AskUserQuestion callback.';
  } catch (error) {
    showError(error.message);
    byId('start').disabled = false;
    byId('topic').disabled = false;
    byId('style').disabled = false;
  }
};
byId('cancel-run').onclick = async () => {
  try {
    const response = await fetch('/api/jobs/' + jobId + '/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!response.ok) throw new Error('Unable to cancel this classroom run.');
    byId('cancel-run').disabled = true;
    watching = true;
  } catch (error) {
    showError(error.message);
  }
};
setInterval(async () => {
  if (!watching || polling || !jobId) return;
  polling = true;
  const id = jobId;
  try {
    await loadJob(id);
  } catch (error) {
    showError(error.message);
  } finally {
    polling = false;
  }
}, 350);
window.lesson = { showView, source, restore, report: () => lastReport, job: () => lastJob };
byId('facts').textContent =
  'Native input · model-generated AskUserQuestion with original question and options\nSelection · actual option labels, one or multiple as requested\nFree text · exact custom answer mapped to the actual question text\nResponse · original questions array and answers returned through updatedInput';
try {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Classroom state unavailable.');
  const config = await response.json();
  byId('status').textContent = 'Ready';
  byId('progress').textContent =
    'Start a real native question and answer with selections or free text.';
  if (config.activeJobId || config.latestJobId) {
    jobId = config.activeJobId || config.latestJobId;
    watching = true;
    await loadJob(jobId);
  }
} catch (error) {
  showError(error.message);
}
