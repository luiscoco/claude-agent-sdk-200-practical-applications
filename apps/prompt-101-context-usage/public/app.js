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
const number = (value) => new Intl.NumberFormat('en-US').format(value);
function svgNode(tag, attributes) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  return node;
}
function showProfile() {
  if (!lastReport) return;
  const profile = lastReport.profiles[Number(byId('profile-select').value)],
    view = profile.view;
  byId('used-value').textContent = number(view.usedTokens);
  byId('window-value').textContent = number(view.windowTokens);
  byId('largest-value').textContent = view.largestUsedContributor?.name ?? 'None reported';
  byId('cost-value').textContent = '$' + lastReport.output.nativeModelCostUsd;
  byId('profile-metadata').textContent =
    profile.profile.toUpperCase() +
    ' · ' +
    profile.rows +
    ' owned records · ' +
    number(profile.contextCharacters) +
    ' input characters\nReported model: ' +
    view.model +
    ' · actual native session: ' +
    profile.command.actualSessionId;
  byId('budget-chart').replaceChildren();
  byId('budget-legend').replaceChildren();
  let offset = 0;
  for (const segment of view.segments) {
    const width = segment.percentageOfReportedWindow * 10;
    byId('budget-chart').append(
      svgNode('rect', {
        x: offset,
        y: 0,
        width,
        height: 72,
        class: 'segment-' + segment.kind,
        'data-tokens': segment.tokens,
      }),
    );
    offset += width;
    const row = element(
      'article',
      segment.name +
        ' · ' +
        number(segment.tokens) +
        ' estimated tokens · ' +
        segment.percentageOfReportedWindow.toFixed(1) +
        '%',
    );
    row.className = 'legend-item ' + segment.kind;
    byId('budget-legend').append(row);
  }
  byId('ranking').replaceChildren();
  for (const [index, category] of view.rankedUsedContributors.entries()) {
    const row = element('article', '', '');
    row.className = 'rank-row';
    row.append(
      element('strong', index + 1 + '. ' + category.name),
      element('span', number(category.tokens) + ' estimated tokens'),
    );
    byId('ranking').append(row);
  }
  if (!view.rankedUsedContributors.length)
    byId('ranking').append(element('p', 'No used category was returned by this baseline report.'));
  byId('native-report').textContent = JSON.stringify(profile.rawContextUsage, null, 2);
  byId('native-markdown').textContent = profile.nativeMarkdown;
  byId('checks').textContent = JSON.stringify(
    { entireComparison: lastReport.checks, selectedNativeProfile: profile.checks },
    null,
    2,
  );
  byId('evidence').textContent = JSON.stringify(
    {
      profile: profile.profile,
      actualNativeSession: profile.command.actualSessionId,
      actualNativeResultSession: profile.command.actualResultSessionId,
      command: '/context',
      structuredReportModel: profile.rawContextUsage.model,
      nativeAssistantModelTurns: profile.command.turns,
      nativeModelCost: profile.command.costUsd,
      nativeApiDurationMs: profile.command.durationApiMs,
    },
    null,
    2,
  );
}
function display(report) {
  lastReport = report;
  byId('mode').value = report.requestedInput.mode;
  byId('topic').value = report.requestedInput.topic;
  byId('profile-select').replaceChildren();
  report.profiles.forEach((profile, index) => {
    const option = element(
      'option',
      profile.profile.toUpperCase() +
        ' · ' +
        number(profile.view.usedTokens) +
        ' estimated used tokens',
    );
    option.value = index;
    byId('profile-select').append(option);
  });
  byId('profile-select').value = report.profiles.length - 1;
  byId('profile-select').disabled = false;
  showProfile();
  byId('comparison').replaceChildren();
  const maximum = Math.max(1, ...report.profiles.map((profile) => profile.view.usedTokens));
  for (const profile of report.profiles) {
    const row = element('article', '');
    row.className = 'comparison-row';
    row.append(
      element(
        'strong',
        profile.profile.toUpperCase() +
          ' · ' +
          number(profile.view.usedTokens) +
          ' estimated tokens',
      ),
    );
    const chart = svgNode('svg', {
      viewBox: '0 0 1000 44',
      preserveAspectRatio: 'none',
      role: 'img',
      'aria-label': profile.profile + ' measured used tokens',
    });
    chart.append(
      svgNode('rect', {
        x: 0,
        y: 0,
        width: (profile.view.usedTokens / maximum) * 1000,
        height: 44,
        class: 'segment-used',
        'data-tokens': profile.view.usedTokens,
      }),
    );
    row.append(chart);
    byId('comparison').append(row);
  }
  byId('metadata').textContent = JSON.stringify(
    { id: report.id, checkedAt: report.checkedAt, fixtureDisclosure: report.fixtureDisclosure },
    null,
    2,
  );
  byId('status').textContent = report.verified
    ? 'Actual native context reports verified'
    : 'Verification failed';
  byId('status').className = 'badge ' + (report.verified ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Actual local /context reports received. Category kinds keep used contributors separate from reserved buffer and free capacity.';
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
  error(report.verified ? '' : 'Inspect the actual native context checks.');
}
async function measure() {
  for (const id of ['inspect', 'mode', 'topic', 'profile-select']) byId(id).disabled = true;
  lastReport = undefined;
  error('');
  byId('download').classList.add('hidden');
  byId('status').className = 'badge';
  byId('status').textContent = 'Measuring owned history with native local /context commands';
  for (const id of ['budget-chart', 'budget-legend', 'ranking', 'comparison'])
    byId(id).replaceChildren();
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: byId('mode').value, topic: byId('topic').value }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error || 'Native context measurement failed.');
    display(report);
    return report;
  } catch (failure) {
    error(failure.message);
    byId('status').textContent = 'Measurement failed';
    throw failure;
  } finally {
    for (const id of ['inspect', 'mode', 'topic']) byId(id).disabled = false;
    byId('profile-select').disabled = !lastReport;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Observed context report unavailable.');
  const report = await response.json();
  display(report);
  return report;
}
byId('inspect').onclick = () => measure().catch(() => {});
byId('profile-select').onchange = showProfile;
window.lesson = { showView, source, measure, restore, report: () => lastReport };
