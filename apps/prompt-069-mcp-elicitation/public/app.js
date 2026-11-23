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
  for (const button of byId('question-controls').querySelectorAll('button,select'))
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
    for (const control of byId('question-controls').querySelectorAll('button,select'))
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
  byId('question-controls').replaceChildren();
  const payload = question.payload;
  if (question.kind === 'agent-clarification') {
    byId('question-kind').textContent = 'Agent clarification · AskUserQuestion';
    byId('question-message').textContent = payload.questions[0].question;
    byId('question-schema').textContent = JSON.stringify(
      { toolName: payload.toolName, toolUseId: payload.toolUseId },
      null,
      2,
    );
    for (const option of payload.questions[0].options)
      answerButton(
        'topic-' + option.label.toLowerCase(),
        option.label + (option.description ? ' · ' + option.description : ''),
        { choice: option.label },
        true,
      );
  } else if (question.kind === 'tool-permission') {
    byId('question-kind').textContent = 'Tool approval · canUseTool';
    byId('question-message').textContent = 'Approve this actual classroom tool invocation?';
    byId('question-schema').textContent = JSON.stringify(payload, null, 2);
    answerButton('approve-tool', 'Approve actual tool call', { approved: true }, true);
    answerButton('deny-tool', 'Deny actual tool call', { approved: false });
  } else {
    byId('question-kind').textContent = 'MCP server form · onElicitation';
    byId('question-message').textContent = payload.message;
    byId('question-schema').textContent = JSON.stringify(
      {
        serverName: payload.serverName,
        mode: payload.mode,
        requestedSchema: payload.requestedSchema,
      },
      null,
      2,
    );
    const label = element(
      'label',
      payload.requestedSchema.properties.format.title || 'Report format',
    );
    const select = document.createElement('select');
    select.id = 'format';
    for (const value of payload.requestedSchema.properties.format.enum) {
      const option = element('option', value);
      option.value = value;
      select.append(option);
    }
    label.append(select);
    byId('question-controls').append(label);
    answerButton(
      'accept-elicitation',
      'Submit requested form',
      () => ({ action: 'accept', format: byId('format').value }),
      true,
    );
    answerButton('decline-elicitation', 'Decline server request', { action: 'decline' });
    answerButton('cancel-elicitation', 'Cancel server request', { action: 'cancel' });
  }
}
function displayReport(report) {
  lastReport = report;
  byId('handler-result').textContent = report.callbackEvents.filter(
    (event) => event.kind === 'agent-clarification',
  ).length;
  byId('native-result-value').textContent = report.callbackEvents.filter(
    (event) => event.kind === 'tool-permission',
  ).length;
  byId('final-result').textContent = report.callbackEvents.filter(
    (event) => event.kind === 'mcp-elicitation',
  ).length;
  byId('execution-count').textContent = report.events.filter(
    (event) => event.event === 'handler-started',
  ).length;
  byId('handler').textContent = JSON.stringify(
    report.questions.map((question) => ({
      kind: question.kind,
      status: question.status,
      answer: question.answer ?? null,
    })),
    null,
    2,
  );
  byId('native-result').textContent = JSON.stringify(
    {
      nativeStatus: report.nativeServerStatus.map((server) => ({
        name: server.name,
        status: server.status,
      })),
      chosenTopic: report.chosenTopic,
      toolApproved: report.toolApproved,
      callbacks: report.callbackEvents.map((event) => event.kind),
    },
    null,
    2,
  );
  byId('final-output').textContent = JSON.stringify(report.output, null, 2);
  byId('checks').textContent = JSON.stringify(report.checks, null, 2);
  byId('provenance').textContent =
    'Request history preserves actual native callback payloads and the classroom answers submitted to each request.';
  byId('evidence').textContent = JSON.stringify(
    { callbackEvents: report.callbackEvents, serverEvents: report.events },
    null,
    2,
  );
  byId('tool-results').textContent = JSON.stringify(
    { calls: report.calls, nativeResults: report.results },
    null,
    2,
  );
  byId('metadata').textContent = JSON.stringify(
    {
      checkedAt: report.checkedAt,
      nativeSessionId: report.sessionId,
      resultStatus: report.resultStatus,
      scenarioVerified: report.verified,
    },
    null,
    2,
  );
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
  showError(report.error || '');
}
function displayJob(job) {
  lastJob = job;
  const active = job.status === 'running' || job.status === 'cancelling';
  watching = active;
  byId('start').disabled = active;
  byId('cancel-run').disabled = !active;
  const pending = job.pending && !answeredQuestionIds.has(job.pending.id) ? job.pending : null;
  displayQuestion(pending);
  if (job.report && lastReport?.id !== job.report.id) displayReport(job.report);
  byId('status').textContent = pending
    ? 'Awaiting ' + pending.kind
    : job.report?.verified
      ? 'Interaction verified'
      : job.status;
  byId('status').className = 'badge ' + (job.report?.verified ? 'passed' : '');
  byId('progress').textContent = pending
    ? 'Answer the actual native request shown below.'
    : active
      ? 'Waiting for the real model or server response.'
      : 'Inspect the completed native callbacks, handler events and structured outcome.';
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
  showError('');
  resetResult();
  jobId = '';
  lastJob = undefined;
  watching = false;
  try {
    const response = await fetch('/api/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    jobId = result.id;
    watching = true;
    byId('cancel-run').disabled = false;
    byId('status').textContent = 'Starting actual SDK query';
    byId('progress').textContent = 'Waiting for the actual agent clarification request.';
  } catch (error) {
    showError(error.message);
    byId('start').disabled = false;
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
  'Agent clarification · native AskUserQuestion\nTool approval · native canUseTool callback\nServer form input · native onElicitation callback\nData source · synthetic classroom topics and report formats';
try {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Classroom state unavailable.');
  const config = await response.json();
  byId('status').textContent = 'Ready';
  byId('progress').textContent =
    'Start a real interaction and answer its three actual input stages.';
  if (config.activeJobId || config.latestJobId) {
    jobId = config.activeJobId || config.latestJobId;
    watching = true;
    await loadJob(jobId);
  }
} catch (error) {
  showError(error.message);
}
