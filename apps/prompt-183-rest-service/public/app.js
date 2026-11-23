const $ = s => document.querySelector(s);
const lab = await fetch('/api/lab').then(r => r.json());
document.title = `Prompt ${lab.number} · ${lab.title}`;
$('#number').textContent = `PROMPT ${String(lab.number).padStart(3, '0')}`;
$('#title').textContent = lab.title;
$('#description').textContent = lab.prompt;
$('#scope').textContent = lab.scope;
for (const mode of lab.modes) $('#mode').add(new Option(mode.label, mode.id));
function describeMode() { $('#mode-description').textContent = lab.modes.find(m => m.id === $('#mode').value).description; }
$('#mode').onchange = describeMode;
describeMode();
for (const file of lab.sources) $('#source-file').add(new Option(file, file));
async function loadSource() {
  const response = await fetch('/api/source?file=' + encodeURIComponent($('#source-file').value));
  const data = await response.json(); $('#code').textContent = data.content;
}
$('#source-file').onchange = loadSource;
for (const button of document.querySelectorAll('[data-view]')) button.onclick = async () => {
  for (const section of document.querySelectorAll('article>section')) section.hidden = section.id !== button.dataset.view;
  for (const item of document.querySelectorAll('[data-view]')) item.classList.toggle('selected', item === button);
  if (button.dataset.view === 'source') await loadSource();
};
let lastReport;
$('#form').onsubmit = async event => {
  event.preventDefault();
  $('#run').disabled = true; $('#results').hidden = true; lastReport = undefined;
  $('#status').textContent = 'Running the experiment. Waiting for actual operation results…';
  try {
    const response = await fetch('/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: $('#mode').value }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Experiment failed.');
    lastReport = data;
    $('#status').textContent = data.verified ? 'All observed checks passed.' : 'Some checks did not pass. Inspect the evidence below.';
    $('#checks').replaceChildren(...Object.entries(data.checks).map(([name, passed]) => {
      const row = document.createElement('li'); row.className = passed ? 'pass' : 'fail';
      row.textContent = `${passed ? '✓' : '✕'} ${name.replace(/([A-Z])/g, ' $1')}`; return row;
    }));
    $('#output').textContent = JSON.stringify(data.output, null, 2);
    $('#evidence').textContent = JSON.stringify({ scope: data.scope, evidence: data.evidence, checkedAt: data.checkedAt }, null, 2);
    $('#results').hidden = false;
  } catch (error) { $('#status').textContent = error.message; }
  finally { $('#run').disabled = false; }
};
$('#download').onclick = () => {
  if (!lastReport) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(lastReport, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `prompt-${lab.number}-observed-report.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
