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

let viewer = null,
  jobId = '',
  lastJob,
  currentQuestionId = '',
  watching = false,
  polling = false;
let connectionLost = false,
  retryAt = 0,
  retryDelay = 350;
const answeredQuestionIds = new Set();
function showError(message) {
  byId('error').textContent = message;
  byId('error').classList.toggle('hidden', !message);
}
function showAuthError(message) {
  byId('auth-error').textContent = message;
  byId('auth-error').classList.toggle('hidden', !message);
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
    byId(id).textContent = 'Awaiting the actual session-scoped approval.';
  byId('download').classList.add('hidden');
  byId('download').removeAttribute('href');
}
function clearViewer(message = '') {
  viewer = null;
  jobId = '';
  lastJob = undefined;
  currentQuestionId = '';
  watching = false;
  answeredQuestionIds.clear();
  resetResult();
  showError('');
  showAuthError(message);
  byId('workspace').classList.add('hidden');
  byId('login-controls').classList.remove('hidden');
  byId('viewer-controls').classList.add('hidden');
  byId('viewer').textContent = '';
  byId('question-panel').classList.add('hidden');
  byId('question-controls').replaceChildren();
  byId('question-schema').textContent = '';
  byId('question-message').textContent = '';
  byId('scope-result').textContent = '';
  byId('connection').textContent = 'Choose classroom identity';
  byId('connection').className = 'badge';
  byId('login').disabled = false;
  byId('identity').disabled = false;
}
function setConnection(connected) {
  if (connected) {
    if (connectionLost) showError('');
    connectionLost = false;
    retryAt = 0;
    retryDelay = 350;
  } else connectionLost = true;
  byId('connection').textContent = connected ? 'Connected' : 'Connection interrupted';
  byId('connection').className = 'badge ' + (connected ? 'passed' : 'mismatch');
}
function showViewer(session) {
  viewer = session;
  showAuthError('');
  byId('viewer').textContent = session.displayName + ' · Application session ' + session.id;
  byId('login-controls').classList.add('hidden');
  byId('viewer-controls').classList.remove('hidden');
  byId('workspace').classList.remove('hidden');
  setConnection(true);
}
async function api(url, options = {}) {
  const sessionRef = viewer?.id;
  let response;
  try {
    response = await fetch(url, options);
  } catch {
    if (sessionRef && viewer?.id === sessionRef) setConnection(false);
    throw new Error('Connection interrupted. Reconnecting to the classroom server.');
  }
  const data = await response.json();
  if (response.status === 401) {
    if (viewer?.id === sessionRef) clearViewer(data.error);
    const error = new Error(data.error);
    error.status = response.status;
    throw error;
  }
  if (sessionRef && viewer?.id === sessionRef) setConnection(true);
  if (!response.ok) {
    const error = new Error(data.error || 'Classroom request failed.');
    error.status = response.status;
    throw error;
  }
  return data;
}
const post = (data) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});
function answerButton(id, text, answer, primary = false) {
  const button = element('button', text);
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
  byId('question-kind').textContent = 'Session-scoped native Write approval';
  byId('question-message').textContent =
    'Approve, deny or revise this actual request in your authenticated classroom session.';
  byId('question-schema').textContent = JSON.stringify(question.payload, null, 2);
  answerButton('approve-tool', 'Approve original Write', { action: 'allow' }, true);
  answerButton('deny-tool', 'Deny Write', { action: 'deny' });
  const label = element('label', 'Revised note content');
  label.className = 'revise-editor';
  const editor = document.createElement('textarea');
  editor.id = 'revised-content';
  editor.maxLength = 2000;
  editor.value = `Reviewed ${question.payload.topic} classroom note.\n`;
  label.append(editor);
  byId('question-controls').append(label);
  answerButton('revise-tool', 'Revise and approve Write', () => ({
    action: 'revise',
    content: editor.value,
  }));
}
function displayReport(report) {
  lastReport = report;
  showError(report.error || '');
  const decision = report.callbackEvents[0];
  byId('handler-result').textContent = report.owner.displayName;
  byId('native-result-value').textContent = report.owner.sessionId.slice(0, 8);
  byId('final-result').textContent = report.sessionId.slice(0, 8);
  byId('execution-count').textContent = String(report.fileEvidence.exists);
  byId('handler').textContent = JSON.stringify(
    {
      classroomUser: report.owner.userId,
      applicationSessionId: report.owner.sessionId,
      submittedDecision: decision?.answer ?? null,
    },
    null,
    2,
  );
  byId('native-result').textContent = JSON.stringify(
    {
      nativeSessionId: report.sessionId,
      effectiveContent: report.fileEvidence.effectiveContent,
      nativeOutcomes: report.results.map((result) => ({
        name: result.name,
        isError: result.isError,
      })),
    },
    null,
    2,
  );
  byId('final-output').textContent = JSON.stringify(
    {
      recordedFileOutcome: report.output,
      modelOutput: report.modelOutput,
      modelEchoExact: report.modelEchoExact,
      actualFile: { exists: report.fileEvidence.exists, text: report.fileEvidence.actualText },
    },
    null,
    2,
  );
  byId('checks').textContent = JSON.stringify(report.checks, null, 2);
  byId('provenance').textContent =
    'The server authorizes each request against both its owner user and application session. Pending native callbacks preserve the actual SDK session identifier.';
  byId('evidence').textContent = JSON.stringify(
    {
      owner: report.owner,
      callbackEvents: report.callbackEvents,
      questionHistory: report.questions,
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
      runId: report.id,
      owner: report.owner,
      nativeSessionId: report.sessionId,
      checkedAt: report.checkedAt,
    },
    null,
    2,
  );
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
}
function displayJob(job) {
  lastJob = job;
  const active = ['running', 'cancelling'].includes(job.status);
  watching = active;
  byId('start').disabled = active;
  byId('topic').disabled = active;
  byId('topic').value = job.requestedInput.topic;
  byId('cancel-run').disabled = !active;
  displayQuestion(job.pending && !answeredQuestionIds.has(job.pending.id) ? job.pending : null);
  if (job.report && lastReport?.id !== job.report.id) displayReport(job.report);
  byId('status').textContent = job.pending
    ? 'Awaiting your approval'
    : job.report?.verified
      ? 'Session approval verified'
      : job.status;
  byId('status').className = 'badge ' + (job.report?.verified ? 'passed' : '');
  byId('progress').textContent = active
    ? 'This actual run belongs to ' +
      job.owner.displayName +
      ' and application session ' +
      job.owner.sessionId
    : 'Inspect the actual owner, native session, callback and file outcome.';
  byId('lookup-id').value = job.id;
  if (job.error) showError(job.error);
}
async function loadJob(id) {
  const sessionRef = viewer?.id;
  const job = await api('/api/jobs/' + encodeURIComponent(id));
  if (viewer?.id !== sessionRef || jobId !== id) return;
  if (job.owner.userId !== viewer.userId || job.owner.sessionId !== viewer.id)
    throw new Error('Unexpected classroom run ownership.');
  displayJob(job);
  return job;
}
async function restore(id) {
  jobId = id;
  resetResult();
  return loadJob(id);
}
async function loadWorkspace() {
  const sessionRef = viewer?.id,
    config = await api('/api/config');
  if (viewer?.id !== sessionRef) return;
  if (config.activeJobId || config.latestJobId)
    return restore(config.activeJobId || config.latestJobId);
  jobId = '';
  lastJob = undefined;
  watching = false;
  resetResult();
  displayQuestion(null);
  byId('start').disabled = false;
  byId('topic').disabled = false;
  byId('cancel-run').disabled = true;
  byId('status').textContent = 'Ready';
  byId('status').className = 'badge';
  byId('progress').textContent =
    'Start an actual native Write owned by your current classroom session.';
}
async function submitAnswer(answer) {
  const sessionRef = viewer?.id,
    requestedJob = jobId,
    questionId = currentQuestionId;
  for (const control of byId('question-controls').querySelectorAll('button,textarea'))
    control.disabled = true;
  try {
    await api('/api/jobs/' + requestedJob + '/answer', post({ questionId, answer }));
    if (viewer?.id !== sessionRef || jobId !== requestedJob) return;
    answeredQuestionIds.add(questionId);
    currentQuestionId = '';
    byId('question-panel').classList.add('hidden');
    showError('');
  } catch (error) {
    if (viewer?.id !== sessionRef || jobId !== requestedJob) return;
    showError(error.message);
    for (const control of byId('question-controls').querySelectorAll('button,textarea'))
      control.disabled = false;
  }
}
byId('login').onclick = async () => {
  byId('login').disabled = true;
  byId('identity').disabled = true;
  showAuthError('');
  try {
    const result = await api('/api/session/login', post({ userId: byId('identity').value }));
    showViewer(result.viewer);
    await loadWorkspace();
  } catch (error) {
    showAuthError(error.message);
  } finally {
    byId('login').disabled = false;
    byId('identity').disabled = false;
  }
};
byId('logout').onclick = async () => {
  byId('logout').disabled = true;
  try {
    await api('/api/session/logout', post({}));
    clearViewer();
  } catch (error) {
    showError(error.message);
  } finally {
    byId('logout').disabled = false;
  }
};
byId('start').onclick = async () => {
  const sessionRef = viewer?.id;
  byId('start').disabled = true;
  byId('topic').disabled = true;
  showError('');
  resetResult();
  jobId = '';
  lastJob = undefined;
  watching = false;
  try {
    const result = await api('/api/start', post({ topic: byId('topic').value }));
    if (viewer?.id !== sessionRef) return;
    jobId = result.id;
    watching = true;
    byId('cancel-run').disabled = false;
    byId('status').textContent = 'Starting native SDK query';
  } catch (error) {
    if (viewer?.id === sessionRef) {
      showError(error.message);
      byId('start').disabled = false;
      byId('topic').disabled = false;
    }
  }
};
byId('cancel-run').onclick = async () => {
  const sessionRef = viewer?.id;
  try {
    await api('/api/jobs/' + jobId + '/cancel', post({}));
    if (viewer?.id === sessionRef) {
      watching = true;
      byId('cancel-run').disabled = true;
    }
  } catch (error) {
    if (viewer?.id === sessionRef) showError(error.message);
  }
};
byId('open-job').onclick = async () => {
  const id = byId('lookup-id').value.trim(),
    sessionRef = viewer?.id,
    previousId = jobId;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    byId('scope-result').textContent = 'Enter the actual run UUID.';
    return;
  }
  jobId = id;
  try {
    const job = await loadJob(id);
    if (job)
      byId('scope-result').textContent = JSON.stringify(
        { requestedRunId: id, httpStatus: 200, owner: job.owner },
        null,
        2,
      );
  } catch (error) {
    if (viewer?.id !== sessionRef) return;
    jobId = previousId;
    byId('scope-result').textContent = JSON.stringify(
      {
        requestedRunId: id,
        httpStatus: error.status,
        message: error.message,
        viewer: viewer.displayName,
        applicationSessionId: viewer.id,
      },
      null,
      2,
    );
  }
};
byId('resume-active').onclick = async () => {
  try {
    showError('');
    await loadWorkspace();
  } catch (error) {
    showError(error.message);
  }
};
setInterval(async () => {
  if (!watching || polling || !jobId || !viewer || Date.now() < retryAt) return;
  const id = jobId,
    sessionRef = viewer.id;
  polling = true;
  try {
    await loadJob(id);
  } catch (error) {
    if (jobId === id && viewer?.id === sessionRef) {
      showError(error.message);
      retryDelay = Math.min(5000, retryDelay * 2);
      retryAt = Date.now() + retryDelay;
    }
  } finally {
    polling = false;
  }
}, 350);
window.lesson = {
  showView,
  source,
  restore,
  report: () => lastReport,
  job: () => lastJob,
  viewer: () => viewer,
};
byId('facts').textContent =
  'Identity · fixed local classroom users\nAuthorization · owner user AND application session on each job, answer, cancellation and report\nNative association · actual SDK session and tool use identifiers\nConnection recovery · reload the same pending approval using its session cookie';
try {
  const result = await api('/api/session');
  if (result.viewer) {
    showViewer(result.viewer);
    await loadWorkspace();
  } else clearViewer();
} catch (error) {
  clearViewer(error.message);
}
byId('login').disabled = false;
