const byId = (id) => document.getElementById(id);
let lastReport;
function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}
async function source(file = 'src/renderer.ts') {
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
let observations = [];
function showSnapshot(snapshot) {
  byId('output').textContent = snapshot.visibleText;
  byId('completed').textContent = snapshot.completedText || 'Awaiting completed text.';
  byId('characters').textContent = snapshot.visibleText.length;
  byId('verification').textContent = JSON.stringify(
    snapshot.blocks.map((block) => ({
      key: block.key,
      messageId: block.messageId,
      streamedCharacters: block.streamed.length,
      completedCharacters: block.completed?.length ?? 0,
      displayedCharacters: block.displayed.length,
    })),
    null,
    2,
  );
}
function observe(event) {
  observations.push(event);
  if (event.type === 'delta-render' || event.type === 'completed-render')
    showSnapshot(event.detail);
  byId('deltas').textContent = observations.filter((item) => item.type === 'delta-render').length;
  byId('completions').textContent = observations.filter(
    (item) => item.type === 'completed-render',
  ).length;
}
function displayReport(report) {
  lastReport = report;
  observations = report.observations;
  showSnapshot(report);
  byId('deltas').textContent = report.deltaCount;
  byId('completions').textContent = report.completedCount;
  byId('extra').textContent = report.visibleText.length - report.completedText.length;
  const duplicated = report.mode === 'naive' && report.verified;
  byId('status').textContent = duplicated
    ? 'Duplicate observed'
    : report.verified
      ? 'Verified'
      : 'Run failed';
  byId('status').className = 'badge ' + (report.verified && !duplicated ? 'passed' : 'mismatch');
  byId('progress').textContent = report.verified
    ? 'Actual SDK response and selected rendering behavior verified.'
    : 'Inspect the actual response and block verification.';
  byId('error').textContent = duplicated
    ? 'CLASSROOM_DUPLICATE_RENDER · Completed text was appended to its already displayed deltas.'
    : report.error ||
      (!report.success
        ? report.answer
        : report.verified
          ? ''
          : 'VERIFICATION_FAILED · Inspect the response and block mapping.');
  byId('error').classList.toggle('hidden', !byId('error').textContent);
  byId('verification').textContent +=
    '\n\n' +
    JSON.stringify(
      {
        finalTextMatched: report.finalTextMatched,
        expectedResponseMatched: report.answer.trim() === report.expectedText,
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
  observations = [];
  for (const id of ['mode', 'inspect', 'repair']) byId(id).disabled = true;
  byId('error').classList.add('hidden');
  byId('download').classList.add('hidden');
  byId('status').textContent = 'Streaming';
  byId('status').className = 'badge';
  byId('progress').textContent = 'Receiving real text deltas and completed SDK blocks.';
  byId('output').textContent = '';
  byId('completed').textContent = 'Awaiting completed text.';
  byId('verification').textContent = 'Awaiting actual block identities.';
  for (const id of ['deltas', 'completions', 'characters']) byId(id).textContent = '0';
  byId('extra').textContent = 'Pending';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: byId('mode').value }),
    });
    if (!response.ok) throw new Error((await response.json()).error);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    while (true) {
      const { done, value } = await reader.read();
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let boundary;
      while ((boundary = pending.indexOf('\n\n')) >= 0) {
        const frame = pending.slice(0, boundary);
        pending = pending.slice(boundary + 2);
        if (!frame.trim()) continue;
        const [typeLine, dataLine] = frame.split('\n');
        const type = typeLine.slice(7),
          data = JSON.parse(dataLine.slice(6));
        if (type === 'observation') observe(data);
        if (type === 'complete') displayReport(data);
        if (type === 'failure') throw new Error(data.error);
      }
      if (done) break;
    }
    if (!lastReport || pending.trim())
      throw new Error('The response stream ended without a complete report.');
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
  byId('mode').value = 'reconciled';
};
window.lesson = {
  showView,
  source,
  restore,
  report: () => lastReport,
  observations: () => observations,
};
try {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Task configuration unavailable.');
  byId('task').textContent = (await response.json()).expectedText;
  byId('inspect').disabled = false;
  byId('status').textContent = 'Ready';
  byId('progress').textContent =
    'Each mode receives both real partial events and completed assistant messages.';
} catch (error) {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
}
