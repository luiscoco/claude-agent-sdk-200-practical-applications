const byId = (id) => document.getElementById(id);
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

let configuration;
function showSelected() {
  if (!configuration) return;
  byId('facts').textContent =
    'Public source · ' +
    configuration.pageUrl +
    '\nContent role · untrusted source data · ' +
    (byId('mode').value === 'blocked'
      ? 'Deliberate retrieval denial'
      : 'Allowed exact URL and retrieval prompt');
}
function displayReport(report) {
  lastReport = report;
  const fetched = report.fetches.find(
    (fetch) => fetch.code === 200 && fetch.url === report.pageUrl,
  );
  const output = report.output;
  byId('http-status').textContent = fetched?.code ?? 'Unavailable';
  byId('byte-count').textContent = fetched?.bytes ?? 'Unavailable';
  byId('excerpt-check').textContent = report.observations.observedExcerpt
    ? 'Observed'
    : 'Unavailable';
  byId('marker-status').textContent =
    report.observations.markerObservedInAssistant || report.observations.markerObservedInToolInputs
      ? 'Observed'
      : 'Absent in this case';
  byId('page-title').textContent = output?.title || 'Actual page summary';
  byId('page-summary').textContent = output?.summary || 'Awaiting a retrieved summary.';
  byId('source-link').href = report.pageUrl;
  byId('source-link').textContent = report.pageUrl;
  byId('page-excerpt').textContent =
    output?.instructionExcerpt || 'Awaiting an observed instruction-like excerpt.';
  byId('retrieval-note').textContent = output?.note || '';
  byId('native-result').textContent = fetched?.processedResult ?? 'Retrieval result unavailable.';
  byId('observations').textContent = JSON.stringify(report.observations, null, 2);
  byId('dummy-marker').textContent = report.dummyMarker;
  byId('evidence').textContent = report.calls
    .filter((call) => call.name === 'WebFetch')
    .map(
      (call) =>
        'WebFetch url = ' +
        JSON.stringify(call.input.url) +
        '\nprompt = ' +
        JSON.stringify(call.input.prompt),
    )
    .join('\n\n');
  byId('tool-results').textContent = JSON.stringify(
    {
      fetches: report.fetches.map(({ processedResult, ...metadata }) => metadata),
      toolResults: report.toolResults,
    },
    null,
    2,
  );
  byId('raw-output').textContent = JSON.stringify(report.rawOutput, null, 2);
  const nativeError =
    report.mode === 'blocked' || !report.verified
      ? report.toolResults.findLast((result) => result.isError)
      : undefined;
  byId('error').textContent =
    report.error ||
    (nativeError
      ? typeof nativeError.content === 'string'
        ? nativeError.content
        : JSON.stringify(nativeError.content)
      : '');
  byId('error').classList.toggle('hidden', !byId('error').textContent);
  byId('status').textContent = report.verified
    ? report.mode === 'blocked'
      ? 'Retrieval access denied'
      : 'Recorded case verified'
    : 'Review';
  byId('status').className =
    'badge ' + (report.verified && report.mode === 'fetch' ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Preserved actual native retrieval, structured summary and scoped observations of the selected dummy-marker case.';
  byId('metadata').textContent = JSON.stringify(
    {
      nativeSessionId: report.sessionId,
      actualInitialTools: report.initialTools,
      nativeFetchDenied: report.nativeFetchDenied,
      resultMetadata: report.resultMetadata,
      scenarioVerified: report.verified,
    },
    null,
    2,
  );
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
}
async function run() {
  lastReport = undefined;
  for (const id of ['mode', 'inspect', 'repair']) byId(id).disabled = true;
  for (const id of ['error', 'download']) byId(id).classList.add('hidden');
  for (const id of ['http-status', 'byte-count', 'excerpt-check', 'marker-status'])
    byId(id).textContent = '—';
  for (const id of [
    'page-summary',
    'page-excerpt',
    'native-result',
    'observations',
    'dummy-marker',
    'evidence',
    'tool-results',
    'raw-output',
    'metadata',
  ])
    byId(id).textContent = 'Awaiting actual retrieval evidence.';
  byId('page-title').textContent = 'Actual page summary';
  byId('source-link').removeAttribute('href');
  byId('source-link').textContent = '';
  byId('retrieval-note').textContent = '';
  byId('status').textContent = 'Retrieving';
  byId('status').className = 'badge';
  byId('progress').textContent =
    'Fetching the actual public page, extracting a summary and preserving embedded examples in the source-data role.';
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
  if (!response.ok) throw new Error('Saved retrieval report unavailable.');
  const report = await response.json();
  byId('mode').value = report.mode;
  showSelected();
  displayReport(report);
  return report;
}
byId('mode').onchange = showSelected;
byId('inspect').onclick = run;
byId('repair').onclick = () => {
  byId('mode').value = 'fetch';
  showSelected();
};
window.lesson = { showView, source, restore, report: () => lastReport };
try {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Retrieval settings unavailable.');
  configuration = await response.json();
  showSelected();
  byId('inspect').disabled = false;
  byId('status').textContent = 'Ready';
  byId('progress').textContent =
    'Retrieve the actual public page and inspect its summary, embedded example and case observations.';
} catch (error) {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
}
