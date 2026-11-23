const byId = (id) => document.getElementById(id);
const defaultModel = 'claude-sonnet-4-6';
let lastReport;

function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}
async function source(file = 'src/models.ts') {
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

async function refreshCatalog() {
  byId('refresh').disabled = true;
  byId('catalog-state').textContent = 'Requesting the credential-scoped model catalog…';
  try {
    const response = await fetch('/api/models');
    const report = await response.json();
    if (!response.ok) throw new Error(report.error);
    byId('catalog').replaceChildren();
    byId('model-list').replaceChildren(element('option', ''));
    byId('model-list').firstChild.value = 'sonnet';
    for (const model of report.models) {
      const button = element('button', model.id);
      button.className = 'catalog-model';
      button.title = model.display_name;
      button.onclick = () => {
        byId('model').value = model.id;
      };
      byId('catalog').append(button);
      const option = document.createElement('option');
      option.value = model.id;
      byId('model-list').append(option);
    }
    byId('catalog-state').textContent =
      report.models.length + ' catalog entries · ' + report.checkedAt;
    return report;
  } catch (error) {
    byId('catalog-state').textContent = error.message;
    throw error;
  } finally {
    byId('refresh').disabled = false;
  }
}
function displayReport(report) {
  lastReport = report;
  byId('requested').textContent = report.requestedModel;
  byId('initialized').textContent = report.initializedModel || 'Unavailable';
  byId('resolved').textContent =
    report.assistantModels.filter((model) => model !== '<synthetic>').join(', ') ||
    'No successful response';
  byId('answer').textContent = report.answer || 'Request failed';
  byId('session').textContent = JSON.stringify(
    {
      provider: report.provider,
      versions: report.versions,
      checkedAt: report.checkedAt,
      requestedModel: report.requestedModel,
      initializedModel: report.initializedModel,
      assistantModels: report.assistantModels,
      modelUsage: report.modelUsage,
      pickerAlias: report.pickerModels.find((model) => model.value === 'sonnet'),
      verified: report.verified,
    },
    null,
    2,
  );
  byId('status').textContent = report.verified
    ? 'Verified'
    : report.success
      ? 'Review result'
      : 'Failed';
  byId('status').className = 'badge ' + (report.verified ? 'passed' : 'mismatch');
  byId('error').classList.toggle('hidden', report.success);
  byId('error').textContent = report.error || '';
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
  byId('progress').textContent =
    'Saved the requested model, observed runtime identifiers, and actual response outcome.';
}
async function run() {
  lastReport = undefined;
  for (const id of ['model', 'inspect', 'alias', 'missing', 'repair']) byId(id).disabled = true;
  byId('download').classList.add('hidden');
  byId('error').classList.add('hidden');
  byId('status').textContent = 'Running';
  byId('status').className = 'badge';
  for (const id of ['requested', 'initialized', 'resolved', 'answer']) byId(id).textContent = '—';
  byId('session').textContent = 'Awaiting the actual SDK response.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: byId('model').value }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error);
    displayReport(report);
  } catch (error) {
    byId('error').textContent = error.message;
    byId('error').classList.remove('hidden');
    byId('status').textContent = 'Stopped';
  } finally {
    for (const id of ['model', 'inspect', 'alias', 'missing', 'repair']) byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved report unavailable.');
  const report = await response.json();
  byId('model').value = report.requestedModel;
  displayReport(report);
  return report;
}
byId('inspect').onclick = run;
byId('refresh').onclick = () => refreshCatalog().catch(() => {});
byId('alias').onclick = () => {
  byId('model').value = 'sonnet';
};
byId('missing').onclick = () => {
  byId('model').value = 'claude-course-missing-model';
};
byId('repair').onclick = () => {
  byId('model').value = defaultModel;
};
window.lesson = { showView, source, restore, refreshCatalog, report: () => lastReport };
