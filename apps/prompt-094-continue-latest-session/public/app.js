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
function showHistory() {
  if (!lastReport) return;
  const stage = byId('history-stage').value;
  const snapshot =
    stage === 'before'
      ? lastReport.before
      : stage === 'implicit'
        ? lastReport.afterImplicit
        : lastReport.afterExplicit;
  for (const [id, sessionId] of [
    ['history-a', lastReport.output.intendedUserASession],
    ['history-b', lastReport.output.userBSession],
  ]) {
    const messages = snapshot.sessions.find((session) => session.sessionId === sessionId).messages;
    byId(id).textContent =
      'Native session · ' +
      sessionId +
      '\n\n' +
      messages
        .map((message) => {
          const content = message.message.content;
          const text =
            typeof content === 'string'
              ? content
              : content
                  .filter((block) => block.type === 'text')
                  .map((block) => block.text)
                  .join('\n');
      return message.type.toUpperCase() + ' · Message UUID · ' + message.uuid + '\n' + text;
        })
        .join('\n\n');
  }
}
function display(report) {
  lastReport = report;
  byId('mode').value = report.requestedInput.mode;
  byId('topic').value = report.requestedInput.topic;
  byId('sessions-value').textContent = new Set([report.seedA.actualSessionId, report.seedB.actualSessionId]).size;
  byId('implicit-value').textContent = report.output.implicitRoutesToUserA
    ? 'Correct session'
    : 'Wrong session';
  byId('implicit-value').className = report.output.implicitRoutesToUserA
    ? 'route-correct'
    : 'route-wrong';
  byId('explicit-value').textContent = report.output.explicitRoutesToUserA
    ? 'Correct session'
    : 'Wrong session';
  byId('explicit-value').className = report.output.explicitRoutesToUserA
    ? 'route-correct'
    : 'route-wrong';
  byId('turns-value').textContent = [
    report.seedA,
    report.seedB,
    report.implicit,
    report.explicit,
  ].reduce((sum, run) => sum + run.turns, 0);
  byId('intended').textContent = JSON.stringify(
    {
      intendedUserASession: report.output.intendedUserASession,
      userBSession: report.output.userBSession,
      actualLatestEligibleSession: report.output.latestEligibleBeforeFollowUp,
    },
    null,
    2,
  );
  byId('implicit').textContent = JSON.stringify(
    {
      selection: report.implicit.selection,
      actualNativeSession: report.implicit.actualSessionId,
      intendedUser: 'User A',
      actualContextOwner: report.output.implicitRoutesToUserA ? 'User A' : report.implicit.actualSessionId === report.output.userBSession ? 'User B' : 'Unexpected native session',
      routesToUserA: report.output.implicitRoutesToUserA,
    },
    null,
    2,
  );
  byId('explicit').textContent = JSON.stringify(
    {
      selection: report.explicit.selection,
      actualNativeSession: report.explicit.actualSessionId,
      intendedUser: 'User A',
      routesToUserA: report.output.explicitRoutesToUserA,
    },
    null,
    2,
  );
  byId('history-stage').value = 'implicit';
  showHistory();
  byId('checks').textContent = JSON.stringify(report.checks, null, 2);
  byId('evidence').textContent = JSON.stringify(
    {
      eligibleNativeSessionIdsBeforeFollowUp: report.before.eligibleSessionsInQueryDirectory.map(
        (session) => session.sessionId,
      ),
      actualContinue: {
        selection: report.implicit.selection,
        promptId: report.implicit.promptId,
        nativeInitId: report.implicit.actualSessionId,
        nativeResultId: report.implicit.actualResultSessionId,
      },
      actualExplicitResume: {
        selection: report.explicit.selection,
        promptId: report.explicit.promptId,
        nativeInitId: report.explicit.actualSessionId,
        nativeResultId: report.explicit.actualResultSessionId,
      },
    },
    null,
    2,
  );
  byId('metadata').textContent = JSON.stringify(
    { id: report.id, checkedAt: report.checkedAt, fixtureDisclosure: report.fixtureDisclosure },
    null,
    2,
  );
  byId('status').textContent = report.verified
    ? report.requestedInput.mode === 'shared'
      ? 'Expected wrong-session selection observed'
      : 'Directory-scoped selection verified'
    : 'Verification failed';
  byId('status').className =
    'badge ' +
    (report.verified
      ? report.requestedInput.mode === 'shared'
        ? 'expected-mismatch'
        : 'passed'
      : 'mismatch');
  byId('progress').textContent =
    report.requestedInput.mode === 'shared'
      ? "Actual continue selected User B's latest session for User A's follow-up. Explicit resume selected User A's session."
      : "With separate working directories, User A's latest session is its own. Explicit resume also selects the intended session.";
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
  error(report.verified ? '' : 'Inspect the actual native selection checks.');
}
async function selectSessions() {
  for (const id of ['inspect', 'mode', 'topic']) byId(id).disabled = true;
  lastReport = undefined;
  error('');
  byId('download').classList.add('hidden');
  byId('status').className = 'badge';
  byId('status').textContent = 'Running actual native selection and history checks';
  for (const id of [
    'intended',
    'implicit',
    'explicit',
    'history-a',
    'history-b',
    'checks',
    'evidence',
  ])
    byId(id).textContent = 'Running fresh owned native transcript operations.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: byId('mode').value, topic: byId('topic').value }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error || 'Native selection experiment failed.');
    display(report);
    return report;
  } catch (failure) {
    error(failure.message);
    byId('status').textContent = 'Experiment failed';
    throw failure;
  } finally {
    for (const id of ['inspect', 'mode', 'topic']) byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Observed selection report unavailable.');
  const report = await response.json();
  display(report);
  return report;
}
byId('inspect').onclick = () => selectSessions().catch(() => {});
byId('history-stage').onchange = showHistory;
window.lesson = { showView, source, selectSessions, restore, report: () => lastReport };
for (const id of [
  'intended',
  'implicit',
  'explicit',
  'history-a',
  'history-b',
  'checks',
  'evidence',
])
  byId(id).textContent = 'Awaiting an actual native selection experiment.';
