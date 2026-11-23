const byId = (id) => document.getElementById(id);
let lastReport;
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
function showProfile() {
  if (!lastReport) return;
  const profile = lastReport.profiles[Number(byId('profile-select').value)];
  byId('configuration').textContent = JSON.stringify(
    {
      language: profile.language,
      sdkVersion: profile.sdkVersion,
      nativeVersion: profile.nativeVersion,
      control: profile.control,
      persistenceExpected: profile.persistenceExpected,
      firstClassPersistOption: profile.firstClassPersistOption,
    },
    null,
    2,
  );
  byId('completion').textContent = JSON.stringify(
    {
      nativeSessionId: profile.actualSessionId,
      initAndResultAgree: profile.actualSessionId === profile.actualResultSessionId,
      success: profile.success,
      assistantTurns: profile.turns,
      modelCostUsd: profile.costUsd,
      durationApiMs: profile.durationApiMs,
    },
    null,
    2,
  );
  byId('history').textContent = JSON.stringify(
    {
      nativeTranscripts: profile.history.transcripts.length,
      originalAppendFound: profile.history.transcripts.some((file) => file.exactUserAppendFound),
      nativeMessages: profile.history.nativeMessages.length,
      exactMarkerFoundByNativeReader: profile.history.exactMarkerFoundByNativeReader,
      separateHostFileRemains: profile.history.noteRemains,
    },
    null,
    2,
  );
  byId('native-history').textContent = JSON.stringify(
    {
      transcriptFiles: profile.history.transcripts,
      actualNativeMessages: profile.history.nativeMessages,
    },
    null,
    2,
  );
  byId('checks').textContent = JSON.stringify(
    { entireComparison: lastReport.checks, selectedProfile: profile.checks },
    null,
    2,
  );
  byId('evidence').textContent = JSON.stringify(profile.events, null, 2);
}
function display(report) {
  lastReport = report;
  byId('mode').value = report.requestedInput.mode;
  byId('topic').value = report.requestedInput.topic;
  byId('profiles-value').textContent = report.output.profiles;
  byId('persisted-value').textContent = report.output.persisted;
  byId('turns-value').textContent = report.output.assistantTurns;
  byId('cost-value').textContent = '$' + report.output.totalCostUsd;
  byId('profile-select').replaceChildren();
  report.profiles.forEach((profile, index) => {
    const option = element('option', profile.language + ' · ' + profile.control);
    option.value = index;
    byId('profile-select').append(option);
  });
  byId('profile-select').disabled = false;
  showProfile();
  byId('difference').textContent = report.profiles
    .map(
      (profile) =>
        profile.language +
        ' SDK ' +
        profile.sdkVersion +
        ' · native ' +
        profile.nativeVersion +
        '\n' +
        'Control: ' +
        profile.control +
        '\n' +
        'Actual transcript files: ' +
        profile.history.transcripts.length +
        ' · assistant turns: ' +
        profile.turns +
        '\n' +
        'First-class persistence option: ' +
        profile.firstClassPersistOption,
    )
    .join('\n\n');
  byId('metadata').textContent = JSON.stringify(
    { id: report.id, checkedAt: report.checkedAt, fixtureDisclosure: report.fixtureDisclosure },
    null,
    2,
  );
  byId('status').textContent = report.verified
    ? 'Actual persistence controls verified'
    : 'Verification failed';
  byId('status').className = 'badge ' + (report.verified ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Native SDK profiles completed. Select each profile to compare actual transcript files and independent history reads.';
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
  error(report.verified ? '' : 'Inspect the actual native persistence checks.');
}
async function compare() {
  for (const id of ['inspect', 'mode', 'topic', 'profile-select']) byId(id).disabled = true;
  lastReport = undefined;
  error('');
  byId('download').classList.add('hidden');
  byId('status').className = 'badge';
  byId('status').textContent = 'Running native transcript-only controls';
  for (const id of [
    'configuration',
    'completion',
    'history',
    'native-history',
    'difference',
    'checks',
    'evidence',
  ])
    byId(id).textContent = 'Running actual native transcript-only operations.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: byId('mode').value, topic: byId('topic').value }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error || 'Native persistence comparison failed.');
    display(report);
    return report;
  } catch (failure) {
    error(failure.message);
    byId('status').textContent = 'Comparison failed';
    throw failure;
  } finally {
    for (const id of ['inspect', 'mode', 'topic']) byId(id).disabled = false;
    byId('profile-select').disabled = !lastReport;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Observed persistence report unavailable.');
  const report = await response.json();
  display(report);
  return report;
}
byId('inspect').onclick = () => compare().catch(() => {});
byId('profile-select').onchange = showProfile;
window.lesson = { showView, source, compare, restore, report: () => lastReport };
for (const id of [
  'configuration',
  'completion',
  'history',
  'native-history',
  'difference',
  'checks',
  'evidence',
])
  byId(id).textContent = 'Awaiting actual native transcript-only profiles.';
