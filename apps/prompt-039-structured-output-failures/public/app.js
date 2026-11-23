const byId = (id) => document.getElementById(id);
let lastReport;
function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}
async function source(file = 'src/results.ts') {
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
  const scenario = configuration.scenarios.find((item) => item.mode === byId('mode').value);
  byId('facts').textContent =
    scenario.prompt +
    '\n\nOutput schema: ' +
    JSON.stringify(scenario.schema) +
    '\nAgent-loop limit: ' +
    scenario.maxTurns;
}
function displayReport(report) {
  lastReport = report;
  byId('native').textContent = JSON.stringify(
    {
      subtype: report.nativeResult?.subtype ?? null,
      is_error: report.nativeResult?.is_error ?? null,
      errors: report.nativeResult?.errors ?? [],
      plainText:
        report.nativeResult?.subtype === 'success' ? report.nativeResult.result : undefined,
      terminalReason: report.nativeResult?.terminal_reason,
      otherToolCalls: report.otherToolCalls,
      followingIteratorException: report.iteratorError || null,
    },
    null,
    2,
  );
  byId('attempts').textContent = report.attempts.length
    ? report.attempts
        .map((attempt, index) => {
          const result = report.toolResults.find((item) => item.toolUseId === attempt.id);
          return (
            index +
            1 +
            '. input ' +
            JSON.stringify(attempt.input) +
            '\n' +
            (result
              ? (result.isError ? 'REJECTED · ' : 'ACCEPTED · ') +
                (typeof result.content === 'string'
                  ? result.content
                  : JSON.stringify(result.content))
              : 'No tool result observed.')
          );
        })
        .join('\n\n')
    : 'No StructuredOutput tool calls observed.';
  byId('raw').textContent = JSON.stringify(report.rawOutput, null, 2);
  byId('typed').textContent = report.typedOutput
    ? JSON.stringify(report.typedOutput, null, 2)
    : 'Consumer withheld. No validated structured data was supplied.';
  const subtype = report.nativeResult?.subtype;
  byId('subtype').textContent = subtype === 'error_max_structured_output_retries' ? 'Retry exhausted' : subtype === 'error_max_turns' ? 'Turn limit' : subtype ?? 'No result';
  byId('attempt-count').textContent = report.attempts.length;
  byId('outcome').textContent = report.outcome.kind;
  byId('consumer').textContent = report.typedOutput ? 'Called' : 'Withheld';
  byId('metadata').textContent = JSON.stringify(
    {
      nativeVersion: report.nativeVersion,
      nativeSessionId: report.nativeResult?.session_id,
      scenarioVerified: report.verified,
      outcome: report.outcome,
    },
    null,
    2,
  );
  byId('error').textContent = report.verified
    ? ''
    : 'Scenario verification failed. Inspect the native result and exception.';
  byId('error').classList.toggle('hidden', !byId('error').textContent);
  byId('status').textContent = report.verified
    ? report.typedOutput
      ? 'Verified'
      : 'Handled'
    : 'Review';
  byId('status').className = 'badge ' + (report.verified ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Preserved actual attempts, the native result, its errors and any following iterator exception.';
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
    'Running the actual SDK scenario and preserving native failure evidence.';
  for (const id of ['native', 'attempts', 'raw', 'typed'])
    byId(id).textContent = 'Awaiting the actual query.';
  for (const id of ['subtype', 'attempt-count', 'outcome', 'consumer'])
    byId(id).textContent = '—';
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
  byId('mode').value = report.mode;
  showSelected();
  displayReport(report);
  return report;
}
byId('mode').onchange = showSelected;
byId('inspect').onclick = run;
byId('repair').onclick = () => {
  byId('mode').value = 'repaired';
  showSelected();
};
window.lesson = { showView, source, restore, report: () => lastReport };
try {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Classroom configuration unavailable.');
  configuration = await response.json();
  showSelected();
  byId('inspect').disabled = false;
  byId('status').textContent = 'Ready';
  byId('progress').textContent =
    'Run a genuine native failure, inspect the guard, then repair the schema.';
} catch (error) {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
}
