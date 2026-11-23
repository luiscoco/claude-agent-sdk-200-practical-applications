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
    'Actual hooks · SubagentStart and SubagentStop\nClassroom case · ' +
    byId('mode').selectedOptions[0].textContent +
    '\nFixture topic · ' +
    byId('topic').value +
    '\nOne real SDK helper reads one owned synthetic classroom note.\nCorrelate the parent Agent call, native task identifier, child Read and actual lifecycle events.';
}
function resetResult() {
  lastReport = undefined;
  for (const id of ['preapproved-value', 'hook-value', 'approval-value', 'read-value'])
    byId(id).textContent = '—';
  for (const id of ['request', 'admission', 'result', 'checks', 'evidence', 'metadata'])
    byId(id).textContent = 'Awaiting this actual native lifecycle experiment.';
  byId('download').classList.add('hidden');
  byId('download').removeAttribute('href');
}
function display(report) {
  lastReport = report;
  byId('mode').value = report.requestedInput.mode;
  byId('topic').value = report.requestedInput.topic;
  showSelected();
  byId('preapproved-value').textContent = report.taskStarts.length;
  byId('hook-value').textContent = report.starts.length;
  byId('approval-value').textContent = report.stops.length;
  byId('read-value').textContent = report.calls.filter((call) => call.name === 'Read').length;
  byId('request').textContent = JSON.stringify(
    {
      parentToolUseId: report.calls.find((call) => call.name === 'Agent')?.id,
      nativeTaskId: report.taskStarts[0]?.task_id,
      helper: report.helper,
      taskParentMatches:
        report.taskStarts[0]?.tool_use_id ===
        report.calls.find((call) => call.name === 'Agent')?.id,
    },
    null,
    2,
  );
  byId('admission').textContent = JSON.stringify(
    {
      lifecycleMatcher: report.matcher,
      starts: report.starts.map((start) => ({
        agentType: start.agentType,
        agentId: start.agentId,
      })),
      stops: report.stops.map((stop) => ({ agentType: stop.agentType, agentId: stop.agentId })),
    },
    null,
    2,
  );
  byId('result').textContent = JSON.stringify(
    {
      output: report.output,
      childReadAgentId: report.readHooks[0]?.agentId,
      childReadTaskMatches: report.readHooks[0]?.agentId === report.taskStarts[0]?.task_id,
    },
    null,
    2,
  );
  byId('checks').textContent = JSON.stringify(report.checks, null, 2);
  byId('evidence').textContent = JSON.stringify(
    {
      starts: report.starts,
      stops: report.stops,
      taskStarts: report.taskStarts,
      calls: report.calls,
      results: report.results,
      readHooks: report.readHooks,
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
    ? 'Native subagent correlation verified'
    : 'Verification failed';
  byId('status').className = 'badge ' + (report.verified ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Inspect actual parent-task linkage, matched lifecycle hooks and the child Read result.';
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
  error(report.error || (!report.verified ? 'Inspect the actual native checks.' : ''));
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Observed subagent report unavailable.');
  const report = await response.json();
  display(report);
  return report;
}
byId('inspect').onclick = async () => {
  for (const id of ['inspect', 'mode', 'topic']) byId(id).disabled = true;
  error('');
  resetResult();
  byId('status').textContent = 'Running one actual SDK helper';
  byId('status').className = 'badge';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: byId('mode').value, topic: byId('topic').value }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error || 'Native subagent experiment failed.');
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
