const byId=id=>document.getElementById(id);
let lastReport;
function node(tag,value){const element=document.createElement(tag);element.textContent=value;return element;}
async function source(file='src/agent.py'){
  const data=await(await fetch('/api/source?file='+encodeURIComponent(file))).json();
  byId('source-title').textContent=data.file;byId('files').replaceChildren();byId('source').replaceChildren();
  for(const name of data.files){const button=node('button',name);button.className='secondary';button.onclick=()=>source(name);byId('files').append(button);}
  data.content.split('\n').forEach((line,index)=>{const row=node('span',line||' ');row.className='code-line';row.dataset.line=index+1;byId('source').append(row);});
}
async function showView(name){
  document.querySelectorAll('.view').forEach(view=>view.classList.toggle('hidden',view.id!==name+'-view'));
  document.querySelectorAll('[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view===name));
  if(name==='source')await source();
}
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>showView(button.dataset.view));
function displayResult(result){
  lastReport=result;byId('answer').textContent=result.answer;byId('status').textContent='Completed';byId('status').className='badge passed';
  byId('events').replaceChildren();
  for(const event of result.events){const row=document.createElement('article');row.className='event';row.append(node('strong',event.type),node('p',event.detail));byId('events').append(row);}
  byId('download').href='/api/report/'+result.id;byId('download').classList.remove('hidden');
  byId('progress').textContent='Successful SDK result received. Estimated cost $'+result.estimatedCostUsd.toFixed(5)+'.';
}
async function restore(id){
  const response=await fetch('/api/report/'+encodeURIComponent(id));
  if(!response.ok)throw new Error('The saved result is unavailable.');
  const result=await response.json();displayResult(result);return result;
}
async function run(){
  byId('run-agent').disabled=true;byId('error').classList.add('hidden');byId('download').classList.add('hidden');
  byId('answer').textContent='Waiting for the SDK result…';byId('events').replaceChildren();byId('status').textContent='Running';byId('status').className='badge';
  try{
    const response=await fetch('/api/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:byId('prompt').value})});
    const result=await response.json();if(!response.ok)throw new Error(result.error);
    displayResult(result);
  }catch(error){byId('status').textContent='Stopped';byId('error').textContent=error.message;byId('error').classList.remove('hidden');byId('answer').textContent='No completed result.';byId('progress').textContent='Correct the task or local configuration, then retry.';}
  finally{byId('run-agent').disabled=false;}
}
byId('run-agent').onclick=run;byId('empty').onclick=()=>{byId('prompt').value='';};byId('repair').onclick=()=>{byId('prompt').value='Reply with READY.';};
fetch('/api/config').then(response=>response.json()).then(config=>{byId('python-info').textContent='Python '+config.python+' · SDK '+config.sdk+' · Isolated environment '+config.isolated;byId('interpreter-path').textContent=config.interpreter;byId('auth').textContent=config.apiConfigured?'Claude API configured':'Configure ANTHROPIC_API_KEY locally';});
window.lesson={showView,source,run,restore,report:()=>lastReport};

