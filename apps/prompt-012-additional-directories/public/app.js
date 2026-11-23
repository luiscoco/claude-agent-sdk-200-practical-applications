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
function busy(value){for(const id of ['grant','project-settings','inspect','run-agent','repair'])byId(id).disabled=value;}
function displayConfiguration(configuration){
  byId('cwd').textContent=configuration.cwd;byId('grants').textContent=configuration.additionalDirectories.length?'1 · shared':'0';
  byId('settings').textContent=configuration.settingSources.length?'Project enabled':'Disabled';
  byId('configuration-evidence').textContent='Existing fixtures · '+configuration.fixtures.map(file=>file.file).join(' · ');
}
function displayReport(report){
  lastReport=report;displayConfiguration(report.configuration);byId('cwd').textContent=report.initializedCwd;
  byId('verified').textContent=report.verified?'Passed':'Mismatch';byId('probes').replaceChildren();
  for(const probe of report.probes){
    const card=document.createElement('article');card.className='panel probe '+(probe.readable?'readable':'unavailable');
    card.dataset.file=probe.file;
    card.append(element('h3',probe.file),element('strong',probe.readable?'Readable':'Unavailable to viewer'),element('p','Fixture exists · '+(probe.exists?'Yes':'No')),element('pre',probe.response?.contents||'readFile() returned null'));
    byId('probes').append(card);
  }
  byId('commands').textContent=report.discoveredCommands.length?report.discoveredCommands.join('\n'):'No shared command discovered';
  byId('answer').textContent=report.answer;byId('status').textContent=report.verified?'Verified':'Review result';byId('status').className='badge '+(report.verified?'passed':'mismatch');
  byId('download').href='/api/report/'+report.id;byId('download').classList.remove('hidden');byId('progress').textContent='Completed native file probes and command discovery checks.';
}
async function request(live){
  byId('error').classList.add('hidden');byId('download').classList.add('hidden');busy(true);byId('status').textContent=live?'Running':'Inspecting';byId('status').className='badge';
  byId('answer').textContent='Awaiting a completed session.';byId('verified').textContent='—';byId('commands').textContent='Awaiting initialization.';
  byId('probes').replaceChildren(element('p','Waiting for SDK file probes.'));
  try{
    const response=await fetch(live?'/api/run':'/api/inspect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({grantShared:byId('grant').checked,loadProjectSettings:byId('project-settings').checked})});
    const result=await response.json();if(!response.ok)throw new Error(result.error);
    if(live)displayReport(result);
    else{displayConfiguration(result);byId('status').textContent='Configuration inspected';byId('status').className='badge passed';byId('progress').textContent='Fixture paths checked. Run the session to observe native access.';}
  }catch(error){byId('status').textContent='Stopped';byId('error').textContent=error.message;byId('error').classList.remove('hidden');}
  finally{busy(false);}
}
async function restore(id){
  const response=await fetch('/api/report/'+encodeURIComponent(id));if(!response.ok)throw new Error('Saved report unavailable.');
  const report=await response.json();byId('grant').checked=report.configuration.additionalDirectories.length>0;byId('project-settings').checked=report.configuration.settingSources.length>0;displayReport(report);return report;
}
byId('inspect').onclick=()=>request(false);byId('run-agent').onclick=()=>request(true);byId('repair').onclick=()=>{byId('grant').checked=true;byId('project-settings').checked=true;};
window.lesson={showView,source,restore,report:()=>lastReport};
