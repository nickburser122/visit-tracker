(function(G){
'use strict';
const M=G.MV,V=G.VIEWS,I=G.I18N,{t}=I;
const {$,$$,esc,uid,clamp,byId,clone,pISO,fISO,addISO,todayISO,validISO,dowOf,rangeOf,daysIn,weekStartOf,Store,compile,fpWithLocks}=M;
const ic=V.ic;

const APP={ix:null,prefs:{},ws:null,view:'plan',selDay:null,f:{},hist:{u:[],r:[],co:null,coT:0},solving:null,animate:false,issuesOpen:false};
G.APP=APP;
let compiledCache=null,saveT=null,solveT=null,pendingRender=false,jobId=0,worker=null;
let workerOK=typeof Worker!=='undefined'&&location.protocol!=='file:';
let pop=null,modal=null,armed=null,dpkState=null,colorTarget=null,expState=null,palState=null,eqState=null,jsonState=null;
const CFG_DEFAULT={dataset:'data/complete_data.json',autoCheck:true,ruleTemplates:[]};
APP.config=Object.assign({},CFG_DEFAULT);

APP.compiled=function(){
  const key=fpWithLocks(APP.ws);
  if(!compiledCache||compiledCache.key!==key)compiledCache={key,c:compile(APP.ws)};
  return compiledCache.c;
};
APP.isStale=function(){const p=APP.ws.plan;return !p||p.fp!==fpWithLocks(APP.ws)};

function toast(msg,kind,action){
  const el=document.createElement('div');el.className='toast '+(kind||'');
  el.innerHTML=ic(kind==='warn'?'ic-alert':'ic-check')+'<span>'+esc(msg)+'</span>'+(action?'<button class="tact">'+esc(action.label)+'</button>':'');
  if(action)el.querySelector('.tact').onclick=()=>{action.fn();el.remove()};
  $('#toasts').appendChild(el);
  setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),320)},action?5200:2600);
}
function saveNow(){
  clearTimeout(saveT);
  APP.ix.prefs=APP.prefs;
  if(!Store.save(APP.ws,APP.ix))toast(t('saveFail'),'warn');
}
function saveSoon(){clearTimeout(saveT);saveT=setTimeout(saveNow,350)}

function isEditing(){const a=document.activeElement;return a&&a.closest&&a.closest('#main')&&/^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)&&a.type!=='range'&&a.type!=='search'}
function renderSoft(){if(isEditing()||(pop&&(ddState||dpkState))){pendingRender=true;refreshChrome()}else render()}
function refreshChrome(){
  I.setTerms(APP.ws.terms);
  $('#mastRight').innerHTML=V.mast();
  $('#tagline').innerHTML=V.tagline();
  $('#tabs').innerHTML=V.tabs();
  const st=$('#status');if(st)st.innerHTML=V.statusHTML();
}
const VIEWFN={plan:'planView',sites:'sitesView',people:'peopleView',history:'historyView',rules:'rulesView',model:'modelView',insights:'insightsView',workspace:'workspaceView'};
const VIEWS_ORDER=['plan','sites','people','history','rules','model','insights','workspace'];
function render(){
  pendingRender=false;
  I.setTerms(APP.ws.terms);
  document.title=APP.ws.name+' — '+t('appName');
  $('#appName').textContent=t('appName');
  refreshChrome();
  $$('.view').forEach(v=>v.classList.toggle('on',v.id==='view-'+APP.view));
  if(location.hash.slice(1)!==APP.view)try{history.replaceState(null,'','#'+APP.view)}catch(e){}
  const host=$('#view-'+APP.view);
  const sy=window.scrollY;
  let html;
  if(!modal)V.DD.clear();
  try{html=V[VIEWFN[APP.view]]()}catch(e){console.error(e);html='<section class="card"><p>'+esc(String(e&&e.message||e))+'</p></section>'}
  host.innerHTML=html;
  window.scrollTo(0,sy);
  $('#footHint').innerHTML=t('footHint');
  $('#footNote').textContent=t('footNote');
  if(APP.view==='plan'){const r=$('#ribbon'),s=r&&r.querySelector('.tile.sel');if(s&&r&&!APP._ribbonDone){r.scrollLeft=Math.max(0,s.offsetLeft-r.offsetLeft-80);APP._ribbonDone=true}}
  APP.animate=false;
}
function applyLook(){
  const l=APP.prefs.lang==='ar'?'ar':'en';I.setLang(l);
  document.documentElement.lang=l;document.documentElement.dir=l==='ar'?'rtl':'ltr';
  document.documentElement.dataset.theme=APP.prefs.theme==='dusk'?'dusk':'light';
}

function pushHist(co){
  const h=APP.hist,now=Date.now();
  if(co&&h.co===co&&now-h.coT<900){h.coT=now;return}
  h.u.push(JSON.stringify(APP.ws));if(h.u.length>60)h.u.shift();h.r=[];h.co=co||null;h.coT=now;
}
function commit(fn,o){
  o=o||{};
  pushHist(o.co);
  fn(APP.ws);
  APP.ws.updated=Date.now();
  saveSoon();
  if(o.render===false)refreshChrome();else renderSoft();
  if(o.solve!==false)scheduleSolve();
}
function undo(){
  const h=APP.hist;if(!h.u.length){toast(t('nothingUndo'),'warn');return}
  h.r.push(JSON.stringify(APP.ws));APP.ws=JSON.parse(h.u.pop());h.co=null;
  saveSoon();closePop();render();toast(t('undone'));
}
function redo(){
  const h=APP.hist;if(!h.r.length)return;
  h.u.push(JSON.stringify(APP.ws));APP.ws=JSON.parse(h.r.pop());h.co=null;
  saveSoon();closePop();render();toast(t('redone'));
}

function scheduleSolve(){
  clearTimeout(solveT);
  if(!APP.ws.engine.live||!APP.isStale())return;
  solveT=setTimeout(()=>solve({warm:true,quiet:true}),480);
}
function warmFor(map){
  const pl=APP.ws.plan;if(!pl||!pl.map||!pl.res)return null;
  const om=pl.map,or=pl.res;
  const sIx={};map.sites.forEach((id,i)=>sIx[id]=i);
  const pIx={};map.people.forEach((id,i)=>pIx[id]=i);
  const oldV={};om.visits.forEach((v,i)=>{const s=or.siteOf[i];oldV[v.key]=s>=0?om.sites[s]:null});
  const oldZ={};om.seats.forEach((s,i)=>{const p=or.seatP[i];oldZ[s.key]=p>=0?om.people[p]:null});
  const siteOf=map.visits.map(v=>{const id=oldV[v.key];return id&&sIx[id]!==undefined?sIx[id]:-1});
  const seatP=map.seats.map(s=>{const id=oldZ[s.key];return id&&pIx[id]!==undefined?pIx[id]:-1});
  if(!siteOf.some(x=>x>=0))return null;
  return {siteOf,seatP};
}
function runEngine(P,onProg){
  return new Promise((resolve,reject)=>{
    const id=++jobId;
    const fallback=()=>setTimeout(()=>{if(id!==jobId)return;try{resolve(G.MauvineEngine.solve(P))}catch(e){reject(e)}},20);
    if(!workerOK)return fallback();
    try{if(worker)worker.terminate();worker=new Worker('js/engine.js')}catch(e){workerOK=false;return fallback()}
    worker.onmessage=e=>{const m=e.data;if(m.id!==id)return;
      if(m.type==='progress')onProg(m.f);
      else if(m.type==='done'){resolve(m.res)}
      else if(m.type==='error')reject(new Error(m.msg));};
    worker.onerror=e=>{e.preventDefault&&e.preventDefault();workerOK=false;worker=null;fallback()};
    worker.postMessage({type:'solve',id,P});
  });
}
async function solve(o){
  o=o||{};
  clearTimeout(solveT);
  const ws=APP.ws;
  const C=APP.compiled();
  const fp=fpWithLocks(ws);
  const P=Object.assign({},C.P);
  if(o.warm){const w=warmFor(C.map);if(w)P.warm=w}
  APP.solving={f:0,id:jobId+1};
  refreshChrome();
  const t0=Date.now();
  try{
    const res=await runEngine(P,f=>{if(APP.solving){APP.solving.f=f;const st=$('#status');if(st)st.innerHTML=V.statusHTML()}});
    if(fpWithLocks(APP.ws)!==fp||APP.ws!==ws){APP.solving=null;scheduleSolve();return}
    ws.plan={fp,map:C.map,res,at:Date.now()};
    APP.solving=null;APP.animate=!o.quiet;
    saveSoon();
    if(!o.quiet){const n=res.issues.filter(x=>x.sev!=='info').length;toast(n?t('toastIssues',{n}):t('toastSolved'),n?'warn':'')}
    renderSoft();
  }catch(e){
    console.error(e);APP.solving=null;toast(t('solverErr'),'warn');render();
  }
}
function reroll(){
  commit(ws=>{ws.engine.seed=((ws.engine.seed*1103515245+12345)>>>0)%99999989+1},{solve:false});
  solve({});
}

function closePop(){const had=!!(pop&&(ddState||dpkState));if(pop){pop.remove();pop=null}$$('.dpk-trigger.open,.dd.open').forEach(b=>b.classList.remove('open'));dpkState=null;colorTarget=null;ddState=null;if(had&&pendingRender)setTimeout(()=>{if(pendingRender&&!pop&&!isEditing())render()},0)}
let ddState=null;
function openDD(btn){
  const id=btn.dataset.dd;
  if(pop&&ddState&&ddState.btn===btn){closePop();return}
  const st=V.DD.get(id);if(!st)return;
  openPop(btn,V.ddPop(id,''),'ddpop');
  pop.style.minWidth=Math.max(btn.offsetWidth,180)+'px';place(pop,btn);
  ddState={id,btn,sel:-1,st,bind:btn.dataset.bind,ds:Object.assign({},btn.dataset)};btn.classList.add('open');
  const q=pop.querySelector('#ddQ');
  if(q){q.focus();q.addEventListener('input',()=>{pop.querySelector('.ddlist').outerHTML=V.ddPop(id,q.value).replace(/^[\s\S]*?(<div class="ddlist")/,'$1');ddState.sel=-1});
    q.addEventListener('keydown',ddKeys)}
  else{const on=pop.querySelector('.ddopt.on')||pop.querySelector('.ddopt');on&&on.focus()}
  const on=pop.querySelector('.ddopt.on');if(on)on.scrollIntoView({block:'nearest'});
}
function ddKeys(e){
  if(!pop||!ddState)return;
  const opts=Array.from(pop.querySelectorAll('.ddopt'));if(!opts.length)return;
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const cur=opts.indexOf(document.activeElement);const n=cur<0?(e.key==='ArrowDown'?0:opts.length-1):(cur+(e.key==='ArrowDown'?1:-1)+opts.length)%opts.length;opts[n].focus()}
  else if(e.key==='Enter'&&e.target.id==='ddQ'){e.preventDefault();opts[0].click()}
}
function ddPick(i){
  const s=ddState;if(!s)return;const st=V.DD.get(s.id)||s.st;if(!st)return;
  const opt=st.opts[i];const bind=s.bind,ds=s.ds;closePop();if(!opt)return;
  applyBind(bind,ds,String(opt[0]));
}
function openPop(anchor,html,cls){
  closePop();
  pop=document.createElement('div');pop.className=cls||'pop';pop.innerHTML=html;document.body.appendChild(pop);
  pop._anchor=anchor;place(pop,anchor);return pop;
}
function topEdge(){const tb=$('.tabbar');if(!tb)return 0;const r=tb.getBoundingClientRect();return r.bottom>0?r.bottom-6:0}
function place(el,anchor){
  const r=anchor.getBoundingClientRect(),vw=innerWidth,vh=innerHeight;
  const lst=el.querySelector('.ddlist');
  if(lst){lst.style.maxHeight='';const below=vh-r.bottom-14,above=r.top-topEdge()-14,extra=el.offsetHeight-lst.offsetHeight;const room=Math.max(below,above)-extra;if(lst.scrollHeight>room)lst.style.maxHeight=Math.max(120,Math.min(300,room))+'px'}
  const w=el.offsetWidth,h=el.offsetHeight;
  let top=r.bottom+6;if(top+h>vh-8){const up=r.top-h-6;top=up>=topEdge()?up:Math.max(8,Math.min(top,vh-h-8))}
  let left=document.documentElement.dir==='rtl'?r.right-w:r.left;left=clamp(left,8,Math.max(8,vw-w-8));
  el.style.top=top+'px';el.style.left=left+'px';
}
function anchorGone(a){if(!a||!a.isConnected)return true;const r=a.getBoundingClientRect();if(!r.width&&!r.height)return true;return r.bottom<topEdge()||r.top>innerHeight}
function openModal(html,cls){
  closeModal();
  modal=document.createElement('div');modal.className='overlay'+(cls?' '+cls:'');modal.innerHTML=html;
  modal.addEventListener('mousedown',e=>{if(e.target===modal)closeModal()});
  document.body.appendChild(modal);document.documentElement.classList.add('modal-open');
  return modal;
}
function closeModal(){if(modal){modal.remove();modal=null;document.documentElement.classList.remove('modal-open')}expState=null;palState=null;eqState=null;jsonState=null}

function explainAt(anchor,q){
  const D=V.derive();if(!D)return;
  let res=null;
  if(!APP.isStale()){
    try{res=G.MauvineEngine.explain(APP.compiled().P,D.r,q)}catch(e){console.error(e)}
  }
  openPop(anchor,V.explainPop(Object.assign({res},q)));
}

function armOr(btn,key,fn){
  if(armed&&armed.key===key&&Date.now()-armed.t<3500){armed=null;fn();return}
  $$('.arm').forEach(b=>{b.classList.remove('arm');if(b.dataset.html){b.innerHTML=b.dataset.html}});
  armed={key,t:Date.now()};btn.dataset.html=btn.innerHTML;btn.classList.add('arm');btn.textContent=t('sure');
  setTimeout(()=>{if(btn.isConnected&&btn.classList.contains('arm')){btn.classList.remove('arm');btn.innerHTML=btn.dataset.html}},3500);
}

function dl(name,text,mime){
  const b=text instanceof Blob?text:new Blob([text],{type:mime||'text/plain;charset=utf-8'});const u=URL.createObjectURL(b);
  const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);
  toast(t('downloaded'));
}
async function copyText(s){
  try{await navigator.clipboard.writeText(s);toast(t('copied'))}
  catch(e){const ta=document.createElement('textarea');ta.value=s;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();let ok=false;try{ok=document.execCommand('copy')}catch(e2){}ta.remove();toast(ok?t('copied'):t('copyFail'),ok?'':'warn')}
}
const slug=s=>String(s||'plan').toLowerCase().replace(/[^\w\u0600-\u06FF]+/g,'-').replace(/^-|-$/g,'')||'plan';

function planRows(who){
  const ws=APP.ws,D=V.derive();if(!D)return [];
  const m=D.m,rows=[];
  m.visits.forEach((vis,v)=>{
    const s=D.siteOfV(v),iso=m.days[vis.d].iso;
    if(vis.opt&&!s)return;
    const team={};const all=[];
    m.roles.forEach(rid=>team[rid]=[]);
    for(let z=vis.z0;z<vis.z0+vis.zn;z++){if(!D.r.stats.active[z])continue;const st=m.seats[z];const p=D.personOfZ(z);const nm=p?p.name:'('+t('open')+')';team[m.roles[st.r]].push(nm);if(p)all.push(p.id)}
    if(who&&!all.includes(who))return;
    const cat=s?byId(ws.categories,s.cat):null;
    rows.push({iso,dow:I.arr('dows')[dowOf(iso)],site:s?s.name:'',cat:cat?cat.name:'',km:s?s.km:'',zone:s?s.zone:'',team,n:vis.k+1});
  });
  return rows;
}
function exportText(st){
  const ws=APP.ws,D=V.derive();if(!D)return '';
  const rows=planRows(st.who);
  const roles=D.m.roles.map(id=>byId(ws.roles,id)).filter(Boolean);
  const c=st.cols;
  const head=[t('day')].concat(c.dow?[t('colDow')]:[]).concat([t('site')]).concat(c.cat?[t('colCat')]:[]).concat(c.km?[t('colDist')+' ('+ws.unit+')']:[]).concat(c.zone?[t('colZone')]:[]).concat(roles.map(r=>r.name));
  const line=r=>[r.iso].concat(c.dow?[r.dow]:[]).concat([r.site]).concat(c.cat?[r.cat]:[]).concat(c.km?[r.km]:[]).concat(c.zone?[r.zone]:[]).concat(roles.map(ro=>(r.team[ro.id]||[]).join(' · ')));
  if(st.fmt==='csv')return '\uFEFF'+[head].concat(rows.map(line)).map(M.csvRow).join('\r\n');
  if(st.fmt==='tsv')return [head].concat(rows.map(line)).map(a=>a.map(x=>String(x).replace(/\t|\n/g,' ')).join('\t')).join('\r\n');
  if(st.fmt==='md'){const e=x=>String(x).replace(/\|/g,'\\|');return '# '+ws.name+'\n\n'+V.fmtDS(D.m.start)+' – '+V.fmtDS(D.m.end)+'\n\n| '+head.map(e).join(' | ')+' |\n|'+head.map(()=>'---').join('|')+'|\n'+rows.map(r=>'| '+line(r).map(e).join(' | ')+' |').join('\n')+'\n'}
  if(st.fmt==='wa'){
    let s='*'+ws.name+'*\n'+V.fmtDS(D.m.start)+' – '+V.fmtDS(D.m.end)+'\n';let cur='';
    rows.forEach(r=>{if(r.iso!==cur){cur=r.iso;s+='\n*'+V.fmtD(r.iso)+'*\n'}
      s+='• '+r.site+(c.cat&&r.cat?' _('+r.cat+')_':'')+(c.km&&r.km!==''?' · '+r.km+' '+ws.unit:'')+'\n'+roles.map(ro=>'   '+ro.name+': '+((r.team[ro.id]||[]).join(', ')||'—')).join('\n')+'\n'});
    return s;
  }
  if(st.fmt==='ics'){
    const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+/,'');
    const ie=x=>String(x).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');
    let s='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Mauvine Planner//EN\r\nCALSCALE:GREGORIAN\r\n';
    rows.forEach((r,i)=>{const d=r.iso.replace(/-/g,''),d2=addISO(r.iso,1).replace(/-/g,'');
      s+='BEGIN:VEVENT\r\nUID:'+slug(ws.id)+'-'+d+'-'+r.n+'@mauvine\r\nDTSTAMP:'+stamp+'\r\nDTSTART;VALUE=DATE:'+d+'\r\nDTEND;VALUE=DATE:'+d2+'\r\nSUMMARY:'+ie(r.site+(r.cat?' ('+r.cat+')':''))+'\r\nDESCRIPTION:'+ie(roles.map(ro=>ro.name+': '+(r.team[ro.id]||[]).join(', ')).join('\n'))+'\r\n'+(r.zone?'LOCATION:'+ie(r.zone)+'\r\n':'')+'END:VEVENT\r\n'});
    return s+'END:VCALENDAR\r\n';
  }
  return JSON.stringify({workspace:ws.name,start:D.m.start,end:D.m.end,visits:rows},null,2);
}
const EXT={csv:['csv','text/csv;charset=utf-8'],tsv:['tsv','text/tab-separated-values;charset=utf-8'],md:['md','text/markdown;charset=utf-8'],wa:['txt','text/plain;charset=utf-8'],ics:['ics','text/calendar;charset=utf-8'],json:['json','application/json']};
function openExport(){
  if(!V.derive()){toast(t('noPlanYet'),'warn');return}
  expState=Object.assign({fmt:'csv',who:'',cols:{cat:true,km:true,zone:false,dow:true}},APP.prefs.exp||{});
  const st=expState;openModal(V.exportModal(st));expState=st;refreshExport();
}
function refreshExport(){
  if(!modal||!expState)return;
  const st=expState;modal.innerHTML=V.exportModal(st);
  const txt=exportText(st);const pv=modal.querySelector('#expPrev');
  pv.textContent=txt.length>8000?txt.slice(0,8000)+'\n…':txt;
  APP.prefs.exp={fmt:st.fmt,cols:st.cols};
}

function reportText(){
  const ws=APP.ws,D=V.derive();if(!D)return '';
  const m=D.m,st=D.r.stats;
  let s=ws.name+' — '+V.fmtDS(m.start)+' – '+V.fmtDS(m.end)+'\n';
  s+=t('kWorkDays')+': '+m.days.length+' · '+t('kVisits')+': '+m.visits.length+' · '+t('kFilled')+': '+st.filled+'/'+st.seats+' · '+t('kDist')+': '+V.fmtN(st.km)+' '+ws.unit+'\n\n';
  s+=t('loadT')+'\n';
  m.people.forEach((id,i)=>{const p=byId(ws.people,id);if(p)s+='  '+p.name+': '+st.loads[i]+' / '+V.r1(m.pTarget[i])+'\n'});
  const cats=m.cats.map(id=>byId(ws.categories,id));
  s+='\n'+t('mixT')+'\n'+cats.map((c,i)=>'  '+(c?c.name:'')+': '+st.catCount[i]+' / '+V.r1(m.catTarget[i])).join('\n')+'\n';
  if(D.iss.length)s+='\n'+t('issues')+'\n'+D.iss.map(x=>'  - '+V.issueText(x,D)).join('\n')+'\n';
  return s;
}

function parseDays(x,def){const s=String(x||'').replace(/[^01]/g,'');if(s.length!==7)return def.slice();return s.split('').map(c=>c==='1')}
function parseDates(x){return String(x||'').split(/[|;\s]+/).map(s=>s.trim()).filter(validISO)}
function boolish(x,d){const s=String(x==null?'':x).trim().toLowerCase();if(!s)return d;return !['0','false','no','n','off','x'].includes(s)}
function importCSV(kind,text){return importRows(kind,M.csvParse(text))}
function importRows(kind,rows){
  rows=(rows||[]).map(r=>(r||[]).map(x=>x==null?'':String(x))).filter(r=>r.some(x=>x.trim()!==''));
  if(!rows.length){toast(t('invalid',{e:'empty'}),'warn');return}
  const hdr=rows[0].map(h=>h.trim().toLowerCase());
  const hasH=hdr.includes('name')||hdr.includes('location');
  if(kind==='locations'){
    const ni=hasH?Math.max(hdr.indexOf('name'),hdr.indexOf('location')):0,ki=hasH?hdr.findIndex(h=>/km|dist|mi/.test(h)):1;
    let n=0;commit(ws=>{(hasH?rows.slice(1):rows).forEach(r=>{const nm=(r[ni]||'').trim();if(!nm)return;const km=Math.max(0,M.num(r[ki<0?1:ki],0));const ex=ws.locations.find(l=>l.name===nm);if(ex){ex.km=km;ex.unknown=false}else ws.locations.push(M.mkLoc(nm,km));n++});M.syncLoc(ws)});
    toast(t('impDone',{n,k:0}));return;
  }
  const keys=kind==='sites'?['name','category','location','km','crit','tag','zone','weight','min','max','gap_min','gap_max','days','blackout','active']:['name','roles','rank','home','pref','weight','days','off','max','max_week','active'];
  const alias={distance:'km',mi:'km',miles:'km',cat:'category',type:'category',role:'roles',pool:'roles',origin_km:'home',origin:'home',off_dates:'off',weekdays:'days',max_total:'max',maxweek:'max_week',criticality:'crit',loc:'location',kind:'tag',gapmin:'gap_min',gapmax:'gap_max','gap min':'gap_min','gap max':'gap_max',revisit_min:'gap_min',revisit_max:'gap_max'};
  const idx={};
  if(hasH)hdr.forEach((h,i)=>{const k=alias[h]||h;if(keys.includes(k)&&idx[k]===undefined)idx[k]=i});else keys.forEach((k,i)=>idx[k]=i);
  const body=hasH?rows.slice(1):rows;
  const get=(r,k)=>idx[k]!==undefined?(r[idx[k]]||'').trim():'';
  let n=0,k=0;
  commit(ws=>{
    body.forEach(r=>{
      const name=get(r,'name');if(!name){k++;return}
      if(kind==='sites'){
        const cn=get(r,'category');let cat=cn?ws.categories.find(c=>c.name.toLowerCase()===cn.toLowerCase()):ws.categories[0];
        if(!cat){const st={};ws.roles.forEach((ro,i)=>st[ro.id]=i===0?1:0);cat=M.mkCat(cn||'Imported',M.COLORS[ws.categories.length%M.COLORS.length],st,1);ws.categories.push(cat)}
        const mn=get(r,'min'),mx=get(r,'max'),g1=get(r,'gap_min'),g2=get(r,'gap_max');const ln=get(r,'location');let loc='';
        if(ln){let l=ws.locations.find(x=>x.name===ln);if(!l){l=M.mkLoc(ln,M.num(get(r,'km'),0));ws.locations.push(l)}loc=l.id}
        ws.sites.push(M.mkSite(name,cat.id,Math.max(0,M.num(get(r,'km'),0)),{loc,crit:clamp(M.num(get(r,'crit'),50),0,100),tag:get(r,'tag'),zone:get(r,'zone'),weight:clamp(M.num(get(r,'weight'),1),.1,3),minV:mn===''?'':Math.max(0,M.intOr(mn,0)),maxV:mx===''?'':Math.max(0,M.intOr(mx,0)),gapMin:g1===''?'':Math.max(0,M.intOr(g1,0)),gapMax:g2===''?'':Math.max(0,M.intOr(g2,0)),days:parseDays(get(r,'days'),[true,true,true,true,true,true,true]),blackout:parseDates(get(r,'blackout')),active:boolish(get(r,'active'),true)}));
      }else{
        const rn=get(r,'roles').split(/[|;]+/).map(s=>s.trim()).filter(Boolean);
        const roles=rn.map(x=>{let ro=ws.roles.find(q=>q.name.toLowerCase()===x.toLowerCase());if(!ro){ro=M.mkRole(x,M.COLORS[ws.roles.length%M.COLORS.length]);ws.roles.push(ro)}return ro.id});
        if(!roles.length&&ws.roles[0])roles.push(ws.roles[0].id);
        const pf=get(r,'pref').toLowerCase();const mx=get(r,'max'),mw=get(r,'max_week');
        ws.people.push(M.mkPerson(name,roles,{rank:clamp(M.num(get(r,'rank'),50),0,100),home:Math.max(0,M.num(get(r,'home'),0)),pref:['near','far'].includes(pf)?pf:'none',weight:clamp(M.num(get(r,'weight'),1),.1,3),days:parseDays(get(r,'days'),[true,true,true,true,true,false,false]),off:parseDates(get(r,'off')),maxLoad:mx===''?'':Math.max(0,M.intOr(mx,0)),maxWeek:mw===''?'':Math.max(0,M.intOr(mw,0)),active:boolish(get(r,'active'),true)}));
      }
      n++;
    });
    M.syncLoc(ws);
  });
  toast(t('impDone',{n,k}),n?'':'warn');
}
/* ---- templates: rows (array of arrays) shared by CSV and Excel ---- */
function tplRows(kind){
  const ws=APP.ws;
  if(kind==='locations'){const L=(ws.locations||[]).slice(0,2);return [['name','km']].concat(L.length?L.map(l=>[l.name,String(l.km)]):[['Central','0'],['North town','18']])}
  if(kind==='sites'){const c=ws.categories[0]?ws.categories[0].name:'Main';const l=(ws.locations||[])[0];return [['name','category','location','km','crit','tag','zone','weight','min','max','gap_min','gap_max','days','blackout','active'],['Central Clinic',c,l?l.name:'Central','0','75','Clinic','','1','','','45','75','1111100','','1'],['Harbour Office',c,'','22','50','Office','East','1.5','1','4','','','0111110','2026-10-06|2026-10-07','1']]}
  if(kind==='history'){
    const S=M.plannable(ws).slice(0,3),P=ws.people.filter(p=>p.active);
    const d0=addISO(todayISO(),-60),d1=addISO(todayISO(),-35),d2=addISO(todayISO(),-12);
    const pp=(i,n)=>P.slice(i,i+n).map(p=>p.name).join('|');
    return [['date','place','people','note'],
      [d0,S[0]?S[0].name:'Central Clinic',pp(0,2)||'Alex|Sam',''],
      [d1,S[1]?S[1].name:'Harbour Office',pp(2,2)||'Sam',''],
      [d2,S[2]?S[2].name:(S[0]?S[0].name:'Central Clinic'),pp(4,3)||'Alex','follow-up']];
  }
  const r=ws.roles.map(x=>x.name);return [['name','roles','rank','home','pref','weight','days','off','max','max_week','active'],['Alex',r[0]||'Lead','75','5','near','1','0111110','','','3','1'],['Sam',r.slice(0,2).join('|')||'Lead','50','12','none','1','1111100','2026-10-12','','','1']];
}
function tplLists(kind){
  const ws=APP.ws;const cols=[];
  if(kind==='history'){cols.push(['place / '+t('site')].concat(M.plannable(ws).map(s=>s.name)));cols.push(['people / '+t('people')].concat(ws.people.map(p=>p.name)))}
  else if(kind==='sites'){cols.push(['category'].concat(ws.categories.map(c=>c.name)));cols.push(['location'].concat((ws.locations||[]).map(l=>l.name)))}
  else if(kind==='people'){cols.push(['roles'].concat(ws.roles.map(r=>r.name)));cols.push(['pref','none','near','far'])}
  else return null;
  const n=Math.max(...cols.map(c=>c.length));const out=[];for(let i=0;i<n;i++)out.push(cols.map(c=>c[i]==null?'':c[i]));return out;
}
function csvTemplate(kind){return '\uFEFF'+tplRows(kind).map(M.csvRow).join('\r\n')}
/* ---- Excel support (bundled SheetJS, loaded on demand) ---- */
let xlsxP=null;
function needXLSX(){
  if(G.XLSX)return Promise.resolve(G.XLSX);
  if(xlsxP)return xlsxP;
  toast(t('xlsxLoading'));
  xlsxP=new Promise((res,rej)=>{const s=document.createElement('script');s.src='js/vendor/xlsx.full.min.js';s.onload=()=>G.XLSX?res(G.XLSX):rej(new Error('XLSX'));s.onerror=()=>{xlsxP=null;rej(new Error('XLSX'))};document.head.appendChild(s)});
  return xlsxP;
}
async function dlXlsx(name,sheets){
  try{const X=await needXLSX();const wb=X.utils.book_new();
    sheets.forEach(([nm,rows,widths])=>{const sh=X.utils.aoa_to_sheet(rows);sh['!cols']=(widths||rows[0].map(()=>18)).map(w=>({wch:w}));X.utils.book_append_sheet(wb,sh,nm)});
    const out=X.write(wb,{bookType:'xlsx',type:'array'});
    dl(name,new Blob([out],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  }catch(e){console.error(e);toast(t('xlsxFail'),'warn')}
}
function tplDownload(kind,fmt){
  const ws=APP.ws;
  if(kind==='book'){const list=M.bookForExport(ws);dl(slug(ws.name)+'.rulebook-template.json',JSON.stringify(list.length?list:[{on:true,rel:'site',sense:'avoid',who:{k:'gender',v:'f'},what:{k:'kmGe',v:'70'},w:50,note:'example'}],null,2),'application/json');return}
  if(kind==='dataset'){dl(slug(ws.name)+'.dataset-template.json',JSON.stringify(M.toDataset(ws),null,2),'application/json');return}
  if(fmt==='xlsx'){const rows=tplRows(kind);const sheets=[[kind,rows,rows[0].map(h=>h==='people'||h==='place'||h==='name'?28:14)]];const L=tplLists(kind);if(L)sheets.push(['lists',L,L[0].map(()=>30)]);dlXlsx(kind+'-template.xlsx',sheets);return}
  dl(kind+'-template.csv',csvTemplate(kind),'text/csv;charset=utf-8');
}
function histRows(){
  const ws=APP.ws;
  return [['date','place','people','note','source']].concat((ws.history||[]).map(h=>{const s=h.site&&byId(ws.sites,h.site);return [h.date,s?s.name:(h.sn||''),h.people.map(id=>(byId(ws.people,id)||{}).name).filter(Boolean).concat(h.pn||[]).join('|'),h.note||'',h.src]}));
}
function importHistory(aoa){
  const ws=APP.ws;const res=M.parseHistoryRows(ws,aoa);
  if(!res.rows){toast(t('invalid',{e:'empty'}),'warn');return}
  let mg=null;
  commit(w=>{mg=M.mergeHistory(w.history||[],res.recs);w.history=mg.list;w.histRev=(w.histRev||0)+1});
  toast(t('histRead',{r:res.rows,n:mg.added,d:mg.dup,b:res.bad,u:res.noSite,q:res.noPerson}),res.bad||res.noSite?'warn':'');
  if(APP.view!=='history'){APP.view='history';render()}
}
function addHistoryRecs(recs){
  let mg=null;commit(w=>{mg=M.mergeHistory(w.history||[],recs);w.history=mg.list;w.histRev=(w.histRev||0)+1});
  toast(t('histAdded',{n:mg.added,d:mg.dup}));
}
function csvExport(kind){
  const ws=APP.ws;const b=d=>d.map(x=>x?'1':'0').join('');
  const ln=id=>{const l=byId(ws.locations,id);return l?l.name:''};
  if(kind==='sites'){const cn=id=>{const c=byId(ws.categories,id);return c?c.name:''};return '\uFEFF'+[['name','category','location','km','crit','tag','zone','weight','min','max','gap_min','gap_max','days','blackout','active']].concat(ws.sites.map(s=>[s.name,cn(s.cat),ln(s.loc),s.km,s.crit,s.tag,s.zone,s.weight,s.minV,s.maxV,s.gapMin==null?'':s.gapMin,s.gapMax==null?'':s.gapMax,b(s.days),s.blackout.join('|'),s.active?1:0])).map(M.csvRow).join('\r\n')}
  const rn=id=>{const r=byId(ws.roles,id);return r?r.name:''};
  return '\uFEFF'+[['name','roles','rank','home','pref','weight','days','off','max','max_week','active']].concat(ws.people.map(p=>[p.name,p.roles.map(rn).join('|'),p.rank,p.home,p.pref,p.weight,b(p.days),p.off.join('|'),p.maxLoad,p.maxWeek,p.active?1:0])).map(M.csvRow).join('\r\n');
}
let fileMode=null;
function pickFile(mode,accept){fileMode=mode;const f=$('#fileIn');f.value='';f.accept=accept;f.click()}
const SHEET_ACCEPT='.csv,.tsv,.txt,.xlsx,.xls,.ods,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';
function tplUpload(kind){
  if(kind==='book'||kind==='dataset'){pickFile('wsJson','.json,.txt,application/json');return}
  pickFile(kind==='history'?'hist':kind,SHEET_ACCEPT+(kind==='history'?',.json,application/json':''));
}
function onRows(mode,rows){if(mode==='hist')importHistory(rows);else importRows(mode,rows)}
$('#fileIn').addEventListener('change',e=>{
  const file=e.target.files[0];if(!file)return;
  const mode=fileMode;
  if(/\.(xlsx|xls|ods)$/i.test(file.name)&&['hist','sites','people','locations'].includes(mode)){
    const rb=new FileReader();
    rb.onload=async()=>{try{const X=await needXLSX();const wb=X.read(new Uint8Array(rb.result),{type:'array'});const sh=wb.Sheets[wb.SheetNames[0]];onRows(mode,X.utils.sheet_to_json(sh,{header:1,raw:true,defval:''}))}catch(err){console.error(err);toast(t('invalid',{e:err.message}),'warn')}};
    rb.readAsArrayBuffer(file);return;
  }
  const rd=new FileReader();
  rd.onload=()=>{
    const txt=String(rd.result||'');
    if(fileMode==='wsJson'){
      try{const o=JSON.parse(txt);let w;
        if(o.location_distances_km||o.facility_criticality||(Array.isArray(o.facilities)&&o.facilities[0]&&o.facilities[0].location!==undefined)){w=M.fromDataset(o,o.name||file.name.replace(/\.(json|txt)+$/i,''));w.source={url:'',hash:M.fnv(txt),at:Date.now(),auto:false}}
        else if(Array.isArray(o)||(o.rulebook&&!o.sites)){const list=Array.isArray(o)?o:o.rulebook;commit(ws=>{ws.book=(ws.book||[]).concat(M.resolveBook(ws,list))});toast(t('bookApplied',{n:list.length}));return}
        else if(Array.isArray(o.facilities)&&Array.isArray(o.people))w=M.migrateLegacy(o);else w=M.normalize(o.workspace||o);
        if(APP.ix.list.some(x=>x.id===w.id))w.id=uid('w');
        w.updated=Date.now();saveNow();switchTo(w);toast(t('imported'));
      }catch(err){toast(t('invalid',{e:err.message}),'warn')}
    }else if(fileMode==='hist'){
      const s=txt.replace(/^\uFEFF/,'').trim();
      if(s[0]==='['||s[0]==='{'){try{const o=JSON.parse(s);importHistory(M.historyAoa(Array.isArray(o)?o:(o.history||[])))}catch(err){toast(t('invalid',{e:err.message}),'warn')}}
      else importHistory(M.csvParse(txt));
    }else if(fileMode==='sites'||fileMode==='people'||fileMode==='locations')importCSV(fileMode,txt);
  };
  rd.readAsText(file);
});

function switchTo(w){
  saveNow();
  APP.ws=w;APP.hist={u:[],r:[],co:null,coT:0};APP.selDay=null;APP.f={};APP._ribbonDone=false;compiledCache=null;
  Store.save(w,APP.ix);
  closePop();closeModal();render();
  if(!w.plan&&APP.compiled().P.V)solve({quiet:true});
}
function newWorkspace(tpl){
  const w=M.TEMPLATES[tpl]();
  if(tpl==='field'||tpl==='retail'){const d=new Date();w.scope={mode:'month',start:fISO(new Date(d.getFullYear(),d.getMonth(),1)),end:''}}
  switchTo(w);APP.view='plan';render();
}

function shiftScope(d){
  commit(ws=>{
    const {start,end}=rangeOf(ws);
    if(ws.scope.mode==='week')ws.scope.start=addISO(start,7*d);
    else if(ws.scope.mode==='month'){const x=pISO(start);ws.scope.start=fISO(new Date(x.getFullYear(),x.getMonth()+d,1))}
    else{const span=M.diffDays(start,end)+1;ws.scope.start=addISO(start,span*d);ws.scope.end=addISO(end,span*d)}
  });
  APP._ribbonDone=false;
}
function dayOverride(iso,patch){
  commit(ws=>{
    const base=ws.week[dowOf(iso)];const o=Object.assign({},ws.overrides[iso]||{},patch);
    const cur={on:o.on!==undefined?o.on:base.on,n:o.n!==undefined?o.n:base.n,focus:o.focus||base.focus};
    if(cur.on&&!cur.n)cur.n=1;
    const same=cur.on===base.on&&cur.n===base.n&&cur.focus===(base.focus||'auto');
    if(same)delete ws.overrides[iso];else ws.overrides[iso]={on:cur.on,n:cur.n,focus:cur.focus};
  });
}

function paletteItems(q){
  const ws=APP.ws;q=(q||'').trim().toLowerCase();
  const cmds=[
    {label:t('solve'),kind:t('palCmd'),icon:'ic-wand',run:()=>solve({})},
    {label:t('reroll'),kind:t('palCmd'),icon:'ic-dice',run:reroll},
    {label:t('exportB'),kind:t('palCmd'),icon:'ic-down',run:openExport},
    {label:t('print'),kind:t('palCmd'),icon:'ic-print',run:doPrint},
    {label:t('copyReport'),kind:t('palCmd'),icon:'ic-copy',run:()=>V.derive()?copyText(reportText()):toast(t('noPlanYet'),'warn')},
    {label:t('addSite'),kind:t('palCmd'),icon:'ic-plus',run:()=>{APP.view='sites';act.addSite()}},
    {label:t('addPerson'),kind:t('palCmd'),icon:'ic-plus',run:()=>{APP.view='people';act.addPerson()}},
    {label:t('themeT'),kind:t('palCmd'),icon:'ic-moon',run:()=>act.theme()},
    {label:(I.lang()==='ar'?'English':'العربية'),kind:t('language'),icon:'ic-globe',run:()=>setLang(I.lang()==='ar'?'en':'ar')},
    {label:t('agenda'),kind:t('palCmd'),icon:'ic-list',run:()=>setLayout('agenda')},
    {label:t('matrix'),kind:t('palCmd'),icon:'ic-grid',run:()=>setLayout('matrix')},
    {label:t('calendar'),kind:t('palCmd'),icon:'ic-cal',run:()=>setLayout('calendar')},
    {label:t('saveSnap'),kind:t('palCmd'),icon:'ic-camera',run:()=>act.snapSave()},
    {label:t('loadDataset'),kind:t('palCmd'),icon:'ic-layers',run:loadDataset},
    {label:t('pr_once'),kind:t('presets'),icon:'ic-target',run:()=>applyPreset('once')},
    {label:t('pr_twice'),kind:t('presets'),icon:'ic-target',run:()=>applyPreset('twice')},
    ...['person','pair','classes','weekly','places','inject','pick'].map(k=>({label:t('gtpl_'+k),kind:t('goalsT'),icon:k==='inject'||k==='pick'?'ic-pin':'ic-target',run:()=>{APP.view='plan';render();addGoal(k)}})),
    {label:t('kbdT'),kind:t('palCmd'),icon:'ic-keyboard',run:()=>openModal(V.kbdModal())},
    {label:t('histUpload'),kind:t('tabHist'),icon:'ic-up',run:()=>tplUpload('history')},
    {label:t('histTplCsv'),kind:t('tabHist'),icon:'ic-file',run:()=>tplDownload('history','csv')},
    {label:t('histTplXlsx'),kind:t('tabHist'),icon:'ic-sheet',run:()=>tplDownload('history','xlsx')},
    {label:t('histAddPlan'),kind:t('tabHist'),icon:'ic-hist',run:()=>act.histFromPlan()},
    ...V.RC_PRESETS.map(([k,o])=>({label:t('rcp_'+k),kind:t('kTiming'),icon:'ic-hist',run:()=>applyRcPreset(k)})),
    {label:t('bAdd'),kind:t('bookT'),icon:'ic-flip',run:()=>addRule('__blank')},
    {label:t('bRestore'),kind:t('bookT'),icon:'ic-undo',run:restoreBook},
    {label:t('bJson'),kind:t('bookT'),icon:'ic-code',run:()=>openJson('book')},
    {label:t('eqExport'),kind:t('kModel'),icon:'ic-sigma',run:openEq},
    {label:t('eqCopy'),kind:t('kModel'),icon:'ic-copy',run:()=>copyText(V.eqText('text'))},
    {label:t('srcKeep'),kind:t('kSource'),icon:'ic-undo',run:()=>refreshSource(true)},
    {label:t('srcExportB'),kind:t('kSource'),icon:'ic-down',run:()=>act.dsExport()}
  ];
  (APP.config.ruleTemplates||[]).forEach((x,i)=>cmds.push({label:t('bAdd')+': '+((x.label&&(x.label[I.lang()]||x.label.en))||'#'+(i+1)),kind:t('bookT'),icon:'ic-flip',run:()=>addRule(String(i))}));
  [['plan','tabPlan','ic-cal'],['sites','tabSites','ic-build'],['people','tabPeople','ic-users'],['history','tabHist','ic-hist'],['rules','tabRules','ic-sliders'],['model','tabModel','ic-sigma'],['insights','tabInsights','ic-chart'],['workspace','tabWs','ic-layers']].forEach(([v,l,i])=>cmds.push({label:t('goTo')+' '+t(l),kind:t('palCmd'),icon:i,run:()=>{APP.view=v;render()}}));
  M.TEMPLATE_ORDER.forEach(k=>cmds.push({label:t('newWs')+': '+t('tpl_'+k),kind:t('palCmd'),icon:'ic-layers',run:()=>newWorkspace(k)}));
  APP.ix.list.filter(x=>x.id!==ws.id).forEach(x=>cmds.push({label:t('open_')+': '+x.name,kind:t('tabWs'),icon:'ic-layers',run:()=>{const w=Store.load(x.id);if(w)switchTo(w)}}));
  let out=cmds.filter(c=>!q||c.label.toLowerCase().includes(q));
  if(q){
    ws.sites.filter(s=>s.name.toLowerCase().includes(q)).slice(0,8).forEach(s=>out.push({label:s.name,kind:t('site'),icon:'ic-build',run:()=>{APP.view='sites';APP.f.siteQ=s.name;APP.f.siteCat='all';APP.f.sitePage=0;render()}}));
    ws.people.filter(p=>p.name.toLowerCase().includes(q)).slice(0,8).forEach(p=>out.push({label:p.name,kind:t('person'),icon:'ic-users',run:()=>{APP.view='people';APP.f.peopleQ=p.name;APP.f.peopleRole='all';APP.f.drawer=p.id;render()}}));
  }
  return out.slice(0,40);
}
function openPalette(){
  palState={q:'',sel:0,items:paletteItems('')};
  const st=palState;
  openModal(V.paletteHTML('',st.items,0),'top');palState=st;
  const inp=$('#palIn');inp.focus();
  inp.addEventListener('input',()=>{palState.q=inp.value;palState.items=paletteItems(inp.value);palState.sel=0;$('#palList').innerHTML=V.paletteList(palState.items,0)});
  inp.addEventListener('keydown',e=>{
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const n=palState.items.length;if(!n)return;palState.sel=(palState.sel+(e.key==='ArrowDown'?1:-1)+n)%n;$('#palList').innerHTML=V.paletteList(palState.items,palState.sel);const on=$('#palList .on');on&&on.scrollIntoView({block:'nearest'})}
    else if(e.key==='Enter'){e.preventDefault();runPal(palState.sel)}
  });
}
function runPal(i){const it=palState&&palState.items[i];closeModal();if(it)it.run()}
function setLang(l){APP.prefs.lang=l;applyLook();saveNow();closePop();render()}
function setLayout(l){APP.prefs.layout=l;APP.view='plan';saveNow();render()}
function doPrint(){if(APP.view!=='plan'){APP.view='plan';render()}setTimeout(()=>window.print(),60)}

function openDpk(btn){
  const tg=btn.dataset.target;
  if(pop&&dpkState&&dpkState.target===tg){closePop();return}
  const ws=APP.ws;let sel=btn.dataset.iso||null,marks=[],range=null;
  if(tg.startsWith('siteBlackout:')){const s=byId(ws.sites,tg.split(':')[1]);marks=s?s.blackout:[]}
  if(tg.startsWith('personOff:')){const p=byId(ws.people,tg.split(':')[1]);marks=p?p.off:[]}
  if(tg==='scopeStart'||tg==='scopeEnd'){const r=rangeOf(ws);range=[r.start,r.end]}
  const view=sel||(range?range[0]:todayISO());
  const st={target:tg,sel,marks,range,view:fISO(new Date(pISO(view).getFullYear(),pISO(view).getMonth(),1))};
  openPop(btn,V.dpkHTML(st),'dpk-pop');dpkState=st;btn.classList.add('open');pop._anchor=btn;
}
function dpkPick(iso){
  const st=dpkState;if(!st)return;
  const tg=st.target;
  if(tg==='scopeStart')commit(ws=>{ws.scope.start=iso;if(ws.scope.mode==='custom'&&(!ws.scope.end||ws.scope.end<iso))ws.scope.end=addISO(iso,6);APP.selDay=iso;APP._ribbonDone=false});
  else if(tg==='scopeEnd')commit(ws=>{ws.scope.end=iso<rangeOf(ws).start?rangeOf(ws).start:iso});
  else if(tg.startsWith('siteBlackout:')){const id=tg.split(':')[1];commit(ws=>{const s=byId(ws.sites,id);if(s&&!s.blackout.includes(iso))s.blackout.push(iso)})}
  else if(tg.startsWith('personOff:')){const id=tg.split(':')[1];commit(ws=>{const p=byId(ws.people,id);if(p&&!p.off.includes(iso))p.off.push(iso)})}
  closePop();
}

function applyBind(bd,ds,v){
  switch(bd){
    case 'site':case 'person':{
      const arr=bd==='site'?'sites':'people',id=ds.id,f=ds.f;let val=v;
      if(f==='crit'||f==='rank')val=clamp(M.intOr(v,50),0,100);
      commit(ws=>{const x=byId(ws[arr],id);if(!x)return;x[f]=val;if(f==='loc'||f==='homeLoc')M.syncLoc(ws)});break}
    case 'rankBy':commit(ws=>{const p=byId(ws.people,ds.id);if(!p)return;if(v==='')delete p.rankBy[ds.c];else p.rankBy[ds.c]=clamp(M.intOr(v,50),0,100)});break;
    case 'tokenAdd':{
      if(!v)return;const id=ds.id,f=ds.f;
      commit(ws=>{const p=byId(ws.people,id);if(!p[f].includes(v))p[f].push(v);if(f==='avoid'||f==='pair'){const q=byId(ws.people,v);const other=f==='avoid'?'pair':'avoid';p[other]=p[other].filter(x=>x!==v);if(q){if(!q[f].includes(p.id))q[f].push(p.id);q[other]=q[other].filter(x=>x!==p.id)}}if(f==='likes')p.bans=p.bans.filter(x=>x!==v);if(f==='bans')p.likes=p.likes.filter(x=>x!==v)});
      break}
    case 'dayFocus':dayOverride(ds.iso,{focus:v});break;
    case 'weekFocus':commit(ws=>{ws.week[+ds.i].focus=v});break;
    case 'rule':{const k=ds.k;commit(ws=>{ws.rules[k]=k==='weekStart'||k==='rankTol'?M.intOr(v,0):Math.max(0,M.num(v,10))});break}
    case 'unit':commit(ws=>{ws.unit=v==='mi'?'mi':'km'},{solve:false});break;
    case 'expWho':expState.who=v;refreshExport();break;
    case 'siteLoc':APP.f.siteLoc=v;APP.f.sitePage=0;render();break;
    case 'goal':commit(ws=>{const g=byId(ws.goals,ds.id);if(!g)return;const IJ={iper:'per',iop:'op',iadd:'add'};if(IJ[ds.f]){g.inject[IJ[ds.f]]=v;Object.assign(g,M.normGoal(g));return}g[ds.f]=v;if(ds.f==='per'&&v==='person'&&g.who.k==='all')g.who={k:'role',v:[]};if(ds.f==='kind'&&v==='inject'&&g.what.k==='all')g.what={k:'site',v:[]};Object.assign(g,M.normGoal(g))});break;
    case 'goalM':commit(ws=>{const g=byId(ws.goals,ds.id);if(!g)return;const side=ds.side;let m=g[side];if(ds.mi!=null&&m.more)m=m.more[+ds.mi];
      if(ds.f==='k'){m.k=v;m.v=GOAL_DEF[v]!=null?GOAL_DEF[v]:(M.MULTI_K.includes(v)||v==='gender'?[]:'');if(v==='gender')m.v=['f'];if(v==='all'){m.not=false;if(m===g[side]){delete m.more;delete m.join}}}
      else m.v=String(v);Object.assign(g,M.normGoal(g))});break;
    case 'goalAddV':commit(ws=>{const g=byId(ws.goals,ds.id);if(!g)return;let m=g[ds.side];if(ds.mi!=null&&m.more)m=m.more[+ds.mi];const a=Array.isArray(m.v)?m.v:(m.v?[m.v]:[]);if(!a.includes(v))a.push(v);m.v=a});break;
    case 'goalAdd':addGoal(v);break;
    case 'preset':applyPreset(v);break;
    case 'book':commit(ws=>{const r=byId(ws.book,ds.id);if(!r)return;const f=ds.f,side=ds.side;
      if(f==='rel'){r.rel=v;r.what=v==='day'?{k:'dow',v:[false,false,false,false,false,true,true]}:{k:'all',v:''};if(v==='count'){r.op='min';r.n=2;r.sense='prefer';r.per='plan'}if(v==='team'){r.op='max';r.n=1;r.sense='prefer'}}
      else if(side&&ds.mi!=null&&r[side].more){const c=r[side].more[+ds.mi];c[f]=v;if(f==='k')c.v=({rankGe:'75',rankLe:'25',critGe:'75',critLe:'25',kmGe:'40',kmLe:'15',gender:'f'})[v]||''}
      else if(side){r[side][f]=v;if(f==='k'){r[side].v=({rankGe:'75',rankLe:'25',critGe:'75',critLe:'25',kmGe:'40',kmLe:'15',gender:'f'})[v]||'';if(v==='all')r[side].not=false}}
      else r[f]=v;
      Object.assign(r,M.normRule(r))});break;
    case 'bookAdd':addRule(v);break;
    case 'rcPreset':applyRcPreset(v);break;
    case 'hAddSite':{const d=$('#hAddDate'),p=$('#hAddPeople');if(d)APP.f.hAddDate=d.value;if(p)APP.f.hAddPeople=p.value;APP.f.hAddSite=v;render();break}
    case 'route':commit(ws=>{const r=byId(ws.routes,ds.id);if(r){r[ds.f]=v;if(r.a===r.b)ws.routes=ws.routes.filter(x=>x!==r)}});break;
  }
}
const GOAL_DEF={rankGe:'75',rankLe:'25',critGe:'75',critLe:'25',kmGe:'40',kmLe:'15'};
function addGoal(k,o){
  const ws=APP.ws;const cat=(ws.categories.find(c=>c.planned)||{}).id||'';const p0=(ws.people.find(p=>p.active)||{}).id||'';const p1=(ws.people.filter(p=>p.active)[1]||{}).id||'';
  const T={blank:{per:'each',op:'min',n:1},person:{per:'person',who:{k:'person',v:p0?[p0]:[]},what:{k:'all',v:''},op:'min',n:3},
    pair:{per:'total',who:{k:'person',v:[p0,p1].filter(Boolean)},mode:'together',k:2,op:'min',n:2},
    classes:{per:'total',what:{k:'cat',v:ws.categories.filter(c=>c.planned).slice(0,2).map(c=>c.id)},op:'min',n:10},
    weekly:{per:'total',what:{k:'cat',v:cat?[cat]:[]},period:'week',op:'between',n:1,n2:3},
    places:{per:'person',who:{k:'all',v:''},what:{k:'all',v:''},measure:'places',op:'min',n:3},
    inject:{kind:'inject',what:{k:'site',v:[]},inject:{mode:'dates',dates:rangeOf(ws).start,n:1}},
    pick:{kind:'inject',what:{k:'kmLe',v:'20'},when:{k:'dow',v:[false,false,false,false,true,false,false]},inject:{mode:'pick',n:2}}};
  let id=null;commit(w=>{const g=M.mkGoal(Object.assign({},T[k]||T.blank,o||{}));w.goals.push(g);id=g.id});
  setTimeout(()=>{const el=document.querySelector('[data-gid="'+id+'"]');if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('flash');setTimeout(()=>el.classList.remove('flash'),1400)}},60);
  return id;
}
async function restoreBook(){
  const url=(APP.ws.source&&APP.ws.source.url)||APP.config.dataset;
  try{const o=(await fetchDataset(url)).o;const nw=M.fromDataset(o,APP.ws.name);const list=M.bookForExport(nw);commit(ws=>{ws.book=M.resolveBook(ws,list)});toast(t('bookApplied',{n:list.length}))}
  catch(e){toast(t('invalid',{e:e.message}),'warn')}
}
function addRule(v,o,stay){
  let id=null;
  commit(ws=>{let r;
    if(o)r=M.mkRule(o);
    else if(v&&v!=='__blank'){const tp=(APP.config.ruleTemplates||[])[+v];r=tp?M.resolveBook(ws,[tp.rule])[0]:M.mkRule()}
    else r=M.mkRule();
    ws.book=ws.book||[];ws.book.unshift(r);id=r.id});
  if(stay)return id;
  if(APP.view!=='rules'){APP.view='rules';render()}
  setTimeout(()=>{const el=document.querySelector('[data-rid="'+id+'"]');if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('flash');setTimeout(()=>el.classList.remove('flash'),1400)}},60);
  return id;
}
function openEq(){eqState=Object.assign({fmt:'text'},APP.prefs.eq||{});const st=eqState;openModal(V.eqModal(st));eqState=st;refreshEq()}
function refreshEq(){if(!modal||!eqState)return;modal.innerHTML=V.eqModal(eqState);const pv=modal.querySelector('#eqPrev');pv.textContent=V.eqText(eqState.fmt);APP.prefs.eq={fmt:eqState.fmt}}
const EQX={text:['txt','text/plain;charset=utf-8'],latex:['tex','application/x-tex'],md:['md','text/markdown;charset=utf-8'],json:['json','application/json']};
function openJson(kind){
  const ws=APP.ws;let obj,title,note;
  if(kind==='book'){obj=M.bookForExport(ws);title='bookJsonT';note='bookJsonN'}
  else{obj=M.toDataset(ws);title='dsJsonT';note='dsJsonN'}
  jsonState={kind,title,note,apply:true};const st=jsonState;
  openModal(V.jsonModal(st));jsonState=st;
  const ta=$('#jsonEd');ta.value=JSON.stringify(obj,null,2);
  ta.addEventListener('input',()=>{const er=$('#jsonErr');try{JSON.parse(ta.value);er.textContent='';er.className='jsonerr'}catch(e){er.textContent=e.message;er.className='jsonerr on'}});
}
function applyJson(){
  const ta=$('#jsonEd');if(!ta||!jsonState)return;let o;
  try{o=JSON.parse(ta.value)}catch(e){toast(t('invalid',{e:e.message}),'warn');return}
  try{
    if(jsonState.kind==='book'){const list=Array.isArray(o)?o:(o.rulebook||[]);commit(ws=>{ws.book=M.resolveBook(ws,list)});toast(t('bookApplied',{n:list.length}))}
    else{const nw=M.fromDataset(o,APP.ws.name);nw.source=APP.ws.source;const w=M.mergeDataset(APP.ws,nw);pushHist();APP.ws=w;compiledCache=null;saveNow();render();solve({quiet:true});toast(t('imported'))}
    closeModal();
  }catch(e){toast(t('invalid',{e:e.message}),'warn')}
}
async function fetchText(url){const r=await fetch(url,{cache:'no-cache'});if(!r.ok)throw new Error(r.status+' '+url);return await r.text()}
async function fetchFirst(urls){let err;for(const u of Array.from(new Set(urls.filter(Boolean)))){try{return {url:u,txt:await fetchText(u)}}catch(e){err=e}}throw err||new Error('no dataset')}
const dsUrls=()=>[APP.config.dataset,'data/complete_data.json','data/complete_data.json.txt'];
async function fetchDataset(first){
  const got=await fetchFirst([first].concat(dsUrls()));const o=JSON.parse(got.txt);let sig=got.txt;
  const side=[['facilities',APP.config.facilities||'data/facilities.json'],['people',APP.config.people||'data/people_ranking.json']];
  for(const [k,u] of side){if(APP.config[k]===false)continue;try{const r=await fetchFirst([u,u+'.txt']);const arr=JSON.parse(r.txt);if(Array.isArray(arr)&&arr.length){o[k]=M.overlayList(k,o[k],arr);sig+=r.txt}}catch(e){}}
  if(APP.config.history){try{const r=await fetchFirst([APP.config.history]);const u=APP.config.history;let arr;if(/\.csv$/i.test(u))arr=M.csvParse(r.txt);else{const x=JSON.parse(r.txt);arr=Array.isArray(x)?x:(x.history||[])}if(arr.length){o.history=Array.isArray(arr[0])?arr:arr;sig+=r.txt}}catch(e){}}
  return {url:got.url,o,hash:M.fnv(sig)};
}
async function checkSource(){
  const ws=APP.ws,src=ws.source;
  if(!src||src.auto===false||location.protocol==='file:'||APP.config.autoCheck===false)return;
  try{const h=(await fetchDataset(src.url)).hash;
    if(h!==src.hash&&APP.ws===ws)refreshSource(true);
  }catch(e){}
}
async function refreshSource(keep){
  const old=APP.ws,url=(old.source&&old.source.url)||APP.config.dataset;
  try{
    const g=await fetchDataset(url);const o=g.o;
    const nw=M.fromDataset(o,old.name);nw.source={url,hash:g.hash,at:Date.now(),auto:!old.source||old.source.auto!==false};
    let w;
    if(keep)w=M.mergeDataset(old,nw);else{w=nw;w.id=old.id;w.name=old.name;w.snapshots=old.snapshots}
    pushHist();APP.ws=w;APP.srcUpdate=null;compiledCache=null;saveNow();render();solve({quiet:true});
    toast(t(keep?'srcMerged':'srcReplaced'));
  }catch(e){toast(t('invalid',{e:e.message}),'warn')}
}
function applyRcPreset(k){
  const x=V.RC_PRESETS.find(p=>p[0]===k);if(!x)return;
  commit(ws=>{ws.recency=M.normRecency(Object.assign({},ws.recency||{},x[1]))});toast(t('presetDone'));
}
function applyPreset(k){
  commit(ws=>{
    if(k==='clear'){ws.goals=[];ws.sizing.mode='rhythm';return}
    if(k==='once'||k==='twice'){ws.goals=ws.goals.filter(g=>!(g.kind==='count'&&g.per==='each'&&g.what.k==='all'));ws.goals.unshift(M.mkGoal({per:'each',op:'min',n:k==='once'?1:2}));ws.sizing.mode='goals'}
    if(k==='crit'){ws.goals.push(M.mkGoal({per:'each',what:{k:'critGe',v:'100'},op:'min',n:2}));ws.goals.push(M.mkGoal({per:'each',what:{k:'critGe',v:'75',more:[{k:'critLe',v:'75'}],join:'and'},op:'min',n:1}))}
    if(k==='fairp'){ws.goals.push(M.mkGoal({per:'person',who:{k:'all',v:''},what:{k:'all',v:''},measure:'places',op:'min',n:3}))}
    if(k==='weekly'){const c=ws.categories.filter(x=>x.planned);c.forEach(x=>ws.goals.push(M.mkGoal({per:'total',what:{k:'cat',v:[x.id]},period:'week',op:'min',n:1})))}
  });
  toast(t('presetDone'));
}
async function loadDataset(keepView){
  try{
    const g=await fetchDataset();const url=g.url,o=g.o;const w=M.fromDataset(o,o.name||t('datasetName'));
    w.source={url,hash:g.hash,at:Date.now(),auto:true};
    APP.prefs.dsBooted=true;
    saveNow();switchTo(w);if(keepView!==true)APP.view='plan';render();toast(t('imported'));
  }catch(e){toast(t('invalid',{e:e.message}),'warn')}
}
const act={
  palette:openPalette,undo,redo,
  /* ---- revisit timing & history ---- */
  rcMode(b){commit(ws=>{ws.recency=M.normRecency(Object.assign({},ws.recency,{mode:b.dataset.v}))})},
  rcToggle(b){commit(ws=>{const r=M.normRecency(ws.recency);r[b.dataset.k]=!r[b.dataset.k];ws.recency=r})},
  rcFresh(b){commit(ws=>{ws.recency=M.normRecency(Object.assign({},ws.recency,{fresh:b.dataset.v}))})},
  rcReroll(){commit(ws=>{const r=M.normRecency(ws.recency);r.salt=(r.salt||1)+1;ws.recency=r})},
  dueWithPlan(){APP.f.dueWithPlan=!APP.f.dueWithPlan;APP.f.duePage=0;render()},
  dueSt(b){APP.f.dueSt=b.dataset.v;APP.f.duePage=0;render()},
  duePage(b){APP.f.duePage=+b.dataset.p;render()},
  histF(b){APP.f.histF=b.dataset.v;APP.f.histPage=0;render()},
  histPage(b){APP.f.histPage=+b.dataset.p;render()},
  histDel(b){commit(ws=>{ws.history=(ws.history||[]).filter(h=>h.id!==b.dataset.id);ws.histRev=(ws.histRev||0)+1})},
  histClear(b){armOr(b,'hc',()=>{commit(ws=>{ws.history=[];ws.histRev=(ws.histRev||0)+1});toast(t('histCleared'))})},
  histRelink(){let n=0;commit(ws=>{n=M.relinkHistory(ws);ws.histRev=(ws.histRev||0)+1});toast(t('histRelinked',{n}))},
  histFromPlan(){if(!APP.ws.plan){toast(t('histNoPlan'),'warn');return}addHistoryRecs(M.histFromPlan(APP.ws))},
  snapHist(b){const s=APP.ws.snapshots.find(x=>x.id===b.dataset.id);if(!s)return;addHistoryRecs(M.histFromPlan({plan:s.plan}))},
  histAddOne(){
    const ws=APP.ws,d=($('#hAddDate')||{}).value,sid=APP.f.hAddSite,ptxt=($('#hAddPeople')||{}).value||'';
    if(!validISO(d)||!sid||!byId(ws.sites,sid)){toast(t('invalid',{e:t('histDate')+' / '+t('histPlace')}),'warn');return}
    const ids=[],pn=[];ptxt.split(/[|;،,]+/).map(x=>x.trim()).filter(Boolean).forEach(x=>{const p=ws.people.find(q=>M.hnorm(q.name)===M.hnorm(x));if(p){if(!ids.includes(p.id))ids.push(p.id)}else pn.push(x)});
    APP.f.hAddDate=d;APP.f.hAddPeople='';
    addHistoryRecs([{id:uid('h'),date:d,site:sid,sn:'',people:ids,pn,note:'',src:'manual'}]);
  },
  histExport(b){const rows=histRows();const nm=slug(APP.ws.name)+'-visit-history';if(b.dataset.fmt==='xlsx')dlXlsx(nm+'.xlsx',[['history',rows,[12,34,40,24,10]]]);else dl(nm+'.csv','\uFEFF'+rows.map(M.csvRow).join('\r\n'),'text/csv;charset=utf-8')},
  tplDl(b){tplDownload(b.dataset.kind,b.dataset.fmt)},
  tplUp(b){tplUpload(b.dataset.kind)},
  jump(b){const el=document.getElementById(b.dataset.to);if(el){el.scrollIntoView({behavior:'smooth',block:'start'});el.classList.add('flash');setTimeout(()=>el.classList.remove('flash'),1200)}},
  bookOn(b){commit(ws=>{const r=byId(ws.book,b.dataset.id);if(r)r.on=!r.on})},
  bookAllOn(){const all=APP.ws.book.every(r=>r.on);commit(ws=>{ws.book.forEach(r=>r.on=!all)})},
  bookFlip(b){commit(ws=>{const r=byId(ws.book,b.dataset.id);if(!r)return;if(r.rel==='team'||r.rel==='count')r.op=({min:'max',max:'min',exact:'exact',ifany:'min'})[r.op]||'max';else r.sense=M.FLIP[r.sense]});toast(t('bFlipped'))},
  bookNot(b){commit(ws=>{const r=byId(ws.book,b.dataset.id);if(!r)return;let m=r[b.dataset.side];if(b.dataset.mi!=null&&m.more)m=m.more[+b.dataset.mi];if(m&&m.k!=='all')m.not=!m.not})},
  bookMore(b){commit(ws=>{const r=byId(ws.book,b.dataset.id);if(!r)return;const m=r[b.dataset.side];m.more=m.more||[];m.join=m.join||'and';m.more.push(b.dataset.side==='who'||r.rel==='with'?{k:'gender',v:'f',not:false}:{k:'kmLe',v:'30',not:false})})},
  bookLess(b){commit(ws=>{const r=byId(ws.book,b.dataset.id);if(!r)return;const m=r[b.dataset.side];m.more.splice(+b.dataset.i,1);if(!m.more.length){delete m.more;delete m.join}})},
  bookJoin(b){commit(ws=>{const r=byId(ws.book,b.dataset.id);if(r){const m=r[b.dataset.side];m.join=m.join==='or'?'and':'or'}})},
  bookDayMode(b){commit(ws=>{const r=byId(ws.book,b.dataset.id);if(r)r.what=b.dataset.v==='dates'?{k:'dates',v:''}:{k:'dow',v:[false,false,false,false,false,true,false]}})},
  bookPer(b){commit(ws=>{const r=byId(ws.book,b.dataset.id);if(r)r.per=r.per==='week'?'plan':'week'})},
  bookRestore(b){armOr(b,'brs',restoreBook)},
  bookFilter(b){APP.f.bookQ=b.dataset.v;render()},
  bookHard(b){commit(ws=>{const r=byId(ws.book,b.dataset.id);if(!r)return;r.sense=({prefer:'only',avoid:'never',only:'prefer',never:'avoid'})[r.sense];Object.assign(r,M.normRule(r))})},
  bookDup(b){commit(ws=>{const i=ws.book.findIndex(r=>r.id===b.dataset.id);if(i<0)return;const c=M.normRule(Object.assign(clone(ws.book[i]),{id:''}));ws.book.splice(i+1,0,c)})},
  bookDel(b){armOr(b,'bd'+b.dataset.id,()=>commit(ws=>{ws.book=ws.book.filter(r=>r.id!==b.dataset.id)}))},
  bookDow(b){commit(ws=>{const r=byId(ws.book,b.dataset.id);if(r&&r.rel==='day')r.what.v[+b.dataset.i]=!r.what.v[+b.dataset.i]})},
  bookN(b){commit(ws=>{const r=byId(ws.book,b.dataset.id);if(r)r.n=clamp(r.n+ +b.dataset.d,0,r.rel==='count'?99:20)},{co:'bn'+b.dataset.id})},
  bookJson(){openJson('book')},
  bookForPerson(b){const k=b.dataset.kind||'site';const o={who:{k:'person',v:b.dataset.id},rel:k==='count'?'count':k,sense:k==='count'?'prefer':'avoid'};if(k==='count'){o.op='min';o.n=2;o.what={k:'all',v:''}}addRule(null,o,true);toast(t('ruleAdded'))},
  personGender(b){commit(ws=>{const p=byId(ws.people,b.dataset.id);if(p)p.gender=b.dataset.v})},
  personPat(b){commit(ws=>{const p=byId(ws.people,b.dataset.id);if(!p)return;if(p.runMax===''){p.runMax=Math.max(1,ws.rules.runMax||1);p.offMin=Math.max(1,ws.rules.offMin||1)}else{p.runMax='';p.offMin=''}})},
  personRun(b){commit(ws=>{const p=byId(ws.people,b.dataset.id);if(!p)return;const k=b.dataset.k;p[k]=clamp((+p[k]||0)+ +b.dataset.d,k==='runMax'?1:0,14)},{co:'pr'+b.dataset.id+b.dataset.k})},
  addRoute(){commit(ws=>{const L0=(ws.locations||[]).slice().sort((x,y)=>x.km-y.km);if(L0.length<2)return;ws.routes=ws.routes||[];const a=L0[1],b=L0[L0.length-1];ws.routes.unshift({id:uid('t'),a:a.id,b:b.id,km:Math.round(Math.abs(b.km-a.km))})})},
  delRoute(b){commit(ws=>{ws.routes=ws.routes.filter(r=>r.id!==b.dataset.id)})},
  eqExport:openEq,
  eqFmt(b){eqState.fmt=b.dataset.v;refreshEq()},
  eqCopy(){copyText(V.eqText(eqState.fmt))},
  eqCopyAs(b){APP.prefs.eq={fmt:b.dataset.v};copyText(V.eqText(b.dataset.v))},
  eqCopyQuick(){copyText(V.eqText(APP.prefs.eq&&APP.prefs.eq.fmt||'text'))},
  eqDownload(){const e=EQX[eqState.fmt];dl(slug(APP.ws.name)+'-objective.'+e[0],V.eqText(eqState.fmt),e[1])},
  srcRefresh(b){refreshSource(b.dataset.keep==='1')},
  srcAuto(){commit(ws=>{ws.source=ws.source||{url:APP.config.dataset,hash:'',at:0,auto:true};ws.source.auto=ws.source.auto===false},{solve:false});render()},
  dsExport(){dl(slug(APP.ws.name)+'.dataset.json',JSON.stringify(M.toDataset(APP.ws),null,2),'application/json')},
  dsJson(){openJson('dataset')},
  jsonApply:applyJson,
  jsonCopy(){const ta=$('#jsonEd');if(ta)copyText(ta.value)},
  jsonDownload(){const ta=$('#jsonEd');if(ta)dl(slug(APP.ws.name)+(jsonState&&jsonState.kind==='book'?'.rulebook.json':'.dataset.json'),ta.value,'application/json')},
  dd(b){openDD(b)},
  ddPick(b){ddPick(+b.dataset.i)},
  loadDataset(){loadDataset()},
  sizeMode(b){commit(ws=>{ws.sizing.mode=b.dataset.v;if(b.dataset.v==='total'&&!ws.sizing.total)ws.sizing.total=M.planDays(ws).reduce((s,d)=>s+d.cfg.n,0)})},
  sizeTotal(b){commit(ws=>{ws.sizing.total=clamp(ws.sizing.total+ +b.dataset.d*(ws.sizing.total>=40?5:1),0,9999)},{co:'szt'})},
  goalDel(b){armOr(b,'gd'+b.dataset.id,()=>commit(ws=>{ws.goals=ws.goals.filter(g=>g.id!==b.dataset.id)}))},
  goalOn(b){commit(ws=>{const g=byId(ws.goals,b.dataset.id);if(g)g.on=!g.on})},
  goalN(b){const k=b.dataset.k||'n';commit(ws=>{const g=byId(ws.goals,b.dataset.id);if(!g)return;const d=+b.dataset.d;
    if(k==='injN'){g.inject.n=clamp(g.inject.n+d,g.inject.op==='max'?0:1,50);if(g.inject.n2<g.inject.n)g.inject.n2=g.inject.n}else if(k==='injN2')g.inject.n2=clamp(g.inject.n2+d,g.inject.n,60);else if(k==='k')g.k=clamp(g.k+d,1,20);else if(k==='n2')g.n2=clamp(g.n2+d,g.n,9999);else{g.n=clamp(g.n+d,0,9999);if(g.n2<g.n)g.n2=g.n}},{co:'gn'+k+b.dataset.id})},
  goalHard(b){commit(ws=>{const g=byId(ws.goals,b.dataset.id);if(g)g.hard=!g.hard})},
  goalDup(b){commit(ws=>{const i=ws.goals.findIndex(g=>g.id===b.dataset.id);if(i<0)return;const c=M.normGoal(Object.assign(clone(ws.goals[i]),{id:''}));ws.goals.splice(i+1,0,c)})},
  goalNot(b){commit(ws=>{const g=byId(ws.goals,b.dataset.id);if(!g)return;let m=g[b.dataset.side];if(b.dataset.mi!=null&&m.more)m=m.more[+b.dataset.mi];if(m&&m.k!=='all')m.not=!m.not})},
  goalMore(b){commit(ws=>{const g=byId(ws.goals,b.dataset.id);if(!g)return;const m=g[b.dataset.side];m.more=m.more||[];m.join=m.join||'and';m.more.push(b.dataset.side==='who'?{k:'gender',v:['f'],not:false}:{k:'kmLe',v:'30',not:false})})},
  goalLess(b){commit(ws=>{const g=byId(ws.goals,b.dataset.id);if(!g)return;const m=g[b.dataset.side];m.more.splice(+b.dataset.i,1);if(!m.more.length){delete m.more;delete m.join}})},
  goalJoin(b){commit(ws=>{const g=byId(ws.goals,b.dataset.id);if(g){const m=g[b.dataset.side];m.join=m.join==='or'?'and':'or'}})},
  goalDelV(b){commit(ws=>{const g=byId(ws.goals,b.dataset.id);if(!g)return;let m=g[b.dataset.side];if(b.dataset.mi!=null&&m.more)m=m.more[+b.dataset.mi];if(Array.isArray(m.v))m.v=m.v.filter(x=>x!==b.dataset.v)})},
  goalWhen(b){commit(ws=>{const g=byId(ws.goals,b.dataset.id);if(!g)return;const v=b.dataset.v;g.when=v==='dow'?{k:'dow',v:[false,true,true,true,true,false,false]}:v==='dates'?{k:'dates',v:rangeOf(ws).start}:{k:'all',v:''}})},
  goalDow(b){commit(ws=>{const g=byId(ws.goals,b.dataset.id);if(g&&g.when.k==='dow')g.when.v[+b.dataset.i]=!g.when.v[+b.dataset.i]})},
  goalPeriod(b){commit(ws=>{const g=byId(ws.goals,b.dataset.id);if(g)g.period=b.dataset.v})},
  goalInj(b){commit(ws=>{const g=byId(ws.goals,b.dataset.id);if(g)g.inject.mode=b.dataset.v})},
  goalForPerson(b){const o=b.dataset.v==='inject'?{who:{k:'person',v:[b.dataset.id]}}:{who:{k:'person',v:[b.dataset.id]}};APP.view='plan';render();addGoal(b.dataset.v==='inject'?'inject':'person',o);toast(t('goalAdded'))},
  goalGo(b){APP.view='plan';render();setTimeout(()=>{const el=document.querySelector('[data-gid="'+b.dataset.id+'"]');if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('flash');setTimeout(()=>el.classList.remove('flash'),1400)}},60)},
  addLoc(){commit(ws=>{ws.locations.unshift(M.mkLoc(t('location')+' '+(ws.locations.length+1),0))});setTimeout(()=>{const i=$('#locations-card .locitem input');i&&(i.focus(),i.select())},30)},
  delLoc(b){armOr(b,'dl'+b.dataset.id,()=>commit(ws=>{const id=b.dataset.id;ws.locations=ws.locations.filter(l=>l.id!==id);ws.sites.forEach(s=>{if(s.loc===id)s.loc=''});ws.people.forEach(p=>{if(p.homeLoc===id)p.homeLoc=''});ws.goals.forEach(g=>{if(g.what.k==='loc'&&Array.isArray(g.what.v))g.what.v=g.what.v.filter(x=>x!==id)})}))},
  pattern(b){commit(ws=>{ws.rules.runMax=+b.dataset.rm;ws.rules.offMin=+b.dataset.om})},
  rankGate(b){commit(ws=>{ws.rules.rankGate=b.dataset.v})},
  scopeLen(b){commit(ws=>{const r=rangeOf(ws);const n=clamp(M.diffDays(r.start,r.end)+1+ +b.dataset.d,1,366);ws.scope.end=addISO(r.start,n-1)},{co:'sl'})},
  theme(){APP.prefs.theme=APP.prefs.theme==='dusk'?'light':'dusk';applyLook();saveNow();refreshChrome();if(APP.view==='workspace')render()},
  themeSet(b){APP.prefs.theme=b.dataset.v;applyLook();saveNow();render()},
  lang(b){setLang(b.dataset.v)},
  tab(b){APP.view=b.dataset.view;closePop();render();window.scrollTo({top:0,behavior:'smooth'})},
  tile(b){APP.selDay=b.dataset.iso;render()},
  dayOn(b){const iso=b.dataset.iso,c=M.dayCfg(APP.ws,iso);dayOverride(iso,{on:!c.on,n:c.on?c.n:Math.max(1,c.n||APP.ws.week[dowOf(iso)].n||1)})},
  dayN(b){const iso=b.dataset.iso,c=M.dayCfg(APP.ws,iso);dayOverride(iso,{n:clamp(c.n+ +b.dataset.d,1,50),on:true})},
  dayReset(b){commit(ws=>{delete ws.overrides[b.dataset.iso]})},
  scopeMode(b){commit(ws=>{const r=rangeOf(ws);ws.scope.mode=b.dataset.v;if(b.dataset.v==='custom'){ws.scope.start=r.start;ws.scope.end=r.end}else ws.scope.start=APP.selDay||r.start});APP._ribbonDone=false},
  scopeShift(b){shiftScope(+b.dataset.d)},
  scopeToday(){commit(ws=>{const td=todayISO();if(ws.scope.mode==='custom'){const r=rangeOf(ws),span=M.diffDays(r.start,r.end);ws.scope.start=td;ws.scope.end=addISO(td,span)}else ws.scope.start=td;APP.selDay=td});APP._ribbonDone=false},
  dpk(b){openDpk(b)},
  dpkNav(b){if(!dpkState)return;const d=pISO(dpkState.view);dpkState.view=fISO(new Date(d.getFullYear(),d.getMonth()+ +b.dataset.d,1));pop.innerHTML=V.dpkHTML(dpkState)},
  dpkPick(b){dpkPick(b.dataset.iso)},
  solve(){solve({})},reroll,export:openExport,print:doPrint,
  layout(b){setLayout(b.dataset.v)},
  clearPins(){commit(ws=>{ws.locks={sites:{},seats:{}}})},
  lockAll(){const D=V.derive();if(!D)return;commit(ws=>{D.m.visits.forEach((v,i)=>{const s=D.siteOfV(i);if(s)ws.locks.sites[v.key]=s.id});D.m.seats.forEach((s,z)=>{if(!D.r.stats.active[z])return;const p=D.personOfZ(z);if(p)ws.locks.seats[s.key]=p.id})});toast(t('pinnedT'))},
  issuesToggle(){setTimeout(()=>{const d=$('#issuesBox');APP.issuesOpen=!!(d&&d.open)},0);return 'pass'},
  gotoDay(b){const iso=b.dataset.iso;if(!iso)return;APP.selDay=iso;if((APP.prefs.layout||'agenda')!=='agenda'){APP.prefs.layout='agenda'}render();const el=document.getElementById('day-'+iso);if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.querySelectorAll('td').forEach(td=>{td.style.transition='background .6s';td.style.background='var(--wash-selected)';setTimeout(()=>td.style.background='',1200)})}},
  xseat(b){explainAt(b,{seat:+b.dataset.z})},
  xvisit(b){explainAt(b,{visit:+b.dataset.v})},
  popClose:closePop,
  pinSeat(b){const D=V.derive(),z=+b.dataset.z,st=D.m.seats[z],p=D.personOfZ(z);closePop();commit(ws=>{ws.locks.seats[st.key]=p?p.id:'__open'},{solve:false});solve({warm:true,quiet:true})},
  unpinSeat(b){const D=V.derive(),st=D.m.seats[+b.dataset.z];closePop();commit(ws=>{delete ws.locks.seats[st.key]},{solve:false});solve({warm:true,quiet:true})},
  openSeat(b){const D=V.derive(),st=D.m.seats[+b.dataset.z];closePop();commit(ws=>{ws.locks.seats[st.key]='__open'},{solve:false});solve({warm:true,quiet:true})},
  useSeat(b){const D=V.derive(),st=D.m.seats[+b.dataset.z],p=+b.dataset.p;closePop();commit(ws=>{ws.locks.seats[st.key]=p>=0?D.m.people[p]:'__open'},{solve:false});solve({warm:true,quiet:true});toast(t('pinnedT'))},
  pinVisit(b){const D=V.derive(),v=+b.dataset.v,s=D.siteOfV(v);closePop();if(!s)return;commit(ws=>{ws.locks.sites[D.m.visits[v].key]=s.id},{solve:false});solve({warm:true,quiet:true})},
  unpinVisit(b){const D=V.derive(),v=+b.dataset.v;closePop();commit(ws=>{delete ws.locks.sites[D.m.visits[v].key]},{solve:false});solve({warm:true,quiet:true})},
  useVisit(b){const D=V.derive(),v=+b.dataset.v,s=+b.dataset.s;closePop();commit(ws=>{ws.locks.sites[D.m.visits[v].key]=D.m.sites[s]},{solve:false});solve({warm:true,quiet:true});toast(t('pinnedT'))},
  addSite(){commit(ws=>{const fc=APP.f.siteCat;const cat=fc&&fc!=='all'?fc:(ws.categories.find(c=>c.planned)||ws.categories[0]||{}).id;if(!cat){const st={};ws.roles.forEach((r,i)=>st[r.id]=i?0:1);const c=M.mkCat('Standard',M.COLORS[0],st,1);ws.categories.push(c);ws.sites.unshift(M.mkSite(t('site')+' '+(ws.sites.length+1),c.id,0))}else ws.sites.unshift(M.mkSite(t('site')+' '+(ws.sites.length+1),cat,0))});APP.f.siteQ='';APP.f.sitePage=0;render();setTimeout(()=>{const i=$('#view-sites .ledger tbody input[data-f="name"]');i&&(i.focus(),i.select())},30)},
  siteCat(b){APP.f.siteCat=b.dataset.v;APP.f.sitePage=0;render()},
  sitePage(b){APP.f.sitePage=+b.dataset.p;render()},
  siteActive(b){commit(ws=>{const s=byId(ws.sites,b.dataset.id);s.active=!s.active})},
  siteDay(b){commit(ws=>{const s=byId(ws.sites,b.dataset.id);s.days[+b.dataset.i]=!s.days[+b.dataset.i]})},
  siteBlackoutDel(b){commit(ws=>{const s=byId(ws.sites,b.dataset.id);s.blackout=s.blackout.filter(x=>x!==b.dataset.iso)})},
  delSite(b){armOr(b,'ds'+b.dataset.id,()=>commit(ws=>{const id=b.dataset.id;ws.sites=ws.sites.filter(s=>s.id!==id);ws.people.forEach(p=>{p.likes=p.likes.filter(x=>x!==id);p.bans=p.bans.filter(x=>x!==id)})}))},
  addPerson(){commit(ws=>{const fr=APP.f.peopleRole;const r=fr&&fr!=='all'?[fr]:(ws.roles[0]?[ws.roles[0].id]:[]);ws.people.unshift(M.mkPerson(t('person')+' '+(ws.people.length+1),r,{days:ws.week.map(d=>d.on)}))});APP.f.peopleQ='';render();setTimeout(()=>{const i=$('#view-people .ledger tbody input[data-f="name"]');i&&(i.focus(),i.select())},30)},
  peopleRole(b){APP.f.peopleRole=b.dataset.v;render()},
  personActive(b){commit(ws=>{const p=byId(ws.people,b.dataset.id);p.active=!p.active})},
  personRole(b){commit(ws=>{const p=byId(ws.people,b.dataset.id),r=b.dataset.r;p.roles=p.roles.includes(r)?p.roles.filter(x=>x!==r):p.roles.concat([r])})},
  personDay(b){commit(ws=>{const p=byId(ws.people,b.dataset.id);p.days[+b.dataset.i]=!p.days[+b.dataset.i]})},
  personOffDel(b){commit(ws=>{const p=byId(ws.people,b.dataset.id);p.off=p.off.filter(x=>x!==b.dataset.iso)})},
  drawer(b){APP.f.drawer=APP.f.drawer===b.dataset.id?null:b.dataset.id;render()},
  delPerson(b){armOr(b,'dp'+b.dataset.id,()=>commit(ws=>{const id=b.dataset.id;ws.people=ws.people.filter(p=>p.id!==id);ws.people.forEach(p=>{p.avoid=p.avoid.filter(x=>x!==id);p.pair=p.pair.filter(x=>x!==id)});for(const k in ws.locks.seats)if(ws.locks.seats[k]===id)delete ws.locks.seats[k]}))},
  tokenDel(b){commit(ws=>{const p=byId(ws.people,b.dataset.id),f=b.dataset.f,v=b.dataset.v;p[f]=p[f].filter(x=>x!==v);if(f==='avoid'||f==='pair'){const q=byId(ws.people,v);if(q)q[f]=q[f].filter(x=>x!==p.id)}})},
  addRole(){commit(ws=>{const r=M.mkRole('Role '+(ws.roles.length+1),M.COLORS[ws.roles.length%M.COLORS.length]);ws.roles.push(r)})},
  delRole(b){armOr(b,'dr'+b.dataset.id,()=>commit(ws=>{const id=b.dataset.id;ws.roles=ws.roles.filter(r=>r.id!==id);ws.people.forEach(p=>p.roles=p.roles.filter(x=>x!==id));ws.categories.forEach(c=>delete c.staff[id])}))},
  color(b){colorTarget={kind:b.dataset.kind,id:b.dataset.id};const st=colorTarget;openPop(b,V.swatches(),'swatches');colorTarget=st},
  colorPick(b){const tg=colorTarget;closePop();if(!tg)return;commit(ws=>{const arr=tg.kind==='role'?ws.roles:ws.categories;const x=byId(arr,tg.id);if(x)x.color=b.dataset.c},{solve:false})},
  addCat(){commit(ws=>{const st={};ws.roles.forEach(r=>st[r.id]=1);ws.categories.push(M.mkCat('Category '+(ws.categories.length+1),M.COLORS[(ws.categories.length+3)%M.COLORS.length],st,1))})},
  catPlanned(b){commit(ws=>{const c=byId(ws.categories,b.dataset.id);c.planned=!c.planned})},
  delCat(b){armOr(b,'dc'+b.dataset.id,()=>commit(ws=>{const id=b.dataset.id;const alt=ws.categories.find(c=>c.id!==id);ws.categories=ws.categories.filter(c=>c.id!==id);if(alt)ws.sites.forEach(s=>{if(s.cat===id)s.cat=alt.id});else ws.sites=ws.sites.filter(s=>s.cat!==id)}))},
  catStaff(b){commit(ws=>{const c=byId(ws.categories,b.dataset.id);c.staff[b.dataset.r]=clamp((c.staff[b.dataset.r]||0)+ +b.dataset.d,0,20)},{co:'cs'+b.dataset.id+b.dataset.r})},
  catShare(b){commit(ws=>{const c=byId(ws.categories,b.dataset.id);c.share=clamp(c.share+ +b.dataset.d,0,50)},{co:'csh'+b.dataset.id})},
  weekOn(b){commit(ws=>{const d=ws.week[+b.dataset.i];d.on=!d.on;if(d.on&&!d.n)d.n=1})},
  weekN(b){commit(ws=>{const d=ws.week[+b.dataset.i];d.n=clamp(d.n+ +b.dataset.d,1,50)},{co:'wn'+b.dataset.i})},
  ruleStep(b){const k=b.dataset.k,mx={perDay:10,runMax:14,offMin:14,siteGap:60}[k];commit(ws=>{ws.rules[k]=clamp(ws.rules[k]+ +b.dataset.d,0,mx);if(k==='runMax'&&ws.rules.runMax>0&&!ws.rules.offMin)ws.rules.offMin=1},{co:'rs'+k})},
  ruleToggle(b){commit(ws=>{ws.rules[b.dataset.k]=!ws.rules[b.dataset.k]})},
  ruleMode(b){commit(ws=>{ws.rules.mode=b.dataset.v})},
  engQuality(b){commit(ws=>{ws.engine.quality=b.dataset.v})},
  engRuns(b){commit(ws=>{ws.engine.runs=clamp(ws.engine.runs+ +b.dataset.d,1,16)},{co:'er'})},
  engLive(){commit(ws=>{ws.engine.live=!ws.engine.live},{solve:false})},
  restoreW(){commit(ws=>{ws.weights=M.defaultWeights();ws.useW=M.defaultUseW()})},
  useW(b){commit(ws=>{ws.useW[b.dataset.k]=!ws.useW[b.dataset.k]})},
  copyReport(){copyText(reportText())},
  wsOpen(b){const w=Store.load(b.dataset.id);if(w)switchTo(w)},
  wsDup(b){const src=b.dataset.id===APP.ws.id?APP.ws:Store.load(b.dataset.id);if(!src)return;const w=clone(src);w.id=uid('w');w.name=src.name+' (2)';w.created=w.updated=Date.now();switchTo(w)},
  wsDel(b){armOr(b,'dw'+b.dataset.id,()=>{const id=b.dataset.id;Store.remove(id,APP.ix);if(id===APP.ws.id){const nx=APP.ix.active&&Store.load(APP.ix.active);if(nx){APP.ws=nx;APP.hist={u:[],r:[],co:null,coT:0};compiledCache=null}}render();toast(t('deleted'))})},
  wsNew(b){newWorkspace(b.dataset.tpl)},
  snapSave(){if(!APP.ws.plan){toast(t('noPlanYet'),'warn');return}const pl=APP.ws.plan;commit(ws=>{ws.snapshots.unshift({id:uid('n'),name:V.fmtDS(pl.map.start)+' – '+V.fmtDS(pl.map.end)+' · '+t('seed')+' '+ws.engine.seed,at:Date.now(),plan:JSON.parse(JSON.stringify(pl))});ws.snapshots=ws.snapshots.slice(0,20)},{solve:false});toast(t('saved'))},
  snapRestore(b){commit(ws=>{const s=ws.snapshots.find(x=>x.id===b.dataset.id);if(s)ws.plan=JSON.parse(JSON.stringify(s.plan))},{solve:false});APP.view='plan';render()},
  snapDel(b){armOr(b,'sn'+b.dataset.id,()=>commit(ws=>{ws.snapshots=ws.snapshots.filter(x=>x.id!==b.dataset.id)},{solve:false}))},
  wsExport(){dl(slug(APP.ws.name)+'.mauvine.json',JSON.stringify(APP.ws,null,1),'application/json')},
  wsImport(){pickFile('wsJson','.json,application/json')},
  wsReset(b){armOr(b,'wr',()=>{const tp=M.TEMPLATES[APP.ws.template]?APP.ws.template:'blank';const w=M.TEMPLATES[tp]();w.id=APP.ws.id;w.name=APP.ws.name;pushHist();APP.ws=w;compiledCache=null;saveNow();render();solve({quiet:true})})},
  csvImport(b){pickFile(b.dataset.kind,SHEET_ACCEPT)},
  csvTpl(b){dl(b.dataset.kind+'-template.csv',csvTemplate(b.dataset.kind),'text/csv;charset=utf-8')},
  csvExport(b){dl(slug(APP.ws.name)+'-'+b.dataset.kind+'.csv',csvExport(b.dataset.kind),'text/csv;charset=utf-8')},
  modalClose:closeModal,
  expFmt(b){expState.fmt=b.dataset.v;refreshExport()},
  expCol(b){expState.cols[b.dataset.k]=!expState.cols[b.dataset.k];refreshExport()},
  expDownload(){const e=EXT[expState.fmt];const D=V.derive();const who=expState.who?'-'+slug((byId(APP.ws.people,expState.who)||{}).name):'';dl(slug(APP.ws.name)+who+'_'+D.m.start+'_'+D.m.end+'.'+e[0],exportText(expState),e[1])},
  expCopy(){copyText(exportText(expState))},
  palRun(b){runPal(+b.dataset.i)}
};

document.addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');
  if(pop&&!e.target.closest('.pop,.dpk-pop,.swatches,.ddpop')&&!(b&&(b.dataset.act==='dpk'||b.dataset.act==='color'||b.dataset.act==='dd'))){if(!(b&&/^x(seat|visit)$/.test(b.dataset.act)))closePop()}
  if(!b||b.disabled)return;
  const fn=act[b.dataset.act];if(!fn)return;
  const r=fn(b,e);
  if(r!=='pass'&&b.tagName!=='SUMMARY')e.preventDefault();
});
document.addEventListener('input',e=>{
  const el=e.target,bd=el.dataset&&el.dataset.bind;if(!bd)return;
  if(bd==='siteQ'||bd==='peopleQ'||bd==='histQ'){
    APP.f[bd]=el.value;if(bd==='siteQ')APP.f.sitePage=0;if(bd==='histQ')APP.f.histPage=0;
    const pos=el.selectionStart;render();const n=$('[data-bind="'+bd+'"]');if(n){n.focus();try{n.setSelectionRange(pos,pos)}catch(x){}}
    return;
  }
  if(el.type==='range'){
    const mn=+el.min,mx=+el.max;el.style.setProperty('--fill',((el.value-mn)/(mx-mn)*100)+'%');
    const lab=el.nextElementSibling;if(lab)lab.textContent=bd==='weight'||bd==='bookW'||bd==='goalW'?el.value:(+el.value).toFixed(2);
    return;
  }
  if(bd==='bookDates'){const id=el.dataset.id,v=el.value;commit(ws=>{const r=byId(ws.book,id);if(r&&r.what.k==='dates')r.what.v=v.slice(0,400)},{render:false,co:'bdt'+id});return}
  if(bd==='bookNote'){const id=el.dataset.id,v=el.value;commit(ws=>{const r=byId(ws.book,id);if(r)r.note=v.slice(0,160)},{render:false,solve:false,co:'bnote'+id});return}
  if(bd==='goalLabel'){const id=el.dataset.id,v=el.value;commit(ws=>{const g=byId(ws.goals,id);if(g)g.label=v.slice(0,80)},{render:false,solve:false,co:'glab'+id});return}
  if(bd==='goalWhenDates'||bd==='goalInjDates'){const id=el.dataset.id,v=el.value;commit(ws=>{const g=byId(ws.goals,id);if(!g)return;if(bd==='goalInjDates')g.inject.dates=v.slice(0,600);else if(g.when.k==='dates')g.when.v=v.slice(0,600)},{render:false,co:'gdt'+id});return}
  if((bd==='site'||bd==='person')&&(el.dataset.f==='name'||el.dataset.f==='zone')){
    const arr=bd==='site'?'sites':'people';const id=el.dataset.id,f=el.dataset.f,v=el.value;
    commit(ws=>{const x=byId(ws[arr],id);if(x)x[f]=v},{render:false,solve:f==='zone',co:'txt'+id+f});
    return;
  }
  if(bd==='site'&&el.dataset.f==='tag'){const id=el.dataset.id,v=el.value;commit(ws=>{const x=byId(ws.sites,id);if(x)x.tag=v},{render:false,solve:false,co:'tag'+id});return}
  if(bd==='loc'&&el.dataset.f==='name'){const id=el.dataset.id,v=el.value;commit(ws=>{const x=byId(ws.locations,id);if(x)x.name=v},{render:false,solve:false,co:'ln'+id});return}
  if(bd==='role'||bd==='cat'){const arr=bd==='role'?'roles':'categories';const id=el.dataset.id,v=el.value;commit(ws=>{const x=byId(ws[arr],id);if(x)x.name=v},{render:false,solve:false,co:'nm'+id});return}
  if(bd==='term'){const f=el.dataset.f,v=el.value;commit(ws=>{ws.terms[I.lang()][f]=v},{render:false,solve:false,co:'term'+f});return}
  if(bd==='wsName'){const v=el.value;commit(ws=>{ws.name=v||'Untitled'},{render:false,solve:false,co:'wsn'});return}
});
document.addEventListener('change',e=>{
  const el=e.target,bd=el.dataset&&el.dataset.bind;if(!bd)return;
  const v=el.value;
  switch(bd){
    case 'site':case 'person':{
      const arr=bd==='site'?'sites':'people';const id=el.dataset.id,f=el.dataset.f;
      if(f==='name'||f==='zone')return;
      if(f==='tag'){scheduleSolve();break}
      let val=v;
      if(f==='km'||f==='home')val=Math.max(0,M.num(v,0));
      else if(f==='weight')val=clamp(M.num(v,1),.1,3);
      else if(f==='minV'||f==='maxV'||f==='maxLoad'||f==='maxWeek'||f==='gapMin'||f==='gapMax')val=v===''?'':Math.max(0,M.intOr(v,0));
      commit(ws=>{const x=byId(ws[arr],id);if(x)x[f]=val},{render:f==='cat'||f==='pref'});
      break;}
    case 'loc':{const id=el.dataset.id,f=el.dataset.f;if(f==='km')commit(ws=>{const l=byId(ws.locations,id);if(l){l.km=Math.max(0,M.num(v,0));l.unknown=false;M.syncLoc(ws)}});else render();break}
    case 'sizeTotal':commit(ws=>{ws.sizing.total=clamp(M.intOr(v,0),0,9999)});break;
    case 'rc':{const k=el.dataset.k;commit(ws=>{const r=M.normRecency(ws.recency);r[k]=Math.max(0,M.intOr(v,0));ws.recency=M.normRecency(r)});break}
    case 'rcCat':{const c=el.dataset.c,k=el.dataset.k;commit(ws=>{const r=M.normRecency(ws.recency);const x=Object.assign({min:'',max:''},r.cat[c]||{});x[k]=v===''?'':Math.max(0,M.intOr(v,0));r.cat[c]=x;ws.recency=M.normRecency(r)});break}
    case 'rule':{const k=el.dataset.k;commit(ws=>{ws.rules[k]=Math.max(0,M.num(v,10))});break}
    case 'engine':commit(ws=>{ws.engine.seed=Math.max(1,M.intOr(v,1))});break;
    case 'weight':{const k=el.dataset.k;commit(ws=>{ws.weights[k]=clamp(M.intOr(v,50),0,100)},{render:false});break}
    case 'bookW':{const id=el.dataset.id;commit(ws=>{const r=byId(ws.book,id);if(r)r.w=clamp(M.intOr(v,50),0,100)},{render:false});break}
    case 'bookNum':{const id=el.dataset.id,side=el.dataset.side,mi=el.dataset.mi;commit(ws=>{const r=byId(ws.book,id);if(!r)return;const m=mi!=null&&r[side].more?r[side].more[+mi]:r[side];m.v=String(Math.max(0,M.num(v,0)))});break}
    case 'bookDates':case 'goalWhenDates':case 'goalInjDates':case 'goalLabel':render();break;
    case 'goalW':{const id=el.dataset.id;commit(ws=>{const g=byId(ws.goals,id);if(g)g.w=clamp(M.intOr(v,50),0,100)},{render:false});break}
    case 'goalNum':{const id=el.dataset.id,side=el.dataset.side,mi=el.dataset.mi;commit(ws=>{const g=byId(ws.goals,id);if(!g)return;const m=mi!=null&&g[side].more?g[side].more[+mi]:g[side];m.v=String(Math.max(0,M.num(v,0)))});break}
    case 'routeKm':{const id=el.dataset.id;commit(ws=>{const r=byId(ws.routes,id);if(r)r.km=Math.max(0,M.num(v,0))});break}
    case 'bookNote':render();break;
    case 'unit':commit(ws=>{ws.unit=v==='mi'?'mi':'km'},{solve:false});break;
    case 'term':case 'role':case 'cat':case 'wsName':render();break;
  }
});
document.addEventListener('focusout',()=>{setTimeout(()=>{if(pendingRender&&!isEditing())render()},0)});
document.addEventListener('mouseover',e=>{
  const p=e.target.closest('[data-pid]');
  const cur=APP._hl;
  const id=p?p.dataset.pid:null;
  if(id===cur)return;
  if(cur)$$('.pill.hl').forEach(x=>x.classList.remove('hl'));
  APP._hl=id;
  if(id)$$('.pill[data-pid="'+CSS.escape(id)+'"]').forEach(x=>x.classList.add('hl'));
});
document.addEventListener('keydown',e=>{
  const k=e.key,mod=e.ctrlKey||e.metaKey;
  if(mod&&k.toLowerCase()==='k'){e.preventDefault();palState?closeModal():openPalette();return}
  if(k==='Escape'){if(pop){const b=ddState&&ddState.btn;closePop();b&&b.isConnected&&b.focus();return}if(modal){closeModal();return}}
  if(pop&&ddState&&(k==='ArrowDown'||k==='ArrowUp')&&e.target.id!=='ddQ'){ddKeys(e);return}
  const typing=/^(INPUT|SELECT|TEXTAREA)$/.test((document.activeElement||{}).tagName||'');
  if(mod&&k.toLowerCase()==='z'&&!typing){e.preventDefault();e.shiftKey?redo():undo();return}
  if(mod&&k.toLowerCase()==='y'&&!typing){e.preventDefault();redo();return}
  if(typing||mod||e.altKey||modal)return;
  const views=VIEWS_ORDER;
  if(/^[1-8]$/.test(k)){APP.view=views[+k-1];closePop();render();return}
  const lk=k.toLowerCase();
  if(lk==='g'){solve({});return}
  if(lk==='r'){reroll();return}
  if(lk==='e'){openExport();return}
  if(lk==='l'){const ls=['agenda','matrix','calendar'];setLayout(ls[(ls.indexOf(APP.prefs.layout||'agenda')+1)%3]);return}
  if(k==='?'){openModal(V.kbdModal());return}
});
window.addEventListener('resize',()=>{if(pop&&pop._anchor&&pop._anchor.isConnected)place(pop,pop._anchor);else closePop()});
window.addEventListener('hashchange',()=>{const hv=location.hash.slice(1);if(VIEWFN[hv]&&hv!==APP.view){APP.view=hv;closePop();render()}});
window.addEventListener('scroll',e=>{if(!pop)return;if(e.target&&e.target.nodeType===1&&pop.contains(e.target))return;if(anchorGone(pop._anchor)){const ae=document.activeElement;closePop();if(ae&&ae.id==='ddQ')ae.blur();return}place(pop,pop._anchor)},{passive:true,capture:true});
window.addEventListener('beforeunload',()=>{if(saveT)saveNow()});

async function loadConfig(){
  if(location.protocol==='file:')return;
  try{const r=await fetchFirst(['data/app-config.json','data/app-config.json.txt']);APP.config=Object.assign({},CFG_DEFAULT,JSON.parse(r.txt))}catch(e){}
}
async function boot(){
  await loadConfig();
  APP.ix=Store.index();
  APP.prefs=Object.assign({lang:'en',theme:'light',layout:'agenda'},APP.ix.prefs||{});
  if(!APP.ix.prefs||!APP.ix.prefs.theme){try{if(matchMedia('(prefers-color-scheme: dark)').matches)APP.prefs.theme='dusk'}catch(e){}}
  applyLook();
  let ws=APP.ix.active&&Store.load(APP.ix.active);
  if(!ws&&APP.ix.list.length){for(const it of APP.ix.list){ws=Store.load(it.id);if(ws)break}}
  let migrated=false;
  if(!ws){
    const lg=Store.legacy();
    if(lg){try{ws=M.migrateLegacy(lg);migrated=true;if(lg.settings&&lg.settings.lang)APP.prefs.lang=lg.settings.lang}catch(e){ws=null}}
    if(!ws){ws=M.TEMPLATES.field();const d=new Date();ws.scope={mode:'month',start:fISO(new Date(d.getFullYear(),d.getMonth(),1)),end:''};APP._firstRun=true}
  }
  applyLook();
  const hv=location.hash.slice(1);if(VIEWFN[hv])APP.view=hv;
  APP.ws=ws;
  Store.save(ws,APP.ix);
  render();
  if(migrated)toast(t('migrated'));
  const hasDs=APP.ix.list.some(x=>x.template==='dataset');
  if(location.protocol==='file:'){if(!ws.sites.length||APP._firstRun)toast(t('fileProto'),'warn',{label:t('impDataset'),fn:()=>pickFile('wsJson','.json,.txt,application/json')})}
  else if(APP._firstRun||!ws.sites.length||(!hasDs&&!APP.prefs.dsBooted)){APP._firstRun=false;APP.prefs.dsBooted=true;loadDataset(true);return}
  if(!ws.plan&&APP.compiled().P.V)solve({quiet:true});
  checkSource();
}
boot();
})(window);
