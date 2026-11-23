const byId = (id) => document.getElementById(id);
let lastReport;
function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}
async function source(file = 'src/conversation.py') {
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
function display(report) {
  lastReport = report;
  byId('chat').replaceChildren();
  byId('boundaries').replaceChildren();
  byId('session').textContent = report.turns[0]?.sessionId || 'No session initialized';
  byId('turn-count').textContent = report.turns.length;
  byId('endings').textContent = report.turns.filter(
    (turn) => turn.receivedTypes.at(-1) === 'ResultMessage',
  ).length;
  byId('managed').textContent = String(report.clientContextCompleted);
  report.turns.forEach((turn, index) => {
    const row = document.createElement('article');
    row.className = 'conversation-turn';
    const question = document.createElement('div');
    question.className = 'user-message';
    question.append(element('strong', 'User · Turn ' + (index + 1)), element('p', turn.prompt));
    const answer = document.createElement('div');
    answer.className = 'assistant-message';
    answer.append(element('strong', 'Assistant'), element('p', turn.answer));
    row.append(question, answer);
    byId('chat').append(row);
    const boundary = document.createElement('article');
    boundary.className = 'response-boundary';
    boundary.append(
      element('strong', 'query() / receive_response() · ' + (index + 1)),
      element('p', turn.receivedTypes.join(' → ')),
      element('code', turn.sessionId),
    );
    byId('boundaries').append(boundary);
  });
  byId('chat').scrollTop = byId('chat').scrollHeight;
  byId('exception-panel').classList.toggle('hidden', !report.exception);
  byId('sdk-error').textContent = report.exception
    ? report.exception.type + '\n\n' + report.exception.message
    : '';
  byId('status').textContent =
    report.success && report.verified
      ? 'Verified'
      : report.exception
        ? 'Observed exception'
        : 'Review result';
  byId('status').className = 'badge ' + (report.success && report.verified ? 'passed' : 'mismatch');
  byId('runtime').textContent =
    'Python ' +
    report.pythonVersion +
    ' · SDK ' +
    report.sdkVersion +
    ' · Native runtime ' +
    (report.nativeVersion || 'Not initialized');
  byId('verification').textContent =
    'Scenario checks ' + (report.verified ? 'passed' : 'need review');
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
  byId('progress').textContent =
    'Preserved the actual Python client responses and observed lifecycle outcome.';
}
async function run() {
  lastReport = undefined;
  for (const id of ['mode', 'inspect', 'repair']) byId(id).disabled = true;
  byId('error').classList.add('hidden');
  byId('exception-panel').classList.add('hidden');
  byId('download').classList.add('hidden');
  byId('status').textContent = 'Running Python client';
  byId('status').className = 'badge';
  for (const id of ['session', 'turn-count', 'endings', 'managed']) byId(id).textContent = '—';
  byId('chat').replaceChildren();
  byId('boundaries').replaceChildren();
  byId('verification').textContent = 'Awaiting client and response checks.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: byId('mode').value }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error);
    display(report);
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
  display(report);
  return report;
}
byId('inspect').onclick = run;
byId('repair').onclick = () => {
  byId('mode').value = 'conversation';
};
window.lesson = { showView, source, restore, report: () => lastReport };
try {
  const config = await (await fetch('/api/config')).json();
  byId('runtime').textContent = 'Python ' + config.pythonVersion + ' · SDK ' + config.sdkVersion;
  byId('inspect').disabled = false;
} catch (error) {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
}
