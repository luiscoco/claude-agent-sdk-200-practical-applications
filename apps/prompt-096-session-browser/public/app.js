const byId = (id) => document.getElementById(id);
let lastReport;
function element(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}
async function source(file = 'src/session-browser.ts') {
  const response = await fetch('/api/source?file=' + encodeURIComponent(file));
  if (!response.ok) throw new Error('Source unavailable.');
  const data = await response.json();
  byId('source-title').textContent = data.file;
  byId('files').replaceChildren();
  byId('source').replaceChildren();
  for (const name of data.files) {
    const button = element('button', name, 'secondary');
    button.onclick = () => source(name);
    byId('files').append(button);
  }
  data.content.split('\n').forEach((line, index) => {
    const row = element('span', line || ' ', 'code-line');
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
function contentText(message) {
  const content = message?.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return JSON.stringify(message, null, 2);
  return content
    .map((block) => {
      if (block.type === 'text') return block.text;
      if (block.type === 'tool_use')
        return 'Tool call · ' + block.name + '\n' + JSON.stringify(block.input, null, 2);
      if (block.type === 'tool_result')
        return (
          'Tool result · ' +
          block.tool_use_id +
          '\n' +
          (typeof block.content === 'string'
            ? block.content
            : JSON.stringify(block.content, null, 2))
        );
      if (block.type === 'thinking' || block.type === 'redacted_thinking')
        return '[Thinking block omitted from the classroom display.]';
      return JSON.stringify(block, null, 2);
    })
    .join('\n\n');
}
function renderMessages() {
  if (!lastReport) return;
  const role = byId('role').value,
    messages = lastReport.messages.filter((message) => role === 'all' || message.type === role);
  byId('messages').replaceChildren();
  byId('role-count').textContent =
    messages.length + ' shown on this SDK page · role filtering is a local display choice';
  for (const message of messages) {
    const card = element('article', '', 'message-card ' + message.type);
    card.append(
      element('strong', message.type.toUpperCase()),
      element('small', 'Native message UUID · ' + message.uuid),
      element('pre', contentText(message.message)),
    );
    byId('messages').append(card);
  }
  if (!messages.length)
    byId('messages').append(element('p', 'No messages with this role on the current SDK page.'));
}
function display(report) {
  lastReport = report;
  byId('selection').value = report.requestedInput.selection;
  byId('system').checked = report.requestedInput.includeSystem;
  byId('page-size').value = report.requestedInput.pageSize;
  byId('sessions-value').textContent = report.output.sessionCount;
  byId('total-value').textContent = report.totalMessages;
  const start = report.messages.length ? report.requestedInput.offset + 1 : 0,
    end = report.requestedInput.offset + report.messages.length;
  byId('page-value').textContent = start + '–' + end;
  byId('hash-value').textContent = report.checks.fixtureUnchangedAfterNativeReads
    ? 'SHA verified'
    : 'Mismatch';
  byId('listing').replaceChildren();
  for (const session of report.sessions) {
    const card = element(
      'article',
      '',
      'session-card' +
        (session.sessionId === report.selectedMetadata?.sessionId ? ' selected' : ''),
    );
    card.append(
      element('strong', session.classroomLabel),
      element('p', session.summary),
      element('small', session.sessionId),
    );
    byId('listing').append(card);
  }
  byId('session-metadata').textContent = JSON.stringify(report.selectedMetadata, null, 2);
  byId('pagination').textContent =
    start + '–' + end + ' of ' + report.totalMessages + ' SDK messages';
  byId('previous').disabled = report.requestedInput.offset === 0;
  byId('next').disabled = end >= report.totalMessages;
  byId('checks').textContent = JSON.stringify(report.checks, null, 2);
  byId('evidence').textContent = JSON.stringify(
    {
      nativeControls: report.controls,
      transcriptProof: report.transcriptProof,
      noModelQueriesMade: report.noModelQueriesMade,
    },
    null,
    2,
  );
  byId('metadata').textContent = JSON.stringify(
    { id: report.id, checkedAt: report.checkedAt, fixtureDisclosure: report.fixtureDisclosure },
    null,
    2,
  );
  byId('status').textContent = report.verified
    ? 'Native session reads verified'
    : 'Verification failed';
  byId('status').className = 'badge ' + (report.verified ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Historical session data read with actual SDK utilities. No new model query was made.';
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
  renderMessages();
  error(report.verified ? '' : 'Inspect the actual native utility checks.');
}
async function browse(offset = 0) {
  const controls = ['inspect', 'selection', 'system', 'page-size', 'previous', 'next'];
  for (const id of controls) byId(id).disabled = true;
  byId('download').classList.add('hidden');
  error('');
  byId('status').textContent = 'Reading actual saved session data';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selection: byId('selection').value,
        includeSystem: byId('system').checked,
        offset,
        pageSize: Number(byId('page-size').value),
      }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error || 'Session read failed.');
    display(report);
    return report;
  } catch (failure) {
    error(failure.message);
    byId('status').textContent = 'Read failed';
    throw failure;
  } finally {
    for (const id of ['inspect', 'selection', 'system', 'page-size']) byId(id).disabled = false;
    byId('previous').disabled = !lastReport || lastReport.requestedInput.offset === 0;
    byId('next').disabled =
      !lastReport ||
      lastReport.requestedInput.offset + lastReport.messages.length >= lastReport.totalMessages;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Observed session-browser report unavailable.');
  const report = await response.json();
  display(report);
  return report;
}
byId('inspect').onclick = () => browse(0).catch(() => {});
byId('previous').onclick = () =>
  browse(Math.max(0, lastReport.requestedInput.offset - Number(byId('page-size').value))).catch(
    () => {},
  );
byId('next').onclick = () =>
  browse(lastReport.requestedInput.offset + lastReport.messages.length).catch(() => {});
byId('role').onchange = renderMessages;
window.lesson = { showView, source, browse, restore, report: () => lastReport };
