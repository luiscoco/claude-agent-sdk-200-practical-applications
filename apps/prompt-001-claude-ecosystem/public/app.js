const byId = (id) => document.getElementById(id);
let lastReport;
function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}
async function source(file = 'src/routes.ts') {
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

let configuration;
function showSelected() {
  if (!configuration) return;
  const id = byId('route').value;
  if (id !== 'embedded') byId('parser').value = 'correct';
  byId('parser').disabled = id !== 'embedded';
  byId('inspect').textContent = id === 'managed' ? 'Inspect hosted route' : '▶ Run selected route';
  document
    .querySelectorAll('.route-card')
    .forEach((card) => card.classList.toggle('active', card.dataset.route === id));
  byId('facts').textContent = configuration.facts;
}
function displayReport(report) {
  lastReport = report;
  byId('selected').textContent = report.route.product;
  byId('native-type').textContent = report.comparisonOnly
    ? 'Documentation'
    : (report.nativeResponse?.type ?? 'Unavailable');
  byId('tool-count').textContent = report.toolCalls.length;
  byId('verified').textContent = report.verified ? 'Passed' : 'Review';
  byId('answer').textContent =
    report.answer || 'Application answer withheld at the response-contract boundary.';
  byId('native').textContent = JSON.stringify(
    {
      comparisonOnly: report.comparisonOnly,
      nativeResponseType: report.nativeResponse?.type,
      nativeSubtype: report.nativeResponse?.subtype,
      nativeVersion: report.nativeVersion,
      applicationProvidedFileContent: report.applicationProvidedFileContent,
      responseFields: {
        hasResult: Boolean(report.nativeResponse && Object.hasOwn(report.nativeResponse, 'result')),
        hasContent: Boolean(
          report.nativeResponse && Object.hasOwn(report.nativeResponse, 'content'),
        ),
      },
      toolCalls: report.toolCalls,
    },
    null,
    2,
  );
  byId('error').textContent = report.error;
  byId('error').classList.toggle('hidden', !report.error);
  byId('metadata').textContent = JSON.stringify(
    {
      route: report.route.id,
      parser: report.parser,
      scenarioVerified: report.verified,
      factsVerified: report.factsVerified,
      readObserved: report.readObserved,
      documentation: report.route.documentation,
    },
    null,
    2,
  );
  byId('status').textContent = report.comparisonOnly
    ? 'Compared'
    : report.error
      ? 'Parser rejected'
      : report.verified
        ? 'Verified'
        : 'Review';
  byId('status').className = 'badge ' + (report.verified && !report.error ? 'passed' : 'mismatch');
  byId('progress').textContent = report.comparisonOnly
    ? 'Documentation-backed comparison of the hosted route.'
    : 'Preserved the actual native response and observed tool calls for this interface.';
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
}
async function run() {
  lastReport = undefined;
  for (const id of ['route', 'parser', 'inspect', 'repair']) byId(id).disabled = true;
  byId('error').classList.add('hidden');
  byId('download').classList.add('hidden');
  byId('status').textContent = 'Running';
  byId('status').className = 'badge';
  byId('progress').textContent = 'Running the selected classroom interface.';
  for (const id of ['answer', 'native']) byId(id).textContent = 'Awaiting the actual response.';
  for (const id of ['selected', 'native-type', 'tool-count', 'verified'])
    byId(id).textContent = '—';
  byId('metadata').textContent = '';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ route: byId('route').value, parser: byId('parser').value }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error);
    displayReport(report);
  } catch (error) {
    byId('status').textContent = 'Stopped';
    byId('error').textContent = error.message;
    byId('error').classList.remove('hidden');
  } finally {
    for (const id of ['route', 'parser', 'inspect', 'repair']) byId(id).disabled = false;
    showSelected();
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved report unavailable.');
  const report = await response.json();
  byId('route').value = report.route.id;
  showSelected();
  byId('parser').value = report.parser;
  displayReport(report);
  return report;
}
byId('route').onchange = showSelected;
byId('inspect').onclick = run;
byId('repair').onclick = () => {
  byId('parser').value = 'correct';
};
window.lesson = { showView, source, restore, report: () => lastReport };
try {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Classroom configuration unavailable.');
  configuration = await response.json();
  for (const route of configuration.routes) {
    const card = element('article', '');
    card.className = 'route-card';
    card.dataset.route = route.id;
    card.append(
      element('h3', route.product),
      element('p', route.goal),
      element('p', route.runner),
      element('code', route.interface),
      element('p', route.capabilities),
    );
    const link = element('a', 'Official reference');
    link.href = route.documentation;
    link.target = '_blank';
    link.rel = 'noopener';
    card.append(link);
    byId('routes').append(card);
  }
  showSelected();
  byId('inspect').disabled = false;
  byId('status').textContent = 'Ready';
  byId('progress').textContent =
    'Choose a goal, inspect its interface and run the matching classroom example.';
} catch (error) {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
}
