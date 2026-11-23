const byId = id => document.getElementById(id);
let lastReport;

function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}

async function source(file = 'src/project.ts') {
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

function relativeFile(file, cwd) {
  const normalized = file.replaceAll('\\', '/');
  const prefix = cwd.replaceAll('\\', '/')+'/';
  return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized;
}

function displayReport(report) {
  lastReport = report;
  byId('project-marker').textContent = report.answer.projectMarker;
  byId('rule-marker').textContent = report.answer.ruleMarker;
  byId('reads').textContent = report.readCalls;
  byId('verified').textContent = report.verified ? 'Passed' : 'Mismatch';
  byId('answer').textContent = JSON.stringify(report.answer, null, 2);
  byId('instruction-events').replaceChildren();
  for (const event of report.instructionLoads) {
    const row = document.createElement('article');
    row.className = 'instruction-event';
    row.append(element('strong', relativeFile(event.file, report.cwd)), element('p', event.reason));
    if (event.trigger) row.append(element('code', 'Triggered by '+relativeFile(event.trigger, report.cwd)));
    if (event.globs) row.append(element('code', 'Paths · '+event.globs.join(', ')));
    byId('instruction-events').append(row);
  }
  if (!report.instructionLoads.length) byId('instruction-events').append(element('p', 'No project instruction-loading events observed.'));
  const observation = report.events.find(event => event.type === 'read_completed')?.data;
  byId('observation').textContent = observation?.file?.content || JSON.stringify(observation, null, 2);
  byId('status').textContent = report.verified ? 'Verified' : 'Review result';
  byId('status').className = 'badge '+(report.verified ? 'passed' : 'mismatch');
  byId('download').href = '/api/report/'+report.id;
  byId('download').classList.remove('hidden');
  byId('progress').textContent = 'Completed the target Read, naming check, and observed instruction-file verification.';
}

async function run() {
  for (const id of ['target', 'project-settings', 'inspect', 'repair']) byId(id).disabled = true;
  byId('error').classList.add('hidden');
  byId('download').classList.add('hidden');
  byId('status').textContent = 'Running';
  byId('status').className = 'badge';
  byId('answer').textContent = 'Awaiting a completed result.';
  byId('instruction-events').replaceChildren();
  byId('observation').textContent = 'Awaiting a completed Read.';
  for (const id of ['project-marker', 'rule-marker', 'reads', 'verified']) byId(id).textContent = '—';
  try {
    const response = await fetch('/api/run', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({target:byId('target').value, loadProjectSettings:byId('project-settings').checked})
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error);
    displayReport(report);
  } catch (error) {
    byId('status').textContent = 'Stopped';
    byId('error').textContent = error.message;
    byId('error').classList.remove('hidden');
    byId('progress').textContent = 'Select a supported target and retry the convention check.';
  } finally {
    for (const id of ['target', 'project-settings', 'inspect', 'repair']) byId(id).disabled = false;
  }
}

async function restore(id) {
  const response = await fetch('/api/report/'+encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved report unavailable.');
  const report = await response.json();
  byId('target').value = report.target;
  byId('project-settings').checked = report.loadProjectSettings;
  displayReport(report);
  return report;
}

byId('inspect').onclick = run;
byId('repair').onclick = () => {byId('target').value = 'typescript'; byId('project-settings').checked = true;};
window.lesson = {showView, source, restore, report:() => lastReport};
