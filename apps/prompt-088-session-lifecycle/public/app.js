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
    'Actual hooks · SessionStart, SessionEnd, Notification and ConfigChange\nObserver mode · ' +
    byId('mode').selectedOptions[0].textContent +
    '\nFixture topic · ' +
    byId('topic').value +
    '\nEach run starts and resumes one native session, then verifies an owned local settings edit.\nActual callbacks and native settings-command observations are counted separately.';
}
function resetResult() {
  lastReport = undefined;
  for (const id of ['preapproved-value', 'hook-value', 'approval-value', 'read-value'])
    byId(id).textContent = '—';
  for (const id of ['request', 'admission', 'result', 'checks', 'evidence', 'metadata'])
    byId(id).textContent = 'Awaiting this actual native lifecycle experiment.';
  byId('download').classList.add('hidden');
  byId('download').removeAttribute('href');
  byId('capabilities-body').replaceChildren();
}
function display(report) {
  lastReport = report;
  byId('mode').value = report.requestedInput.mode;
  byId('topic').value = report.requestedInput.topic;
  showSelected();
  byId('preapproved-value').textContent = report.phases.length;
  byId('hook-value').textContent = report.callbackCounts.ConfigChange;
  byId('approval-value').textContent =
    report.output.commandStarts + ' / ' + report.output.commandEnds;
  byId('read-value').textContent = report.callbackCounts.Notification;
  byId('request').textContent = JSON.stringify(
    {
      nativeSessionId: report.sessionId,
      phases: report.phases.map((phase) => ({ phase: phase.phase, result: phase.result })),
      sameSessionResumed: report.checks.sameNativeSessionResumed,
    },
    null,
    2,
  );
  byId('admission').textContent = JSON.stringify(
    {
      actualSdkCallbacks: report.callbackCounts,
      commandStartSources: report.commandEvents
        .filter((event) => event.input.hook_event_name === 'SessionStart')
        .map((event) => event.input.source),
      commandEndReasons: report.commandEvents
        .filter((event) => event.input.hook_event_name === 'SessionEnd')
        .map((event) => event.input.reason),
    },
    null,
    2,
  );
  byId('result').textContent = JSON.stringify(
    {
      originalOwnedSettings: report.settingsEvidence.original,
      afterNativeWriter:
        report.phases[0]?.callbacks.find((callback) => callback.nativeWriterSettings)
          ?.nativeWriterSettings ?? null,
      afterExternalEdit: report.settingsEvidence.final,
      actualConfigSource:
        report.events.find((event) => event.input.hook_event_name === 'ConfigChange')?.input
          .source ?? null,
    },
    null,
    2,
  );
  byId('checks').textContent = JSON.stringify(report.checks, null, 2);
  byId('evidence').textContent = JSON.stringify(
    {
      sdkCallbacks: report.events,
      nativeCommandEvents: report.commandEvents,
      nativePhases: report.phases,
      limitations: report.limitations,
    },
    null,
    2,
  );
  byId('metadata').textContent = JSON.stringify(
    {
      runId: report.id,
      nativeSessionId: report.sessionId,
      checkedAt: report.checkedAt,
    },
    null,
    2,
  );
  byId('status').textContent = report.verified
    ? 'Native lifecycle observations verified'
    : 'Verification failed';
  byId('status').className = 'badge ' + (report.verified ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Compare actual callback and command observations with installed event names and documented language support.';
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
  byId('capabilities-body').replaceChildren();
  for (const row of report.capabilities) {
    const tr = document.createElement('tr');
    const commandCount = report.commandEvents.filter(
      (event) => event.input.hook_event_name === row.event,
    ).length;
    for (const value of [
      row.event,
      row.installedTypeScriptEvent ? 'Yes' : 'No',
      row.pythonCallbackDocumented ? 'Yes' : 'No',
      row.actualCallbackCount,
      commandCount,
      row.observation,
    ])
      tr.append(element('td', String(value)));
    byId('capabilities-body').append(tr);
  }
  error(report.error || (!report.verified ? 'Inspect the actual native checks.' : ''));
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Observed session-lifecycle report unavailable.');
  const report = await response.json();
  display(report);
  return report;
}
byId('inspect').onclick = async () => {
  for (const id of ['inspect', 'mode', 'topic']) byId(id).disabled = true;
  error('');
  resetResult();
  byId('status').textContent = 'Running actual startup, settings edit and resume';
  byId('status').className = 'badge';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: byId('mode').value, topic: byId('topic').value }),
    });
    const report = await response.json();
    if (!response.ok)
      throw new Error(report.error || 'Native session-lifecycle experiment failed.');
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
for (const id of ['request', 'admission', 'result', 'checks', 'evidence', 'metadata'])
  byId(id).textContent = 'Awaiting the actual native rewrite experiment.';
showSelected();
