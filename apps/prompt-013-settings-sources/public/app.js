const byId=id=>document.getElementById(id);
let lastReport;
function element(tag,value){const node=document.createElement(tag);node.textContent=value;return node;}
async function source(file='src/settings.ts'){
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
function displayReport(report){
  lastReport=report;byId('cleanup').textContent=report.cleanupPeriodDays??'Unset';byId('winner').textContent=report.provenance?.source||'No fixture value';byId('origin').textContent=report.origin??'Unset';byId('selection').textContent=report.optionOmitted?'Omitted':JSON.stringify(report.selection);
  byId('source-cards').replaceChildren();
  for(const name of ['user','project','local']){
    const row=report.sources.find(source=>source.source===name);const card=document.createElement('article');card.className='panel source-card '+(report.provenance?.source===name?'winning':'');card.dataset.source=name;
    card.append(element('h3',name),element('strong',row?'Loaded':'Excluded'),element('p',row?`cleanupPeriodDays · ${row.cleanupPeriodDays}`:'This optional source is disabled.'),element('pre',row?row.path:'—'));byId('source-cards').append(card);
  }
  byId('provenance').textContent=JSON.stringify(report.provenance,null,2);byId('scope').textContent='Classroom config home · '+report.configHome;
  byId('status').textContent='Resolved';byId('status').className='badge passed';byId('download').href='/api/report/'+report.id;byId('download').classList.remove('hidden');byId('progress').textContent='Observed resolveSettings() result from SDK '+report.sdkVersion+'.';
}
async function inspect(){
  byId('inspect').disabled=true;byId('mode').disabled=true;byId('repair').disabled=true;byId('error').classList.add('hidden');byId('download').classList.add('hidden');byId('status').textContent='Resolving';byId('status').className='badge';
  for(const id of ['cleanup','winner','origin','selection'])byId(id).textContent='—';byId('provenance').textContent='Awaiting the SDK snapshot.';byId('source-cards').replaceChildren();
  try{
    const response=await fetch('/api/inspect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:byId('mode').value})});const result=await response.json();if(!response.ok)throw new Error(result.error);displayReport(result);
  }catch(error){byId('status').textContent='Stopped';byId('error').textContent=error.message;byId('error').classList.remove('hidden');byId('progress').textContent='Restore a supported source selection and retry.';}
  finally{byId('inspect').disabled=false;byId('mode').disabled=false;byId('repair').disabled=false;}
}
async function restore(id){const response=await fetch('/api/report/'+encodeURIComponent(id));if(!response.ok)throw new Error('Saved report unavailable.');const report=await response.json();byId('mode').value=report.mode;displayReport(report);return report;}
byId('inspect').onclick=inspect;byId('repair').onclick=()=>{byId('mode').value='default';};window.lesson={showView,source,restore,report:()=>lastReport};
