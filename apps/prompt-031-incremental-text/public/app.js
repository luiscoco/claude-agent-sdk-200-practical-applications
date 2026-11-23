const byId = (id) => document.getElementById(id);
let lastReport;
function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}
async function source(file = 'src/stream.ts') {
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
let observed = [];
let updates = 0;
function observe(event) {
  observed.push(event);
  if (event.type === 'observed-text-delta')
    byId('deltas').textContent = observed.filter(
      (item) => item.type === 'observed-text-delta',
    ).length;
  if (event.type === 'completed-block')
    byId('blocks').textContent = observed.filter((item) => item.type === 'completed-block').length;
  if (event.type === 'render-text') {
    byId('output').textContent += event.text;
    byId('output').scrollTop = byId('output').scrollHeight;
    byId('updates').textContent = ++updates;
    if (updates === 1) byId('first-text').textContent = event.elapsedMs + ' ms';
  }
  byId('metrics').textContent = JSON.stringify(
    {
      latestEvent: event.type,
      elapsedMs: event.elapsedMs,
      finalResultReceived: observed.some((item) => item.type === 'result'),
    },
    null,
    2,
  );
}
function displayReport(report) {
  lastReport = report;
  observed = report.events;
  const firstRender = observed.find((event) => event.type === 'render-text');
  byId('output').textContent = report.renderedText || 'No text passed the selected display filter.';
  byId('deltas').textContent = report.deltaCount;
  byId('updates').textContent = observed.filter((event) => event.type === 'render-text').length;
  byId('blocks').textContent = observed.filter((event) => event.type === 'completed-block').length;
  byId('first-text').textContent = firstRender ? firstRender.elapsedMs + ' ms' : 'No visible text';
  byId('metrics').textContent = JSON.stringify(
    {
      acceptedDeltaType: report.acceptedDeltaType,
      firstRenderedTextMs: firstRender?.elapsedMs ?? null,
      firstCompletedBlockMs:
        observed.find((event) => event.type === 'completed-block')?.elapsedMs ?? null,
      resultMs: observed.find((event) => event.type === 'result')?.elapsedMs ?? null,
      finalTextMatched: report.finalTextMatched,
      renderedTextMatched: report.renderedText === report.answer,
      scenarioVerified: report.verified,
      nativeSessionId: report.sessionId,
    },
    null,
    2,
  );
  const filterError = report.mode === 'wrong-filter' && report.verified;
  byId('status').textContent = filterError
    ? 'Observed filter error'
    : report.verified
      ? 'Verified'
      : 'Run failed';
  byId('status').className = 'badge ' + (report.verified && !filterError ? 'passed' : 'mismatch');
  byId('progress').textContent = 'Completed the selected response-display experiment.';
  const error = filterError
    ? 'CLASSROOM_FILTER_ERROR · Text deltas arrived, while the display filter accepted input_json_delta.'
    : report.error;
  byId('error').textContent = error;
  byId('error').classList.toggle('hidden', !error);
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
}
async function run() {
  lastReport = undefined;
  observed = [];
  updates = 0;
  for (const id of ['mode', 'prompt', 'inspect', 'repair']) byId(id).disabled = true;
  for (const id of ['deltas', 'updates', 'blocks']) byId(id).textContent = '0';
  byId('first-text').textContent = 'Waiting';
  byId('output').textContent = '';
  byId('metrics').textContent = 'Awaiting actual SDK events.';
  byId('error').classList.add('hidden');
  byId('download').classList.add('hidden');
  byId('status').textContent = 'Streaming';
  byId('status').className = 'badge';
  byId('progress').textContent = 'Receiving actual SDK events over the local response stream.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: byId('mode').value, prompt: byId('prompt').value }),
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
        const type = typeLine.slice(7);
        const data = JSON.parse(dataLine.slice(6));
        if (type === 'observation') observe(data);
        if (type === 'complete') displayReport(data);
        if (type === 'failure') throw new Error(data.error);
      }
      if (done) break;
    }
    if (!lastReport || pending.trim())
      throw new Error('The local response stream ended without a complete report.');
  } catch (error) {
    byId('status').textContent = 'Stopped';
    byId('error').textContent = error.message;
    byId('error').classList.remove('hidden');
  } finally {
    for (const id of ['mode', 'prompt', 'inspect', 'repair']) byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved report unavailable.');
  const report = await response.json();
  byId('mode').value = report.mode;
  byId('prompt').value = report.prompt;
  displayReport(report);
  return report;
}
byId('inspect').onclick = run;
byId('repair').onclick = () => {
  byId('mode').value = 'incremental';
};
window.lesson = {
  showView,
  source,
  restore,
  report: () => lastReport,
  observations: () => observed,
};
try {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Configuration unavailable.');
  byId('prompt').value = (await response.json()).defaultPrompt;
  byId('inspect').disabled = false;
  byId('status').textContent = 'Ready';
  byId('progress').textContent =
    'Run a real response and inspect when its first text becomes visible.';
} catch (error) {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
}
