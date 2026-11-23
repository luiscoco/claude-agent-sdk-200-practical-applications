const byId = (id) => document.getElementById(id);
let lastReport;
function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
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
function error(message) {
  byId('error').textContent = message;
  byId('error').classList.toggle('hidden', !message);
}
function showSelected() {
  byId('facts').textContent =
    'Actual application workers · seed → exit → launch a new worker\nRestoration case · ' +
    byId('mode').selectedOptions[0].textContent +
    '\nFixture topic · ' +
    byId('topic').value +
    '\nThe new worker receives only the saved application conversation ID.\nThe saved mapping contains SDK identity and storage locations, without the classroom answer.';
}
function resetResult() {
  lastReport = undefined;
  for (const id of ['preapproved-value', 'hook-value', 'approval-value', 'read-value'])
    byId(id).textContent = '—';
  for (const id of [
    'request',
    'admission',
    'result',
    'questions',
    'checks',
    'evidence',
    'metadata',
  ])
    byId(id).textContent = 'Awaiting actual native queries. No answers have been generated yet.';
  byId('download').classList.add('hidden');
  byId('download').removeAttribute('href');
}
function display(report) {
  lastReport = report;
  byId('mode').value = report.requestedInput.mode;
  byId('topic').value = report.requestedInput.topic;
  showSelected();
  byId('preapproved-value').textContent = report.seed.pid;
  byId('hook-value').textContent = report.restored.pid;
  byId('approval-value').textContent = report.seed.exitCode === 0 ? 'Exited · 0' : 'Failed';
  byId('read-value').textContent = report.output.contextMatches ? 'Matches case' : 'Mismatch';
  byId('request').textContent = JSON.stringify(
    {
      pid: report.seed.pid,
      workerInstance: report.seed.result.workerInstance,
      exitedAt: report.seed.exitedAt,
      exitCode: report.seed.exitCode,
      nativeSessionId: report.seed.result.initIds[0],
      answer: report.seed.result.answer,
    },
    null,
    2,
  );
  byId('admission').textContent = JSON.stringify(report.savedRecord, null, 2);
  byId('result').textContent = JSON.stringify(
    {
      pid: report.restored.pid,
      workerInstance: report.restored.result.workerInstance,
      spawnedAt: report.restored.spawnedAt,
      requestedResume: report.restored.result.requestedResume,
      nativeSessionId: report.restored.result.initIds[0],
      answer: report.restored.result.answer,
    },
    null,
    2,
  );
  byId('questions').textContent = JSON.stringify(
    {
      seedPrompt: report.seed.result.prompt,
      restartedPrompt: report.restored.result.prompt,
      restartedWorkerArgument: report.savedRecord.conversationId,
      originalMarkerNotRestated: report.checks.followUpDoesNotRestateOriginalMarker,
    },
    null,
    2,
  );
  byId('checks').textContent = JSON.stringify(report.checks, null, 2);
  byId('evidence').textContent = JSON.stringify(
    {
      seed: report.seed,
      restored: report.restored,
    },
    null,
    2,
  );
  byId('metadata').textContent = JSON.stringify(
    {
      runId: report.id,
      fixtureDisclosure: report.fixtureDisclosure,
      checkedAt: report.checkedAt,
    },
    null,
    2,
  );
  byId('status').textContent = report.verified
    ? 'Actual process restart verified'
    : 'Verification failed';
  byId('status').className = 'badge ' + (report.verified ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'The first application worker exited before the second started. Compare the saved SDK binding and actual restored answer.';
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
  error(report.error || (!report.verified ? 'Inspect the actual native checks.' : ''));
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Observed follow-up report unavailable.');
  const report = await response.json();
  display(report);
  return report;
}
byId('inspect').onclick = async () => {
  for (const id of ['inspect', 'mode', 'topic']) byId(id).disabled = true;
  error('');
  resetResult();
  byId('status').textContent = 'Running actual application workers';
  byId('status').className = 'badge';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: byId('mode').value, topic: byId('topic').value }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error || 'Native follow-up experiment failed.');
    display(report);
  } catch (failure) {
    error(failure.message);
    byId('status').textContent = 'Request failed';
  } finally {
    for (const id of ['inspect', 'mode', 'topic']) byId(id).disabled = false;
  }
};
byId('mode').onchange = showSelected;
byId('topic').onchange = showSelected;
window.lesson = { showView, source, restore, report: () => lastReport };
resetResult();
showSelected();
