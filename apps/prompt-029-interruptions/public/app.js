const byId = (id) => document.getElementById(id);
let lastReport;
function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}
async function source(file = 'src/interruption.ts') {
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
let sessionId;
let polling;
let sending = false;
const descriptions = {
  starting: 'Waiting for the model to request the classroom Bash command.',
  'tool-requested': 'Actual Bash tool request observed. Interrupt the waiting turn now.',
  interrupting: 'Interrupt requested. Consuming remaining SDK events through the native result.',
  interrupted: 'Interrupted result received. A new instruction can use this same session.',
  continuing: 'Waiting for the actual follow-up answer.',
  completed: 'Follow-up completed and the query input was closed.',
  failed: 'Inspect the actual session diagnostic.',
  closed: 'Session closed.',
};
function displayReport(report) {
  lastReport = report;
  sessionId = report.id;
  byId('stage').textContent = report.stage;
  byId('receipt').textContent = report.receiptReceived ? JSON.stringify(report.receipt) : 'Pending';
  byId('count').textContent = report.results.length;
  byId('continuity').textContent = report.verified ? 'Verified' : 'Awaiting follow-up';
  byId('status').textContent = report.verified ? 'Verified' : report.stage;
  byId('status').className = 'badge ' + (report.verified ? 'passed' : '');
  byId('progress').textContent = descriptions[report.stage];
  byId('native-session').textContent = report.sessionId ? 'Native session ' + report.sessionId : '';
  byId('start').disabled = sending || !report.closed;
  byId('interrupt').disabled = sending || report.stage !== 'tool-requested';
  byId('continue').disabled = sending || report.stage !== 'interrupted';
  byId('close').disabled = sending || report.closed;
  byId('events').replaceChildren();
  for (const observation of report.observations) {
    const row = element('details', '');
    row.className = 'event-row';
    row.dataset.type = observation.type;
    row.dataset.phase = observation.phase;
    row.append(
      element(
        'summary',
        observation.sequence + ' · ' + observation.type + ' · ' + observation.phase,
      ),
    );
    row.append(element('pre', JSON.stringify(observation.detail, null, 2)));
    byId('events').append(row);
  }
  byId('events').scrollTop = byId('events').scrollHeight;
  byId('results').replaceChildren();
  for (const [index, result] of report.results.entries()) {
    const row = element('article', '');
    row.className = 'result-group' + (result.is_error ? ' failed' : '');
    row.append(element('strong', 'Turn ' + (index + 1) + ' · ' + result.subtype));
    row.append(
      element('p', 'terminal_reason=' + result.terminal_reason + ' · is_error=' + result.is_error),
    );
    row.append(
      element(
        'code',
        result.user_message_uuid || result.user_message_uuids?.join(', ') || 'No input UUID field',
      ),
    );
    row.append(
      element('pre', result.subtype === 'success' ? result.result : result.errors.join('\n')),
    );
    byId('results').append(row);
  }
  if (report.error) showError(report.error);
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
  if (report.closed) clearInterval(polling);
}
function showError(message) {
  byId('error').textContent = message;
  byId('error').classList.remove('hidden');
}
async function refresh() {
  if (!sessionId) return;
  const response = await fetch('/api/state/' + encodeURIComponent(sessionId));
  if (!response.ok) throw new Error('Session unavailable.');
  const report = await response.json();
  displayReport(report);
  return report;
}
function startPolling() {
  clearInterval(polling);
  polling = setInterval(
    () =>
      refresh().catch((error) => {
        clearInterval(polling);
        showError(error.message);
      }),
    300,
  );
}
async function action(name) {
  if (sending) return;
  sending = true;
  byId('error').classList.add('hidden');
  for (const id of ['start', 'interrupt', 'continue', 'close']) byId(id).disabled = true;
  try {
    const response = await fetch(
      '/api/' + name + (name === 'start' ? '' : '/' + encodeURIComponent(sessionId || 'none')),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: byId('prompt').value }),
      },
    );
    const report = await response.json();
    if (!response.ok) {
      if (report.session) displayReport(report.session);
      throw new Error(report.error);
    }
    displayReport(report);
    if (!report.closed) startPolling();
  } catch (error) {
    showError(error.message);
  } finally {
    sending = false;
    if (lastReport) displayReport(lastReport);
    else byId('start').disabled = false;
  }
}
async function restore(id) {
  sessionId = id;
  const report = await refresh();
  if (!report.closed) startPolling();
  return report;
}
for (const name of ['start', 'interrupt', 'continue', 'close'])
  byId(name).onclick = () => action(name);
byId('repair').onclick = () => {
  byId('prompt').value = 'Reply with exactly CONTINUED';
};
window.lesson = { showView, source, restore, refresh, report: () => lastReport };
