const byId = (id) => document.getElementById(id);
let lastReport;
function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}
async function source(file = 'src/tool-preview.ts') {
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
let observations = [];
function showBlocks(blocks) {
  const block = blocks.at(-1);
  if (!block) return;
  byId('fragments').textContent = blocks.reduce((count, item) => count + item.fragments, 0);
  byId('phase').textContent = block.state;
  byId('identity').textContent = block.name + ' · ' + block.toolId + ' · block ' + block.index;
  byId('raw').textContent = block.rawInput || 'Awaiting argument bytes.';
  byId('raw').scrollTop = byId('raw').scrollHeight;
  byId('parsed').textContent = block.arguments
    ? JSON.stringify(block.arguments, null, 2)
    : block.state === 'receiving'
      ? 'Arguments remain unparsed while the block is receiving fragments.'
      : block.parseError || 'The argument stream is incomplete.';
}
function observe(event) {
  observations.push(event);
  if (event.type === 'argument-fragment') showBlocks(event.detail.blocks);
  if (['tool-start', 'block-stop', 'message-stop'].includes(event.type)) showBlocks(event.detail);
  byId('native-calls').textContent = observations.filter(
    (item) => item.type === 'native-tool-request',
  ).length;
}
function displayReport(report) {
  lastReport = report;
  observations = report.observations;
  showBlocks(report.blocks);
  byId('raw').scrollTop = 0;
  byId('native-calls').textContent = report.nativeInputs.length;
  byId('file-check').textContent = report.writtenExactly ? 'Verified' : 'Review file';
  byId('verification').textContent =
    JSON.stringify(
      {
        actualTarget: report.target,
        nativeToolResults: report.toolResults.length,
        actualFileCharacters: report.fileContent.length,
        expectedFileCharacters: report.expectedContent.length,
        writtenExactly: report.writtenExactly,
        previewMatchesNativeInput: report.previewVerified,
        actualAnswer: report.answer,
        scenarioVerified: report.verified,
      },
      null,
      2,
    ) +
    '\n\nActual file excerpt\n' +
    report.fileContent.split('\n').slice(0, 3).join('\n');
  const previewError = report.blocks
    .map((block) => block.parseError)
    .filter(Boolean)
    .join('\n');
  byId('error').textContent =
    previewError ||
    report.error ||
    (!report.success
      ? report.answer
      : report.verified
        ? ''
        : 'VERIFICATION_FAILED · Inspect the tool and file observations.');
  byId('error').classList.toggle('hidden', !byId('error').textContent);
  byId('status').textContent =
    previewError && report.verified
      ? 'Observed preview error'
      : report.verified
        ? 'Verified'
        : 'Run failed';
  byId('status').className = 'badge ' + (report.verified && !previewError ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Preserved actual argument fragments, native Write observations and file verification.';
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
}
async function run() {
  lastReport = undefined;
  observations = [];
  for (const id of ['mode', 'inspect', 'repair']) byId(id).disabled = true;
  byId('error').classList.add('hidden');
  byId('download').classList.add('hidden');
  byId('status').textContent = 'Streaming';
  byId('status').className = 'badge';
  byId('progress').textContent =
    'Receiving actual input_json_delta fragments from the real SDK tool call.';
  byId('fragments').textContent = '0';
  byId('native-calls').textContent = '0';
  byId('phase').textContent = 'Waiting';
  byId('file-check').textContent = 'Pending';
  byId('raw').textContent = 'Awaiting actual argument fragments.';
  byId('parsed').textContent = 'Awaiting the complete tool block.';
  byId('identity').textContent = '';
  byId('verification').textContent = 'Awaiting native execution and file verification.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: byId('mode').value }),
    });
    if (!response.ok) throw new Error((await response.json()).error);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    while (true) {
      const { done, value } = await reader.read();
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let boundary;
      while ((boundary = pending.indexOf('\n\n')) >= 0) {
        const frame = pending.slice(0, boundary);
        pending = pending.slice(boundary + 2);
        if (!frame.trim()) continue;
        const [typeLine, dataLine] = frame.split('\n');
        const type = typeLine.slice(7),
          data = JSON.parse(dataLine.slice(6));
        if (type === 'observation') observe(data);
        if (type === 'complete') displayReport(data);
        if (type === 'failure') throw new Error(data.error);
      }
      if (done) break;
    }
    if (!lastReport || pending.trim())
      throw new Error('The local stream ended without a complete report.');
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
  displayReport(report);
  return report;
}
byId('inspect').onclick = run;
byId('repair').onclick = () => {
  byId('mode').value = 'normal';
};
window.lesson = {
  showView,
  source,
  restore,
  report: () => lastReport,
  observations: () => observations,
};
try {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Task configuration unavailable.');
  const { expectedContent } = await response.json();
  byId('progress').textContent =
    'Create notes.txt with ' +
    expectedContent.trimEnd().split('\n').length +
    ' numbered classroom lines and verify the actual file.';
  byId('inspect').disabled = false;
  byId('status').textContent = 'Ready';
} catch (error) {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
}
