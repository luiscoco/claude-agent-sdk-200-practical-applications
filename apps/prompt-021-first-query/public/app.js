const byId = (id) => document.getElementById(id);
const arithmetic = 'What is 7 multiplied by 6? Reply with just the number.';
const greeting = 'Translate Hello into Spanish. Reply with just the translated word.';
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
function displayReport(report) {
  lastReport = report;
  byId('model').textContent = report.initializedModel;
  byId('tools').textContent = report.availableTools.length;
  byId('mcp').textContent = report.mcpServers.length;
  byId('calls').textContent = report.toolUseCount;
  byId('answer').textContent = report.answer;
  byId('metadata').textContent = JSON.stringify(
    {
      availableTools: report.availableTools,
      mcpServers: report.mcpServers,
      toolUseCount: report.toolUseCount,
      nativeVersion: report.nativeVersion,
      sessionId: report.sessionId,
      verified: report.verified,
    },
    null,
    2,
  );
  byId('status').textContent = report.verified ? 'Verified' : 'Review result';
  byId('status').className = 'badge ' + (report.verified ? 'passed' : 'mismatch');
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
  byId('progress').textContent =
    'Completed the query and verified a nonempty answer with zero available tools, MCP servers, and tool calls.';
}
async function run() {
  lastReport = undefined;
  for (const id of ['prompt', 'inspect', 'greeting', 'empty', 'repair']) byId(id).disabled = true;
  byId('error').classList.add('hidden');
  byId('download').classList.add('hidden');
  byId('status').textContent = 'Running';
  byId('status').className = 'badge';
  for (const id of ['model', 'tools', 'mcp', 'calls']) byId(id).textContent = '—';
  byId('answer').textContent = 'Awaiting the actual final result.';
  byId('metadata').textContent = 'Awaiting native runtime metadata.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: byId('prompt').value }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error);
    displayReport(report);
  } catch (error) {
    byId('status').textContent = 'Stopped';
    byId('error').textContent = error.message;
    byId('error').classList.remove('hidden');
    byId('progress').textContent = 'Enter a question or restore an example before retrying.';
  } finally {
    for (const id of ['prompt', 'inspect', 'greeting', 'empty', 'repair'])
      byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved report unavailable.');
  const report = await response.json();
  byId('prompt').value = report.prompt;
  displayReport(report);
  return report;
}
byId('inspect').onclick = run;
byId('greeting').onclick = () => {
  byId('prompt').value = greeting;
};
byId('empty').onclick = () => {
  byId('prompt').value = '';
};
byId('repair').onclick = () => {
  byId('prompt').value = arithmetic;
};
window.lesson = { showView, source, restore, report: () => lastReport };
