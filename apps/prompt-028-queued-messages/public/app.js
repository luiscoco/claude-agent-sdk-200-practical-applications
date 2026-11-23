const byId = (id) => document.getElementById(id);
let lastReport;
function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}
async function source(file = 'src/items.ts') {
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
  byId('submitted').textContent = report.submittedIds.length;
  byId('yielded').textContent = report.yieldedIds.length;
  byId('groups').textContent = report.results.length;
  byId('coverage').textContent = report.orderVerified ? 'A → B → C' : 'Awaiting / stopped';
  byId('items').replaceChildren();
  for (const item of report.items) {
    const card = element('article', '');
    card.className = 'queue-item';
    card.append(element('strong', item.key + ' · expected ' + item.expected));
    card.append(element('code', item.id));
    const index = report.yieldedIds.indexOf(item.id);
    card.append(
      element('p', index >= 0 ? 'Yielded position ' + (index + 1) : 'Stopped before SDK input'),
    );
    byId('items').append(card);
  }
  byId('results').replaceChildren();
  for (const result of report.results) {
    const card = element('article', '');
    card.className = 'result-group';
    const keys = result.coveredIds.map(
      (id) => report.items.find((item) => item.id === id)?.key || '?',
    );
    card.append(element('strong', 'Result ' + result.sequence + ' · covers ' + keys.join(', ')));
    card.append(element('pre', result.answer));
    for (const id of result.coveredIds) card.append(element('code', id));
    card.append(element('p', result.subtype + ' · is_error=' + result.isError));
    byId('results').append(card);
  }
  if (!report.results.length) byId('results').append(element('p', 'No SDK result was produced.'));
  byId('verification').textContent = JSON.stringify(
    {
      orderVerified: report.orderVerified,
      answersVerified: report.answersVerified,
      nativeSessionIds: [...new Set(report.results.map((result) => result.sessionId))],
      scenarioVerified: report.verified,
      model: report.model,
    },
    null,
    2,
  );
  byId('error').textContent = report.error;
  byId('error').classList.toggle('hidden', !report.error);
  const duplicateGuard = report.error.startsWith('DUPLICATE_MESSAGE_ID');
  byId('status').textContent = report.error
    ? duplicateGuard ? 'Application guard' : 'Run failed'
    : report.verified
      ? 'Verified'
      : 'Review result';
  byId('status').className = 'badge ' + (report.verified && !report.error ? 'passed' : 'mismatch');
  byId('progress').textContent = report.error
    ? duplicateGuard ? 'Duplicate UUID detected by application validation before query creation.' : 'Inspect the observed run diagnostic.'
    : 'Completed one real SDK query and preserved its actual result coverage.';
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
}
async function run() {
  for (const id of ['mode', 'inspect', 'repair']) byId(id).disabled = true;
  byId('error').classList.add('hidden');
  byId('download').classList.add('hidden');
  byId('status').textContent = 'Running';
  byId('status').className = 'badge';
  byId('progress').textContent = 'Waiting for actual SDK result groups.';
  lastReport = undefined;
  for (const id of ['submitted', 'yielded', 'groups', 'coverage']) byId(id).textContent = '—';
  byId('items').replaceChildren(element('p', 'Preparing fresh queue input.'));
  byId('results').replaceChildren(element('p', 'Waiting for the native SDK output.'));
  byId('verification').textContent = 'Awaiting queue completion.';
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
  byId('mode').value = 'rapid';
};
window.lesson = { showView, source, restore, report: () => lastReport };
