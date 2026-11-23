const byId=id=>document.getElementById(id);
let lastReport;
function element(tag,value){const node=document.createElement(tag);node.textContent=value;return node;}
async function source(file='src/typescript.ts'){
  const data=await(await fetch('/api/source?file='+encodeURIComponent(file))).json();byId('source-title').textContent=data.file;byId('files').replaceChildren();byId('source').replaceChildren();
  for(const name of data.files){const button=element('button',name);button.className='secondary';button.onclick=()=>source(name);byId('files').append(button);}
  data.content.split('\n').forEach((line,index)=>{const row=element('span',line||' ');row.className='code-line';row.dataset.line=index+1;byId('source').append(row);});
}
async function showView(name){document.querySelectorAll('.view').forEach(view=>view.classList.toggle('hidden',view.id!==name+'-view'));document.querySelectorAll('[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view===name));if(name==='source')await source();}
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>showView(button.dataset.view));
function displayReport(report){
  lastReport=report;byId('language').textContent=report.sdk;byId('selected-mode').textContent=report.mode;byId('initialized').textContent=report.initialized?'Yes':'Failed';byId('verified').textContent=report.verified?'Passed':'Review';
  byId('parent').textContent=report.observed.parentMarker??'Missing';byId('custom').textContent=report.observed.customValue??'Missing';byId('path').textContent=report.observed.pathPresent?'Present':'Missing';byId('parent-card').classList.toggle('missing',!report.observed.parentMarker);
  byId('evidence').textContent=report.evidence;byId('scope').textContent=report.initialized?'The native SDK runtime completed its initialization handshake. The application then closed it.':report.initializationError;
  byId('status').textContent='Observed';byId('status').className='badge passed';byId('download').href='/api/report/'+report.id;byId('download').classList.remove('hidden');byId('progress').textContent='Actual SDK subprocess environment observed and checked.';
}
async function inspect(){
  for(const id of ['mode','inspect','repair'])byId(id).disabled=true;byId('error').classList.add('hidden');byId('download').classList.add('hidden');byId('status').textContent='Initializing';byId('status').className='badge';
  for(const id of ['language','selected-mode','initialized','verified','parent','custom','path'])byId(id).textContent='—';byId('parent-card').classList.remove('missing');
  try{
    const response=await fetch('/api/inspect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:byId('mode').value})});const result=await response.json();if(!response.ok)throw new Error(result.error);displayReport(result);
  }catch(error){byId('status').textContent='Stopped';byId('error').textContent=error.message;byId('error').classList.remove('hidden');byId('progress').textContent='Choose a supported mode and verify the installed SDK runtime.';}
  finally{for(const id of ['mode','inspect','repair'])byId(id).disabled=false;}
}
async function restore(id){const response=await fetch('/api/report/'+encodeURIComponent(id));if(!response.ok)throw new Error('Saved report unavailable.');const report=await response.json();byId('mode').value=report.sdk==='Python'?'python-merge':report.mode==='replacement'?'typescript-replace':'typescript-preserve';displayReport(report);return report;}
byId('inspect').onclick=inspect;byId('repair').onclick=()=>{byId('mode').value='typescript-preserve';};window.lesson={showView,source,restore,report:()=>lastReport};
