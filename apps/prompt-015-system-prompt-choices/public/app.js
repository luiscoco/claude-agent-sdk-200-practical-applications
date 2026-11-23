const byId = id => document.getElementById(id);
const results = new Map();
const labels = {minimal: 'Minimal default', preset: 'claude_code preset', custom: 'Custom tutor'};
let lastReport;

function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}

async function source(file = 'src/profiles.ts') {
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

function drawProfiles() {
  byId('profiles').replaceChildren();
  for (const mode of ['minimal', 'preset', 'custom']) {
    const result = results.get(mode);
    const card = document.createElement('article');
    card.className = 'panel profile-card';
    card.dataset.mode = mode;
    card.append(element('h3', labels[mode]));
    if (result) {
      const option = result.optionOmitted ? 'systemPrompt omitted' : JSON.stringify(result.systemPromptOption, null, 2);
      const configuration = element('pre', option);
      configuration.className = 'configuration';
      const answer = element('pre', result.answer);
      answer.className = 'answer';
      card.append(configuration, element('strong', result.inputTokens+' reported input tokens'), answer);
    } else {
      card.append(element('p', 'Run this profile to observe its response.'));
    }
    byId('profiles').append(card);
  }
  const visible = [...results.values()];
  byId('count').textContent = visible.length+' / 3';
  byId('model').textContent = visible[0]?.model || '—';
  byId('prefix').textContent = results.has('custom') ? (results.get('custom').customPrefixMatched ? 'Matched TUTOR |' : 'Review answer') : 'Awaiting custom run';
  byId('cost').textContent = visible.length ? '$'+visible.reduce((sum, result) => sum+result.estimatedCostUsd, 0).toFixed(4) : '—';
}

function displayReport(report) {
  lastReport = report;
  for (const result of report.results) results.set(result.mode, result);
  drawProfiles();
  byId('status').textContent = 'Completed';
  byId('status').className = 'badge passed';
  byId('download').href = '/api/report/'+report.id;
  byId('download').classList.remove('hidden');
  byId('progress').textContent = 'Completed '+report.results.length+' real SDK profile run(s).';
}

async function run(compareAll = false) {
  for (const id of ['mode', 'inspect', 'compare', 'repair']) byId(id).disabled = true;
  byId('error').classList.add('hidden');
  byId('download').classList.add('hidden');
  byId('status').textContent = 'Running';
  byId('status').className = 'badge';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({mode: compareAll ? 'compare' : byId('mode').value})
    });
    const report = await response.json();
    if (!response.ok) {
      for (const result of report.completedResults || []) results.set(result.mode, result);
      drawProfiles();
      throw new Error(report.error);
    }
    displayReport(report);
  } catch (error) {
    byId('status').textContent = 'Stopped';
    byId('error').textContent = error.message;
    byId('error').classList.remove('hidden');
    byId('progress').textContent = 'Select a supported profile and verify the configured credentials.';
  } finally {
    for (const id of ['mode', 'inspect', 'compare', 'repair']) byId(id).disabled = false;
  }
}

async function restore(id) {
  const response = await fetch('/api/report/'+encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved report unavailable.');
  const report = await response.json();
  displayReport(report);
  return report;
}

byId('inspect').onclick = () => run(false);
byId('compare').onclick = () => run(true);
byId('repair').onclick = () => {byId('mode').value = 'custom';};
window.lesson = {showView, source, restore, report: () => lastReport};
fetch('/api/task').then(response => response.json()).then(data => {byId('task').textContent = data.task;});
