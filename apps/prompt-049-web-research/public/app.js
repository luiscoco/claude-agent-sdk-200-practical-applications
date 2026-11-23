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
    'Native WebSearch · allowed_domains ' +
    JSON.stringify(configuration.sourceDomains) +
    '\nAccess policy · ' +
    (byId('mode').value === 'blocked'
      ? 'Deliberate classroom denial'
      : 'Allow the exact question and domain list');
}
function sourceLink(url, title) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return element('span', title || url);
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    !configuration.sourceDomains.includes(parsed.hostname)
  )
    return element('span', title || url);
  const link = element('a', title || url);
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}
function displayReport(report) {
  lastReport = report;
  byId('hit-count').textContent = report.hits.length;
  byId('finding-count').textContent = report.trustedFindings.length;
  byId('source-check').textContent = report.validation.valid ? 'Passed' : 'Review';
  byId('access-state').textContent = report.nativeSearchDenied
    ? 'Denied'
    : report.searches.length
      ? 'Allowed'
      : 'Unavailable';
  byId('findings').replaceChildren();
  for (const finding of report.trustedFindings) {
    const card = document.createElement('article');
    card.className = 'finding';
    card.append(element('p', finding.summary));
    for (const url of finding.sourceUrls) card.append(sourceLink(url));
    byId('findings').append(card);
  }
  if (!report.trustedFindings.length)
    byId('findings').append(element('p', 'Awaiting findings supported by observed source URLs.'));
  byId('research-note').textContent = report.validation.note;
  byId('hits').replaceChildren();
  for (const hit of report.hits) {
    const item = document.createElement('article');
    item.append(sourceLink(hit.url, hit.title), element('small', hit.url));
    byId('hits').append(item);
  }
  byId('evidence').textContent = report.calls
    .filter((call) => call.name === 'WebSearch')
    .map(
      (call) =>
        'WebSearch query = ' +
        JSON.stringify(call.input.query) +
        '\nallowed_domains = ' +
        JSON.stringify(call.input.allowed_domains),
    )
    .join('\n\n');
  byId('validation').textContent = JSON.stringify(
    {
      actualHitUrls: report.hits.map((hit) => hit.url),
      citedFindingCount: report.trustedFindings.length,
      sourceMembershipValid: report.validation.valid,
      checks: report.validation.checks,
    },
    null,
    2,
  );
  byId('raw-output').textContent = JSON.stringify(report.rawOutput, null, 2);
  byId('tool-results').textContent = JSON.stringify(
    { searches: report.searches, toolResults: report.toolResults },
    null,
    2,
  );
  const nativeError = report.mode === 'blocked' || !report.verified
    ? report.toolResults.findLast((result) => result.isError)
    : undefined;
  byId('error').textContent =
    report.error ||
    (nativeError
      ? typeof nativeError.content === 'string'
        ? nativeError.content
        : JSON.stringify(nativeError.content)
      : '') ||
    report.validation.checks.join('\n');
  byId('error').classList.toggle('hidden', !byId('error').textContent);
  byId('status').textContent = report.verified
    ? report.mode === 'blocked'
      ? 'Search access denied'
      : 'Search verified'
    : 'Review';
  byId('status').className =
    'badge ' + (report.verified && report.mode === 'search' ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Preserved actual native search queries, returned source titles and URLs, structured findings and citation membership checks.';
  byId('metadata').textContent = JSON.stringify(
    {
      nativeSessionId: report.sessionId,
      actualInitialTools: report.initialTools,
      searchDurationsSeconds: report.searches.map((search) => search.durationSeconds),
      nativeSearchDenied: report.nativeSearchDenied,
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
  for (const id of ['mode', 'question', 'inspect', 'repair']) byId(id).disabled = true;
  for (const id of ['error', 'download']) byId(id).classList.add('hidden');
  for (const id of ['hit-count', 'finding-count', 'source-check', 'access-state'])
    byId(id).textContent = '—';
  for (const id of [
    'findings',
    'hits',
    'evidence',
    'validation',
    'raw-output',
    'tool-results',
    'metadata',
  ])
    byId(id).textContent = 'Awaiting actual web research.';
  byId('research-note').textContent = '';
  byId('status').textContent = 'Researching';
  byId('status').className = 'badge';
  byId('progress').textContent =
    'Running the exact question through native WebSearch and validating the resulting source citations.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: byId('mode').value, question: byId('question').value }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error);
    displayReport(report);
  } catch (error) {
    byId('status').textContent = 'Stopped';
    byId('error').textContent = error.message;
    byId('error').classList.remove('hidden');
  } finally {
    for (const id of ['mode', 'question', 'inspect', 'repair']) byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved research report unavailable.');
  const report = await response.json();
  byId('mode').value = report.mode;
  byId('question').value = report.searchQuery;
  showSelected();
  displayReport(report);
  return report;
}
byId('mode').onchange = showSelected;
byId('inspect').onclick = run;
byId('repair').onclick = () => {
  byId('mode').value = 'search';
  showSelected();
};
window.lesson = { showView, source, restore, report: () => lastReport };
try {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Research settings unavailable.');
  configuration = await response.json();
  byId('question').value = configuration.defaultQuestion;
  showSelected();
  byId('inspect').disabled = false;
  byId('status').textContent = 'Ready';
  byId('progress').textContent =
    'Research a Claude documentation question and inspect actual returned source URLs.';
} catch (error) {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
}
