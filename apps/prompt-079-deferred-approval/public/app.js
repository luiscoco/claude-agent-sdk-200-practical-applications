const byId = (id) => document.getElementById(id);
let lastReport,
  busy = false;
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
async function api(url, value) {
  const response = await fetch(
    url,
    value === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(value),
        },
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Classroom request failed.');
  return data;
}
function controls() {
  byId('defer').disabled = busy;
  byId('topic').disabled = busy;
  byId('restore').disabled = busy;
  byId('decision').disabled = busy || lastReport?.status !== 'deferred';
  byId('resume').disabled = busy || lastReport?.status !== 'deferred';
}
function display(report) {
  lastReport = report;
  const phase = report.phases.at(-1);
  byId('run-id').value = report.id;
  byId('status').textContent =
    report.status === 'deferred' ? 'Deferred · worker stopped' : report.status;
  byId('status').className = 'badge ' + (report.verified ? 'passed' : 'mismatch');
  byId('state-value').textContent = report.status;
  byId('worker-value').textContent = String(phase?.worker.exited ?? false);
  byId('session-value').textContent = report.sessionId.slice(0, 8) || '—';
  byId('file-value').textContent = String(report.actualText !== null);
  byId('pending').textContent = JSON.stringify(
    {
      nativeSessionId: report.sessionId,
      deferredTool: report.deferredTool,
      ownerDecision: report.decision,
    },
    null,
    2,
  );
  byId('workers').textContent = JSON.stringify(
    report.phases.map((item) => {
      const hook = item.hookEvents.find((event) => event.name === 'Write');
      const callback = item.callbackEvents?.find((event) => event.name === 'Write');
      const decision = hook || callback;
      return {
        stage: item.stage,
        workerPid: item.worker.pid,
        workerExited: item.worker.exited,
        exitCode: item.worker.exitCode,
        stopReason: item.stopReason,
        originalToolUseId: decision?.id,
        writeDecision: decision?.decision,
        decisionSource: hook ? 'PreToolUse' : callback ? 'canUseTool' : null,
      };
    }),
    null,
    2,
  );
  byId('file').textContent = JSON.stringify(
    {
      actualFile: { exists: report.actualText !== null, text: report.actualText },
      modelOutput: phase?.output ?? null,
      nativeResults:
        phase?.results.filter(item => ['Read', 'Write'].includes(item.name)).map((item) => ({ id: item.id, name: item.name, isError: item.isError })) ??
        [],
    },
    null,
    2,
  );
  byId('checks').textContent = JSON.stringify(report.checks, null, 2);
  byId('evidence').textContent = JSON.stringify(report.phases, null, 2);
  byId('metadata').textContent = JSON.stringify(
    {
      runId: report.id,
      nativeSessionId: report.sessionId,
      transcriptPersisted: report.transcriptPersisted,
      workspace: report.workspace,
    },
    null,
    2,
  );
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
  byId('progress').textContent =
    report.status === 'deferred'
      ? 'The actual worker has stopped. Choose a decision and resume this persisted native call.'
      : 'Inspect actual worker exit, native replay and independently read file contents.';
  error(
    report.error || (!report.verified ? 'Inspect the actual native checks before continuing.' : ''),
  );
  controls();
}
async function restore(id) {
  const report = await api('/api/runs/' + encodeURIComponent(id));
  display(report);
  return report;
}
async function perform(url, value) {
  busy = true;
  controls();
  error('');
  byId('status').textContent = 'Running actual native worker';
  byId('status').className = 'badge';
  byId('progress').textContent = 'Waiting for the actual native result and worker exit.';
  try {
    return display(await api(url, value));
  } catch (failure) {
    error(failure.message);
    byId('status').textContent = 'Request failed';
  } finally {
    busy = false;
    controls();
  }
}
byId('defer').onclick = () => perform('/api/defer', { topic: byId('topic').value });
byId('resume').onclick = () =>
  perform('/api/resume', { id: lastReport.id, decision: byId('decision').value });
byId('restore').onclick = async () => {
  try {
    error('');
    await restore(byId('run-id').value.trim());
    byId('restore-result').textContent = 'Loaded the actual saved run ' + lastReport.id;
  } catch (failure) {
    error(failure.message);
  }
};
window.lesson = { showView, source, restore, report: () => lastReport, busy: () => busy };
for (const id of ['pending', 'workers', 'file', 'checks', 'evidence', 'metadata'])
  byId(id).textContent = 'Awaiting an actual deferred native call.';
try {
  const config = await api('/api/config');
  if (config.latestRunId) await restore(config.latestRunId);
  else {
    byId('status').textContent = 'Ready';
    byId('progress').textContent = 'Start a fresh native call and inspect its actual defer result.';
  }
} catch (failure) {
  error(failure.message);
}
controls();
