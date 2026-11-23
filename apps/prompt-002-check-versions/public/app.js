const byId = id => document.getElementById(id);
let lastReport;
let sourceRequest = 0;
function text(tag, value) { const element = document.createElement(tag); element.textContent = value; return element; }
async function source(file = 'src/inspector.mjs') {
  const request = ++sourceRequest;
  const data = await (await fetch('/api/source?file=' + encodeURIComponent(file))).json();
  if (request !== sourceRequest) return;
  byId('source-title').textContent = data.file;
  byId('files').replaceChildren();
  for (const name of data.files) {
    const button = text('button', name); button.className = 'secondary'; button.onclick = () => source(name); byId('files').append(button);
  }
  byId('source').replaceChildren();
  data.content.split('\n').forEach((line, index) => {
    const row = text('span', line || ' '); row.className = 'code-line'; row.dataset.line = index + 1; byId('source').append(row);
  });
}
function showView(name) {
  document.querySelectorAll('.view').forEach(view => view.classList.toggle('hidden', view.id !== name + '-view'));
  document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === name));
  if (name === 'source') return source();
}
document.querySelectorAll('[data-view]').forEach(button => button.onclick = () => showView(button.dataset.view));
async function inspect() {
  byId('inspect').disabled = true;
  byId('error').classList.add('hidden');
  byId('download').classList.add('hidden');
  byId('checks').replaceChildren(); byId('capabilities').replaceChildren();
  for (const id of ['node', 'sdk', 'runtime', 'platform']) byId(id).textContent = '—';
  byId('status').textContent = 'Inspecting'; byId('status').className = 'badge';
  byId('progress').textContent = 'Reading package metadata and executing the bundled runtime…';
  try {
    const response = await fetch('/api/inspect', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({expectedVersion:byId('expected').value})});
    const report = await response.json();
    if (!response.ok) throw new Error(report.error);
    lastReport = report;
    byId('node').textContent = report.environment.node; byId('sdk').textContent = report.sdk.version;
    byId('runtime').textContent = report.runtime.version; byId('platform').textContent = report.environment.platform + '/' + report.environment.architecture;
    byId('status').textContent = report.status === 'passed' ? 'Verified' : 'Version mismatch'; byId('status').className = 'badge ' + report.status;
    byId('progress').textContent = 'Inspection completed from local files and actual runtime output.';
    for (const check of report.checks) {
      const row = document.createElement('article'); row.className = 'check ' + (check.passed ? 'pass' : 'failed');
      row.append(text('strong', (check.passed ? '✓ ' : '! ') + check.label), text('p', check.evidence)); byId('checks').append(row);
    }
    for (const feature of report.capabilities) {
      const row = document.createElement('article'); row.className = 'capability'; const heading = document.createElement('div');
      heading.append(text('strong', feature.label), text('span', feature.status));
      row.append(heading, text('code', feature.declaration || 'No declaration found in Options.'));
      const evidence = text('p', feature.line ? `${feature.file} · line ${feature.line}` : feature.file);
      const link = text('a', 'Official documentation ↗'); link.href = feature.documentation; link.target = '_blank'; link.rel = 'noopener';
      row.append(evidence, link); byId('capabilities').append(row);
    }
    byId('download').href = '/api/report/' + report.id; byId('download').classList.remove('hidden');
  } catch (error) {
    byId('error').textContent = error.message; byId('error').classList.remove('hidden');
    byId('status').textContent = 'Stopped'; byId('progress').textContent = 'Correct the input or installation, then retry.';
  } finally { byId('inspect').disabled = false; }
}
byId('inspect').onclick = inspect;
byId('mismatch').onclick = () => { byId('expected').value = '0.0.0'; };
byId('repair').onclick = () => { byId('expected').value = lastReport?.sdk.version || ''; };
window.lesson = { showView, source, inspect, report:() => lastReport };
