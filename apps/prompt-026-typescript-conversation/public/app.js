const byId = (id) => document.getElementById(id);
let current;
let examples;
let busy = false;
function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}
async function source(file = 'src/queue.ts') {
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
function controls() {
  byId('start').disabled = busy || !examples;
  byId('send').disabled = busy || !current;
  byId('send').textContent = current?.closed
    ? 'Try sending to closed session'
    : 'Send next message';
  byId('close').disabled = busy || !current || current.closed;
  byId('prompt').disabled = busy;
  document.querySelectorAll('[data-example]').forEach((button) => {
    button.disabled = busy || !examples;
  });
}
function display(snapshot) {
  current = snapshot;
  byId('session').textContent = snapshot.sessionId || 'Awaiting initialization';
  byId('turn-count').textContent = snapshot.turns.length;
  byId('matched').textContent =
    snapshot.turns.filter((turn) => turn.correlationMatched).length + ' / ' + snapshot.turns.length;
  byId('state').textContent = snapshot.closed ? 'Closed' : 'Open';
  byId('chat').replaceChildren();
  byId('correlation').replaceChildren();
  snapshot.turns.forEach((turn, index) => {
    const row = document.createElement('article');
    row.className = 'conversation-turn';
    row.dataset.turn = turn.id;
    const question = document.createElement('div');
    question.className = 'user-message';
    question.append(element('strong', 'User · Turn ' + (index + 1)), element('p', turn.prompt));
    const answer = document.createElement('div');
    answer.className = 'assistant-message' + (turn.isError ? ' failed' : '');
    answer.append(
      element('strong', turn.isError ? 'SDK result error' : 'Assistant'),
      element('p', turn.answer),
    );
    row.append(question, answer);
    byId('chat').append(row);
    const pair = document.createElement('article');
    pair.className = 'correlation';
    pair.append(
      element(
        'strong',
        'Turn ' + (index + 1) + ' · ' + (turn.correlationMatched ? 'Matched' : 'Needs review'),
      ),
      element('p', 'Submitted UUID'),
      element('code', turn.id),
      element('p', 'Native result UUID'),
      element('code', turn.resultMessageId || 'No echo observed'),
    );
    byId('correlation').append(pair);
  });
  byId('chat').scrollTop = byId('chat').scrollHeight;
  byId('status').textContent = snapshot.closed ? 'Closed' : 'Ready for next message';
  byId('status').className = 'badge ' + (snapshot.verified ? 'passed' : '');
  byId('progress').textContent = snapshot.closed
    ? snapshot.closeReason
    : 'The same SDK query is waiting for the next user message.';
  byId('verification').textContent =
    'Session and result checks ' + (snapshot.verified ? 'passed' : 'need review');
  byId('download').href = '/api/report/' + snapshot.id;
  byId('download').classList.remove('hidden');
  controls();
}
async function submit(startNew) {
  const previousId = current?.id;
  busy = true;
  controls();
  byId('error').classList.add('hidden');
  byId('status').textContent = 'Waiting for SDK reply';
  if (startNew) {
    current = undefined;
    byId('chat').replaceChildren();
    byId('correlation').replaceChildren();
    byId('download').classList.add('hidden');
    byId('session').textContent = '—';
    byId('turn-count').textContent = '0';
    byId('matched').textContent = '—';
    byId('state').textContent = 'Starting';
    byId('verification').textContent = 'Awaiting session and result checks.';
  }
  try {
    const response = await fetch(startNew ? '/api/start' : '/api/send/' + current.id, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: byId('prompt').value, previousId }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    display(result.conversation);
  } catch (error) {
    if (previousId) {
      try {
        await restore(previousId);
      } catch {
        current = undefined;
      }
    }
    byId('status').textContent = 'Stopped';
    byId('error').textContent = error.message;
    byId('error').classList.remove('hidden');
    if (!current) byId('state').textContent = 'Not started';
  } finally {
    busy = false;
    controls();
  }
}
async function close() {
  busy = true;
  controls();
  byId('error').classList.add('hidden');
  try {
    const response = await fetch('/api/close/' + current.id, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    display(result);
  } catch (error) {
    byId('error').textContent = error.message;
    byId('error').classList.remove('hidden');
  } finally {
    busy = false;
    controls();
  }
}
async function restore(id) {
  const response = await fetch('/api/conversation/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Conversation unavailable.');
  const snapshot = await response.json();
  display(snapshot);
  return snapshot;
}
byId('start').onclick = () => submit(true);
byId('send').onclick = () => submit(false);
byId('close').onclick = close;
document.querySelectorAll('[data-example]').forEach(
  (button) =>
    (button.onclick = () => {
      byId('prompt').value = examples[button.dataset.example];
    }),
);
window.lesson = { showView, source, restore, report: () => current };
try {
  const response = await fetch('/api/examples');
  if (!response.ok) throw new Error('Could not load classroom messages.');
  examples = await response.json();
  byId('prompt').value = examples.store;
  controls();
} catch (error) {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
}
