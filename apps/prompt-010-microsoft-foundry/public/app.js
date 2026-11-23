const byId=id=>document.getElementById(id);
let defaults;let lastReport;
function element(tag,value){const node=document.createElement(tag);node.textContent=value;return node;}
async function source(file='src/config.ts'){
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
function busy(value){for(const id of ['resource','deployment','inspect','run-agent','repair'])byId(id).disabled=value;}
function displayConfiguration(configuration){
  byId('provider').textContent=configuration.provider;byId('selected-model').textContent=configuration.deployment;byId('authentication').textContent=configuration.authentication;byId('endpoint').textContent=configuration.endpoint;
}
function displayReport(report){
  lastReport=report;displayConfiguration(report.configuration);byId('answer').textContent=report.answer;byId('events').replaceChildren();
  for(const event of report.events){const row=document.createElement('article');row.className='event';row.append(element('strong',event.type),element('p',event.detail));if(event.data)row.append(element('pre',JSON.stringify(event.data,null,2)));byId('events').append(row);}
  byId('status').textContent='Authenticated';byId('status').className='badge passed';byId('download').href='/api/report/'+report.id;byId('download').classList.remove('hidden');byId('progress').textContent='Successful Foundry-backed SDK result received.';
}
async function request(live){
  busy(true);byId('error').classList.add('hidden');byId('download').classList.add('hidden');byId('answer').textContent='Awaiting a completed query.';byId('events').replaceChildren();byId('status').textContent=live?'Running':'Inspecting';byId('status').className='badge';
  for(const id of ['provider','selected-model','authentication','endpoint'])byId(id).textContent='—';
  try{
    const response=await fetch(live?'/api/run':'/api/inspect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({resource:byId('resource').value.trim(),deployment:byId('deployment').value.trim()})});
    const result=await response.json();if(!response.ok)throw new Error(result.error);
    if(live)displayReport(result);else{displayConfiguration(result);byId('status').textContent='Configuration inspected';byId('status').className='badge passed';byId('progress').textContent='Route inspected. Run the SDK query to verify service access.';}
  }catch(error){byId('status').textContent='Stopped';byId('error').textContent=error.message;byId('error').classList.remove('hidden');byId('progress').textContent='Check the resource, deployment, Azure sign-in, role, and firewall configuration.';}
  finally{busy(false);}
}
function repair(){byId('resource').value=defaults.resource;byId('deployment').value=defaults.deployment;}
async function restore(id){
  const response=await fetch('/api/report/'+encodeURIComponent(id));if(!response.ok)throw new Error('Saved report unavailable.');const report=await response.json();byId('resource').value=report.configuration.resource;byId('deployment').value=report.configuration.deployment;displayReport(report);return report;
}
byId('inspect').onclick=()=>request(false);byId('run-agent').onclick=()=>request(true);byId('repair').onclick=repair;
async function initialize(){
  try{
    const data=await(await fetch('/api/config')).json();defaults=data.defaults;repair();
    for(const feature of data.providerNotes.features){const row=document.createElement('article');row.className='feature';row.append(element('strong',feature.name),element('span',feature.availability),element('p',feature.detail));byId('features').append(row);}
    busy(false);byId('status').textContent='Ready';byId('progress').textContent='Inspect the route, then run the authenticated Foundry query.';
  }catch(error){byId('error').textContent=error.message;byId('error').classList.remove('hidden');}
}
window.lesson={showView,source,restore,report:()=>lastReport};initialize();
