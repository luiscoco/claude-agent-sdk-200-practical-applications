const byId = id => document.getElementById(id);
function element(tag, content) { const node=document.createElement(tag); node.textContent=content; return node; }
let lastReport;
async function source(file='src/diagnostics.mjs') {
  const data=await(await fetch('/api/source?file='+encodeURIComponent(file))).json();
  byId('source-title').textContent=data.file; byId('files').replaceChildren(); byId('source').replaceChildren();
  for(const name of data.files){const button=element('button',name);button.className='secondary';button.onclick=()=>source(name);byId('files').append(button);}
  data.content.split('\n').forEach((line,index)=>{const row=element('span',line||' ');row.className='code-line';row.dataset.line=index+1;byId('source').append(row);});
}
async function showView(name) {
  document.querySelectorAll('.view').forEach(view=>view.classList.toggle('hidden',view.id!==name+'-view'));
  document.querySelectorAll('[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view===name));
  if(name==='source')await source();
}
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>showView(button.dataset.view));
async function inspect() {
  byId('inspect').disabled=true; byId('error').classList.add('hidden'); byId('download').classList.add('hidden');
  byId('checks').replaceChildren(); byId('status').textContent='Inspecting'; byId('status').className='badge';
  for(const id of ['language-version','sdk','platform','runtime'])byId(id).textContent='—';
  try {
    const response=await fetch('/api/inspect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language:byId('language').value,missingBinary:byId('missing').checked})});
    const report=await response.json(); if(!response.ok)throw new Error(report.error);
    lastReport=report;
    byId('language-version').textContent=report.environment.language+' '+report.environment.version;
    byId('sdk').textContent=report.environment.sdkVersion; byId('platform').textContent=report.environment.platform+'/'+report.environment.architecture;
    byId('runtime').textContent=report.runtimeOutput||'Unavailable';
    byId('status').textContent=report.status==='passed'?'Ready to run':'Attention required';byId('status').className='badge '+(report.status==='passed'?'passed':'mismatch');
    for(const check of report.checks){
      const attention=check.status==='failed'||check.status==='review';
      const row=document.createElement('article');row.className='check '+(attention?'failed':'pass');
      row.append(element('strong',(attention?'! ':check.status==='observed'?'• ':'✓ ')+check.label),element('p',check.evidence));
      if(check.remedy){const remedy=element('p',check.remedy);remedy.className='remedy';row.append(remedy);}
      byId('checks').append(row);
    }
    byId('download').href='/api/report/'+report.id;byId('download').classList.remove('hidden');
    byId('progress').textContent=report.scenario+' · Actual local dependency inspection completed.';
  } catch(error){byId('status').textContent='Stopped';byId('error').textContent=error.message;byId('error').classList.remove('hidden');}
  finally{byId('inspect').disabled=false;}
}
byId('inspect').onclick=inspect;byId('repair').onclick=()=>{byId('missing').checked=false;};
window.lesson={showView,source,inspect,report:()=>lastReport};
