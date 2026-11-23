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
    'Actual SDK queries · establish → recall → apply\nConversation selection · ' +
    byId('mode').selectedOptions[0].textContent +
    '\nFixture topic · ' +
    byId('topic').value +
    '\nOnly the first prompt supplies the random marker and selected requirements.\nFollow-ups resume the captured ID or intentionally start fresh for comparison.';
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
  byId('preapproved-value').textContent = report.output.actualQueries;
  byId('hook-value').textContent = report.output.distinctNativeSessions;
  byId('approval-value').textContent =
    report.turns.slice(1).filter((turn) => turn.answer?.contextAvailable).length + ' / 2';
  byId('read-value').textContent =
    report.turns.filter((turn) => turn.contextMatches).length + ' / 3';
  for (const [index, id] of ['request', 'admission', 'result'].entries()) {
    const turn = report.turns[index];
    byId(id).textContent = turn
      ? JSON.stringify(
          {
            nativeSessionId: turn.initIds[0] ?? null,
            contextExpected: turn.contextExpected,
            contextMatches: turn.contextMatches,
            ...turn.answer,
          },
          null,
          2,
        )
      : 'This query was not reached.';
  }
  byId('questions').textContent = JSON.stringify(
    report.turns.map((turn) => ({
      question: turn.index,
      prompt: turn.prompt,
      requestedResume: turn.requestedResume,
    })),
    null,
    2,
  );
  byId('checks').textContent = JSON.stringify(report.checks, null, 2);
  byId('evidence').textContent = JSON.stringify(
    {
      originalContext: report.originalContext,
      actualQueries: report.turns,
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
    ? 'Actual follow-up comparison verified'
    : 'Verification failed';
  byId('status').className = 'badge ' + (report.verified ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Compare actual native IDs and exact answers. Fresh mode intentionally loses earlier context.';
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
  byId('status').textContent = 'Asking actual native questions';
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
