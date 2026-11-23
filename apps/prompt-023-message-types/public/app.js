const byId = (id) => document.getElementById(id);
let lastReport;
let activeFilter = 'all';
function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}
async function source(file = 'src/messages.ts') {
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
function filterEvents(filter = 'all') {
  activeFilter = filter;
  document
    .querySelectorAll('[data-filter]')
    .forEach((button) => button.classList.toggle('active', button.dataset.filter === filter));
  byId('events').replaceChildren();
  const events = (lastReport?.events || []).filter(
    (event) =>
      filter === 'all' ||
      (filter === 'tool-result' ? event.kind === 'tool-result' : event.messageType === filter),
  );
  for (const event of events) {
    const row = document.createElement('article');
    row.className = 'message-event ' + event.kind;
    row.append(
      element('strong', 'Frame ' + event.frame + ' · ' + event.messageType + ' · ' + event.kind),
    );
    row.append(element('h4', event.title));
    if (event.toolUseId) row.append(element('code', 'tool_use_id · ' + event.toolUseId));
    if (event.kind === 'tool-result' || event.kind === 'result')
      row.append(element('p', 'is_error · ' + event.isError));
    row.append(element('pre', event.text));
    byId('events').append(row);
  }
  if (!events.length) byId('events').append(element('p', 'No matching observed message content.'));
}
document
  .querySelectorAll('[data-filter]')
  .forEach((button) => (button.onclick = () => filterEvents(button.dataset.filter)));
function displayReport(report) {
  lastReport = report;
  for (const type of ['system', 'assistant', 'user', 'result'])
    byId(type + '-count').textContent = report.frameTypes.filter((value) => value === type).length;
  filterEvents(activeFilter);
  byId('pairs').replaceChildren();
  for (const pair of report.toolPairs) {
    const row = document.createElement('article');
    row.className = 'tool-pair';
    row.append(element('code', pair.toolUseId));
    row.append(
      element('p', 'Request frame ' + pair.requestFrame + ' → Result frame ' + pair.resultFrame),
    );
    row.append(element('strong', pair.isError ? 'Observed tool error' : 'Observed tool success'));
    byId('pairs').append(row);
  }
  byId('answer').textContent = report.resultOutcome.answer;
  byId('status').textContent = report.verified ? 'Verified' : 'Review result';
  byId('status').className = 'badge ' + (report.verified ? 'passed' : 'mismatch');
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
  byId('progress').textContent =
    'Classified ' +
    report.frames +
    ' actual SDK frames and correlated their tool request/result IDs.';
}
async function run() {
  lastReport = undefined;
  for (const id of ['mode', 'inspect', 'repair']) byId(id).disabled = true;
  byId('error').classList.add('hidden');
  byId('download').classList.add('hidden');
  byId('status').textContent = 'Running';
  byId('status').className = 'badge';
  for (const type of ['system', 'assistant', 'user', 'result'])
    byId(type + '-count').textContent = '—';
  byId('events').replaceChildren();
  byId('pairs').replaceChildren();
  byId('answer').textContent = 'Awaiting the SDK result.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: byId('mode').value }),
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
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved report unavailable.');
  const report = await response.json();
  byId('mode').value = report.mode;
  displayReport(report);
  return report;
}
byId('inspect').onclick = run;
byId('repair').onclick = () => {
  byId('mode').value = 'success';
};
window.lesson = { showView, source, restore, filterEvents, report: () => lastReport };
