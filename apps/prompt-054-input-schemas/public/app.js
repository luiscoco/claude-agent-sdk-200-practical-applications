const byId = (id) => document.getElementById(id);
let lastReport;
let defaultInput;
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

function showSelected() {
  byId('facts').textContent =
    'Registered tool · mcp__orders__quote_order\nClassroom quote fixture · Prices and shipping are local euro-cent constants.';
}
function displayReport(report) {
  lastReport = report;
  const execution = report.executions[0];
  const outcome = execution?.outcome;
  const native = report.toolResults.find((result) => result.parsedOutcome);
  const summary = (value) =>
    value
      ? {
          ok: value.ok,
          totalCents: value.totalCents,
          errorCode: value.errorCode,
          issues: value.issues,
        }
      : null;
  byId('handler-result').textContent = outcome
    ? outcome.ok
      ? 'Accepted'
      : 'Rejected'
    : 'Unavailable';
  byId('native-result-value').textContent = outcome?.totalCents ?? '—';
  byId('final-result').textContent = outcome?.normalized
    ? outcome.normalized.options.shipping + ', gift ' + outcome.normalized.options.giftWrap
    : '—';
  byId('execution-count').textContent = report.executions.length;
  const normalized = outcome?.normalized;
  byId('handler').textContent = normalized
    ? [
        'customer.name · ' + normalized.customer.name,
        'address.city · ' + normalized.address.city,
        'address.postalCode · ' + normalized.address.postalCode,
        'address.country · ' + normalized.address.country,
        ...normalized.items.map(
          (item, index) => 'items[' + index + '] · ' + item.sku + ' × ' + item.quantity,
        ),
        'options.shipping · ' + normalized.options.shipping,
        'options.giftWrap · ' + normalized.options.giftWrap,
      ].join('\n\n')
    : JSON.stringify({ normalized: null, issues: outcome?.issues ?? [] }, null, 2);
  byId('native-result').textContent = JSON.stringify(
    { ...summary(native?.parsedOutcome), isError: native?.isError ?? null },
    null,
    2,
  );
  byId('final-output').textContent = JSON.stringify(summary(report.output), null, 2);
  byId('checks').textContent = JSON.stringify(report.checks, null, 2);
  byId('provenance').textContent = JSON.stringify(
    {
      hostProcessId: report.hostProcessId,
      handlerProcessId: execution?.processId ?? null,
      nativeMcpServer: report.hookResults.find((result) => result.mcpServer)?.mcpServer ?? null,
    },
    null,
    2,
  );
  byId('evidence').textContent = report.calls
    .filter((call) => call.name === report.toolName)
    .map((call) => call.name + '(' + JSON.stringify(call.input) + ')')
    .join('\n');
  byId('tool-results').textContent = JSON.stringify(
    {
      requestedInput: report.requestedInput,
      executions: report.executions,
      toolResults: report.toolResults,
      hookResults: report.hookResults,
      output: report.output,
    },
    null,
    2,
  );
  byId('error').textContent =
    report.error ||
    report.resultErrors.join('\n') ||
    (outcome?.ok === false ? outcome.errorCode + ' · ' + outcome.issues.join(' | ') : '');
  byId('error').classList.toggle('hidden', !byId('error').textContent);
  byId('status').textContent = report.verified
    ? outcome?.ok
      ? 'Defaults and quote verified'
      : 'Handler rejection observed'
    : 'Review';
  byId('status').className = 'badge ' + (report.verified && outcome?.ok ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Preserved actual requested arguments, handler normalization, native error flag and final result.';
  byId('metadata').textContent = JSON.stringify(
    {
      nativeSessionId: report.sessionId,
      actualInitialTools: report.initialTools,
      sdkResultStatus: report.resultStatus,
      sdkConversationSucceeded: report.success,
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
  for (const id of ['arguments', 'inspect', 'failure', 'repair', 'options'])
    byId(id).disabled = true;
  for (const id of ['error', 'download']) byId(id).classList.add('hidden');
  for (const id of ['handler-result', 'native-result-value', 'final-result', 'execution-count'])
    byId(id).textContent = '—';
  for (const id of [
    'handler',
    'native-result',
    'final-output',
    'checks',
    'provenance',
    'evidence',
    'tool-results',
    'metadata',
  ])
    byId(id).textContent = 'Awaiting actual nested-input evidence.';
  byId('status').textContent = 'Calling order tool';
  byId('status').className = 'badge';
  byId('progress').textContent =
    'Running the actual SDK agent and the nested-input validation inside its order handler.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(JSON.parse(byId('arguments').value)),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error);
    displayReport(report);
  } catch (error) {
    byId('status').textContent = 'Stopped';
    byId('error').textContent = error.message;
    byId('error').classList.remove('hidden');
  } finally {
    for (const id of ['arguments', 'inspect', 'failure', 'repair', 'options'])
      byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved nested-input report unavailable.');
  const report = await response.json();
  byId('arguments').value = JSON.stringify(report.requestedInput, null, 2);
  showSelected();
  displayReport(report);
  return report;
}
byId('inspect').onclick = run;
byId('failure').onclick = () => {
  const input = structuredClone(defaultInput);
  input.items[0].quantity = 0;
  byId('arguments').value = JSON.stringify(input, null, 2);
};
byId('repair').onclick = () => {
  byId('arguments').value = JSON.stringify(defaultInput, null, 2);
};
byId('options').onclick = () => {
  byId('arguments').value = JSON.stringify(
    { ...defaultInput, options: { shipping: 'express', giftWrap: true } },
    null,
    2,
  );
};
window.lesson = { showView, source, restore, report: () => lastReport };
try {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Nested-input settings unavailable.');
  defaultInput = (await response.json()).defaultInput;
  byId('arguments').value = JSON.stringify(defaultInput, null, 2);
  showSelected();
  byId('inspect').disabled = false;
  byId('status').textContent = 'Ready';
  byId('progress').textContent =
    'Run the actual order tool with omitted options, inspect applied defaults and reproduce a handler validation error.';
} catch (error) {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
}
