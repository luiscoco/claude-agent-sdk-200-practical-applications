const byId = (id) => document.getElementById(id);
let lastReport;

function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}
async function source(file = 'fixtures/template/.claude/output-styles/teaching-report.md') {
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

function renderExplanation(answer) {
  byId('answer').replaceChildren();
  for (const paragraph of answer.split(/\n\s*\n/)) {
    const heading = paragraph.match(/^##\s+([^\n]+)$/);
    byId('answer').append(element(heading ? 'h4' : 'p', heading ? heading[1] : paragraph));
  }
}

function displayReport(report) {
  lastReport = report;
  byId('active-style').textContent = report.activeStyle;
  byId('baseline').textContent =
    report.baseline.counts.failed + ' / ' + report.baseline.counts.total;
  byId('passed').textContent =
    report.verification.counts.passed + ' / ' + report.verification.counts.total;
  byId('verified').textContent = report.verified ? 'Passed' : 'Mismatch';
  renderExplanation(report.answer);
  byId('before').textContent = report.before;
  byId('after').textContent = report.after;
  const bash = report.events.filter((event) => event.tool === 'Bash').at(-1);
  byId('tool-check').textContent =
    'SDK Bash verification ' +
    (report.toolVerificationPassed ? 'passed' : 'needs review') +
    ' · Independent host exit code ' +
    report.verification.exitCode +
    ' · ' +
    (report.style === 'default'
      ? 'Built-in default style observed'
      : 'Required headings ' + (report.sectionsMatched ? 'matched' : 'missing'));
  byId('verification').textContent =
    'SDK Bash command\n' +
    (bash?.input?.command || 'No Bash command observed') +
    '\n\n' +
    (bash?.response?.stdout || '') +
    '\nIndependent host test output\n' +
    report.verification.stdout;
  byId('status').textContent = report.verified ? 'Verified' : 'Review result';
  byId('status').className = 'badge ' + (report.verified ? 'passed' : 'mismatch');
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
  byId('progress').textContent =
    'Completed a fresh code repair, observed tool verification, and an independent test recheck.';
}
async function run() {
  lastReport = undefined;
  for (const id of ['style', 'inspect', 'repair']) byId(id).disabled = true;
  byId('error').classList.add('hidden');
  byId('download').classList.add('hidden');
  byId('status').textContent = 'Running';
  byId('status').className = 'badge';
  for (const id of ['active-style', 'baseline', 'passed', 'verified']) byId(id).textContent = '—';
  byId('answer').textContent = 'Awaiting a completed SDK repair.';
  byId('after').textContent = 'Awaiting the agent’s Edit.';
  byId('verification').textContent = 'Awaiting actual test output.';
  byId('tool-check').textContent =
    'The agent will read the fixture, apply an Edit, and run the exact test command.';
  byId('progress').textContent = 'Running the baseline, SDK repair, and independent test recheck.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ style: byId('style').value }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error);
    displayReport(report);
  } catch (error) {
    byId('status').textContent = 'Stopped';
    byId('error').textContent = error.message;
    byId('error').classList.remove('hidden');
    byId('progress').textContent = 'Restore a supported output style and retry the experiment.';
  } finally {
    for (const id of ['style', 'inspect', 'repair']) byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved report unavailable.');
  const report = await response.json();
  byId('style').value = report.style;
  displayReport(report);
  return report;
}
byId('inspect').onclick = run;
byId('repair').onclick = () => {
  byId('style').value = 'teaching-report';
};
window.lesson = { showView, source, restore, report: () => lastReport };
