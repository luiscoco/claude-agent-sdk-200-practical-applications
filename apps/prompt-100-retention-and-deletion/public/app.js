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
function display(report) {
  lastReport = report;
  byId('mode').value = report.requestedInput.mode;
  byId('retention').value = report.requestedInput.retentionHours;
  byId('eligible-value').textContent = report.mutation.plan.filter((item) => item.eligible).length;
  byId('deleted-value').textContent = report.output.deletedCount;
  byId('remaining-value').textContent = report.output.remainingSessions;
  byId('source-value').textContent = report.checks.originalFixturesUnchanged
    ? 'Unchanged'
    : 'Mismatch';
  byId('plan').textContent = JSON.stringify(
    report.mutation.plan.map((item) => ({
      sessionId: item.sessionId,
      modifiedAt: new Date(item.lastModified).toISOString(),
      eligible: item.eligible,
      reason: item.reason,
    })),
    null,
    2,
  );
  byId('deleted').textContent = JSON.stringify(
    {
      mode: report.requestedInput.mode,
      cutoff: report.output.policyCutoff,
      deletedNativeIds: report.mutation.deleted,
      errors: report.mutation.errors,
    },
    null,
    2,
  );
  byId('reloaded').textContent = JSON.stringify(
    {
      readerPid: report.reloaded.pid,
      remainingNativeIds: report.reloaded.after.map((item) => item.sessionId),
      targetMetadataPresent: report.reloaded.targetMetadata !== null,
      targetMessageCount: report.reloaded.targetMessageCount,
    },
    null,
    2,
  );
  for (const [id, key] of Object.entries({
    'transcript-state': 'targetTranscript',
    'subdirectory-state': 'sessionSubdirectory',
    'reference-state': 'applicationReference',
    'note-state': 'workspaceNote',
  })) {
    byId(id).textContent = report.output.artifacts[key] ? 'Remains' : 'Removed';
    byId(id).className = report.output.artifacts[key] ? 'remains' : 'removed';
  }
  byId('controls').textContent = JSON.stringify(
    {
      repeatDelete: report.mutation.repeatDeletion,
      independentlyReadTargetMetadata:
        report.reloaded.targetMetadata === null
          ? null
          : { sessionId: report.reloaded.targetMetadata.sessionId },
      independentlyReadTargetMessageCount: report.reloaded.targetMessageCount,
    },
    null,
    2,
  );
  byId('checks').textContent = JSON.stringify(report.checks, null, 2);
  byId('evidence').textContent = JSON.stringify(
    {
      mutationProcess: { pid: report.mutation.pid, exitedAt: report.mutation.exitedAt },
      reloadProcess: { pid: report.reloaded.pid, exitedAt: report.reloaded.exitedAt },
      artifactPresence: report.reloaded.artifacts,
      noModelQueriesMade: report.noModelQueriesMade,
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
    ? 'Actual retention scope verified'
    : 'Verification failed';
  byId('status').className = 'badge ' + (report.verified ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Actual native utility results and local artifact presence were independently rechecked after the first worker exited.';
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
  error(report.verified ? '' : 'Inspect the actual retention checks.');
}
async function retain() {
  for (const id of ['inspect', 'mode', 'retention']) byId(id).disabled = true;
  lastReport = undefined;
  error('');
  byId('download').classList.add('hidden');
  byId('status').className = 'badge';
  byId('status').textContent = 'Applying selected policy to fresh disposable copies';
  for (const id of ['plan', 'deleted', 'reloaded', 'controls', 'checks', 'evidence'])
    byId(id).textContent = 'Running actual local SDK retention operations.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: byId('mode').value,
        retentionHours: Number(byId('retention').value),
      }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error || 'Native retention failed.');
    display(report);
    return report;
  } catch (failure) {
    error(failure.message);
    byId('status').textContent = 'Operation failed';
    throw failure;
  } finally {
    for (const id of ['inspect', 'mode', 'retention']) byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Observed retention report unavailable.');
  const report = await response.json();
  display(report);
  return report;
}
byId('inspect').onclick = () => retain().catch(() => {});
window.lesson = { showView, source, retain, restore, report: () => lastReport };
for (const id of ['plan', 'deleted', 'reloaded', 'controls', 'checks', 'evidence'])
  byId(id).textContent = 'Awaiting an actual native retention experiment.';
