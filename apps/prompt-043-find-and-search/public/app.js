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
const patterns = {
  matches: 'validateDiscount|MAX_DISCOUNT_CENTS',
  'no-results': 'NO_SUCH_DISCOUNT_SYMBOL',
  'invalid-regex': '[',
};
function showSelected() {
  byId('facts').textContent =
    'Glob pattern · **/*.ts\nGrep regex · ' +
    patterns[byId('mode').value] +
    '\nSearch root · fixtures/project';
}
function showFile(name, line = 1) {
  const files = lastReport?.snapshot.files ?? configuration.files;
  const file = files.find((file) => file.name === name.replaceAll('\\', '/').replace(/^\.\//, ''));
  byId('file-title').textContent = 'Classroom source · ' + name;
  byId('target-source').replaceChildren();
  if (!file) {
    byId('target-source').textContent = 'A matching classroom source file is unavailable.';
    return;
  }
  file.lines.forEach((text, index) => {
    const row = element('span', text || ' ');
    row.className = 'target-line' + (index + 1 === line ? ' focus' : '');
    row.dataset.line = index + 1;
    byId('target-source').append(row);
  });
  const row = byId('target-source').querySelector('[data-line="' + line + '"]');
  if (row)
    byId('target-source').scrollTop = Math.max(
      0,
      row.offsetTop - byId('target-source').offsetTop - 50,
    );
}
function displayReport(report) {
  lastReport = report;
  const data = report.normalizedData ?? report.parsedData;
  byId('file-count').textContent = report.comparison.filesMatched ? data.files.length : 'Review';
  byId('match-count').textContent = data?.matches.length ?? 'Unavailable';
  byId('pattern-check').textContent = report.exactPattern ? 'Passed' : 'Review';
  byId('source-check').textContent = report.searchFailed
    ? 'Withheld'
    : report.comparison.filesMatched && report.comparison.matchesMatched
      ? 'Passed'
      : 'Review';
  byId('answer').textContent = data?.summary ?? 'A validated search summary was unavailable.';
  byId('project-files').replaceChildren();
  for (const file of data?.files ?? []) {
    const button = element('button', file);
    button.className = 'secondary';
    button.onclick = () => showFile(file);
    byId('project-files').append(button);
  }
  byId('matches').replaceChildren();
  for (const match of data?.matches ?? []) {
    const row = element('div', '');
    row.className = 'match-row';
    const button = element('button', match.file + ' · line ' + match.line);
    button.className = 'secondary';
    button.onclick = () => showFile(match.file, match.line);
    row.append(button, element('code', match.code));
    byId('matches').append(row);
  }
  if (!data?.matches.length)
    byId('matches').textContent = report.searchFailed
      ? 'Content search failed. Inspect its actual native error.'
      : 'The actual search returned zero matching source lines.';
  const first = data?.matches[0];
  if (first) showFile(first.file, first.line);
  else if (report.snapshot.files[0]) showFile(report.snapshot.files[0].name);
  byId('evidence').textContent = JSON.stringify(
    {
      availableTools: report.availableTools,
      calls: report.calls,
      exactPattern: report.exactPattern,
      searchFailed: report.searchFailed,
      hadSearchError: report.hadSearchError,
      independentComparison: report.comparison,
    },
    null,
    2,
  );
  byId('tool-results').textContent = JSON.stringify(report.toolResults, null, 2);
  const nativeError = report.searchFailed
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
    ? report.searchFailed
      ? 'Regex rejected'
      : report.task.mode === 'no-results'
        ? 'Empty result'
        : 'Verified'
    : 'Review';
  byId('status').className =
    'badge ' + (report.verified && !report.searchFailed ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Preserved actual Glob and Grep calls and compared the returned files and source lines with the independent project snapshot.';
  byId('metadata').textContent = JSON.stringify(
    {
      nativeSessionId: report.sessionId,
      schemaPassed: report.schemaPassed,
      filesMatched: report.comparison.filesMatched,
      matchesMatched: report.comparison.matchesMatched,
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
  byId('error').classList.add('hidden');
  byId('download').classList.add('hidden');
  byId('status').textContent = 'Running';
  byId('status').className = 'badge';
  byId('progress').textContent =
    'Finding actual TypeScript files, then running the exact requested content regex.';
  for (const id of ['file-count', 'match-count', 'pattern-check', 'source-check'])
    byId(id).textContent = '—';
  byId('answer').textContent = 'Awaiting actual native discovery and search.';
  byId('matches').textContent = 'Awaiting the actual content search.';
  byId('project-files').replaceChildren();
  byId('evidence').textContent = 'Awaiting actual tool calls.';
  byId('tool-results').textContent = '';
  byId('metadata').textContent = '';
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
  byId('mode').value = report.task.mode;
  showSelected();
  displayReport(report);
  return report;
}
byId('mode').onchange = showSelected;
byId('inspect').onclick = run;
byId('repair').onclick = () => {
  byId('mode').value = 'matches';
  showSelected();
};
window.lesson = { showView, source, restore, report: () => lastReport, showFile };
try {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Classroom project unavailable.');
  configuration = await response.json();
  showSelected();
  if (configuration.files[0]) showFile(configuration.files[0].name);
  else byId('target-source').textContent = 'The classroom project has no TypeScript source files.';
  byId('inspect').disabled = false;
  byId('status').textContent = 'Ready';
  byId('progress').textContent =
    'Find the actual files, inspect their content search results and validate matching source lines.';
} catch (error) {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
}
