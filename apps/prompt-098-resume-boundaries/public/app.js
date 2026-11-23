const byId = (id) => document.getElementById(id);
let lastReport;
function element(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
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
function renderHistory(messages, sessionId) {
  return (
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
        return message.type.toUpperCase() + ' · ' + message.uuid + '\n' + text;
      })
      .join('\n\n')
  );
}
function display(report) {
  lastReport = report;
  byId('mode').value = report.requestedInput.mode;
  byId('topic').value = report.requestedInput.topic;
  byId('contexts-value').textContent =
    report.output.actualMarkerPresence.filter(Boolean).length + ' / 3';
  byId('prefix-value').textContent = report.output.keptSourcePrefixMessages;
  byId('fork-value').textContent =
    report.fork.actualSessionId !== report.sourceSessionId ? 'Distinct session' : 'Mismatch';
  byId('cost-value').textContent =
    '$' + [...report.seedRuns, report.fork].reduce((sum, run) => sum + run.costUsd, 0);
  byId('boundary').textContent = JSON.stringify(
    {
      sourceNativeSession: report.sourceSessionId,
      selectedBoundaryUUID: report.output.selectedBoundaryUUID,
      selectedBoundaryRole: report.selectedBoundary?.type ?? null,
      keptSourcePrefixMessages: report.output.keptSourcePrefixMessages,
    },
    null,
    2,
  );
  byId('markers').replaceChildren();
  report.markers.forEach((marker, index) => {
    const row = element('article', '', 'marker-row');
    row.append(element('strong', marker));
    row.append(
      element(
        'p',
        'Expected: ' +
          (report.output.expectedMarkerPresence[index] ? 'in fork' : 'outside prefix') +
          '\nActual: ' +
          (report.output.actualMarkerPresence[index] ? 'in fork' : 'not in fork'),
      ),
    );
    byId('markers').append(row);
  });
  byId('fork').textContent = JSON.stringify(
    {
      actualForkNativeSession: report.fork.actualSessionId,
      newFollowUpUUID: report.fork.promptId,
      nativeForkMessageCount: report.output.actualForkMessageCount,
      originalUserContextIntact: report.checks.originalUserContextUnchanged,
    },
    null,
    2,
  );
  byId('source-history').textContent = renderHistory(report.originalAfter, report.sourceSessionId);
  byId('fork-history').textContent = renderHistory(
    report.forkMessages,
    report.fork.actualSessionId,
  );
  byId('scope').textContent = JSON.stringify(
    {
      sourceUserContextUnchanged: report.checks.originalUserContextUnchanged,
      sourceFullNativeMessageHashUnchanged: report.output.sourceFullMessageHashUnchanged,
      allOriginalMarkersRemainInSource: report.checks.allOriginalMarkersRemainInSource,
      forkRawFileMarkerPresence: report.output.rawForkMarkerPresence,
      separateHostFileRemainsAtLatestState: report.output.hostFileRemainsAtLatestState,
    },
    null,
    2,
  );
  byId('checks').textContent = JSON.stringify(report.checks, null, 2);
  byId('evidence').textContent = JSON.stringify(
    {
      requestedSelection: report.fork.selection,
      actualSelectedBoundary: report.selectedBoundary,
      expectedKeptMessageUUIDs: report.sourcePrefix.map((message) => message.uuid),
      actualForkMessageUUIDs: report.forkMessages.map((message) => message.uuid),
      actualNativeInit: report.fork.actualSessionId,
      actualNativeResult: report.fork.actualResultSessionId,
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
    ? 'Actual retained prefix verified'
    : 'Verification failed';
  byId('status').className = 'badge ' + (report.verified ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Actual native resume/fork completed. The selected prefix and retained original marker values were independently read from SDK history.';
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
  error(report.verified ? '' : 'Inspect the actual native boundary checks.');
}
async function resumeBoundary() {
  for (const id of ['inspect', 'mode', 'topic']) byId(id).disabled = true;
  lastReport = undefined;
  error('');
  byId('download').classList.add('hidden');
  byId('status').className = 'badge';
  byId('status').textContent = 'Creating native contexts and resuming at the selected boundary';
  for (const id of [
    'boundary',
    'fork',
    'source-history',
    'fork-history',
    'scope',
    'checks',
    'evidence',
  ])
    byId(id).textContent = 'Running actual owned native transcript operations.';
  byId('markers').replaceChildren();
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: byId('mode').value, topic: byId('topic').value }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error || 'Native boundary experiment failed.');
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
  if (!response.ok) throw new Error('Observed boundary report unavailable.');
  const report = await response.json();
  display(report);
  return report;
}
byId('inspect').onclick = () => resumeBoundary().catch(() => {});
window.lesson = { showView, source, resumeBoundary, restore, report: () => lastReport };
for (const id of [
  'boundary',
  'fork',
  'source-history',
  'fork-history',
  'scope',
  'checks',
  'evidence',
])
  byId(id).textContent = 'Awaiting an actual native boundary experiment.';
