const byId = id => document.getElementById(id);
let lastReport;
function element(tag, value) { const node=document.createElement(tag); node.textContent=value; return node; }
async function source(file='src/auth.ts') {
  const data=await(await fetch('/api/source?file='+encodeURIComponent(file))).json();
  byId('source-title').textContent=data.file;byId('files').replaceChildren();byId('source').replaceChildren();
  for(const name of data.files){const button=element('button',name);button.className='secondary';button.onclick=()=>source(name);byId('files').append(button);}
  data.content.split('\n').forEach((line,index)=>{const row=element('span',line||' ');row.className='code-line';row.dataset.line=index+1;byId('source').append(row);});
}
async function showView(name) {
  document.querySelectorAll('.view').forEach(view=>view.classList.toggle('hidden',view.id!==name+'-view'));
  document.querySelectorAll('[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view===name));
  if(name==='source')await source();
}
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>showView(button.dataset.view));
function busy(value) { for(const id of ['mode','inspect','run-agent','blank','repair'])byId(id).disabled=value; }
function clearResult() {
  byId('answer').textContent='Awaiting a completed query.';byId('events').replaceChildren();byId('download').classList.add('hidden');byId('error').classList.add('hidden');
  for(const id of ['presence','origin','dotenv','model'])byId(id).textContent='—';byId('configuration-evidence').textContent='';
}
function displayConfiguration(configuration) {
  byId('presence').textContent=configuration.keyPresent?'Present':'Missing';
  byId('origin').textContent=configuration.credentialOrigin;
  byId('dotenv').textContent=configuration.dotenvLoaded?'Yes':'No';
  byId('model').textContent=configuration.model;
  byId('configuration-evidence').textContent=configuration.dotenvLoaded?`Loaded ${configuration.sourceFile}. Variable names: ${configuration.loadedVariables.join(', ')}.`:'Credential read from the process environment.';
}
function displayReport(result) {
  lastReport=result;displayConfiguration(result.configuration);byId('answer').textContent=result.answer;
  byId('status').textContent='Authenticated';byId('status').className='badge passed';byId('events').replaceChildren();
  for(const event of result.events){const row=document.createElement('article');row.className='event';row.append(element('strong',event.type),element('p',event.detail));byId('events').append(row);}
  byId('download').href='/api/report/'+result.id;byId('download').classList.remove('hidden');byId('progress').textContent='Successful authenticated SDK result received.';
}
async function request(live) {
  clearResult();busy(true);byId('status').textContent=live?'Running':'Checking';byId('status').className='badge';
  try {
    const response=await fetch(live?'/api/run':'/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:byId('mode').value,prompt:byId('prompt').value})});
    const result=await response.json();if(!response.ok)throw new Error((result.code?result.code+' · ':'')+result.error);
    if(live)displayReport(result);
    else{displayConfiguration(result.configuration);byId('status').textContent='Configuration checked';byId('status').className='badge passed';byId('progress').textContent='Credential presence checked. Run the authenticated query to verify service access.';}
  } catch(error){byId('status').textContent='Stopped';byId('error').textContent=error.message;byId('error').classList.remove('hidden');byId('progress').textContent='Configure the credential source and retry.';}
  finally{busy(false);}
}
async function restore(id) {
  const response=await fetch('/api/report/'+encodeURIComponent(id));if(!response.ok)throw new Error('Saved result unavailable.');
  const result=await response.json();displayReport(result);return result;
}
byId('inspect').onclick=()=>request(false);byId('run-agent').onclick=()=>request(true);
byId('blank').onclick=()=>{byId('mode').value='blank';};byId('repair').onclick=()=>{byId('mode').value='environment';};
window.lesson={showView,source,restore,report:()=>lastReport};
