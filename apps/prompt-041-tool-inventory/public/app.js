const byId = (id) => document.getElementById(id);
let lastReport;
function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}
async function source(file = 'src/inventory.ts') {
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

let inventoryId;
function reset() {
  inventoryId = undefined;
  lastReport = undefined;
  byId('execute').disabled = true;
  byId('download').classList.add('hidden');
  byId('error').classList.add('hidden');
  for (const id of ['count', 'version', 'available', 'started']) byId(id).textContent = '—';
  byId('native').textContent = 'Awaiting inventory inspection.';
  byId('capabilities').textContent = 'Awaiting actual native tools.';
  byId('answer').textContent = 'Inspect tools before running the example.';
  byId('evidence').textContent = 'Awaiting example execution.';
  byId('metadata').textContent = '';
  byId('progress').textContent = 'Inspect a new native inventory before selecting the Read example.';
  byId('status').textContent = 'Ready';
  byId('status').className = 'badge';
}
function displayReport(report) {
  lastReport = report;
  const inventory = report.inventory;
  inventoryId = inventory.verified
    ? report.phase === 'inventory'
      ? report.id
      : report.inventoryId
    : undefined;
  byId('mode').value = inventory.mode;
  byId('native').textContent = JSON.stringify(inventory.nativeInitialization, null, 2);
  byId('capabilities').replaceChildren();
  for (const capability of inventory.capabilities) {
    const row = element('div', '');
    row.className = 'capability-row';
    row.append(element('strong', capability.name), element('span', capability.capability));
    byId('capabilities').append(row);
  }
  if (!inventory.capabilities.length)
    byId('capabilities').textContent = 'Native initialization reported an empty tool inventory.';
  byId('count').textContent = inventory.availableTools.length;
  byId('version').textContent = inventory.nativeInitialization?.nativeVersion ?? 'Unavailable';
  byId('available').textContent = inventory.availableTools.includes('Read') ? 'Present' : 'Absent';
  byId('started').textContent =
    report.phase === 'inventory' ? 'Awaiting selection' : report.sdkStarted ? 'Yes' : 'No';
  byId('answer').textContent =
    report.answer || 'Example answer withheld until an available tool can execute.';
  byId('evidence').textContent =
    report.phase === 'execution'
      ? JSON.stringify(
          {
            sdkStarted: report.sdkStarted,
            actualTools: report.actualTools,
            toolCalls: report.toolCalls,
            sessionId: report.sessionId,
            factsMatched: report.factsMatched,
          },
          null,
          2,
        )
      : 'Read selection follows this actual native inventory.';
  byId('error').textContent = report.error || inventory.error;
  byId('error').classList.toggle('hidden', !byId('error').textContent);
  const verified = report.phase === 'inventory' ? inventory.verified : report.verified;
  byId('status').textContent = verified
    ? report.phase === 'inventory'
      ? 'Inspected'
      : report.blocked
        ? 'Tool unavailable'
        : 'Verified'
    : 'Review';
  byId('status').className = 'badge ' + (verified && !report.blocked ? 'passed' : 'mismatch');
  byId('progress').textContent =
    report.phase === 'inventory'
      ? 'Actual tool inventory is available. Select the Read example now.'
      : report.blocked
        ? 'The availability guard stopped the example before another SDK query.'
        : 'The actual Read call and source facts were verified.';
  byId('metadata').textContent = JSON.stringify(
    {
      inventoryVerified: inventory.verified,
      inventorySessionId: inventory.nativeInitialization?.sessionId,
      phase: report.phase,
      scenarioVerified: verified,
    },
    null,
    2,
  );
  byId('execute').disabled = !inventoryId;
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
}
async function request(phase) {
  for (const id of ['mode', 'inspect', 'execute', 'repair']) byId(id).disabled = true;
  byId('status').textContent = 'Running';
  byId('status').className = 'badge';
  byId('error').classList.add('hidden');
  byId('progress').textContent =
    phase === 'inventory'
      ? 'Inspecting actual native initialization.'
      : 'Checking Read availability before starting the actual example.';
  try {
    const response = await fetch(phase === 'inventory' ? '/api/inventory' : '/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(phase === 'inventory' ? { mode: byId('mode').value } : { inventoryId }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error);
    displayReport(report);
  } catch (error) {
    byId('status').textContent = 'Stopped';
    byId('error').textContent = error.message;
    byId('error').classList.remove('hidden');
  } finally {
    for (const id of ['mode', 'inspect', 'repair']) byId(id).disabled = false;
    byId('execute').disabled = !inventoryId;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved report unavailable.');
  const report = await response.json();
  displayReport(report);
  return report;
}
byId('mode').onchange = reset;
byId('inspect').onclick = () => {
  reset();
  request('inventory');
};
byId('execute').onclick = () => request('execution');
byId('repair').onclick = () => {
  byId('mode').value = 'scoped';
  reset();
};
window.lesson = { showView, source, restore, report: () => lastReport };
