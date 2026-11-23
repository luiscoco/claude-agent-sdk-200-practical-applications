const byId=id=>document.getElementById(id);
let lastReport;
function element(tag,value){const node=document.createElement(tag);node.textContent=value;return node;}
async function source(file='src/agent.ts'){
  const data=await(await fetch('/api/source?file='+encodeURIComponent(file))).json();
  byId('source-title').textContent=data.file;byId('files').replaceChildren();byId('source').replaceChildren();
  for(const name of data.files){const button=element('button',name);button.className='secondary';button.onclick=()=>source(name);byId('files').append(button);}
  data.content.split('\n').forEach((line,index)=>{const row=element('span',line||' ');row.className='code-line';row.dataset.line=index+1;byId('source').append(row);});
}
async function showView(name){
  document.querySelectorAll('.view').forEach(view=>view.classList.toggle('hidden',view.id!==name+'-view'));
  document.querySelectorAll('[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view===name));
  if(name==='source')await source();
}
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>showView(button.dataset.view));
function busy(value){for(const id of ['project','project-settings','inspect','run-agent','repair'])byId(id).disabled=value;}
function reset(){
  byId('error').classList.add('hidden');byId('download').classList.add('hidden');
  byId('answer').textContent='Awaiting a completed query.';byId('observation').textContent='Awaiting an observed Read response.';
  for(const id of ['cwd','settings','reads','verified'])byId(id).textContent='—';
}
function displayProject(project){byId('readme').textContent=project.readme;byId('instructions').textContent=project.instructions;}
function displayReport(report){
  lastReport=report;byId('cwd').textContent=report.initializedCwd;byId('settings').textContent=report.settingSources.length?'Project enabled':'Disabled';byId('reads').textContent=report.readCalls;
  byId('verified').textContent=report.verified?'Passed':'Mismatch';byId('answer').textContent=JSON.stringify(report.answer,null,2);
  const observation=report.events.find(event=>event.type==='read_completed');
  byId('observation').textContent=JSON.stringify(observation?.data,null,2);
  byId('status').textContent=report.verified?'Verified':'Review result';byId('status').className='badge '+(report.verified?'passed':'mismatch');
  byId('download').href='/api/report/'+report.id;byId('download').classList.remove('hidden');byId('progress').textContent='Completed query with observed Read and fixture comparison.';
}
async function request(live){
  reset();busy(true);byId('status').textContent=live?'Running':'Inspecting';byId('status').className='badge';
  try{
    const body={project:byId('project').value,loadProjectSettings:byId('project-settings').checked};
    const inspection=await fetch('/api/inspect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const project=await inspection.json();if(!inspection.ok)throw new Error(project.error);displayProject(project);
    if(live){const response=await fetch('/api/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const report=await response.json();if(!response.ok)throw new Error(report.error);displayReport(report);}
    else{byId('status').textContent='Project inspected';byId('status').className='badge passed';byId('progress').textContent='Fixture preview loaded. Run the query to observe the SDK session.';}
  }catch(error){byId('status').textContent='Stopped';byId('error').textContent=error.message;byId('error').classList.remove('hidden');byId('progress').textContent='Select an installed fixture project and retry.';}
  finally{busy(false);}
}
async function restore(id){
  const response=await fetch('/api/report/'+encodeURIComponent(id));if(!response.ok)throw new Error('Saved report unavailable.');
  const report=await response.json();byId('project').value=report.project;byId('project-settings').checked=report.settingSources.length>0;displayReport(report);return report;
}
byId('inspect').onclick=()=>request(false);byId('run-agent').onclick=()=>request(true);byId('repair').onclick=()=>{byId('project').value='orbit';byId('project-settings').checked=true;};
window.lesson={showView,source,restore,report:()=>lastReport};
