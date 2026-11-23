const byId = (id) => document.getElementById(id);
let lastReport;
function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}
async function source(file = 'src/image.ts') {
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
let uploadedImage;
function showError(message) {
  byId('error').textContent = message;
  byId('error').classList.remove('hidden');
}
async function chooseImage() {
  const file = byId('image-file').files[0];
  if (!file) return;
  uploadedImage = undefined;
  byId('image-file').disabled = true;
  byId('inspect').disabled = true;
  byId('source-mode').disabled = true;
  try {
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 5 * 1024 * 1024)
      throw new Error('Choose a PNG or JPEG within this lab’s 5 MiB limit.');
    const dataURL = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('The selected image could not be read.'));
      reader.readAsDataURL(file);
    });
    const data = dataURL.slice(dataURL.indexOf(',') + 1);
    uploadedImage = { name: file.name, mediaType: file.type, data };
    byId('source-mode').value = 'upload';
    byId('preview').src = dataURL;
    byId('image-name').textContent = file.name;
    byId('error').classList.add('hidden');
  } catch (error) {
    byId('preview').removeAttribute('src');
    byId('image-name').textContent = 'Choose a supported image.';
    showError(error.message);
  } finally {
    byId('image-file').disabled = false;
    byId('inspect').disabled = false;
    byId('source-mode').disabled = false;
  }
}
function displayReport(report) {
  lastReport = report;
  byId('media').textContent = report.image.mediaType;
  byId('bytes').textContent = report.image.bytes.toLocaleString();
  byId('types').textContent = report.contentTypes.join(' + ');
  byId('content-check').textContent =
    report.classroomContentCheck === null
      ? 'Review visual answer'
      : report.classroomContentCheck
        ? 'Passed'
        : 'Review result';
  byId('answer').textContent = report.answer;
  byId('answer').scrollTop = 0;
  byId('metadata').textContent = JSON.stringify(
    {
      yieldedImageMessage: report.yielded,
      actualSDKFrames: report.frameTypes,
      nativeSessionId: report.sessionId,
      imageSha256: report.image.sha256,
    },
    null,
    2,
  );
  byId('preview').src = '/api/image/' + report.id;
  byId('image-name').textContent = report.image.name;
  byId('status').textContent = report.verified ? 'SDK completed' : 'Review result';
  byId('status').className = 'badge ' + (report.verified ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Preserved the actual image metadata, yielded content types and SDK explanation.';
  if (report.error || !report.success) showError(report.error || report.answer);
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
}
async function run() {
  lastReport = undefined;
  for (const id of ['source-mode', 'image-file', 'question', 'inspect', 'repair'])
    byId(id).disabled = true;
  byId('error').classList.add('hidden');
  byId('download').classList.add('hidden');
  byId('status').textContent = 'Analyzing';
  byId('status').className = 'badge';
  byId('progress').textContent =
    'Validating image bytes and submitting a real multimodal SDK user message.';
  byId('answer').textContent = 'Waiting for the actual visual explanation.';
  byId('metadata').textContent = '';
  for (const id of ['media', 'bytes', 'types', 'content-check']) byId(id).textContent = '—';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: byId('source-mode').value,
        image: uploadedImage,
        question: byId('question').value,
      }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error);
    displayReport(report);
  } catch (error) {
    byId('status').textContent = 'Stopped';
    showError(error.message);
  } finally {
    for (const id of ['source-mode', 'image-file', 'question', 'inspect', 'repair'])
      byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved report unavailable.');
  const report = await response.json();
  uploadedImage = undefined;
  byId('image-file').value = '';
  byId('source-mode').value = report.source;
  byId('question').value = report.question;
  displayReport(report);
  if (report.source === 'upload')
    byId('progress').textContent =
      'Showing the saved uploaded image. Choose a local file to start another uploaded-image run.';
  return report;
}
byId('image-file').onchange = chooseImage;
byId('source-mode').onchange = () => {
  if (byId('source-mode').value === 'upload') {
    if (uploadedImage) {
      byId('preview').src = 'data:' + uploadedImage.mediaType + ';base64,' + uploadedImage.data;
      byId('image-name').textContent = uploadedImage.name;
    } else {
      byId('preview').removeAttribute('src');
      byId('image-name').textContent = 'Choose a local PNG or JPEG.';
    }
  } else {
    byId('preview').src = 'assets/main-infographic.png';
    byId('image-name').textContent = 'Original main infographic';
  }
};
byId('inspect').onclick = run;
byId('repair').onclick = () => {
  byId('source-mode').value = 'demo';
  byId('preview').src = 'assets/main-infographic.png';
  byId('image-name').textContent = 'Original main infographic';
};
window.lesson = { showView, source, restore, report: () => lastReport };
try {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Classroom question unavailable.');
  byId('question').value = (await response.json()).defaultQuestion;
  byId('inspect').disabled = false;
  byId('status').textContent = 'Ready';
  byId('progress').textContent =
    'Send the selected image and its question together in one SDK user message.';
} catch (error) {
  showError(error.message);
}
