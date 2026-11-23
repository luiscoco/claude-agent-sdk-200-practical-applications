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
function metadataFields(metadata) {
  return {
    sessionId: metadata.sessionId,
    summary: metadata.summary,
    customTitle: metadata.customTitle ?? null,
    tag: metadata.tag ?? null,
    fileSize: metadata.fileSize,
  };
}
function display(report) {
  lastReport = report;
  byId('mode').value = report.requestedInput.mode;
  byId('title').value = report.requestedInput.title;
  byId('tag').value = report.requestedInput.tag;
  byId('calls-value').textContent = report.mutation.operations.length;
  byId('messages-value').textContent = report.reloaded.conversationMessageCount;
  byId('reload-value').textContent = report.reloaded.pid;
  byId('source-value').textContent = report.checks.originalFixtureUnchanged
    ? 'Unchanged'
    : 'Mismatch';
  byId('before').textContent = JSON.stringify(
    metadataFields(report.output.originalMetadata),
    null,
    2,
  );
  byId('after').textContent = JSON.stringify(
    metadataFields(report.output.changedMetadata),
    null,
    2,
  );
  byId('reloaded').textContent = JSON.stringify(
    metadataFields(report.output.reloadedMetadata),
    null,
    2,
  );
  byId('operations').textContent = JSON.stringify(
    report.mutation.operations.map((operation) => ({
      utility: operation.utility,
      requestedValue: operation.requestedValue,
      observedTitle: operation.actualMetadata.customTitle,
      observedTag: operation.actualMetadata.tag ?? null,
    })),
    null,
    2,
  );
  byId('checks').textContent = JSON.stringify(report.checks, null, 2);
  byId('evidence').textContent = JSON.stringify(
    {
      persistedMetadataRows: report.persistedMetadataRows,
      mutationProcess: { pid: report.mutation.pid, exitedAt: report.mutation.exitedAt },
      independentReader: { pid: report.reloaded.pid, exitedAt: report.reloaded.exitedAt },
      beforeConversationHash: report.mutation.beforeMessageHash,
      reloadedConversationHash: report.reloaded.afterMessageHash,
    },
    null,
    2,
  );
  byId('metadata').textContent = JSON.stringify(
    {
      id: report.id,
      checkedAt: report.checkedAt,
      fixtureDisclosure: report.fixtureDisclosure,
      noModelQueriesMade: report.noModelQueriesMade,
    },
    null,
    2,
  );
  byId('status').textContent = report.verified
    ? 'Persisted organization verified'
    : 'Verification failed';
  byId('status').className = 'badge ' + (report.verified ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Native writes completed. A new SDK process independently reread the persisted title and tag.';
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
  error(report.verified ? '' : 'Inspect the actual native organization checks.');
}
async function organize() {
  for (const id of ['inspect', 'mode', 'title', 'tag']) byId(id).disabled = true;
  error('');
  lastReport = undefined;
  byId('download').classList.add('hidden');
  for (const id of ['before', 'after', 'reloaded', 'operations', 'checks', 'evidence'])
    byId(id).textContent = 'Running actual native utilities on a fresh disposable copy.';
  byId('status').textContent = 'Applying and independently rereading native metadata';
  byId('status').className = 'badge';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: byId('mode').value,
        title: byId('title').value,
        tag: byId('tag').value,
      }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error || 'Native organization failed.');
    display(report);
    return report;
  } catch (failure) {
    error(failure.message);
    byId('status').textContent = 'Operation failed';
    throw failure;
  } finally {
    for (const id of ['inspect', 'mode', 'title', 'tag']) byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Observed organization report unavailable.');
  const report = await response.json();
  display(report);
  return report;
}
byId('inspect').onclick = () => organize().catch(() => {});
window.lesson = { showView, source, organize, restore, report: () => lastReport };
for (const id of ['before', 'after', 'reloaded', 'operations', 'checks', 'evidence'])
  byId(id).textContent = 'Awaiting actual native utility operations.';
