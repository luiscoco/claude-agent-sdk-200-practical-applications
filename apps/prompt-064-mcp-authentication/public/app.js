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

let account = { connected: false, credentialPresent: false, connecting: false, revoked: false };
let running = false;
function updateControls() {
  byId('inspect').disabled = running || account.connecting;
  byId('connect').disabled = running;
  byId('revoke').disabled = running || !account.connected;
}
function showSelected() {
  byId('facts').textContent =
    'Identity source · Local classroom fixture\nOAuth flow · Authorization code + S256 PKCE\nMCP transport · HTTP · Authorization header supplied by the host\nActual tool argument · ' +
    JSON.stringify({ slug: byId('slug').value });
}
async function refreshAuth() {
  const response = await fetch('/api/auth/status');
  if (!response.ok) throw new Error('Classroom connection status unavailable.');
  account = await response.json();
  byId('auth-status').textContent = account.connecting
    ? 'Connecting'
    : account.connected
      ? 'Connected'
      : account.revoked
        ? 'Revoked'
        : account.credentialPresent
          ? 'Expired'
          : 'Not connected';
  byId('connect').textContent = account.connected
    ? 'Reconnect classroom account'
    : 'Connect classroom account';
  updateControls();
  return account;
}
function displayReport(report) {
  lastReport = report;
  const native = report.nativeServerStatus.find((server) => server.name === 'secure_catalog');
  byId('handler-result').textContent = String(report.auth.admitted);
  byId('native-result-value').textContent = report.preflight.httpStatus;
  byId('final-result').textContent = String(report.privacyChecks.credentialValuesAbsent);
  byId('execution-count').textContent = report.executions.length;
  byId('handler').textContent = JSON.stringify(
    {
      credentialSupplied: report.auth.credentialSupplied,
      admitted: report.auth.admitted,
      subject: report.auth.subject ?? null,
      scope: report.auth.scope ?? null,
      authorizationHeaderConfigured: report.connection?.authorizationHeaderConfigured ?? false,
    },
    null,
    2,
  );
  byId('native-result').textContent = JSON.stringify(
    {
      stage: report.stage,
      sdkStarted: report.sdkStarted,
      protectedHttpStatus: report.preflight.httpStatus,
      nativeStatus: native?.status ?? null,
      serverInfo: native?.serverInfo ?? null,
      authorizedHttpRequests: report.httpEvents.filter((event) => event.authorized).length,
    },
    null,
    2,
  );
  byId('final-output').textContent = JSON.stringify(report.output, null, 2);
  byId('checks').textContent = JSON.stringify(
    { ...report.checks, ...report.connectionChecks, ...report.privacyChecks, ...report.oauthFlow },
    null,
    2,
  );
  byId('provenance').textContent =
    'Identity source · ' +
    report.identitySource +
    '\nCredential source · Runtime host session\nActual resource · ' +
    (report.connection?.url ?? 'http://127.0.0.1:43164/mcp');
  byId('evidence').textContent = report.calls
    .filter((call) => call.name.startsWith('mcp__'))
    .map((call) => call.name + '(' + JSON.stringify(call.input) + ')')
    .join('\n');
  byId('tool-results').textContent = JSON.stringify(
    {
      httpEvents: report.httpEvents,
      executions: report.executions,
      nativeServerStatus: report.nativeServerStatus,
      nativeToolResults: report.toolResults,
      hookResults: report.hookResults,
    },
    null,
    2,
  );
  byId('error').textContent =
    report.error ||
    report.resultErrors.join('\n') ||
    (report.output?.ok === false ? report.output.errorCode : '');
  byId('error').classList.toggle('hidden', !byId('error').textContent);
  byId('status').textContent = report.verified
    ? report.sdkStarted
      ? 'Protected tool verified'
      : 'Authentication required observed'
    : 'Review';
  byId('status').className =
    'badge ' + (report.verified && report.sdkStarted ? 'passed' : 'mismatch');
  byId('progress').textContent = report.sdkStarted
    ? 'Preserved actual OAuth evidence, authenticated HTTP admission and the native protected tool outcome.'
    : 'The actual protected endpoint returned HTTP 401 before SDK inference. Connect or reconnect the classroom account.';
  byId('metadata').textContent = JSON.stringify(
    {
      nativeSessionId: report.sessionId,
      actualInitialTools: report.initialTools,
      sdkStarted: report.sdkStarted,
      sdkResultStatus: report.resultStatus,
      scenarioVerified: report.verified,
      checkedAt: report.checkedAt,
    },
    null,
    2,
  );
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
}
async function finishRequest() {
  running = false;
  updateControls();
  try {
    await refreshAuth();
  } catch (error) {
    byId('error').textContent = error.message;
    byId('error').classList.remove('hidden');
  }
}
async function run() {
  running = true;
  updateControls();
  lastReport = undefined;
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
    byId(id).textContent = 'Awaiting actual protected HTTP and SDK evidence.';
  byId('status').textContent = 'Checking protected MCP access';
  byId('status').className = 'badge';
  byId('progress').textContent =
    'The host supplies its runtime session credential to the protected endpoint.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: byId('slug').value }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error);
    displayReport(report);
  } catch (error) {
    byId('status').textContent = 'Stopped';
    byId('error').textContent = error.message;
    byId('error').classList.remove('hidden');
  } finally {
    await finishRequest();
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved authentication report unavailable.');
  const report = await response.json();
  byId('slug').value = report.requestedInput.slug;
  showSelected();
  displayReport(report);
  await refreshAuth();
  return report;
}
byId('slug').oninput = showSelected;
byId('inspect').onclick = run;
byId('connect').onclick = () => location.assign('/auth/start');
byId('revoke').onclick = async () => {
  running = true;
  updateControls();
  try {
    const response = await fetch('/api/auth/revoke', { method: 'POST' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    byId('progress').textContent =
      'The classroom token was revoked. Call the protected endpoint to inspect its actual HTTP 401 response.';
  } catch (error) {
    byId('error').textContent = error.message;
    byId('error').classList.remove('hidden');
  } finally {
    await finishRequest();
  }
};
window.lesson = { showView, source, restore, refreshAuth, report: () => lastReport };
try {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Authentication settings unavailable.');
  await response.json();
  showSelected();
  await refreshAuth();
  byId('status').textContent = 'Ready';
  const outcome = new URLSearchParams(location.search).get('auth');
  byId('progress').textContent =
    outcome === 'access_denied'
      ? 'Classroom consent was declined. Reconnect to try again.'
      : account.connected
        ? 'Classroom OAuth completed. Run the actual protected MCP tool.'
        : 'Connect the classroom account or call the endpoint to observe its actual authentication requirement.';
} catch (error) {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
}
