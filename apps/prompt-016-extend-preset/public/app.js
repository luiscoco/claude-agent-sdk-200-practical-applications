const byId = id => document.getElementById(id);
let lastReport;

function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}

async function source(file = 'src/inventory.ts') {
  const data = await (await fetch('/api/source?file='+encodeURIComponent(file))).json();
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
    row.dataset.line = index+1;
    byId('source').append(row);
  });
}

async function showView(name) {
  document.querySelectorAll('.view').forEach(view => view.classList.toggle('hidden', view.id !== name+'-view'));
  document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === name));
  if (name === 'source') await source();
}
document.querySelectorAll('[data-view]').forEach(button => button.onclick = () => showView(button.dataset.view));

function displayReport(report) {
  lastReport = report;
  byId('extended').textContent = report.extend ? 'Enabled' : 'Disabled';
  byId('reads').textContent = report.readCalls;
  byId('verified').textContent = report.verified ? 'Passed' : 'Mismatch';
  byId('notebooks').textContent = report.recommendations.find(row => row.sku === 'NOTEBOOK')?.proposed ?? '—';
  byId('recommendations').replaceChildren();
  for (const recommendation of report.recommendations) {
    const expected = report.expected.find(row => row.sku === recommendation.sku);
    const row = document.createElement('tr');
    row.append(element('td', recommendation.sku), element('td', recommendation.needed), element('td', recommendation.proposed), element('td', expected?.proposed ?? 'Unknown SKU'));
    byId('recommendations').append(row);
  }
  const observation = report.events.find(event => event.type === 'read_completed')?.data;
  byId('observation').textContent = observation?.file?.content || JSON.stringify(observation, null, 2);
  byId('status').textContent = report.verified ? 'Verified' : 'Review result';
  byId('status').className = 'badge '+(report.verified ? 'passed' : 'mismatch');
  byId('download').href = '/api/report/'+report.id;
  byId('download').classList.remove('hidden');
  byId('progress').textContent = 'Completed a real SDK Read and independently checked the recommendations.';
}

async function run() {
  for (const id of ['mode', 'inspect', 'repair']) byId(id).disabled = true;
  byId('error').classList.add('hidden');
  byId('download').classList.add('hidden');
  byId('status').textContent = 'Running';
  byId('status').className = 'badge';
  byId('recommendations').replaceChildren();
  byId('observation').textContent = 'Awaiting a completed Read.';
  for (const id of ['extended', 'reads', 'verified', 'notebooks']) byId(id).textContent = '—';
  try {
    const mode = byId('mode').value;
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({extend: mode === 'invalid' ? 'invalid' : mode === 'extended'})
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error);
    displayReport(report);
  } catch (error) {
    byId('status').textContent = 'Stopped';
    byId('error').textContent = error.message;
    byId('error').classList.remove('hidden');
    byId('progress').textContent = 'Select a supported preset configuration and retry.';
  } finally {
    for (const id of ['mode', 'inspect', 'repair']) byId(id).disabled = false;
  }
}

async function restore(id) {
  const response = await fetch('/api/report/'+encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved report unavailable.');
  const report = await response.json();
  byId('mode').value = report.extend ? 'extended' : 'base';
  displayReport(report);
  return report;
}

byId('inspect').onclick = run;
byId('repair').onclick = () => {byId('mode').value = 'extended';};
window.lesson = {showView, source, restore, report: () => lastReport};
fetch('/api/inventory').then(async response => {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  byId('policy').textContent = data.domainPolicy;
}).catch(error => {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
});
