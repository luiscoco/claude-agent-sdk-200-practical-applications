const byId = (id) => document.getElementById(id);
let lastReport;
function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}
async function source(file = 'src/cleanup.ts') {
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
  byId('processes').textContent = report.reports.filter((item) => item.process.aliveAtStart).length;
  byId('cleanup').textContent = report.reports.filter((item) => item.cleanupCalled).length;
  byId('closed').textContent = report.reports.filter((item) => item.process.closeObserved).length;
  byId('alive').textContent = report.reports.filter(
    (item) => item.process.aliveAfterCleanup === true,
  ).length;
  byId('scenarios').replaceChildren();
  for (const item of report.reports) {
    const card = element('section', '');
    card.className = 'panel scenario-card';
    card.dataset.mode = item.mode;
    const heading = element('div', '');
    heading.className = 'heading';
    heading.append(
      element(
        'h3',
        {
          success: '✓ Successful query',
          cancel: '◼ Streaming cancellation',
          exception: '⚠ Application exception',
        }[item.mode],
      ),
    );
    card.append(heading);
    const details = element(
      'pre',
      JSON.stringify(
        {
          pid: item.process.pid,
          aliveAtStart: item.process.aliveAtStart,
          cleanupCalled: item.cleanupCalled,
          closeObserved: item.process.closeObserved,
          exitCode: item.process.exitCode,
          signal: item.process.signal,
          applicationFallbackKill: item.process.applicationFallbackKill,
          aliveAfterCleanup: item.process.aliveAfterCleanup,
          verifiedStopped: item.process.verifiedStopped,
        },
        null,
        2,
      ),
    );
    card.append(details);
    const diagnostic = element(
      'p',
      item.applicationError || item.sdkError || 'Actual answer ' + item.answer,
    );
    diagnostic.className = 'outcome ' + (item.mode === 'success' ? 'success' : 'diagnostic');
    card.append(diagnostic);
    if (item.mode === 'cancel') {
      const excerpt = item.partialText.slice(0, 120);
      card.append(
        element(
          'p',
          'Actual streamed prefix, first ' +
            excerpt.length +
            ' of ' +
            item.partialText.length +
            ' characters · ' +
            JSON.stringify(excerpt),
        ),
      );
    }
    byId('scenarios').append(card);
  }
  byId('verification').textContent = JSON.stringify(
    report.reports.map((item) => ({
      mode: item.mode,
      events: item.events,
      cleanupError: item.cleanupError,
      verified: item.verified,
    })),
    null,
    2,
  );
  byId('status').textContent = report.verified ? 'Verified' : 'Review cleanup';
  byId('status').className = 'badge ' + (report.verified ? 'passed' : 'mismatch');
  byId('progress').textContent = report.verified
    ? 'Scenario outcomes and tracked subprocess termination verified.'
    : 'Inspect the observed outcome and process verification.';
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
}
async function run() {
  for (const id of ['mode', 'inspect', 'repair']) byId(id).disabled = true;
  byId('error').classList.add('hidden');
  byId('download').classList.add('hidden');
  byId('status').textContent = 'Running';
  byId('status').className = 'badge';
  byId('progress').textContent =
    'Running actual SDK queries and checking their tracked PIDs after cleanup.';
  lastReport = undefined;
  for (const id of ['processes', 'cleanup', 'closed', 'alive']) byId(id).textContent = '—';
  byId('scenarios').replaceChildren(element('p', 'Awaiting actual lifecycle observations.'));
  byId('verification').textContent = 'Awaiting real process close events and PID probes.';
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
window.lesson = { showView, source, restore, report: () => lastReport };
