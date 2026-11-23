const byId = (id) => document.getElementById(id);
let inventory,
  lastReport,
  selected = 'PreToolUse';
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
function chooseEvent(name) {
  selected = name;
  const hook = inventory.hooks.find((hook) => hook.name === name);
  const observations = lastReport?.events.filter((event) => event.event === name) || [];
  byId('event-name').textContent = hook.name;
  byId('event-when').textContent = hook.when || 'Inspect the newly installed SDK event.';
  byId('event-use-case').textContent =
    hook.useCase || 'A practical use case has not been mapped for this installed event.';
  byId('event-observation').textContent = JSON.stringify(
    {
      installedSdkVersion: inventory.sdkVersion,
      supportedEvent: name,
      actualCallbackCount: observations.length,
      observedInThisProbe: observations.length > 0,
      nativeToolUseIds: observations.map((event) => event.nativeToolUseId).filter(Boolean),
    },
    null,
    2,
  );
  document
    .querySelectorAll('[data-event]')
    .forEach((button) => button.classList.toggle('active', button.dataset.event === name));
}
function renderInventory() {
  if (!inventory) return;
  const query = byId('filter').value.trim().toLowerCase();
  const filter = byId('observation-filter').value;
  const observed = new Set(lastReport?.observedNames || []);
  const visible = inventory.hooks.filter((hook) => {
    const matchesText = [hook.name, hook.when, hook.useCase]
      .join(' ')
      .toLowerCase()
      .includes(query);
    const matchesObservation =
      filter === 'all' ||
      (filter === 'observed' ? observed.has(hook.name) : !observed.has(hook.name));
    return matchesText && matchesObservation;
  });
  byId('hook-list').replaceChildren();
  for (const hook of visible) {
    const button = document.createElement('button');
    button.className = 'hook-row';
    button.dataset.event = hook.name;
    button.append(
      element('strong', hook.name),
      element('span', hook.when || 'New installed SDK event'),
    );
    button.onclick = () => chooseEvent(hook.name);
    byId('hook-list').append(button);
  }
  byId('visible-count').textContent = visible.length + ' shown';
  if (visible.length && !visible.some((hook) => hook.name === selected)) selected = visible[0].name;
  chooseEvent(selected);
}
function display(report) {
  lastReport = report;
  byId('topic').value = report.requestedInput.topic;
  byId('observed-count').textContent = report.observedNames.length;
  byId('observed').textContent = JSON.stringify(
    {
      registeredHookCount: report.registeredEvents.length,
      observedNames: report.observedNames,
      unobservedCount: report.unobservedNames.length,
    },
    null,
    2,
  );
  byId('native-read').textContent = JSON.stringify(
    {
      nativeToolUseId: report.calls[0]?.id,
      nativeReadSucceeded: report.results.some(
        (result) => result.id === report.calls[0]?.id && !result.isError,
      ),
      toolHooks: report.events
        .filter((event) => ['PreToolUse', 'PostToolUse'].includes(event.event))
        .map((event) => ({
          event: event.event,
          identifierMatchesRead: event.nativeToolUseId === report.calls[0]?.id,
        })),
    },
    null,
    2,
  );
  byId('file').textContent = JSON.stringify(
    {
      actualFileText: report.actualText,
      output: report.output,
    },
    null,
    2,
  );
  byId('checks').textContent = JSON.stringify(report.checks, null, 2);
  byId('evidence').textContent = JSON.stringify(report.events, null, 2);
  byId('metadata').textContent = JSON.stringify(
    {
      runId: report.id,
      nativeSessionId: report.sessionId,
      checkedAt: report.checkedAt,
      sdkVersion: report.inventory.sdkVersion,
    },
    null,
    2,
  );
  byId('status').textContent = report.verified ? 'Native hooks verified' : 'Verification failed';
  byId('status').className = 'badge ' + (report.verified ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Inspect the actual callbacks and filter the installed inventory by this probe’s observed events.';
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
  error(report.error || (!report.verified ? 'Inspect the actual native checks.' : ''));
  renderInventory();
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Observed hook report unavailable.');
  const report = await response.json();
  display(report);
  return report;
}
byId('filter').oninput = renderInventory;
byId('observation-filter').onchange = renderInventory;
window.lesson = { showView, source, restore, inventory: () => inventory, report: () => lastReport };
byId('inspect').onclick = async () => {
  byId('inspect').disabled = true;
  byId('topic').disabled = true;
  error('');
  byId('status').textContent = 'Running actual native Read';
  byId('status').className = 'badge';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: byId('topic').value }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error || 'Native hook probe failed.');
    display(report);
  } catch (failure) {
    error(failure.message);
    byId('status').textContent = 'Request failed';
  } finally {
    byId('inspect').disabled = false;
    byId('topic').disabled = false;
  }
};
byId('filter').oninput = renderInventory;
byId('observation-filter').onchange = renderInventory;
window.lesson = {
  showView,
  source,
  restore,
  chooseEvent,
  inventory: () => inventory,
  report: () => lastReport,
};
for (const id of ['observed', 'native-read', 'file', 'checks', 'evidence', 'metadata'])
  byId(id).textContent = 'Awaiting the actual native hook probe.';
try {
  const response = await fetch('/api/inventory');
  if (!response.ok) throw new Error('Installed SDK inventory unavailable.');
  inventory = await response.json();
  byId('sdk-version').textContent = inventory.sdkVersion;
  byId('hook-count').textContent = inventory.count;
  byId('mapped-count').textContent = inventory.count - inventory.unmappedEvents.length;
  byId('inventory-status').textContent = inventory.unmappedEvents.length
    ? 'Use-case mapping needs an update'
    : 'Every installed event mapped';
  byId('inventory-status').className =
    'badge ' + (inventory.unmappedEvents.length ? 'mismatch' : 'passed');
  renderInventory();
} catch (failure) {
  error(failure.message);
}
