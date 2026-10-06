import { auth, db, doc, getDoc, setDoc, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "./firebase.js";

let firebaseUser=null;
let cloudReady=false;
let cloudSaveTimer=null;
let cloudLoading=false;

const KEY='machineServiceLogV02';
const OLD='machineServiceLogV01';
const localSave=()=>localStorage.setItem(KEY,JSON.stringify(data));
async function cloudSave(){
  if(!firebaseUser || cloudLoading) return;
  try {
    await setDoc(doc(db,"users",firebaseUser.uid,"app","state"),{data,updatedAt:new Date().toISOString()});
    cloudReady=true;
    setSyncStatus("Cloud saved");
  } catch(err){
    console.error(err);
    setSyncStatus("Cloud save failed: "+(err.message||"Unknown error"),true);
  }
}
function save(){
  localSave();
  if(firebaseUser){
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer=setTimeout(cloudSave,250);
  }
}
function setSyncStatus(msg,error=false){
  const el=document.getElementById("syncStatus");
  if(el){el.textContent=msg||"";el.classList.toggle("error",!!error);}
}
function setAuthMessage(msg,error=false){
  const el=document.getElementById("authMessage");
  if(el){el.textContent=msg||"";el.classList.toggle("error",!!error);}
}
function showAppForUser(user){
  const authPanel=document.getElementById("authPanel"), appShell=document.getElementById("appShell"), userEmail=document.getElementById("userEmail");
  if(authPanel) authPanel.classList.add("hidden");
  if(appShell) appShell.classList.remove("hidden");
  if(userEmail) userEmail.textContent=user?.email||"";
}
function showAuth(){
  const authPanel=document.getElementById("authPanel"), appShell=document.getElementById("appShell");
  if(authPanel) authPanel.classList.remove("hidden");
  if(appShell) appShell.classList.add("hidden");
}
async function loadCloudForUser(user){
  cloudLoading=true;
  setSyncStatus("Loading cloud data…");
  try {
    const ref=doc(db,"users",user.uid,"app","state");
    const snap=await getDoc(ref);
    if(snap.exists() && snap.data().data){
      data={...defaultData,...snap.data().data};
      data.templates ||= []; data.models ||= []; data.services ||= []; data.machines ||= [];
      data.services.forEach(s=>{
        if(!Array.isArray(s.workLogs)){s.workLogs=[];if(s.workDate||s.hours||s.workDescription)s.workLogs.push({id:crypto.randomUUID(),date:s.workDate||today(),hours:Number(s.hours||0),description:s.workDescription||''});}
        s.workLogs.forEach(l=>l.hours=Number(l.hours||0));
      });
      localSave();
      setSyncStatus("Cloud data loaded");
    } else {
      const localRaw=localStorage.getItem(KEY);
      if(localRaw){
        const localData=JSON.parse(localRaw);
        const hasLocal=localData && ((localData.machines?.length||0)+(localData.services?.length||0)+(localData.templates?.length||0)+(localData.models?.length||0));
        if(hasLocal){
          const importIt=confirm("No Beam Tracker cloud data exists for this account. Import the data currently saved on this device into Firebase?

Choose Cancel to start with an empty cloud database.");
          if(importIt){data={...defaultData,...localData};cloudLoading=false;await cloudSave();cloudLoading=true;}
          else {data=structuredClone(defaultData);localSave();cloudLoading=false;await cloudSave();cloudLoading=true;}
        } else {data=structuredClone(defaultData);localSave();cloudLoading=false;await cloudSave();cloudLoading=true;}
      } else {data=structuredClone(defaultData);localSave();cloudLoading=false;await cloudSave();cloudLoading=true;}
    }
    render();
  } catch(err){
    console.error(err);
    setSyncStatus("Cloud load failed — using local copy",true);
    render();
  } finally {cloudLoading=false;}
}

async function login(){
  const email=document.getElementById("authEmail")?.value.trim();
  const password=document.getElementById("authPassword")?.value||"";
  if(!email||!password)return setAuthMessage("Enter your email and password.",true);
  setAuthMessage("Signing in…");
  try{await signInWithEmailAndPassword(auth,email,password);setAuthMessage("");}
  catch(err){setAuthMessage(authError(err),true);}
}
async function createAccount(){
  const email=document.getElementById("authEmail")?.value.trim();
  const password=document.getElementById("authPassword")?.value||"";
  if(!email||!password)return setAuthMessage("Enter an email and password. Password must be at least 6 characters.",true);
  setAuthMessage("Creating account…");
  try{await createUserWithEmailAndPassword(auth,email,password);setAuthMessage("");}
  catch(err){setAuthMessage(authError(err),true);}
}
function authError(err){
  const code=err?.code||"";
  if(code.includes("invalid-credential")||code.includes("wrong-password")||code.includes("user-not-found"))return "Email or password is incorrect.";
  if(code.includes("email-already-in-use"))return "That email already has an account. Use Sign In.";
  if(code.includes("weak-password"))return "Password must be at least 6 characters.";
  if(code.includes("invalid-email"))return "Enter a valid email address.";
  return err?.message||"Authentication failed.";
}
window.login=login; window.createAccount=createAccount;

// Auth buttons use explicit event listeners so they work reliably from an ES module.
document.getElementById("signInBtn")?.addEventListener("click", login);
document.getElementById("createAccountBtn")?.addEventListener("click", createAccount);

// Allow Enter from the password field to submit the sign-in form.
document.getElementById("authPassword")?.addEventListener("keydown", e=>{
  if(e.key === "Enter") login();
});
window.logout=async()=>{try{await signOut(auth);}catch(err){console.error(err);}};

onAuthStateChanged(auth,user=>{
  firebaseUser=user;
  if(user){showAppForUser(user);loadCloudForUser(user);}
  else {showAuth();setSyncStatus("");}
});

const defaultData={manufacturers:['Husqvarna','Wacker Neuson','Allen Engineering','Somero','Multiquip'],machineTypes:['Concrete Saw','Ride-On Trowel','Walk-Behind Trowel','Power Buggy','Screed','Grinder','Generator'],companies:[],models:[],templates:[],machines:[],services:[]};
let data=JSON.parse(localStorage.getItem(KEY)||'null');
if(!data){const old=JSON.parse(localStorage.getItem(OLD)||'null');data=old?{...defaultData,...old,templates:[],services:(old.services||[]).map(s=>({...s,inspectionResults:s.inspectionResults||[]}))}:structuredClone(defaultData);save();}
data.templates ||= []; data.models ||= []; data.services ||= []; data.machines ||= [];
// V0.5 migration: convert each existing single work entry into a daily work log list.
data.services.forEach(s=>{
  if(!Array.isArray(s.workLogs)){
    s.workLogs=[];
    if(s.workDate || s.hours || s.workDescription){s.workLogs.push({id:crypto.randomUUID(),date:s.workDate||today(),hours:Number(s.hours||0),description:s.workDescription||''});}
  }
  s.workLogs.forEach(l=>{l.hours=Number(l.hours||0);});
});
function serviceTotalHours(s){return (s.workLogs||[]).reduce((n,l)=>n+Number(l.hours||0),0);}
function serviceOpen(s){return (s.status||'Received')!=='Complete';}
function getOpenServiceForMachine(machineId){return data.services.find(s=>s.machineId===machineId && serviceOpen(s));}
const $=id=>document.getElementById(id); const today=()=>new Date().toISOString().slice(0,10);
const MACHINE_STATUSES=['Received','Inspection','Maintenance','Waiting for Parts','Ready','Complete','Out of Service'];
let editingServiceId=null;
let addingLogServiceId=null;
function statusOptions(selected='Received'){return MACHINE_STATUSES.map(s=>`<option value="${esc(s)}" ${s===selected?'selected':''}>${esc(s)}</option>`).join('');}
function showView(v){document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));$(v).classList.add('active');document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('active',x.dataset.view===v));render();}
document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>showView(b.dataset.view));
function fillSelect(id,items,placeholder){$(id).innerHTML='<option value="">'+placeholder+'</option>'+items.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');}
function renderSelects(){let manufacturer=$('manufacturer')?.value||'';let machineType=$('machineType')?.value||'';let company=$('company')?.value||'';let template=$('inspectionTemplateSelect')?.value||'';let status=$('machineStatus')?.value||'Received';fillSelect('manufacturer',data.manufacturers,'Select manufacturer');fillSelect('machineType',data.machineTypes,'Select machine type');fillSelect('company',data.companies,'Select company');fillSelect('newModelM',data.manufacturers,'Manufacturer');fillSelect('newModelT',data.machineTypes,'Machine type');fillSelect('newModelTemplate',data.templates.map(t=>t.name),'Inspection template (optional)');$('manufacturer').value=manufacturer;$('machineType').value=machineType;$('company').value=company;$('inspectionTemplateSelect').innerHTML='<option value="">No inspection / choose template</option>'+data.templates.map(t=>`<option value="${esc(t.name)}">${esc(t.name)}</option>`).join('');$('inspectionTemplateSelect').value=template;$('machineStatus').innerHTML=statusOptions(status);$('machineStatus').value=status;}
function render(){renderSelects();renderDashboard();renderMachines();renderPresets();renderTemplates();}
function renderDashboard(){ $('machineCount').textContent=data.machines.length; $('activeCount').textContent=data.services.filter(serviceOpen).length; $('hoursCount').textContent=data.services.reduce((sum,x)=>sum+serviceTotalHours(x),0).toFixed(2); $('inspectionCount').textContent=data.services.filter(s=>s.inspectionResults?.length).length; const recent=[...data.services].sort((a,b)=>b.workDate.localeCompare(a.workDate)).slice(0,8); $('recentList').innerHTML=recent.length?recent.map(serviceHTML).join(''):'<div class="muted">No service records yet.</div>'; }
function renderMachines(){let q=($('machineSearch')?.value||'').toLowerCase();let arr=data.machines.filter(m=>Object.values(m).join(' ').toLowerCase().includes(q));$('machineList').innerHTML=arr.length?arr.map(m=>`<div class="item" onclick="showMachine('${m.id}')"><div class="itemtop"><strong>${esc(m.unit)}</strong><span class="badge">${esc(m.status)}</span></div><div class="muted">${esc(m.manufacturer||'')} ${esc(m.model||'')} · ${esc(m.machineType||'')}</div><div class="muted">Status: ${esc(m.status||'Received')} · Last engine hours: ${m.engineHours||'—'} · ${esc(m.company||'')}</div></div>`).join(''):'<div class="muted">No machines found.</div>';}
function serviceHTML(s){let logs=s.workLogs||[];let last=logs[logs.length-1];return `<div class="item" onclick="showMachine('${s.machineId}')"><div class="itemtop"><strong>${esc(s.unit)}</strong><span class="badge">${esc(s.status||'Received')}</span></div><div>${esc(last?.description||'Open service visit')}</div><div class="muted">${serviceTotalHours(s).toFixed(2)} labor hours · ${logs.length} work day${logs.length===1?'':'s'} · engine ${s.engineHours||'—'}</div></div>`}
function renderPresets(){[['manufacturers','manufacturersList'],['machineTypes','typesList'],['companies','companiesList']].forEach(([k,id])=>$(id).innerHTML=data[k].map((x,i)=>`<div class="presetitem"><span>${esc(x)}</span><button class="secondary" onclick="removePreset('${k}',${i})">×</button></div>`).join('')||'<div class="muted">None yet.</div>');$('modelsList').innerHTML=data.models.map((m,i)=>`<div class="modelrow"><strong>${esc(m.model)}</strong><span>${esc(m.manufacturer||'')}</span><span>${esc(m.machineType||'')}</span><span>${esc(m.template||'No inspection')}</span><button class="secondary" onclick="removeModel(${i})">×</button></div>`).join('')||'<div class="muted">No model rules yet.</div>';}
function addPreset(k,id){let v=$(id).value.trim();if(!v)return;if(!data[k].includes(v))data[k].push(v);$(id).value='';save();render();toast('Preset added');}
function removePreset(k,i){data[k].splice(i,1);save();render();}
function addModel(){let model=$('newModel').value.trim(),manufacturer=$('newModelM').value,machineType=$('newModelT').value,template=$('newModelTemplate').value;if(!model)return toast('Model number is required');data.models=data.models.filter(x=>x.model.toLowerCase()!==model.toLowerCase());data.models.push({model,manufacturer,machineType,template});save();$('newModel').value='';render();toast('Model rule saved');}
function removeModel(i){data.models.splice(i,1);save();render();}
$('unit').addEventListener('blur',()=>loadKnownUnit($('unit').value));$('model').addEventListener('input',()=>autoFillModel($('model').value));$('machineSearch').addEventListener('input',renderMachines);
function autoFillModel(v){let m=data.models.find(x=>x.model.toLowerCase()===v.trim().toLowerCase());if(m){$('manufacturer').value=m.manufacturer;$('machineType').value=m.machineType;$('inspectionTemplateSelect').value=m.template||'';loadTemplateForName(m.template);$('unitHint').textContent=`Auto-filled: ${m.manufacturer||'—'} · ${m.machineType||'—'}${m.template?' · Inspection: '+m.template:''}`;}else{$('unitHint').textContent='';$('inspectionTemplateSelect').value='';hideInspection();}}

function loadTemplateForName(name,existing=[]){let t=data.templates.find(x=>x.name===name);if(t){if($('inspectionTemplateSelect'))$('inspectionTemplateSelect').value=t.name;renderInspectionForm(t,existing);}else hideInspection();}
function loadSelectedInspection(){let name=$('inspectionTemplateSelect')?.value||'';if(!name){hideInspection();return;}loadTemplateForName(name);}
$('unit').addEventListener('blur',()=>loadKnownUnit($('unit').value));$('model').addEventListener('input',()=>autoFillModel($('model').value));$('machineSearch').addEventListener('input',renderMachines);$('inspectionTemplateSelect').addEventListener('change',()=>loadTemplateForName($('inspectionTemplateSelect').value));$('loadInspectionBtn').addEventListener('click',loadSelectedInspection);
function loadKnownUnit(v){let m=data.machines.find(x=>x.unit.toLowerCase()===v.trim().toLowerCase());if(!m)return;$('model').value=m.model||'';$('manufacturer').value=m.manufacturer||'';$('machineType').value=m.machineType||'';$('serial').value=m.serial||'';$('company').value=m.company||'';$('description').value=m.description||'';$('engineHours').value=m.engineHours||'';$('machineStatus').value=m.status||'Received';$('inspectionTemplateSelect').value=m.inspectionTemplate||data.models.find(x=>x.model.toLowerCase()===String(m.model||'').toLowerCase())?.template||'';$('unitHint').textContent=`Existing unit found. Last engine hours: ${m.engineHours||'—'} · Status: ${m.status||'Received'}`;loadTemplateForName($('inspectionTemplateSelect').value);}
function hideInspection(){$('inspectionArea').classList.add('hidden');$('templateNotice').classList.add('hidden');$('inspectionForm').innerHTML='';}
function renderInspectionForm(t,existing=[]){if(!t){hideInspection();return;}$('inspectionArea').classList.remove('hidden');$('templateNotice').classList.remove('hidden');$('templateNotice').textContent=`Using inspection template: ${t.name}`;$('inspectionTemplateName').textContent=t.name;$('inspectionForm').innerHTML=t.items.length?t.items.map(it=>{let old=existing.find(x=>x.itemId===it.id)||{};let checked=old.status&&old.status!=='N/A'&&old.status!=='Not checked';return `<div class="inspect-item"><label class="inspect-check"><input type="checkbox" class="inspect-checkbox" data-item="${it.id}" ${checked?'checked':''}><strong>${esc(it.category?it.category+' — ':'')}${esc(it.text)}</strong></label><div class="inspect-buttons"><button type="button" class="statusbtn ${old.status==='Needs Repair'?'selected':''}" data-status="Needs Repair" data-item="${it.id}">Needs Repair</button><button type="button" class="statusbtn ${old.status==='N/A'?'selected':''}" data-status="N/A" data-item="${it.id}">N/A</button></div><input class="inspect-note" id="note-${it.id}" value="${esc(old.note||'')}" placeholder="Details / notes (optional)"></div>`}).join(''):'<div class="muted">This template has no inspection items yet.</div>';document.querySelectorAll('.inspect-checkbox').forEach(b=>b.onchange=()=>{if(b.checked)document.querySelectorAll(`.statusbtn[data-item="${b.dataset.item}"]`).forEach(x=>x.classList.remove('selected'));updateInspectionSummary();});document.querySelectorAll('.statusbtn').forEach(b=>b.onclick=()=>{document.querySelectorAll(`.statusbtn[data-item="${b.dataset.item}"]`).forEach(x=>x.classList.remove('selected'));b.classList.add('selected');let cb=document.querySelector(`.inspect-checkbox[data-item="${b.dataset.item}"]`);if(cb)cb.checked=b.dataset.status!=='N/A';updateInspectionSummary();});updateInspectionSummary();}
function getInspectionResults(){let t=getCurrentTemplate();if(!t)return [];return t.items.map(it=>{let cb=document.querySelector(`.inspect-checkbox[data-item="${it.id}"]`);let btn=document.querySelector(`.statusbtn.selected[data-item="${it.id}"]`);let note=$(`note-${it.id}`)?.value||'';if(!cb?.checked&&!btn&&!note)return null;return {itemId:it.id,text:it.text,category:it.category||'',status:btn?.dataset.status||(cb?.checked?'OK':'Not checked'),note};}).filter(Boolean);}
function getCurrentTemplate(){let chosen=$('inspectionTemplateSelect')?.value||'';if(chosen)return data.templates.find(t=>t.name===chosen)||null;let model=data.models.find(x=>x.model.toLowerCase()===$('model').value.trim().toLowerCase());return model?data.templates.find(t=>t.name===model.template):null;}
function updateInspectionSummary(){let t=getCurrentTemplate();if(!t){$('inspectionSummary').textContent='0 / 0';return;}let checked=document.querySelectorAll('.inspect-checkbox:checked').length;$('inspectionSummary').textContent=`${checked} / ${t.items.length}`;}
$('date').value=today();$('workDate').value=today();
$('serviceForm').onsubmit=e=>{e.preventDefault();let unit=$('unit').value.trim();let existing=data.machines.find(m=>m.unit.toLowerCase()===unit.toLowerCase());let machine=existing||{id:crypto.randomUUID(),unit};let status=$('machineStatus').value||'Received';let templateName=$('inspectionTemplateSelect')?.value||'';let results=getInspectionResults();
Object.assign(machine,{model:$('model').value.trim(),manufacturer:$('manufacturer').value,machineType:$('machineType').value,serial:$('serial').value.trim(),company:$('company').value,engineHours:Number($('engineHours').value||0),description:$('description').value,status,inspectionTemplate:templateName,updatedAt:today()});if(!existing)data.machines.push(machine);
if(addingLogServiceId){let svc=data.services.find(x=>x.id===addingLogServiceId);if(!svc)return;svc.workLogs ||= [];svc.workLogs.push({id:crypto.randomUUID(),date:$('workDate').value||today(),hours:Number($('hours').value||0),description:$('workDescription').value.trim()});svc.status=status;svc.engineHours=Number($('engineHours').value||svc.engineHours||0);svc.updatedAt=today();toast('Daily work log added');addingLogServiceId=null;editingServiceId=null;}
else if(editingServiceId){let svc=data.services.find(x=>x.id===editingServiceId);if(svc){svc.inspectionTemplate=templateName;svc.inspectionResults=results;svc.status=status;svc.engineHours=Number($('engineHours').value||svc.engineHours||0);svc.updatedAt=today();}toast('Inspection progress saved');editingServiceId=null;}
else{let open=getOpenServiceForMachine(machine.id);if(open){toast('This machine already has an open service visit');showMachine(machine.id);return;}data.services.push({id:crypto.randomUUID(),machineId:machine.id,unit,workDate:$('workDate').value,dateReceived:$('date').value,status,inspectionTemplate:templateName,inspectionResults:results,engineHours:Number($('engineHours').value||0),workLogs:[{id:crypto.randomUUID(),date:$('workDate').value||today(),hours:Number($('hours').value||0),description:$('workDescription').value.trim()}],createdAt:today()});toast('Service visit started');}
save();e.target.reset();$('date').value=today();$('workDate').value=today();$('unitHint').textContent='';$('serviceForm').querySelector('.primary').textContent='Save Service Visit';renderSelects();hideInspection();setTimeout(()=>showMachine(machine.id),350);};

function inspectionProgress(s){let t=data.templates.find(x=>x.name===s.inspectionTemplate);if(!t||!t.items.length)return {status:'Not Started',done:0,total:0};let results=s.inspectionResults||[];let done=t.items.filter(it=>results.some(r=>r.itemId===it.id&&['OK','Needs Repair','N/A'].includes(r.status))).length;return {status:done===0?'Not Started':done>=t.items.length?'Complete':'In Progress',done,total:t.items.length};}
function continueInspection(serviceId){let s=data.services.find(x=>x.id===serviceId);if(!s)return;let m=data.machines.find(x=>x.id===s.machineId);if(!m)return;editingServiceId=s.id;addingLogServiceId=null;showView('new');$('unit').value=m.unit||s.unit||'';$('model').value=m.model||'';$('manufacturer').value=m.manufacturer||'';$('machineType').value=m.machineType||'';$('serial').value=m.serial||'';$('company').value=m.company||'';$('engineHours').value=s.engineHours??m.engineHours??'';$('description').value=m.description||'';$('date').value=s.dateReceived||today();$('workDate').value=today();$('hours').value='';$('workDescription').value='';$('machineStatus').value=m.status||s.status||'Inspection';renderSelects();$('inspectionTemplateSelect').value=s.inspectionTemplate||m.inspectionTemplate||'';loadTemplateForName($('inspectionTemplateSelect').value,s.inspectionResults||[]);$('serviceForm').querySelector('.primary').textContent='Save Inspection Progress';$('unitHint').textContent='Continuing inspection for this open service visit.';}
function addDailyLog(serviceId){let s=data.services.find(x=>x.id===serviceId);if(!s)return;let m=data.machines.find(x=>x.id===s.machineId);if(!m)return;addingLogServiceId=s.id;editingServiceId=null;showView('new');$('unit').value=m.unit||s.unit||'';$('model').value=m.model||'';$('manufacturer').value=m.manufacturer||'';$('machineType').value=m.machineType||'';$('serial').value=m.serial||'';$('company').value=m.company||'';$('engineHours').value=m.engineHours??s.engineHours??'';$('description').value=m.description||'';$('date').value=s.dateReceived||today();$('workDate').value=today();$('hours').value='';$('workDescription').value='';$('machineStatus').value=s.status||m.status||'Maintenance';renderSelects();$('inspectionTemplateSelect').value=s.inspectionTemplate||m.inspectionTemplate||'';loadTemplateForName($('inspectionTemplateSelect').value,s.inspectionResults||[]);$('serviceForm').querySelector('.primary').textContent='Add Daily Work Log';$('unitHint').textContent='Adding another work day to this open service visit.';}
function completeService(serviceId){let s=data.services.find(x=>x.id===serviceId);if(!s)return;if(!confirm('Mark this service visit complete?'))return;s.status='Complete';s.completedAt=today();let m=data.machines.find(x=>x.id===s.machineId);if(m){m.status='Complete';m.updatedAt=today();}save();toast('Service visit completed');showMachine(s.machineId);}
function showMachine(id){let m=data.machines.find(x=>x.id===id);if(!m)return;let hs=data.services.filter(s=>s.machineId===id).sort((a,b)=>(b.createdAt||b.workDate||'').localeCompare(a.createdAt||a.workDate||''));let open=hs.find(serviceOpen);$('detailContent').innerHTML=`<button class="secondary back" onclick="showView('machines')">← Back</button><div class="hero"><div><h2>${esc(m.unit)}</h2><p>${esc(m.manufacturer||'')} ${esc(m.model||'')} · ${esc(m.machineType||'')}</p></div><span class="badge">${esc(m.status||'Received')}</span></div><div class="panel status-panel"><div class="grid"><label>Machine Status<select id="detailStatus">${statusOptions(m.status||'Received')}</select></label><div class="actions" style="align-self:end"><button class="primary" onclick="saveMachineStatus('${m.id}')">Save Status</button></div></div></div><div class="cards"><div class="card"><b>${m.engineHours||'—'}</b><span>Current Engine Hours</span></div><div class="card"><b>${hs.reduce((sum,x)=>sum+serviceTotalHours(x),0).toFixed(2)}</b><span>Total Labor Hours</span></div><div class="card"><b>${hs.length}</b><span>Service Visits</span></div><div class="card"><b>${hs.filter(x=>x.inspectionResults?.length).length}</b><span>Inspections</span></div></div><div class="panel"><h3>Machine Details</h3><p><b>Serial:</b> ${esc(m.serial||'—')}</p><p><b>Company:</b> ${esc(m.company||'—')}</p><p><b>Description:</b> ${esc(m.description||'—')}</p><p><b>Default Inspection:</b> ${esc(m.inspectionTemplate||'—')}</p></div><div class="panel"><h3>${open?'Open Service Visit':'Service History'}</h3>${open?`<div class="open-service"><div class="itemtop"><strong>${esc(open.status||'Open')}</strong><span>${serviceTotalHours(open).toFixed(2)} hrs · ${(open.workLogs||[]).length} days</span></div><div class="actions"><button class="primary" onclick="addDailyLog('${open.id}')">+ Add Daily Work Log</button>${open.inspectionTemplate&&inspectionProgress(open).status!=='Complete'?`<button class="secondary" onclick="continueInspection('${open.id}')">Continue Inspection</button>`:''}<button class="secondary" onclick="completeService('${open.id}')">Complete Service Visit</button></div>${(open.workLogs||[]).map(l=>`<div class="servicecard"><div class="itemtop"><strong>${esc(l.date)}</strong><span>${Number(l.hours||0).toFixed(2)} hrs</span></div><p>${esc(l.description||'')}</p></div>`).join('')||'<div class="muted">No work logs yet.</div>'}</div>`:''}</div><div class="panel"><h3>Previous Service History</h3><div class="history">${hs.length?hs.map(serviceDetailHTML).join(''):'<div class="muted">No service history.</div>'}</div></div>`;showView('detail');}
function saveMachineStatus(id){let m=data.machines.find(x=>x.id===id);if(!m)return;m.status=$('detailStatus').value;let open=getOpenServiceForMachine(id);if(open){open.status=m.status;open.updatedAt=today();}save();toast('Machine status updated');showMachine(id);}
function serviceDetailHTML(s){let insp=s.inspectionResults||[];let prog=inspectionProgress(s);return `<div class="servicecard"><div class="itemtop"><strong>${esc(s.dateReceived||s.workDate)}</strong><span>${serviceTotalHours(s).toFixed(2)} hrs · ${esc(s.status||'Complete')}</span></div><div class="muted">${(s.workLogs||[]).length} work day${(s.workLogs||[]).length===1?'':'s'}${s.inspectionTemplate?' · '+esc(s.inspectionTemplate):''}</div>${(s.workLogs||[]).map(l=>`<div class="logline"><b>${esc(l.date)}</b> — ${Number(l.hours||0).toFixed(2)} hrs — ${esc(l.description||'')}</div>`).join('')}${s.inspectionTemplate?`<div class="inspection-history"><span class="badge">Inspection: ${prog.status} · ${prog.done}/${prog.total}</span>${prog.status!=='Complete'?`<button type="button" class="secondary" onclick="continueInspection('${s.id}')">Continue Inspection</button>`:''}</div>`:''}${insp.length?`<details><summary>Inspection Results (${insp.length})</summary><div class="result-list">${insp.map(x=>`<div><b>${esc(x.category?x.category+' — ':'')}${esc(x.text)}</b><span class="badge">${esc(x.status)}</span>${x.note?`<p>${esc(x.note)}</p>`:''}</div>`).join('')}</div></details>`:''}</div>`}
function renderTemplates(){$('templateList').innerHTML=data.templates.length?data.templates.map((t,i)=>`<div class="template-card"><div><h3>${esc(t.name)}</h3><p class="muted">${t.items.length} inspection items${t.category?' · '+esc(t.category):''}</p></div><div class="actions"><button class="secondary" onclick="editTemplate(${i})">Edit</button><button class="secondary" onclick="removeTemplate(${i})">Delete</button></div></div>`).join(''):'<div class="panel muted">No inspection templates yet. Create your first one above.</div>';}
function newTemplateForm(){editTemplate(-1);}
function editTemplate(i){let t=i>=0?data.templates[i]:{name:'',category:'',items:[]};$('templateEditor').classList.remove('hidden');$('templateEditor').innerHTML=`<div class="sectionhead"><div><h3>${i>=0?'Edit':'New'} Inspection Template</h3><p class="muted">Build the exact inspection sheet you use for this machine.</p></div></div><div class="grid"><label>Template Name *<input id="tplName" value="${esc(t.name)}" placeholder="e.g. S26 Inspection"></label><label>Machine Category<input id="tplCategory" value="${esc(t.category||'')}" placeholder="e.g. Concrete Saw"></label></div><div id="tplItems">${templateRows(t.items)}</div><div class="addrow"><input id="newItemText" placeholder="Inspection item"><input id="newItemCategory" placeholder="Category (optional)"><button type="button" class="secondary" onclick="addTemplateItem()">+ Add Item</button></div><div class="actions"><button class="secondary" onclick="cancelTemplateEdit()">Cancel</button><button class="primary" onclick="saveTemplate(${i})">Save Template</button></div>`;}
function templateRows(items){return items.map((it,i)=>`<div class="template-edit-row"><input value="${esc(it.text)}" data-ti-text="${i}" placeholder="Inspection item"><input value="${esc(it.category||'')}" data-ti-cat="${i}" placeholder="Category"><button class="secondary" onclick="removeTemplateItem(${i})">×</button></div>`).join('')||'<div class="muted template-empty">No items yet.</div>';}
function addTemplateItem(){let text=$('newItemText').value.trim();if(!text)return;let rows=Array.from(document.querySelectorAll('[data-ti-text]')).map((x,i)=>({id:x.dataset.id||crypto.randomUUID(),text:x.value.trim(),category:document.querySelector(`[data-ti-cat="${i}"]`)?.value.trim()||''})).filter(x=>x.text);rows.push({id:crypto.randomUUID(),text,category:$('newItemCategory').value.trim()});$('tplItems').innerHTML=templateRows(rows);$('newItemText').value='';$('newItemCategory').value='';}
function removeTemplateItem(i){let rows=collectTemplateItems();rows.splice(i,1);$('tplItems').innerHTML=templateRows(rows);}
function collectTemplateItems(){return Array.from(document.querySelectorAll('[data-ti-text]')).map((x,i)=>({id:x.dataset.id||crypto.randomUUID(),text:x.value.trim(),category:document.querySelector(`[data-ti-cat="${i}"]`)?.value.trim()||''})).filter(x=>x.text);}
function saveTemplate(i){let name=$('tplName').value.trim();if(!name)return toast('Template name is required');let t={id:i>=0?data.templates[i].id:crypto.randomUUID(),name,category:$('tplCategory').value.trim(),items:collectTemplateItems()};if(i>=0)data.templates[i]=t;else data.templates.push(t);save();cancelTemplateEdit();render();toast('Inspection template saved');}
function removeTemplate(i){if(!confirm('Delete this inspection template? Existing service history will remain.'))return;let removed=data.templates[i]?.name||'';data.templates.splice(i,1);data.models.forEach(m=>{if(m.template===removed)m.template='';});data.machines.forEach(m=>{if(m.inspectionTemplate===removed)m.inspectionTemplate='';});save();render();}
function cancelTemplateEdit(){$('templateEditor').classList.add('hidden');$('templateEditor').innerHTML='';}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}function toast(s){let t=$('toast');t.textContent=s;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)}
let deferred;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;$('installBtn').hidden=false});$('installBtn').onclick=async()=>{if(deferred){deferred.prompt();deferred=null}};
// Keep the existing V0.5 inline buttons working after app.js becomes an ES module.
Object.assign(window,{showView,addPreset,removePreset,addModel,removeModel,newTemplateForm,editTemplate,addTemplateItem,removeTemplateItem,saveTemplate,cancelTemplateEdit,removeTemplate,showMachine,continueInspection,addDailyLog,completeService,saveMachineStatus});
render();
