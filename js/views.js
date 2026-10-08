(function(G){
'use strict';
const M=G.MV,{esc,byId,pISO,fISO,addISO,dowOf,todayISO,sum,avg,gini,clamp,daysIn,dayCfg,rangeOf,weekStartOf}=M;
const {t,arr}=G.I18N;
const A=()=>G.APP;
const ic=(n,c)=>'<svg class="ic '+(c||'')+'" aria-hidden="true"><use href="#'+n+'"/></svg>';
const L=()=>G.I18N.lang();
const fmtD=iso=>{const d=pISO(iso);return arr('dows')[d.getDay()]+' '+d.getDate()+' '+arr('months')[d.getMonth()]};
const fmtDL=iso=>{const d=pISO(iso);return arr('dows')[d.getDay()]+' · '+d.getDate()+' '+arr('monthsL')[d.getMonth()]+' '+d.getFullYear()};
const fmtDS=iso=>{const d=pISO(iso);return d.getDate()+' '+arr('months')[d.getMonth()]};
const unitL=()=>{const u=A().ws.unit;return L()==='ar'?(u==='mi'?'ميل':'كم'):u};
const r1=x=>Math.round(x*10)/10;
const fmtN=x=>{const v=Math.round(x*10)/10;return (Math.abs(v)>=1000?Math.round(v).toLocaleString('en'):String(v))};
const fmtMs=ms=>ms<1000?ms+' ms':(ms/1000).toFixed(1)+' s';
const fill=(v,mn,mx)=>((v-mn)/(mx-mn)*100)+'%';
const swBtn=(on,act,attrs,sm)=>'<button class="sw'+(sm?' sm':'')+(on?' on':'')+'" role="switch" aria-checked="'+(on?'true':'false')+'" data-act="'+act+'" '+(attrs||'')+'></button>';
const stepper=(act,attrs,v)=>'<div class="step"><button data-act="'+act+'" '+attrs+' data-d="-1" aria-label="−">'+ic('ic-minus')+'</button><span class="v">'+v+'</span><button data-act="'+act+'" '+attrs+' data-d="1" aria-label="+">'+ic('ic-plus')+'</button></div>';
const wdChips=(days,act,attrs)=>{const n=arr('dows1');const ws=A().ws.rules.weekStart;let h='<div class="wds">';for(let k=0;k<7;k++){const i=(ws+k)%7;h+='<button class="wd'+(days[i]?' on':'')+'" data-act="'+act+'" '+attrs+' data-i="'+i+'" title="'+esc(arr('dows')[i])+'">'+n[i]+'</button>'}return h+'</div>'};
const DD=new Map();let ddN=0;
function dd(bind,attrs,val,opts,o){
  o=o||{};
  const id='d'+(ddN++);DD.set(id,{bind,opts,val:String(val==null?'':val),search:o.search!=null?o.search:opts.length>9});
  const cur=opts.find(x=>String(x[0])===String(val));
  const sw=x=>x&&x[2]?'<span class="dot" style="--c:'+esc(x[2])+'"></span>':'';
  const lab=cur&&!o.ph?cur[1]:(o.ph||'—');
  return '<button type="button" class="dd'+(o.cls?' '+o.cls:'')+(cur&&!o.ph?'':' ph')+'" data-act="dd" data-dd="'+id+'" data-bind="'+esc(bind)+'" '+(attrs||'')+(o.title?' title="'+esc(o.title)+'"':'')+' aria-haspopup="listbox">'+(o.ph?'':sw(cur))+'<span class="ddv">'+esc(lab)+'</span>'+ic('ic-chev','ddc')+'</button>';
}
function ddPop(id,q){
  const st=DD.get(id);if(!st)return '';
  q=(q||'').trim().toLowerCase();
  const list=st.opts.map((x,i)=>[x,i]).filter(([x])=>!q||String(x[1]).toLowerCase().includes(q)||String(x[3]||'').toLowerCase().includes(q));
  return (st.search?'<div class="ddsearch">'+ic('ic-search')+'<input id="ddQ" autocomplete="off" placeholder="'+esc(t('search'))+'" value="'+esc(q)+'"></div>':'')
    +'<div class="ddlist" role="listbox">'+(list.length?list.map(([x,i])=>'<button type="button" class="ddopt'+(String(x[0])===st.val?' on':'')+'" data-act="ddPick" data-i="'+i+'" role="option">'+(x[2]?'<span class="dot" style="--c:'+esc(x[2])+'"></span>':'')+'<span class="ddl">'+esc(x[1])+'</span>'+(x[3]?'<small>'+esc(x[3])+'</small>':'')+(String(x[0])===st.val?ic('ic-check','ddok'):'')+'</button>').join(''):'<div class="ddnone">'+esc(t('noMatch'))+'</div>')+'</div>';
}
const lvlOpts=()=>M.LEVELS.map(v=>[v,v+' · '+t('lvl'+v)]);
const lvlChip=v=>'<span class="lvl l'+v+'" title="'+esc(t('lvl'+v))+'">'+v+'</span>';
const locOf=id=>byId(A().ws.locations||[],id);
const locOpts=(none)=>[['',none||t('noLoc')]].concat((A().ws.locations||[]).slice().sort((a,b)=>a.km-b.km||a.name.localeCompare(b.name)).map(l=>[l.id,l.name,null,r1(l.km)+' '+unitL()]));
const catOf=id=>byId(A().ws.categories,id);
const roleOf=id=>byId(A().ws.roles,id);
const catColor=id=>{const c=catOf(id);return c?c.color:'#999'};
const ctag=c=>c?'<span class="ctag" style="--c:'+esc(c.color)+'">'+esc(c.name)+'</span>':'';

function derive(){
  const ws=A().ws,pl=ws.plan;
  if(!pl||!pl.res||!pl.map)return null;
  if(pl.derived&&pl.derived._ws===ws.updated)return pl.derived;
  const m=pl.map,r=pl.res;
  const siteOfV=v=>{const i=r.siteOf[v];return i>=0?byId(ws.sites,m.sites[i]):null};
  const personOfZ=z=>{const i=r.seatP[z];return i>=0?byId(ws.people,m.people[i]):null};
  const byDay=m.days.map(()=>[]);
  m.visits.forEach((v,vi)=>{if(v.opt&&r.siteOf[vi]<0)return;byDay[v.d].push(vi)});
  const pd={};
  m.seats.forEach((s,z)=>{const p=r.seatP[z];if(p<0||!r.stats.active[z])return;const pid=m.people[p],d=m.visits[s.v].d;(pd[pid+'|'+d]=pd[pid+'|'+d]||[]).push(z)});
  const flagged=new Set(),dayIss=new Set();
  const iss=(r.issues||[]).map(x=>Object.assign({},x));
  iss.forEach(x=>{
    if(x.v!=null)dayIss.add(m.visits[x.v].d);
    if(x.d!=null)dayIss.add(x.d);
    if(x.k==='rest'||x.k==='run'){flagged.add(m.people[x.p]+'|'+x.d1);flagged.add(m.people[x.p]+'|'+x.d2);dayIss.add(x.d2)}
    if(x.k==='perday'||x.k==='unavail')flagged.add(m.people[x.p]+'|'+(x.d!=null?x.d:m.visits[x.v].d));
  });
  const loads={};m.people.forEach((pid,i)=>loads[pid]=r.stats.loads[i]);
  const targets={};m.people.forEach((pid,i)=>targets[pid]=m.pTarget[i]);
  const uses={};m.sites.forEach((sid,i)=>uses[sid]=r.stats.siteUse[i]);
  const goalIx={};
  const gr=r.stats.goalRes||[];
  (m.goalOf||[]).forEach((gid,qi)=>{const x=gr[qi],g=byId(ws.goals,gid);if(!x||!g||g.kind==='inject')return;
    const single=x.n===1&&g.per==='total'&&g.period!=='week';
    goalIx[gid]={met:x.met===x.n,txt:single?x.sum+' / '+(g.op==='between'?g.n+'–'+g.n2:g.op==='max'?(g.n===0?t('gNone'):'≤ '+g.n):g.n):x.met+'/'+x.n,tip:t('gProgTip',{met:x.met,n:x.n,s:x.short,o:x.over})}});
  (ws.goals||[]).forEach(g=>{if(!g.on||g.kind!=='inject'||goalIx[g.id])return;let n=0,bad=0;m.visits.forEach((v,vi)=>{if(v.inj!==g.id||r.siteOf[vi]<0)return;n++;if((r.issues||[]).some(x=>x.v===vi&&(x.k==='injwho'||x.k==='injset')))bad++});const want=g.inject.mode==='pick'?g.inject.n:m.visits.filter(v=>v.inj===g.id).length;goalIx[g.id]={met:!bad&&n>0&&n===want,txt:n+' / '+want+'×'}});
  const D={m,r,siteOfV,personOfZ,byDay,pd,flagged,dayIss,iss,loads,targets,uses,goalIx,_ws:ws.updated};
  Object.defineProperty(pl,'derived',{value:D,enumerable:false,configurable:true,writable:true});
  return D;
}

function issueText(x,D){
  const ws=A().ws,m=D.m;
  const pn=i=>{const p=byId(ws.people,m.people[i]);return p?p.name:'—'};
  const sn=i=>{const s=byId(ws.sites,m.sites[i]);return s?s.name:'—'};
  const dn=i=>fmtD(m.days[i].iso);
  const vd=v=>fmtD(m.days[m.visits[v].d].iso);
  const vs=v=>{const s=D.siteOfV(v);return s?s.name:'—'};
  const rn=i=>{const r=roleOf(m.roles[i]);return r?r.name:'—'};
  switch(x.k){
    case 'nosite':return t('i_nosite',{d:vd(x.v),k:m.visits[x.v].k+1});
    case 'siteoff':return t('i_siteoff',{d:vd(x.v),s:sn(x.s)});
    case 'open':return t('i_open',{d:vd(x.v),s:vs(x.v),n:x.n,r:rn(x.r)});
    case 'rest':return t('i_rest',{p:pn(x.p),d1:dn(x.d1),d2:dn(x.d2),n:x.n});
    case 'run':return t('i_run',{p:pn(x.p),d1:dn(x.d1),d2:dn(x.d2),n:x.n});
    case 'rankgap':return t('i_rankgap',{s:sn(x.s),d:vd(x.v),n:x.n,max:x.max});
    case 'goal':{const g=byId(ws.goals,m.goalOf&&m.goalOf[x.q]);const unit=x.per===0?sn(x.u):x.per===2?pn(x.u):'';const wk=x.nw>1&&m.weeks?t('gWeekOf',{d:fmtDS(m.weeks[x.w])}):'';
      const want=x.hi<0?'≥ '+x.lo:x.lo===x.hi?'= '+x.lo:x.lo>0?x.lo+'–'+x.hi:'≤ '+x.hi;
      return t('i_goal',{g:g?goalText(g):'—',u:[unit,wk].filter(Boolean).join(' · '),n:x.n,want}).replace(' ()','')}
    case 'injwho':{const g=byId(ws.goals,x.gid);return t('i_injwho',{d:vd(x.v),s:vs(x.v),n:x.n,min:x.min,g:g?goalText(g):'—'})}
    case 'injset':return t('i_injset',{d:vd(x.v),s:vs(x.v)});
    case 'perday':return t('i_perday',{p:pn(x.p),n:x.n,d:dn(x.d)});
    case 'maxload':return t('i_maxload',{p:pn(x.p),n:x.n,max:x.max});
    case 'maxweek':return t('i_maxweek',{p:pn(x.p),n:x.n,max:x.max});
    case 'ban':return t('i_ban',{p:pn(x.p),s:sn(x.s),d:vd(x.v)});
    case 'unavail':return t('i_unavail',{p:pn(x.p),d:dn(x.d)});
    case 'sitemax':return t('i_sitemax',{s:sn(x.s),n:x.n,max:x.max});
    case 'sitemin':return t('i_sitemin',{s:sn(x.s),n:x.n,min:x.min});
    case 'sitegap':return t('i_sitegap',{s:sn(x.s),d1:dn(x.d1),d2:dn(x.d2)});
    case 'dup':return t('i_dup',{s:sn(x.s),d:dn(x.d)});
    case 'avoid':return t('i_avoid',{p:pn(x.p),q:pn(x.q),s:vs(x.v),d:vd(x.v)});
    case 'rulesite':case 'rulesoft':return t('i_rulesite',{p:pn(x.p),s:sn(x.s),d:vd(x.v),r:bn(x.b)});
    case 'ruleday':return t('i_ruleday',{p:pn(x.p),d:vd(x.v),r:bn(x.b)});
    case 'rulewith':case 'rulewithsoft':return t('i_rulewith',{p:pn(x.p),q:pn(x.q),s:vs(x.v),d:vd(x.v),r:bn(x.b)});
    case 'ruleteam':return t('i_ruleteam',{s:sn(x.s),d:vd(x.v),n:x.n,max:x.max,r:bn(x.b)});
    case 'rulecount':return t(x.w?'i_rulecountW':'i_rulecount',{p:pn(x.p),n:x.n,max:x.max,w:x.w,r:bn(x.b)});
    case 'rcearly':return t('i_rcearly',{s:sn(x.s),n:x.n,min:x.min});
    case 'rclate':return t('i_rclate',{s:sn(x.s),n:x.n,max:x.max});
    case 'rcover':return t('i_rcover',{s:sn(x.s),n:x.n,max:x.max});
    case 'rcnever':return t('i_rcnever',{s:sn(x.s)});
    case 'rcperson':return t('i_rcperson',{p:pn(x.p),s:sn(x.s),n:x.n,min:x.min});
  }
  return x.k;
  function bn(i){const id=m.book&&m.book[i];const r=id&&byId(ws.book||[],id);return r?ruleText(r):'—'}
}
function issueDay(x,D){
  if(x.v!=null)return D.m.days[D.m.visits[x.v].d].iso;
  if(x.d!=null)return D.m.days[x.d].iso;
  if(x.d2!=null)return D.m.days[x.d2].iso;
  return null;
}
function warnText(w){
  const rn=id=>{const r=roleOf(id);return r?r.name:'—'};
  switch(w.k){
    case 'nodays':return t('w_nodays');
    case 'nosites':return t('w_nosites');
    case 'norole':return t('w_norole',{r:rn(w.r)});
    case 'capacity':return t('w_capacity',{r:rn(w.r),need:w.need,cap:w.cap});
    case 'minover':{const c=catOf(w.c);return t('w_minover',{c:c?c.name:'—',need:w.need,have:w.have})}
    case 'tight':return t('w_tight',{r:rn(w.r),d1:fmtD(w.d1),d2:fmtD(w.d2),need:w.need,free:w.free});
    case 'goalshort':return t('w_goalshort',{need:w.need,have:w.have});
    case 'injbusy':return t('w_injbusy',{g:goalText(byId(A().ws.goals,w.g)),n:w.n});
    case 'goalnone':case 'goalnoday':case 'goalnop':case 'injout':return t('w_'+w.k,{g:goalText(byId(A().ws.goals,w.g))});
    case 'goalcap':{const p=byId(A().ws.people,w.p);return t('w_goalcap',{g:goalText(byId(A().ws.goals,w.g)),p:p?p.name:'—',need:w.need,cap:w.cap})}
    case 'goalk':return t('w_goalk',{g:goalText(byId(A().ws.goals,w.g)),n:w.n,k:w.k});
    case 'goalplaces':return t('w_goalplaces',{g:goalText(byId(A().ws.goals,w.g)),need:w.need,have:w.have});
    case 'rankgap':return t('w_rankgap',{n:w.n,ex:w.ex});
    case 'rulenone':return t('w_rulenone',{r:ruleText(byId(A().ws.book||[],w.b))});
    case 'ruleteam':return t('w_ruleteam',{r:ruleText(byId(A().ws.book||[],w.b)),n:w.n,have:w.have});
    case 'rcnohist':return t('w_rcnohist');
    case 'rcblocked':return t('w_rcblocked',{n:w.n});
  }
  return w.k;
}

function mast(){
  const a=A(),ws=a.ws;
  const pl=ws.plan;
  return '<button class="palbtn" data-act="palette" aria-label="'+esc(t('palette'))+'">'+ic('ic-search')+'<span>'+esc(t('palette'))+'</span><kbd>Ctrl K</kbd></button>'
    +'<button class="ibtn" data-act="undo" title="'+esc(t('undo'))+' (Ctrl Z)" '+(a.hist.u.length?'':'disabled style="opacity:.4"')+'>'+ic('ic-undo')+'</button>'
    +'<button class="ibtn" data-act="redo" title="'+esc(t('redo'))+' (Ctrl Shift Z)" '+(a.hist.r.length?'':'disabled style="opacity:.4"')+'>'+ic('ic-redo')+'</button>'
    +'<button class="ibtn" data-act="theme" title="'+esc(t('themeT'))+'">'+ic(a.prefs.theme==='dusk'?'ic-sun':'ic-moon')+'</button>'
    +'<div class="seg mini" role="group" aria-label="language"><button class="'+(L()==='en'?'on':'')+'" data-act="lang" data-v="en">EN</button><button class="'+(L()==='ar'?'on':'')+'" data-act="lang" data-v="ar">ع</button></div>'
    +'<div class="seedchip mono">'+esc(t('seed'))+' <b>'+ws.engine.seed+'</b></div>';
}
function tagline(){
  const ws=A().ws;
  return '<span>'+esc(t('tagline'))+'</span><span>·</span><button class="wsbtn" data-act="tab" data-view="workspace">'+esc(ws.name)+ic('ic-chev')+'</button>';
}
function tabs(){
  const v=A().view,ws=A().ws;
  const D=derive();const nIss=D&&!A().isStale()?D.iss.filter(x=>x.sev!=='info').length:0;
  const T=TABS;
  return T.map(([k,i,l],n)=>'<button class="tab'+(v===k?' on':'')+'" role="tab" aria-selected="'+(v===k)+'" data-act="tab" data-view="'+k+'" title="'+esc(t(l))+' ('+(n+1)+')">'+ic(i)+'<span class="tablab">'+esc(t(l))+'</span>'+(k==='plan'&&nIss?'<span class="badge">'+nIss+'</span>':'')+'</button>').join('');
}

const TABS=[['plan','ic-cal','tabPlan'],['sites','ic-build','tabSites'],['people','ic-users','tabPeople'],['history','ic-hist','tabHist'],['rules','ic-sliders','tabRules'],['model','ic-sigma','tabModel'],['insights','ic-chart','tabInsights'],['workspace','ic-layers','tabWs']];
function ringSvg(f){const c=2*Math.PI*9;return '<svg class="ring" viewBox="0 0 22 22"><circle class="bg" cx="11" cy="11" r="9"/><circle class="fg" cx="11" cy="11" r="9" stroke-dasharray="'+c+'" stroke-dashoffset="'+(c*(1-f))+'"/></svg>'}
function statusHTML(){
  const a=A(),ws=a.ws;
  if(a.solving)return ringSvg(a.solving.f||0)+'<span>'+esc(t('solving'))+' '+Math.round((a.solving.f||0)*100)+'%</span>';
  const pl=ws.plan;if(!pl||!pl.res)return '';
  const D=derive();const n=D.iss.filter(x=>x.sev!=='info').length;
  return (n?'<span class="chip warn">'+ic('ic-alert')+t('nIssues',{n})+'</span>':'<span class="chip good">'+ic('ic-check')+esc(t('allClean'))+'</span>')
    +'<span class="mono tiny muted">'+esc(t('cost'))+' '+fmtN(pl.res.cost)+' · '+esc(t('solvedIn',{ms:fmtMs(pl.res.ms)}))+'</span>';
}

function planView(){
  const a=A(),ws=a.ws;const {start,end}=rangeOf(ws);
  const list=daysIn(start,end).map(iso=>({iso,cfg:dayCfg(ws,iso)}));
  if(!a.selDay||!list.some(d=>d.iso===a.selDay))a.selDay=(list.find(d=>d.cfg.on)||list[0]).iso;
  const work=list.filter(d=>d.cfg.on&&d.cfg.n>0);
  const pdays=M.planDays(ws,true);const pdn={};pdays.forEach(d=>pdn[d.iso]=d.n);
  const V=sum(pdays.map(d=>d.n));
  const C=a.compiled();
  const D=derive();const stale=a.isStale();
  const td=todayISO();
  const tiles=list.map(d=>{
    const on=d.cfg.on&&d.cfg.n>0,sel=d.iso===a.selDay,nn=pdn[d.iso]!=null?pdn[d.iso]:0;
    let dots='';
    if(on){dots=nn<=4?'<i></i>'.repeat(nn):'<b>'+nn+'</b>';
      if(d.cfg.focus==='near')dots+=ic('ic-pin');
      else if(d.cfg.focus==='far')dots+='<b>↗</b>';
      else if(d.cfg.focus!=='auto'&&catOf(d.cfg.focus))dots+='<span class="dot" style="--c:'+esc(catColor(d.cfg.focus))+';width:6px;height:6px"></span>';}
    let hasI=false;
    if(D&&!stale){const di=D.m.days.findIndex(x=>x.iso===d.iso);if(di>=0&&D.dayIss.has(di))hasI=true}
    return '<button class="tile'+(on?'':' off')+(sel?' sel':'')+(d.cfg.over?' ov':'')+(d.iso===td?' today':'')+(hasI?' hasiss':'')+'" data-act="tile" data-iso="'+d.iso+'" title="'+esc(fmtDL(d.iso)+' · '+(on?t('nVisits',{n:d.cfg.n}):t('dayOff')))+'"><span class="dw">'+arr('dows')[dowOf(d.iso)]+'</span><span class="dn">'+pISO(d.iso).getDate()+'</span><span class="tdots">'+dots+'</span></button>';
  }).join('');
  const sd=list.find(d=>d.iso===a.selDay);
  const focusOpts=[['auto',t('fAuto')],['near',t('fNear')],['far',t('fFar')]].concat(ws.categories.filter(c=>c.planned).map(c=>[c.id,c.name]));
  const dayEdit=sd?'<div class="day-edit noprint"><div class="de-date"><b>'+esc(fmtDL(sd.iso))+'</b><span>'+esc(sd.cfg.over?t('overridden'):t('followsWeek'))+'</span></div>'
    +'<div class="de-ctl"><span class="lbl">'+esc(sd.cfg.on?t('dayOn'):t('dayOff'))+'</span>'+swBtn(sd.cfg.on,'dayOn','data-iso="'+sd.iso+'"')+'</div>'
    +(sd.cfg.on?'<div class="de-ctl"><span class="lbl">'+esc(t('visitsLbl'))+'</span>'+stepper('dayN','data-iso="'+sd.iso+'"',sd.cfg.n)+'</div>'
      +'<div class="de-ctl"><span class="lbl">'+esc(t('focus'))+'</span>'+dd('dayFocus','data-iso="'+sd.iso+'"',sd.cfg.focus,focusOpts)+'</div>':'')
    +(sd.cfg.over?'<button class="linkbtn" data-act="dayReset" data-iso="'+sd.iso+'">'+ic('ic-undo')+esc(t('resetDay'))+'</button>':'')+'</div>':'';
  const sm=ws.scope.mode;
  const scope='<section class="card noprint" id="scope-card"><div class="card-head"><div><div class="kicker">'+esc(t('kScope'))+'</div><h2 class="ctitle">'+esc(t('planWindow'))+'</h2></div>'
    +'<div class="seg" role="group">'+['week','month','custom'].map(k=>'<button class="'+(sm===k?'on':'')+'" data-act="scopeMode" data-v="'+k+'">'+esc(t(k))+'</button>').join('')+'</div></div>'
    +'<div class="scope-row"><label class="fld"><span>'+esc(t('start'))+'</span>'+dpkTrigger('scopeStart',sm==='month'?start:ws.scope.start,sm==='month'?'month':'')+'</label>'
    +(sm==='custom'?'<label class="fld"><span>'+esc(t('end'))+'</span>'+dpkTrigger('scopeEnd',end)+'</label><div class="fld"><span>'+esc(t('lenDays'))+'</span>'+stepper('scopeLen','',M.diffDays(start,end)+1)+'</div>':'')
    +'<div class="navpair"><button class="ibtn" data-act="scopeShift" data-d="-1" title="'+esc(t('prevW'))+'">'+ic('ic-chevl','flip')+'</button><button class="btn sm ghost" data-act="scopeToday">'+esc(t('thisW'))+'</button><button class="ibtn" data-act="scopeShift" data-d="1" title="'+esc(t('nextW'))+'">'+ic('ic-chevr','flip')+'</button></div>'
    +'<div class="scope-stats"><span class="chip">'+esc(t('nWork',{n:work.length}))+'</span><span class="chip">'+esc(t('nVisits',{n:V}))+'</span><span class="chip">'+esc(t('nPeopleA',{n:C.P.N}))+'</span></div></div>'
    +'<div class="ribbon" id="ribbon">'+tiles+'</div>'+dayEdit
    +'<div class="cta-row"><button class="btn primary" data-act="solve">'+ic('ic-wand')+esc(t('solve'))+'<kbd>G</kbd></button>'
    +'<button class="btn" data-act="reroll">'+ic('ic-dice')+esc(t('reroll'))+'<kbd>R</kbd></button>'
    +'<button class="btn" data-act="export">'+ic('ic-down')+esc(t('exportB'))+'<kbd>E</kbd></button>'
    +'<button class="btn ghost" data-act="print">'+ic('ic-print')+esc(t('print'))+'</button>'
    +'<div class="status" id="status">'+statusHTML()+'</div></div></section>';
  return scope+recipeCard(ws,pdays,V,C)+scheduleCard(C,D,stale);
}
const NUM_K=['rankGe','rankLe','critGe','critLe','kmGe','kmLe'];
function whenLabel(w){
  if(!w||w.k==='all')return '';
  if(w.k==='dow')return w.v.map((x,i)=>x?arr('dows')[i]:null).filter(Boolean).join(', ')||'—';
  return w.v||'—';
}
function goalWhat(g){return g.what.k==='all'&&!g.what.more?t('g_allSites'):mLabel(g.what)}
function goalWho(g){return g.who.k==='all'?'':mLabel(g.who,true)}
function goalText(g){
  if(!g)return '—';
  if(g.label)return g.label;
  const wl=whenLabel(g.when),who=goalWho(g);
  if(g.kind==='inject'){
    const when=g.inject.mode==='dates'?(g.inject.dates||'—'):(wl||t('gw_all'));
    return t('gt_inject',{n:g.inject.n,what:goalWhat(g),when})+(who?' · '+t('g_with')+' '+who:'');
  }
  const b=g.op==='between'?g.n+'–'+g.n2:g.n;
  const head=g.per==='each'?t('gt_each',{what:goalWhat(g)}):g.per==='person'?t('gt_person',{who:who||t('bw_all'),what:goalWhat(g)}):t('gt_total',{what:goalWhat(g)});
  const withTxt=g.per!=='person'&&who?' · '+(g.mode==='together'?t('gt_together',{k:g.k,who}):t('g_with')+' '+who):'';
  return head+withTxt+(wl?' · '+wl:'')+': '+(g.op==='between'?t('op_between'):t('op_'+g.op))+' '+b+' '+t(g.measure==='places'?'gms_places':'gms_visits')+(g.period==='week'?' '+t('gpd_week'):'')+(g.hard?' 🔒':'');
}
function gPicker(g,side,isWho){
  const m=g[side];
  let h='<span class="mgrp">'+gPicker1(g,side,m,isWho,'');
  (m.more||[]).forEach((c,i)=>{h+='<button class="joinbtn" data-act="goalJoin" data-id="'+g.id+'" data-side="'+side+'">'+esc(t(m.join==='or'?'bj_or':'bj_and'))+'</button>'+gPicker1(g,side,c,isWho,i)+'<button class="ibtn xs" data-act="goalLess" data-id="'+g.id+'" data-side="'+side+'" data-i="'+i+'" title="'+esc(t('remove'))+'">'+ic('ic-x')+'</button>'});
  if(m.k!=='all'&&(m.more||[]).length<3)h+='<button class="ibtn xs" data-act="goalMore" data-id="'+g.id+'" data-side="'+side+'" title="'+esc(t('bMore'))+'">'+ic('ic-plus')+'</button>';
  return h+'</span>';
}
function gPicker1(g,side,m,isWho,mi){
  const kOpts=(isWho?whoKOpts():whatKOpts()).filter(o=>mi===''||o[0]!=='all');
  const at='data-id="'+g.id+'" data-side="'+side+'"'+(mi===''?'':' data-mi="'+mi+'"');
  let h=(m.k!=='all'?'<button class="notbtn'+(m.not?' on':'')+'" data-act="goalNot" '+at+' title="'+esc(t('bNotT'))+'">'+esc(t('bNot'))+'</button>':'')+dd('goalM',at+' data-f="k"',m.k,kOpts,{cls:'bdd'});
  if(m.k==='all')return h;
  if(NUM_K.includes(m.k)){
    const v=Array.isArray(m.v)?m.v[0]:m.v;
    if(m.k==='kmGe'||m.k==='kmLe')return h+'<span class="numwrap"><input class="inp num s" type="number" min="0" data-bind="goalNum" '+at+' value="'+esc(v)+'"><span class="unit">'+unitL()+'</span></span>';
    return h+dd('goalM',at+' data-f="v"',v,lvlSel(),{cls:'bdd'});
  }
  const vo=isWho?whoVOpts(m.k):goalWhatVOpts(m.k);
  const vals=Array.isArray(m.v)?m.v:(m.v?[m.v]:[]);
  const lab=x=>{const o=vo.find(y=>String(y[0])===String(x));return o?o[1]:x};
  h+='<span class="vchips">'+vals.map((x,i)=>(i?'<span class="vor">'+esc(t('bj_or'))+'</span>':'')+'<span class="vchip">'+esc(lab(x))+'<button data-act="goalDelV" '+at+' data-v="'+esc(x)+'" aria-label="'+esc(t('remove'))+'">'+ic('ic-x')+'</button></span>').join('');
  const rest=vo.filter(o=>!vals.includes(String(o[0])));
  if(rest.length)h+=dd('goalAddV',at,'',rest,{ph:vals.length?'+':t('pick'),cls:'bdd adddd'+(vals.length?' plus':''),search:rest.length>8});
  return h+'</span>';
}
function whenPicker(g,w,f){
  const id=g.id;
  let h='<div class="seg mini">'+[['all','gw_all'],['dow','gw_dow'],['dates','gw_dates']].map(([k,l])=>'<button class="'+(w.k===k?'on':'')+'" data-act="goalWhen" data-id="'+id+'" data-v="'+k+'">'+esc(t(l))+'</button>').join('')+'</div>';
  if(w.k==='dow'){const n=arr('dows1'),w0=A().ws.rules.weekStart;h+='<div class="wds">';for(let k=0;k<7;k++){const i=(w0+k)%7;h+='<button class="wd'+(w.v[i]?' on':'')+'" data-act="goalDow" data-id="'+id+'" data-i="'+i+'" title="'+esc(arr('dows')[i])+'">'+n[i]+'</button>'}h+='</div>'}
  else if(w.k==='dates')h+='<input class="inp slim bdates" dir="ltr" data-bind="goalWhenDates" data-id="'+id+'" value="'+esc(w.v)+'" placeholder="2026-10-06, 2026-10-12..2026-10-15">';
  return h;
}
function goalRow(g,res){
  const ws=A().ws,id=g.id;
  const kOpts=[['count',t('gk_count')],['inject',t('gk_inject')]];
  let s='';
  if(g.kind==='inject'){
    s='<div class="gline">'+dd('goal','data-id="'+id+'" data-f="kind"',g.kind,kOpts,{cls:'bdd rel'})
      +stepper('goalN','data-id="'+id+'" data-k="injN"',g.inject.n)+'<span class="gw">'+esc(t('gi_visitsTo'))+'</span>'+gPicker(g,'what',false)+'</div>'
      +'<div class="gline sub"><span class="gw">'+esc(t('g_on'))+'</span><div class="seg mini">'+[['dates','gi_fixed'],['pick','gi_pick']].map(([k,l])=>'<button class="'+(g.inject.mode===k?'on':'')+'" data-act="goalInj" data-id="'+id+'" data-v="'+k+'">'+esc(t(l))+'</button>').join('')+'</div>'
      +(g.inject.mode==='dates'?'<input class="inp slim bdates" dir="ltr" data-bind="goalInjDates" data-id="'+id+'" value="'+esc(g.inject.dates)+'" placeholder="2026-10-14, 2026-10-21">':'<span class="gw">'+esc(t('gi_within'))+'</span>'+whenPicker(g,g.when))
      +'</div>'
      +'<div class="gline sub"><span class="gw">'+esc(t('gi_each'))+'</span>'+dd('goal','data-id="'+id+'" data-f="iper"',g.inject.per,[['any',t('gi_perAny')],['each',t('gi_perEach')]],{cls:'bdd'})
      +(g.inject.mode==='pick'?dd('goal','data-id="'+id+'" data-f="iop"',g.inject.op,[['exact',t('op_exact')],['min',t('op_min')],['max',t('op_max')],['between',t('op_between')]],{cls:'bdd'})+(g.inject.op==='between'?'<span class="gw">–</span>'+stepper('goalN','data-id="'+id+'" data-k="injN2"',g.inject.n2):''):'')
      +dd('goal','data-id="'+id+'" data-f="iadd"',g.inject.add,[['extra',t('gi_extra')],['replace',t('gi_replace')]],{cls:'bdd'})+'</div>'
      +'<div class="gline sub"><span class="gw">'+esc(t('gi_team'))+'</span>'+gPicker(g,'who',true)
      +(g.who.k!=='all'?dd('goal','data-id="'+id+'" data-f="mode"',g.mode,[['any',t('gm_any')],['together',t('gm_together')],['all',t('gm_all')],['exact',t('gm_exact')],['only',t('gm_only')]],{cls:'bdd'})+(g.mode==='together'?stepper('goalN','data-id="'+id+'" data-k="k"',g.k):''):'<span class="gw muted">'+esc(t('gi_auto'))+'</span>')+'</div>';
  }else{
    const perOpts=[['each',t('gp_each')],['total',t('gp_total')],['person',t('gp_person')]];
    s='<div class="gline">'+dd('goal','data-id="'+id+'" data-f="kind"',g.kind,kOpts,{cls:'bdd rel'})+dd('goal','data-id="'+id+'" data-f="per"',g.per,perOpts,{cls:'bdd'});
    if(g.per==='person')s+=gPicker(g,'who',true)+'<span class="gw">'+esc(t('g_at'))+'</span>'+gPicker(g,'what',false);
    else s+=gPicker(g,'what',false);
    s+='</div>';
    if(g.per!=='person'){
      s+='<div class="gline sub"><span class="gw">'+esc(t('g_with'))+'</span>'+gPicker(g,'who',true)
        +(g.who.k!=='all'?dd('goal','data-id="'+id+'" data-f="mode"',g.mode==='together'?'together':'any',[['any',t('gm_any')],['together',t('gm_together')]],{cls:'bdd'})+(g.mode==='together'?stepper('goalN','data-id="'+id+'" data-k="k"',g.k):''):'')+'</div>';
    }
    s+='<div class="gline sub"><span class="gw">'+esc(t('g_on'))+'</span>'+whenPicker(g,g.when)+'</div>';
    s+='<div class="gline"><span class="gw">'+esc(t('g_gets'))+'</span>'+dd('goal','data-id="'+id+'" data-f="op"',g.op,[['min',t('op_min')],['exact',t('op_exact')],['max',t('op_max')],['between',t('op_between')]],{cls:'bdd'})
      +stepper('goalN','data-id="'+id+'" data-k="n"',g.n)+(g.op==='between'?'<span class="gw">–</span>'+stepper('goalN','data-id="'+id+'" data-k="n2"',g.n2):'')
      +dd('goal','data-id="'+id+'" data-f="measure"',g.measure,[['visits',t('gms_visits')],['places',t('gms_places')]],{cls:'bdd'})
      +'<div class="seg mini">'+[['plan','gpd_plan'],['week','gpd_week']].map(([k,l])=>'<button class="'+(g.period===k?'on':'')+'" data-act="goalPeriod" data-id="'+id+'" data-v="'+k+'">'+esc(t(l))+'</button>').join('')+'</div></div>';
  }
  let meta='';
  if(g.kind==='count'){
    const set=M.goalSites(ws,g),ppl=M.goalPeople(ws,g);
    meta=g.per==='each'?t('g_sitesX',{n:set.length,v:set.length*(g.op==='max'?0:g.n)}):g.per==='person'?t('g_peopleX',{n:ppl.length,s:set.length}):t('g_sitesIn',{n:set.length});
    if(g.who.k!=='all'&&g.per!=='person')meta+=' · '+t('g_ppl',{n:ppl.length});
  }else meta=t('g_sitesIn',{n:M.goalSites(ws,g).length});
  let prog='';
  if(res)prog='<span class="gprog '+(res.met?'good':'bad')+'" title="'+esc(res.tip||'')+'">'+ic(res.met?'ic-check':'ic-alert')+esc(res.txt)+'</span>';
  const strength=g.hard?'<span class="bstrength hard">'+ic('ic-lock')+esc(t('bHard'))+'</span>':'<span class="bstrength">'+esc(t('bSoft'))+'<input type="range" class="rng sm" min="0" max="100" step="5" value="'+g.w+'" style="--fill:'+g.w+'%" data-bind="goalW" data-id="'+id+'"><span class="wv">'+g.w+'</span></span>';
  return '<div class="goal'+(g.on?'':' off')+(g.hard?' hard':'')+(g.kind==='inject'?' inj':'')+'" data-gid="'+id+'">'+swBtn(g.on,'goalOn','data-id="'+id+'"',true)
    +'<div class="gmain"><div class="gsent">'+s+'</div>'
    +'<div class="bmeta">'+strength+'<span class="gmeta mono tiny">'+esc(meta)+'</span>'+prog+'<input class="inp bare bnote" data-bind="goalLabel" data-id="'+id+'" value="'+esc(g.label||'')+'" placeholder="'+esc(t('gLabelPh'))+'"></div></div>'
    +'<div class="bacts"><button class="ibtn'+(g.hard?' on':'')+'" data-act="goalHard" data-id="'+id+'" title="'+esc(g.hard?t('bMakeSoft'):t('bMakeHard'))+'">'+ic('ic-lock')+'</button>'
    +'<button class="ibtn" data-act="goalDup" data-id="'+id+'" title="'+esc(t('duplicate'))+'">'+ic('ic-copy')+'</button>'
    +'<button class="ibtn" data-act="goalDel" data-id="'+id+'" title="'+esc(t('remove'))+'">'+ic('ic-trash')+'</button></div></div>';
}
const GOAL_TPL=['blank','person','pair','classes','weekly','places','inject','pick'];
function recipeCard(ws,pdays,V,C){
  const sz=ws.sizing,mode=sz.mode;
  const need=M.goalNeed(ws),nOn=ws.goals.filter(g=>g.on).length;
  const rhythmN=sum(pdays.map(d=>d.cfg.n));
  const nPl=M.plannable(ws).length;
  const D=derive(),ok=D&&!A().isStale();
  const gi=D?D.goalIx:null;
  let h='<section class="card noprint" id="recipe-card"><div class="card-head"><div><div class="kicker">'+esc(t('kRecipe'))+'</div><h2 class="ctitle">'+esc(t('recipeT'))+'</h2></div>'
    +'<div class="row">'+dd('preset','',"",[['once',t('pr_once')],['twice',t('pr_twice')],['crit',t('pr_crit')],['fairp',t('pr_fairp')],['weekly',t('pr_weekly')],['clear',t('pr_clear')]],{ph:t('presets'),cls:'ghostdd'})+'</div></div>';
  h+='<div class="sizing"><div class="szq"><span class="lbl">'+esc(t('howMany'))+'</span><div class="seg">'+[['rhythm','sz_rhythm'],['total','sz_total'],['goals','sz_goals']].map(([k,l])=>'<button class="'+(mode===k?'on':'')+'" data-act="sizeMode" data-v="'+k+'">'+esc(t(l))+'</button>').join('')+'</div>'
    +(mode==='total'?'<span class="sznum"><input class="inp num" type="number" min="0" data-bind="sizeTotal" value="'+sz.total+'"></span>':'')+'</div>'
    +'<div class="szsum"><b class="bignum">'+V+'</b><span>'+esc(t('szSum',{d:pdays.filter(d=>d.n>0).length}))+'</span>'
    +(mode==='rhythm'?'<small>'+esc(t('szRhythmN'))+'</small>':mode==='total'?'<small>'+esc(t('szTotalN',{r:rhythmN}))+'</small>':'<small>'+esc(nOn?t('szGoalsN',{n:need}):t('szGoalsNone'))+'</small>')+'</div>'
    +'<div class="szdays"><span class="lbl">'+esc(t('workDays'))+'</span>'+wdChips(ws.week.map(d=>d.on),'weekOn','')+'</div></div>';
  h+='<div class="goals"><div class="grouplbl">'+esc(t('goalsT'))+' <span class="muted mono tiny">'+esc(t('nPlannable',{n:nPl}))+'</span></div>';
  if(!ws.goals.length)h+='<div class="goal-empty">'+ic('ic-target')+'<span>'+esc(t('goalsEmpty'))+'</span></div>';
  ws.goals.forEach(g=>{h+=goalRow(g,ok&&gi?gi[g.id]:null)});
  h+='<div class="row addgoal">'+dd('goalAdd','','',GOAL_TPL.map(k=>[k,t('gtpl_'+k),null,t('gtplD_'+k)]),{ph:'+ '+t('addGoal'),cls:'btn sm adddd'})+'</div></div>'
    +'<p class="quiet">'+ic('ic-info')+esc(t('recipeNote'))+'</p></section>';
  return h;
}
function scheduleCard(C,D,stale){
  const a=A(),ws=a.ws;
  const lay=a.prefs.layout||'agenda';
  const nPins=Object.keys(ws.locks.sites).length+Object.keys(ws.locks.seats).length;
  let h='<section class="card" id="schedule-card"><div class="card-head"><div><div class="kicker">'+esc(t('kSched'))+'</div><h2 class="ctitle">'+esc(ws.name)+' · '+esc(fmtDS(C.map.start))+' – '+esc(fmtDS(C.map.end))+'</h2></div>'
    +'<div class="row noprint">'+(nPins?'<span class="chip">'+ic('ic-lock')+esc(t('nPins',{n:nPins}))+'</span><button class="linkbtn" data-act="clearPins">'+esc(t('clearPins'))+'</button>':'')
    +(D&&!stale?'<button class="linkbtn" data-act="lockAll">'+ic('ic-lock')+esc(t('lockAll'))+'</button>':'')
    +'<div class="seg" role="group">'+[['agenda','ic-list'],['matrix','ic-grid'],['calendar','ic-cal']].map(([k,i])=>'<button class="'+(lay===k?'on':'')+'" data-act="layout" data-v="'+k+'">'+ic(i)+esc(t(k))+'</button>').join('')+'</div></div></div>';
  if(stale&&D&&!a.solving)h+='<div class="banner stale noprint">'+ic('ic-info')+'<span class="grow">'+esc(t('stale'))+'</span><button class="btn sm" data-act="solve">'+ic('ic-wand')+esc(t('resolve'))+'</button></div>';
  if(C.warn.length){
    h+='<details class="issues noprint" '+(D?'':'open')+'><summary>'+ic('ic-info')+esc(t('preflight'))+' <span class="chip warn">'+C.warn.length+'</span>'+ic('ic-chev','chev')+'</summary><div class="issue-list">'
      +C.warn.map(w=>'<div class="issue pre warn">'+ic('ic-alert')+'<span>'+esc(warnText(w))+'</span></div>').join('')+'</div></details>';
  }
  if(D&&!stale&&D.iss.length){
    const order={error:0,warn:1,info:2};
    const iss=D.iss.slice().sort((x,y)=>order[x.sev]-order[y.sev]);
    const nE=iss.filter(x=>x.sev!=='info').length;
    h+='<details class="issues noprint"'+(a.issuesOpen?' open':'')+' id="issuesBox"><summary data-act="issuesToggle">'+ic('ic-alert')+esc(t('issues'))+' <span class="chip '+(nE?'bad':'')+'">'+iss.length+'</span>'+ic('ic-chev','chev')+'</summary><div class="issue-list">'
      +iss.slice(0,300).map(x=>{const di=issueDay(x,D);return '<div class="issue '+x.sev+'" data-act="gotoDay" data-iso="'+(di||'')+'">'+ic(x.sev==='info'?'ic-info':'ic-alert')+'<span>'+esc(issueText(x,D))+'</span></div>'}).join('')+'</div></details>';
  }
  if(!D){
    h+='<div class="empty-state">'+ic('ic-cal','bigic')+'<h3 class="ctitle">'+esc(C.P.V?t('noPlan'):t('nothing'))+'</h3><p>'+esc(t('noPlanTxt'))+'</p>'+(C.P.V?'<button class="btn primary" data-act="solve">'+ic('ic-wand')+esc(t('solve'))+'</button>':'')+'</div>';
    return h+'</section>';
  }
  if(!D.m.visits.length){h+='<div class="empty-state">'+ic('ic-cal','bigic')+'<h3 class="ctitle">'+esc(t('nothing'))+'</h3><p>'+esc(t('w_nodays'))+'</p></div>';return h+'</section>'}
  if(lay==='matrix')h+=matrixHTML(D);
  else if(lay==='calendar')h+=calendarHTML(D);
  else h+=agendaHTML(D);
  h+='<p class="quiet noprint">'+ic('ic-info')+esc(t('hoverTrace'))+'</p>';
  return h+'</section>';
}
function pillHTML(p,z,role,D,d,locked){
  const pid=p.id;const fl=D.flagged.has(pid+'|'+d);
  return '<button class="pill'+(fl?' flagged':'')+'" style="--c:'+esc(role.color)+'" data-act="xseat" data-z="'+z+'" data-pid="'+esc(pid)+'">'+esc(p.name)+(locked?ic('ic-lock','pinic'):'')+'</button>';
}
function agendaHTML(D){
  const a=A(),ws=a.ws,m=D.m,r=D.r;
  const roles=m.roles.map(id=>roleOf(id)).filter(Boolean);
  let h='<div class="tblwrap"><table class="sched'+(a.animate?' anim':'')+'"><thead><tr><th>#</th><th>'+esc(t('site'))+'</th>'+roles.map(ro=>'<th><span class="rolecol"><span class="dot" style="--c:'+esc(ro.color)+'"></span>'+esc(ro.name)+'</span></th>').join('')+'</tr></thead>';
  m.days.forEach((dd,d)=>{
    const vs=D.byDay[d];
    const foc=dd.focus==='near'?t('fNear'):dd.focus==='far'?t('fFar'):(catOf(dd.focus)?catOf(dd.focus).name:'');
    const km=sum(vs.map(v=>{const s=D.siteOfV(v);return s?+s.km:0}));
    const rt=r.stats.dayRoute&&r.stats.dayRoute[d];const rts=rt&&rt.sites.length>1?'<span class="droute">'+ic('ic-route')+rt.sites.map(si=>{const x=byId(ws.sites,m.sites[si]);return esc(x?x.name:'—')}).join(' → ')+' <b>'+r1(rt.km)+' '+unitL()+'</b></span>':'';
    h+='<tbody class="dayg" id="day-'+dd.iso+'" style="--i:'+Math.min(d,14)+'"><tr class="dayhead"><td colspan="'+(2+roles.length)+'"><span class="dh"><b>'+esc(arr('dows')[dowOf(dd.iso)])+'</b> '+esc(fmtDS(dd.iso))+'</span><span class="dhmeta">'+esc(t('nVisits',{n:vs.length}))+' · '+r1(km)+' '+unitL()+(foc?' · '+esc(t('focus'))+': '+esc(foc):'')+'</span>'+rts+'</td></tr>';
    vs.forEach(v=>{
      const vis=m.visits[v],s=D.siteOfV(v),cat=s?catOf(s.cat):null;
      const lockedS=!!ws.locks.sites[vis.key];
      h+='<tr'+(vis.inj?' class="injrow"':'')+'><td class="vnum">'+(vis.inj?ic('ic-pin','pinic'):(vis.k+1))+'</td><td><button class="sitebtn" data-act="xvisit" data-v="'+v+'"><span class="fname">'+(s?esc(s.name):'<i class="muted">'+esc(t('open'))+'</i>')+(lockedS?' '+ic('ic-lock','pinic'):'')+'</span><span class="submeta">'+ctag(cat)+(s?'<span>'+r1(+s.km)+' '+unitL()+'</span>'+(s.zone?'<span>'+esc(s.zone)+'</span>':''):'')+'</span></button></td>';
      roles.forEach((ro,ri)=>{
        let cell='';
        for(let z=vis.z0;z<vis.z0+vis.zn;z++){
          const st=m.seats[z];if(st.r!==ri||!r.stats.active[z])continue;
          const p=D.personOfZ(z);const lk=ws.locks.seats[st.key];
          if(p)cell+=pillHTML(p,z,ro,D,d,!!lk);
          else cell+='<button class="pill open'+(lk==='__open'?' forced':'')+'" data-act="xseat" data-z="'+z+'">'+esc(t('open'))+(lk?ic('ic-lock','pinic'):'')+'</button>';
        }
        h+='<td><div class="team">'+(cell||'<span class="muted tiny">—</span>')+'</div></td>';
      });
      h+='</tr>';
    });
    h+='</tbody>';
  });
  return h+'</table></div>';
}
function matrixHTML(D){
  const a=A(),ws=a.ws,m=D.m,r=D.r;
  const roles=m.roles.map(id=>roleOf(id)).filter(Boolean);
  let h='<div class="tblwrap"><table class="mtx"><thead><tr><th class="who"></th>'+m.days.map(dd=>'<th>'+esc(arr('dows')[dowOf(dd.iso)])+'<b>'+pISO(dd.iso).getDate()+'</b></th>').join('')+'<th>'+esc(t('total'))+'</th></tr></thead><tbody>';
  const seen=new Set();
  roles.forEach(ro=>{
    const ppl=m.people.map(id=>byId(ws.people,id)).filter(p=>p&&p.roles.includes(ro.id)&&!seen.has(p.id));
    if(!ppl.length)return;
    h+='<tr class="grp"><td colspan="'+(m.days.length+2)+'"><span class="rolecol"><span class="dot" style="--c:'+esc(ro.color)+'"></span>'+esc(ro.name)+'</span></td></tr>';
    ppl.forEach(p=>{
      seen.add(p.id);
      h+='<tr><td class="who"><span class="pill" style="--c:'+esc(ro.color)+'" data-pid="'+esc(p.id)+'">'+esc(p.name)+'</span></td>';
      m.days.forEach((dd,d)=>{
        const zs=D.pd[p.id+'|'+d]||[];
        const na=!p.days[dowOf(dd.iso)]||p.off.includes(dd.iso);
        const fl=D.flagged.has(p.id+'|'+d);
        h+='<td class="mcell'+(na?' na':'')+'">'+zs.map(z=>{const v=m.seats[z].v,s=D.siteOfV(v);return '<span class="mb'+(fl?' flag':'')+'" style="--c:'+esc(s?catColor(s.cat):'#999')+'" data-act="xseat" data-z="'+z+'" title="'+esc((s?s.name:'—')+' · '+fmtD(dd.iso))+'">'+esc(s?s.name:'—')+'</span>'}).join('')+'</td>';
      });
      const ld=D.loads[p.id]||0,tg=D.targets[p.id]||0;
      h+='<td class="mtot">'+ld+' <small>/ '+r1(tg)+'</small></td></tr>';
    });
  });
  return h+'</tbody></table></div>';
}
function calendarHTML(D){
  const a=A(),ws=a.ws,m=D.m;
  const w0=ws.rules.weekStart;
  const st=weekStartOf(m.start,w0);let en=m.end;while((dowOf(en)-w0+7)%7!==6)en=addISO(en,1);
  const dix={};m.days.forEach((d,i)=>dix[d.iso]=i);
  let h='<div class="cal">';
  for(let k=0;k<7;k++)h+='<div class="cdow">'+esc(arr('dows')[(w0+k)%7])+'</div>';
  daysIn(st,en).forEach(iso=>{
    const inR=iso>=m.start&&iso<=m.end,d=dix[iso];
    h+='<div class="cday'+(inR?'':' out')+(d==null&&inR?' offd':'')+'"><div class="cn">'+pISO(iso).getDate()+(d!=null?'<small>'+D.byDay[d].length+'</small>':'')+'</div>';
    if(d!=null)D.byDay[d].forEach(v=>{
      const s=D.siteOfV(v),vis=m.visits[v];
      const names=[];for(let z=vis.z0;z<vis.z0+vis.zn;z++){const p=D.personOfZ(z);if(p&&D.r.stats.active[z])names.push(p.name)}
      h+='<div class="cv" style="--c:'+esc(s?catColor(s.cat):'#999')+'" data-act="xvisit" data-v="'+v+'" title="'+esc((s?s.name:'—')+' — '+names.join(', '))+'">'+esc(s?s.name:t('open'))+'<small>'+esc(names.join(', '))+'</small></div>';
    });
    h+='</div>';
  });
  return h+'</div>';
}

function explainPop(q){
  const a=A(),ws=a.ws,D=derive();
  if(!D)return '';
  const m=D.m;
  const x=q.res;
  let h='<div class="pophead"><div><div class="kicker">'+esc(t('why'))+'</div>';
  const termChips=terms=>{const ks=Object.keys(terms||{}).filter(k=>Math.abs(terms[k])>=.05).sort((p,q)=>Math.abs(terms[q])-Math.abs(terms[p])).slice(0,4);
    return ks.length?'<div class="terms">'+ks.map(k=>'<span class="tchip '+(terms[k]>0?'up':'dn')+'">'+esc(t('term_'+k))+' '+(terms[k]>0?'+':'')+fmtN(terms[k])+'</span>').join('')+'</div>':''};
  const dl=v=>{if(v==null)return '';if(Math.abs(v)<.05)return '<span class="delta">±0</span>';return '<span class="delta '+(v>0?'up':'dn')+'">'+(v>0?'+':'')+fmtN(v)+'</span>'};
  if(q.seat!=null){
    const z=q.seat,st=m.seats[z],vis=m.visits[st.v],s=D.siteOfV(st.v),ro=roleOf(m.roles[st.r]);
    const lk=ws.locks.seats[st.key];
    h+='<h3 class="ctitle">'+esc(ro?ro.name:'')+' · '+esc(s?s.name:'—')+'</h3><div class="tiny muted">'+esc(fmtDL(m.days[vis.d].iso))+'</div></div><button class="ibtn" data-act="popClose">'+ic('ic-x')+'</button></div>';
    h+='<div class="row" style="margin-bottom:10px">'+(lk?'<button class="btn sm" data-act="unpinSeat" data-z="'+z+'">'+ic('ic-lock')+esc(t('unpin'))+'</button>':'<button class="btn sm" data-act="pinSeat" data-z="'+z+'">'+ic('ic-lock')+esc(t('pin'))+'</button>')
      +(lk!=='__open'?'<button class="btn sm ghost" data-act="openSeat" data-z="'+z+'">'+esc(t('leaveOpen'))+'</button>':'')+'</div>';
    h+='<div class="mlab">'+esc(t('alts'))+'</div>';
    if(!x){h+='<div class="muted tiny">'+esc(t('explainStale'))+'</div>';return h}
    x.slice(0,40).forEach(o=>{
      const p=o.p>=0?byId(ws.people,m.people[o.p]):null;
      const nm=o.p<0?t('openSeat'):(p?p.name:'—');
      const ld=o.p>=0&&p?(D.loads[p.id]||0)+'/'+r1(D.targets[p.id]||0):'';
      h+='<div class="alt'+(o.current?' cur':'')+(o.blocked?' blk':'')+'"><div class="an"><span>'+esc(nm)+'</span>'+(ld?'<span class="mono tiny muted">'+ld+'</span>':'')+(o.current?'<span class="chip">'+esc(t('current'))+'</span>':'')+'</div>'
        +(o.blocked?'<span class="tiny muted">'+esc(o.blocked==='unavail'?t('blockedUn'):t('blockedIn'))+'</span><span></span>':dl(o.current?null:o.delta)+(o.current?'<span></span>':'<button class="btn sm" data-act="useSeat" data-z="'+z+'" data-p="'+o.p+'">'+esc(t('use'))+'</button>'))
        +(o.blocked||o.current?'':termChips(o.terms))+'</div>';
    });
  }else{
    const v=q.visit,vis=m.visits[v],s=D.siteOfV(v),lk=ws.locks.sites[vis.key];
    h+='<h3 class="ctitle">'+esc(s?s.name:t('open'))+'</h3><div class="tiny muted">'+esc(fmtDL(m.days[vis.d].iso))+' · #'+(vis.k+1)+'</div></div><button class="ibtn" data-act="popClose">'+ic('ic-x')+'</button></div>';
    h+='<div class="row" style="margin-bottom:10px">'+(lk?'<button class="btn sm" data-act="unpinVisit" data-v="'+v+'">'+ic('ic-lock')+esc(t('unpin'))+'</button>':(s?'<button class="btn sm" data-act="pinVisit" data-v="'+v+'">'+ic('ic-lock')+esc(t('pin'))+'</button>':''))+'</div>';
    h+='<div class="mlab">'+esc(t('alts'))+'</div>';
    if(!x){h+='<div class="muted tiny">'+esc(t('explainStale'))+'</div>';return h}
    x.slice(0,40).forEach(o=>{
      const st=byId(ws.sites,m.sites[o.s]);const cat=st?catOf(st.cat):null;
      h+='<div class="alt'+(o.current?' cur':'')+'"><div class="an"><span class="dot" style="--c:'+esc(cat?cat.color:'#999')+'"></span><span>'+esc(st?st.name:'—')+'</span><span class="mono tiny muted">'+(st?r1(+st.km)+' '+unitL():'')+' · '+(D.uses[st&&st.id]||0)+'×</span>'+(o.current?'<span class="chip">'+esc(t('current'))+'</span>':'')+'</div>'
        +(o.current?'<span></span><span></span>':dl(o.delta)+'<button class="btn sm" data-act="useVisit" data-v="'+v+'" data-s="'+o.s+'">'+esc(t('use'))+'</button>')
        +(o.current?'':termChips(o.terms))+'</div>';
    });
  }
  return h;
}

function dpkTrigger(target,iso,mode,icon){
  if(icon)return '<button class="dpk-trigger icon" data-act="dpk" data-target="'+esc(target)+'" title="'+esc(t('addDate'))+'">'+ic('ic-plus')+'</button>';
  const d=pISO(iso);
  const lbl=mode==='month'?arr('monthsL')[d.getMonth()]+' '+d.getFullYear():fmtDL(iso);
  return '<button class="dpk-trigger" data-act="dpk" data-target="'+esc(target)+'" data-iso="'+esc(iso)+'">'+ic('ic-cal')+'<span class="dpk-val">'+esc(lbl)+'</span></button>';
}
function dpkHTML(st){
  const d=pISO(st.view);const y=d.getFullYear(),mo=d.getMonth();
  const w0=A().ws.rules.weekStart;
  const first=new Date(y,mo,1);const lead=(first.getDay()-w0+7)%7;
  let h='<div class="dpk-head"><button class="dpk-nav" data-act="dpkNav" data-d="-1">'+ic('ic-chevl','flip')+'</button><div class="dpk-title">'+esc(arr('monthsL')[mo]+' '+y)+'</div><button class="dpk-nav" data-act="dpkNav" data-d="1">'+ic('ic-chevr','flip')+'</button></div><div class="dpk-grid">';
  for(let k=0;k<7;k++)h+='<div class="dpk-dow">'+esc(arr('dows1')[(w0+k)%7])+'</div>';
  const td=todayISO();
  for(let i=0;i<42;i++){
    const dt=new Date(y,mo,1-lead+i),iso=fISO(dt);
    const cls=['dpk-day'];if(dt.getMonth()!==mo)cls.push('mute');if(iso===td)cls.push('today');if(iso===st.sel)cls.push('sel');if(st.marks&&st.marks.includes(iso))cls.push('mark');
    if(st.range&&iso>=st.range[0]&&iso<=st.range[1]&&iso!==st.sel)cls.push('inr');
    h+='<button class="'+cls.join(' ')+'" data-act="dpkPick" data-iso="'+iso+'">'+dt.getDate()+'</button>';
    if(i===34&&new Date(y,mo,1-lead+35).getMonth()!==mo)break;
  }
  h+='</div><div class="dpk-foot"><button class="linkbtn" data-act="dpkPick" data-iso="'+td+'">'+esc(t('thisW'))+'</button><button class="linkbtn" data-act="popClose">'+esc(t('close'))+'</button></div>';
  return h;
}

function pager(total,page,per,act){
  const pages=Math.ceil(total/per);if(pages<=1)return '';
  return '<div class="pgn"><button class="ibtn" data-act="'+act+'" data-p="'+(page-1)+'" '+(page<=0?'disabled':'')+'>'+ic('ic-chevl','flip')+'</button><span class="mono tiny">'+(page+1)+' / '+pages+'</span><button class="ibtn" data-act="'+act+'" data-p="'+(page+1)+'" '+(page>=pages-1?'disabled':'')+'>'+ic('ic-chevr','flip')+'</button></div>';
}
function dateChips(list,act,id){
  const max=3;const l=list.slice().sort();
  return '<div class="offs">'+l.slice(0,max).map(iso=>'<span class="offchip">'+esc(fmtDS(iso))+'<button data-act="'+act+'" data-id="'+esc(id)+'" data-iso="'+iso+'" aria-label="'+esc(t('remove'))+'">'+ic('ic-x')+'</button></span>').join('')+(l.length>max?'<span class="more" title="'+esc(l.slice(max).map(fmtDS).join(', '))+'">+'+(l.length-max)+'</span>':'')+'</div>';
}
function sitesView(){
  const a=A(),ws=a.ws,D=derive(),stale=a.isStale();
  const q=(a.f.siteQ||'').trim().toLowerCase(),fc=a.f.siteCat||'all';
  const counts={};ws.sites.forEach(s=>counts[s.cat]=(counts[s.cat]||0)+1);
  const fl=a.f.siteLoc||'';
  let list=ws.sites.filter(s=>(fc==='all'||s.cat===fc)&&(!fl||s.loc===fl)&&(!q||s.name.toLowerCase().includes(q)||(s.tag||'').toLowerCase().includes(q)||((locOf(s.loc)||{}).name||'').toLowerCase().includes(q)));
  const per=40,pages=Math.max(1,Math.ceil(list.length/per));a.f.sitePage=clamp(a.f.sitePage||0,0,pages-1);
  const page=list.slice(a.f.sitePage*per,(a.f.sitePage+1)*per);
  let h='<section class="card"><div class="card-head"><div><div class="kicker">'+esc(t('kList'))+'</div><h2 class="ctitle">'+esc(t('tabSites'))+' <span class="muted mono tiny">'+ws.sites.length+'</span></h2></div>'
    +'<div class="row"><button class="btn primary sm" data-act="addSite">'+ic('ic-plus')+esc(t('addSite'))+'</button><button class="btn sm" data-act="csvImport" data-kind="sites">'+ic('ic-up')+esc(t('importCsv'))+'</button>'+tplMenu('sites')+'<button class="btn sm ghost" data-act="csvExport" data-kind="sites">'+ic('ic-down')+esc(t('exportCsv'))+'</button></div></div>';
  h+='<div class="toolbar"><label class="search">'+ic('ic-search')+'<input class="inp slim" type="search" placeholder="'+esc(t('search'))+'" data-bind="siteQ" value="'+esc(a.f.siteQ||'')+'"></label>'
    +'<button class="fchip'+(fc==='all'?' on':'')+'" data-act="siteCat" data-v="all">'+esc(t('all'))+' <small>'+ws.sites.length+'</small></button>'
    +ws.categories.map(c=>'<button class="fchip'+(fc===c.id?' on':'')+'" data-act="siteCat" data-v="'+esc(c.id)+'"><span class="dot" style="--c:'+esc(c.color)+'"></span>'+esc(c.name)+' <small>'+(counts[c.id]||0)+'</small></button>').join('')
    +((ws.locations||[]).length?dd('siteLoc','',fl,[['',t('allLocs')]].concat(locOpts().slice(1)),{search:true,cls:'fdd'}):'')+'</div>';
  if(!ws.sites.length){h+='<div class="empty-state">'+ic('ic-build','bigic')+'<p>'+esc(t('noSites'))+'</p></div></section>';return h}
  const catOpts=ws.categories.map(c=>[c.id,c.name+(c.planned?'':' ('+t('unplanned')+')'),c.color]);
  const lo=locOpts();
  h+='<div class="tblwrap"><table class="ledger"><thead><tr><th>'+esc(t('active'))+'</th><th>'+esc(t('name'))+'</th><th>'+esc(t('category'))+'</th><th>'+esc(t('location'))+'</th><th>'+esc(t('dist'))+'</th><th>'+esc(t('crit'))+'</th><th>'+esc(t('tag'))+'</th><th>'+esc(t('weight'))+'</th><th>'+esc(t('minMax'))+'</th><th title="'+esc(t('rcCatN'))+'">'+esc(t('cGap'))+'</th><th>'+esc(t('days'))+'</th><th>'+esc(t('blackout'))+'</th><th>'+esc(t('used'))+'</th><th></th></tr></thead><tbody>';
  const rcg=M.normRecency(ws.recency);
  if(!page.length)h+='<tr><td colspan="14" class="empty">'+esc(t('noMatch'))+'</td></tr>';
  page.forEach(s=>{
    const cat=catOf(s.cat);const u=D&&!stale?(D.uses[s.id]||0):null;
    const sa='data-id="'+esc(s.id)+'"';
    h+='<tr class="'+(s.active?'':'inactive')+'" data-id="'+esc(s.id)+'"><td>'+swBtn(s.active,'siteActive',sa,true)+'</td>'
      +'<td class="nm"><input class="inp bare" data-bind="site" '+sa+' data-f="name" value="'+esc(s.name)+'" aria-label="'+esc(t('name'))+'"></td>'
      +'<td>'+dd('site',sa+' data-f="cat"',s.cat,catOpts)+'</td>'
      +'<td>'+dd('site',sa+' data-f="loc"',s.loc,lo,{search:true})+'</td>'
      +'<td>'+(s.loc?'<span class="mono tiny kmro">'+r1(s.km)+' '+unitL()+'</span>':'<span class="numwrap"><input class="inp num s" type="number" min="0" step="0.5" data-bind="site" '+sa+' data-f="km" value="'+s.km+'"><span class="unit">'+unitL()+'</span></span>')+'</td>'
      +'<td>'+dd('site',sa+' data-f="crit"',s.crit,lvlOpts(),{cls:'lvdd l'+s.crit})+'</td>'
      +'<td><input class="inp slim" style="width:104px" data-bind="site" '+sa+' data-f="tag" value="'+esc(s.tag||'')+'" placeholder="—"></td>'
      +'<td><span class="numwrap"><input type="range" class="rng sm" min="0.1" max="3" step="0.05" value="'+s.weight+'" style="--fill:'+fill(s.weight,.1,3)+'" data-bind="site" data-id="'+esc(s.id)+'" data-f="weight"><span class="mono tiny">'+(+s.weight).toFixed(2)+'</span></span></td>'
      +'<td><span class="numwrap"><input class="inp num s" type="number" min="0" placeholder="—" data-bind="site" data-id="'+esc(s.id)+'" data-f="minV" value="'+s.minV+'"><input class="inp num s" type="number" min="0" placeholder="—" data-bind="site" data-id="'+esc(s.id)+'" data-f="maxV" value="'+s.maxV+'"></span></td>'
      +'<td>'+(()=>{const w=M.rcWindow(ws,Object.assign({},s,{gapMin:'',gapMax:''}),Object.assign({},rcg,{mode:rcg.mode==='off'||rcg.mode==='random'?'range':rcg.mode}));return '<span class="numwrap"><input class="inp num s" type="number" min="0" placeholder="'+(w?w.lo:'—')+'" data-bind="site" data-id="'+esc(s.id)+'" data-f="gapMin" value="'+(s.gapMin==null?'':s.gapMin)+'"><input class="inp num s" type="number" min="0" placeholder="'+(w&&w.hi?w.hi:'—')+'" data-bind="site" data-id="'+esc(s.id)+'" data-f="gapMax" value="'+(s.gapMax==null?'':s.gapMax)+'"></span>'})()+'</td>'
      +'<td>'+wdChips(s.days,'siteDay','data-id="'+esc(s.id)+'"')+'</td>'
      +'<td><div class="row" style="gap:5px;flex-wrap:nowrap">'+dateChips(s.blackout,'siteBlackoutDel',s.id)+dpkTrigger('siteBlackout:'+s.id,null,null,true)+'</div></td>'
      +'<td>'+(u==null?'<span class="muted">—</span>':'<span class="mono">'+u+'×</span>')+'</td>'
      +'<td><button class="ibtn" data-act="delSite" data-id="'+esc(s.id)+'" title="'+esc(t('remove'))+'">'+ic('ic-trash')+'</button></td></tr>';
  });
  h+='</tbody></table></div>'+pager(list.length,a.f.sitePage,per,'sitePage');
  h+='<p class="quiet">'+ic('ic-info')+esc(t('sitesNote'))+' CSV: name, category, location, '+esc(ws.unit)+', crit, tag, weight, min, max, gap_min, gap_max, days(7×1/0), blackout(|), active.</p></section>';
  return h+locationsCard();
}
function locationsCard(){
  const a=A(),ws=a.ws,L0=ws.locations||[];
  const cs={},cp={};ws.sites.forEach(s=>{if(s.loc)cs[s.loc]=(cs[s.loc]||0)+1});ws.people.forEach(p=>{if(p.homeLoc)cp[p.homeLoc]=(cp[p.homeLoc]||0)+1});
  const list=L0.slice().sort((x,y)=>x.km-y.km||x.name.localeCompare(y.name));
  const mx=Math.max(10,...list.map(l=>l.km));
  let h='<section class="card" id="locations-card"><div class="card-head"><div><div class="kicker">'+esc(t('kLoc'))+'</div><h2 class="ctitle">'+esc(t('locT'))+' <span class="muted mono tiny">'+L0.length+'</span></h2></div><div class="row"><button class="btn sm" data-act="addLoc">'+ic('ic-plus')+esc(t('addLoc'))+'</button><button class="btn sm ghost" data-act="csvImport" data-kind="locations">'+ic('ic-up')+esc(t('importCsv'))+'</button>'+tplMenu('locations')+'</div></div>';
  if(!L0.length){h+='<div class="goal-empty">'+ic('ic-pin')+'<span>'+esc(t('noLocs'))+'</span></div></section>';return h}
  h+='<div class="locgrid">'+list.map(l=>'<div class="locitem'+(l.unknown?' unk':'')+'"><input class="inp bare" data-bind="loc" data-id="'+esc(l.id)+'" data-f="name" value="'+esc(l.name)+'"><span class="numwrap"><input class="inp num s" type="number" min="0" step="1" data-bind="loc" data-id="'+esc(l.id)+'" data-f="km" value="'+l.km+'"><span class="unit">'+unitL()+'</span></span><div class="locbar"><i style="width:'+(l.km/mx*100)+'%"></i></div><span class="mono tiny muted" title="'+esc(t('locUse'))+'">'+(cs[l.id]||0)+' · '+(cp[l.id]||0)+'</span><button class="ibtn" data-act="delLoc" data-id="'+esc(l.id)+'">'+ic('ic-trash')+'</button></div>').join('')+'</div>'
    +'<p class="quiet">'+ic('ic-info')+esc(t('locNote'))+'</p>'+routesBlock()+'</section>';
  return h;
}
function personRulesList(p){
  const ws=A().ws;
  const own=r=>(r.who.k==='person'&&r.who.v===p.id)||(r.rel==='with'&&r.what.k==='person'&&r.what.v===p.id);
  const mine=(ws.book||[]).filter(own);
  const inh=(ws.book||[]).filter(r=>!own(r)&&r.on&&r.rel!=='team'&&r.who.k!=='all'&&M.whoMatch(p,r.who));
  const tok=(r,mine)=>'<span class="token'+(r.on?'':' off')+(M.isHard(r)?' hard':'')+(mine?'':' inh')+'">'+(M.isHard(r)?ic('ic-lock'):'')+esc(ruleText(r))+(mine?'<button data-act="bookOn" data-id="'+esc(r.id)+'" title="'+esc(t('active'))+'">'+ic(r.on?'ic-check':'ic-minus')+'</button><button data-act="bookFlip" data-id="'+esc(r.id)+'" title="'+esc(t('bFlip'))+'">'+ic('ic-flip')+'</button><button data-act="bookDel" data-id="'+esc(r.id)+'" title="'+esc(t('remove'))+'">'+ic('ic-x')+'</button>':'')+'</span>';
  const vio=bookVio();
  return (mine.length?'<div class="brules compact">'+mine.map(r=>bookRow(r,vio?vio[r.id]:null)).join('')+'</div>':'')
    +(inh.length?'<div class="prules"><span class="tiny muted">'+esc(t('bInherited'))+'</span>'+inh.map(r=>tok(r,false)).join('')+'</div>':'')
    +'<div class="prules add"><span class="tiny muted">'+esc(t('bAddFor'))+'</span>'+[['site','ic-build','br_site'],['day','ic-cal','br_day'],['with','ic-users','br_with'],['count','ic-target','br_count']].map(([k,i,l])=>'<button class="btn sm ghost" data-act="bookForPerson" data-kind="'+k+'" data-id="'+esc(p.id)+'">'+ic(i)+esc(t(l))+'</button>').join('')+'</div>';
}
function personGoalsList(p){
  const ws=A().ws,D=derive(),ok=D&&!A().isStale();
  const mine=(ws.goals||[]).filter(g=>g.who.k!=='all'&&M.whoMatch(p,g.who));
  return '<div class="prules">'+mine.map(g=>{const r=ok?D.goalIx[g.id]:null;return '<span class="token'+(g.on?'':' off')+(g.hard?' hard':'')+'">'+ic(g.kind==='inject'?'ic-pin':'ic-target')+esc(goalText(g))+(r?' <b class="'+(r.met?'okc':'badc')+'">'+esc(r.txt)+'</b>':'')+'<button data-act="goalGo" data-id="'+g.id+'" title="'+esc(t('edit'))+'">'+ic('ic-edit')+'</button></span>'}).join('')
    +'<button class="btn sm ghost" data-act="goalForPerson" data-id="'+esc(p.id)+'" data-v="count">'+ic('ic-target')+esc(t('gtpl_person'))+'</button>'
    +'<button class="btn sm ghost" data-act="goalForPerson" data-id="'+esc(p.id)+'" data-v="inject">'+ic('ic-pin')+esc(t('gtpl_inject'))+'</button></div>';
}
function tokenBox(list,act,id,field,opts,labelOf){
  let h='<div class="tokens">'+list.map(x=>'<span class="token">'+esc(labelOf(x))+'<button data-act="'+act+'" data-id="'+esc(id)+'" data-f="'+field+'" data-v="'+esc(x)+'">'+ic('ic-x')+'</button></span>').join('');
  const rest=opts.filter(o=>!list.includes(o.id));
  if(rest.length)h+=dd('tokenAdd','data-id="'+esc(id)+'" data-f="'+field+'"','',rest.map(o=>[o.id,o.name]),{ph:'+ '+t('addEllipsis'),cls:'adddd'});
  return h+'</div>';
}
function peopleView(){
  const a=A(),ws=a.ws,D=derive(),stale=a.isStale();
  const q=(a.f.peopleQ||'').trim().toLowerCase(),fr=a.f.peopleRole||'all';
  const counts={};ws.people.forEach(p=>p.roles.forEach(r=>counts[r]=(counts[r]||0)+1));
  const list=ws.people.filter(p=>(fr==='all'||p.roles.includes(fr))&&(!q||p.name.toLowerCase().includes(q)));
  let h='<section class="card"><div class="card-head"><div><div class="kicker">'+esc(t('kList'))+'</div><h2 class="ctitle">'+esc(t('tabPeople'))+' <span class="muted mono tiny">'+ws.people.length+'</span></h2></div>'
    +'<div class="row"><button class="btn primary sm" data-act="addPerson">'+ic('ic-plus')+esc(t('addPerson'))+'</button><button class="btn sm" data-act="csvImport" data-kind="people">'+ic('ic-up')+esc(t('importCsv'))+'</button>'+tplMenu('people')+'<button class="btn sm ghost" data-act="csvExport" data-kind="people">'+ic('ic-down')+esc(t('exportCsv'))+'</button></div></div>';
  h+='<div class="toolbar"><label class="search">'+ic('ic-search')+'<input class="inp slim" type="search" placeholder="'+esc(t('search'))+'" data-bind="peopleQ" value="'+esc(a.f.peopleQ||'')+'"></label>'
    +'<button class="fchip'+(fr==='all'?' on':'')+'" data-act="peopleRole" data-v="all">'+esc(t('all'))+' <small>'+ws.people.length+'</small></button>'
    +ws.roles.map(r=>'<button class="fchip'+(fr===r.id?' on':'')+'" data-act="peopleRole" data-v="'+esc(r.id)+'"><span class="dot" style="--c:'+esc(r.color)+'"></span>'+esc(r.name)+' <small>'+(counts[r.id]||0)+'</small></button>').join('')+'</div>';
  if(!ws.people.length){h+='<div class="empty-state">'+ic('ic-users','bigic')+'<p>'+esc(t('noPeople'))+'</p></div></section>';return h}
  const maxLoad=D&&!stale?Math.max(1,...Object.values(D.loads),...Object.values(D.targets).map(Math.ceil)):1;
  const pc=ws.categories.filter(c=>c.planned);
  h+='<div class="tblwrap"><table class="ledger"><thead><tr><th>'+esc(t('active'))+'</th><th>'+esc(t('name'))+'</th><th>'+esc(t('roles'))+'</th><th>'+esc(t('rank'))+'</th><th>'+esc(t('home'))+'</th><th>'+esc(t('pref'))+'</th><th>'+esc(t('weight'))+'</th><th>'+esc(t('days'))+'</th><th>'+esc(t('offDays'))+'</th><th>'+esc(t('limits'))+'</th><th>'+esc(t('load'))+'</th><th></th></tr></thead><tbody>';
  if(!list.length)h+='<tr><td colspan="12" class="empty">'+esc(t('noMatch'))+'</td></tr>';
  list.forEach(p=>{
    const open=a.f.drawer===p.id;
    const ld=D&&!stale?D.loads[p.id]:null,tg=D&&!stale?D.targets[p.id]:null;
    const c=p.roles.length?roleOf(p.roles[0]).color:'#999';
    h+='<tr class="'+(p.active?'':'inactive')+'"><td>'+swBtn(p.active,'personActive','data-id="'+esc(p.id)+'"',true)+'</td>'
      +'<td class="nm"><input class="inp bare" data-bind="person" data-id="'+esc(p.id)+'" data-f="name" value="'+esc(p.name)+'" aria-label="'+esc(t('name'))+'"></td>'
      +'<td><div class="rolechips">'+ws.roles.map(r=>'<button class="rchip'+(p.roles.includes(r.id)?' on':'')+'" style="--c:'+esc(r.color)+'" data-act="personRole" data-id="'+esc(p.id)+'" data-r="'+esc(r.id)+'">'+esc(r.name)+'</button>').join('')+(p.roles.length?'':'<span class="chip bad">'+esc(t('noRoleWarn'))+'</span>')+'</div></td>'
      +'<td><div class="rankcell">'+dd('person','data-id="'+esc(p.id)+'" data-f="rank"',p.rank,lvlOpts(),{cls:'lvdd l'+p.rank,title:t('rankAll')})+(pc.length>1?pc.map(c=>{const v=p.rankBy[c.id];return dd('rankBy','data-id="'+esc(p.id)+'" data-c="'+esc(c.id)+'"',v==null?'':v,[['',t('inherit')+' ('+p.rank+')']].concat(lvlOpts()),{cls:'lvdd mini'+(v==null?' inh':' l'+v),title:c.name,ph:v==null?c.name.slice(0,1)+'·'+p.rank:null})}).join(''):'')+'</div></td>'
      +'<td>'+((ws.locations||[]).length?dd('person','data-id="'+esc(p.id)+'" data-f="homeLoc"',p.homeLoc,locOpts(t('customKm')),{search:true})+(p.homeLoc?'':'<span class="numwrap"><input class="inp num s" type="number" min="0" step="0.5" data-bind="person" data-id="'+esc(p.id)+'" data-f="home" value="'+p.home+'"><span class="unit">'+unitL()+'</span></span>'):'<span class="numwrap"><input class="inp num s" type="number" min="0" step="0.5" data-bind="person" data-id="'+esc(p.id)+'" data-f="home" value="'+p.home+'"><span class="unit">'+unitL()+'</span></span>')+'</td>'
      +'<td>'+dd('person','data-id="'+esc(p.id)+'" data-f="pref"',p.pref,[['none',t('prefNone')],['near',t('fNear')],['far',t('fFar')]])+'</td>'
      +'<td><span class="numwrap"><input type="range" class="rng sm" min="0.1" max="3" step="0.05" value="'+p.weight+'" style="--fill:'+fill(p.weight,.1,3)+'" data-bind="person" data-id="'+esc(p.id)+'" data-f="weight"><span class="mono tiny">'+(+p.weight).toFixed(2)+'</span></span></td>'
      +'<td>'+wdChips(p.days,'personDay','data-id="'+esc(p.id)+'"')+'</td>'
      +'<td><div class="row" style="gap:5px;flex-wrap:nowrap">'+dateChips(p.off,'personOffDel',p.id)+dpkTrigger('personOff:'+p.id,null,null,true)+'</div></td>'
      +'<td><span class="numwrap"><input class="inp num s" type="number" min="0" placeholder="∞" data-bind="person" data-id="'+esc(p.id)+'" data-f="maxLoad" value="'+p.maxLoad+'"><input class="inp num s" type="number" min="0" placeholder="∞" data-bind="person" data-id="'+esc(p.id)+'" data-f="maxWeek" value="'+p.maxWeek+'"></span></td>'
      +'<td>'+(ld==null?'<span class="muted">—</span>':'<div class="usebar" title="'+ld+' / '+r1(tg||0)+'"><b>'+ld+'</b><div class="bar'+(tg!=null&&ld>tg+1.01?' over':'')+'" style="--c:'+esc(c)+'"><i style="width:'+(ld/maxLoad*100)+'%"></i>'+(tg!=null?'<span class="tick" style="--t:'+(tg/maxLoad*100)+'%"></span>':'')+'</div></div>')+'</td>'
      +'<td><div class="row" style="gap:2px;flex-wrap:nowrap"><button class="ibtn'+(open?' on':'')+'" data-act="drawer" data-id="'+esc(p.id)+'" title="'+esc(t('details'))+'">'+ic('ic-chev')+'</button><button class="ibtn" data-act="delPerson" data-id="'+esc(p.id)+'" title="'+esc(t('remove'))+'">'+ic('ic-trash')+'</button></div></td></tr>';
    if(open){
      const others=ws.people.filter(x=>x.id!==p.id).map(x=>({id:x.id,name:x.name}));
      const sites=ws.sites.map(x=>({id:x.id,name:x.name}));
      const pn=id=>{const x=byId(ws.people,id);return x?x.name:'—'},sn=id=>{const x=byId(ws.sites,id);return x?x.name:'—'};
      h+='<tr class="drawer"><td colspan="12"><div class="drawer-grid">'
        +'<div><span class="lbl">'+esc(t('avoidWith'))+'</span>'+tokenBox(p.avoid,'tokenDel',p.id,'avoid',others,pn)+'</div>'
        +'<div><span class="lbl">'+esc(t('pairWith'))+'</span>'+tokenBox(p.pair,'tokenDel',p.id,'pair',others,pn)+'</div>'
        +'<div><span class="lbl">'+esc(t('likes'))+'</span>'+tokenBox(p.likes,'tokenDel',p.id,'likes',sites,sn)+'</div>'
        +'<div><span class="lbl">'+esc(t('bans'))+'</span>'+tokenBox(p.bans,'tokenDel',p.id,'bans',sites,sn)+'</div>'
        +'<div><span class="lbl">'+esc(t('gender'))+'</span><div class="seg">'+[['',t('g_none')],['m',t('g_m')],['f',t('g_f')]].map(([k,l])=>'<button class="'+((p.gender||'')===k?'on':'')+'" data-act="personGender" data-id="'+esc(p.id)+'" data-v="'+k+'">'+esc(l)+'</button>').join('')+'</div></div>'
        +'<div><span class="lbl">'+esc(t('ownPattern'))+'</span><div class="row" style="gap:8px">'+swBtn(p.runMax!=='','personPat','data-id="'+esc(p.id)+'"',true)
          +(p.runMax!==''?'<span class="sc tiny">'+esc(t('patWork'))+stepper('personRun','data-id="'+esc(p.id)+'" data-k="runMax"',p.runMax||'∞')+'</span><span class="sc tiny">'+esc(t('patRest'))+stepper('personRun','data-id="'+esc(p.id)+'" data-k="offMin"',p.offMin===''?0:p.offMin)+'</span>'+patternStrip(+p.runMax,p.offMin===''?1:+p.offMin):'<span class="muted tiny">'+esc(t('usesGlobal'))+'</span>')+'</div></div>'
        +'<div class="span-all"><span class="lbl">'+esc(t('personGoals'))+'</span>'+personGoalsList(p)+'</div>'
        +'<div class="span-all"><span class="lbl">'+esc(t('personRules'))+'</span>'+personRulesList(p)+'</div>'
        +'</div></td></tr>';
    }
  });
  h+='</tbody></table></div><p class="quiet">'+ic('ic-info')+esc(t('peopleNote'))+' CSV: name, roles(|), rank, home, pref, weight, days(7×1/0), off(|), max, max_week, active.</p></section>';
  return h;
}

const RULES_NAV=[['book-card','navBook'],['pattern-card','kPattern'],['rank-card','kRank'],['hard-card','hardT'],['weights-card','weightsT'],['cats-card','kCats'],['week-card','weekT'],['words-card','kWords']];
function rulesNav(){
  const ws=A().ws;const nb=(ws.book||[]).filter(r=>r.on).length;
  return '<nav class="subnav noprint" aria-label="'+esc(t('tabRules'))+'">'+RULES_NAV.map(([id,l])=>'<button class="snav" data-act="jump" data-to="'+id+'">'+esc(t(l))+(id==='book-card'&&nb?'<small>'+nb+'</small>':'')+'</button>').join('')+'</nav>';
}
function rulesView(){
  const a=A(),ws=a.ws;
  const words=['visit','visits','site','sites','person','people'];
  const lng=L();
  let h=rulesNav()+bookCard()+'<div class="grid2"><section class="card" id="words-card"><div class="card-head"><div><div class="kicker">'+esc(t('kWords'))+'</div><h2 class="ctitle">'+esc(t('wordsT'))+'</h2></div>'
    +'<div class="row"><span class="lbl">'+esc(t('unit'))+'</span>'+dd('unit','',ws.unit,[['km','km'],['mi','mi']])+'</div></div>'
    +'<div class="words">'+words.map(w=>'<label><span class="lbl">'+esc(t('w_'+w))+'</span><input class="inp slim" data-bind="term" data-f="'+w+'" value="'+esc(ws.terms[lng][w])+'"></label>').join('')+'</div>'
    +'<p class="quiet">'+ic('ic-globe')+esc(t('wordsNote'))+' ('+(lng==='ar'?'العربية':'English')+')</p></section>';
  h+='<section class="card"><div class="card-head"><div><div class="kicker">'+esc(t('kRoles'))+'</div><h2 class="ctitle">'+esc(t('rolesT'))+'</h2></div><button class="btn sm" data-act="addRole">'+ic('ic-plus')+esc(t('addRole'))+'</button></div><div class="rolelist">'
    +ws.roles.map(r=>{const n=ws.people.filter(p=>p.roles.includes(r.id)).length;return '<div class="roleitem"><button class="colorpick" style="--c:'+esc(r.color)+'" data-act="color" data-kind="role" data-id="'+esc(r.id)+'" aria-label="colour"></button><input class="inp slim" data-bind="role" data-id="'+esc(r.id)+'" data-f="name" value="'+esc(r.name)+'"><span class="chip">'+esc(t('members',{n}))+'</span><button class="ibtn" data-act="delRole" data-id="'+esc(r.id)+'">'+ic('ic-trash')+'</button></div>'}).join('')
    +'</div><p class="quiet">'+ic('ic-info')+esc(t('rolesNote'))+'</p></section></div>';
  h+='<section class="card" id="cats-card"><div class="card-head"><div><div class="kicker">'+esc(t('kCats'))+'</div><h2 class="ctitle">'+esc(t('catsT'))+'</h2></div><button class="btn sm" data-act="addCat">'+ic('ic-plus')+esc(t('addCat'))+'</button></div><div class="catlist">';
  const shareSum=sum(ws.categories.filter(c=>c.planned).map(c=>c.share))||1;
  ws.categories.forEach(c=>{
    const n=ws.sites.filter(s=>s.cat===c.id).length;
    h+='<div class="catitem'+(c.planned?'':' unpl')+'"><div class="cattop"><button class="colorpick" style="--c:'+esc(c.color)+'" data-act="color" data-kind="cat" data-id="'+esc(c.id)+'" aria-label="colour"></button><input class="inp slim" data-bind="cat" data-id="'+esc(c.id)+'" data-f="name" value="'+esc(c.name)+'"><span class="chip">'+esc(t('nSitesC',{n}))+'</span>'
      +'<span class="lbl">'+esc(t('planned'))+'</span>'+swBtn(c.planned,'catPlanned','data-id="'+esc(c.id)+'"',true)
      +'<button class="ibtn" data-act="delCat" data-id="'+esc(c.id)+'">'+ic('ic-trash')+'</button></div>';
    if(c.planned)h+='<div class="catstaff"><span class="lbl">'+esc(t('staff'))+'</span>'+ws.roles.map(r=>'<span class="sc"><span class="dot" style="--c:'+esc(r.color)+'"></span>'+esc(r.name)+stepper('catStaff','data-id="'+esc(c.id)+'" data-r="'+esc(r.id)+'"',c.staff[r.id]||0)+'</span>').join('')
      +'<span class="sc" style="margin-inline-start:auto"><span class="lbl">'+esc(t('share'))+'</span>'+stepper('catShare','data-id="'+esc(c.id)+'"',c.share)+'<span class="mono tiny muted">'+Math.round(c.share/shareSum*100)+'%</span></span></div>';
    h+='</div>';
  });
  h+='</div><p class="quiet">'+ic('ic-info')+esc(t('catsNote'))+'</p></section>';
  const w0=ws.rules.weekStart;
  const focusOpts=[['auto',t('fAuto')],['near',t('fNear')],['far',t('fFar')]].concat(ws.categories.filter(c=>c.planned).map(c=>[c.id,c.name]));
  h+='<section class="card" id="week-card"><div class="card-head"><div><div class="kicker">'+esc(t('kRhythm'))+'</div><h2 class="ctitle">'+esc(t('weekT'))+'</h2></div></div><div class="wkgrid">';
  for(let k=0;k<7;k++){const i=(w0+k)%7,d=ws.week[i];
    h+='<div class="wkcell'+(d.on?'':' off')+'"><div class="wktop"><span class="wkname">'+esc(arr('dows')[i])+'</span>'+swBtn(d.on,'weekOn','data-i="'+i+'"',true)+'</div>'
      +(d.on?stepper('weekN','data-i="'+i+'"',d.n)+dd('weekFocus','data-i="'+i+'"',d.focus,focusOpts,{cls:'full'}):'<span class="tiny muted">'+esc(t('dayOff'))+'</span>')+'</div>'}
  h+='</div><p class="quiet">'+ic('ic-info')+esc(t('weekNote'))+'</p></section>';
  const R=ws.rules;
  h+='<div class="grid2"><section class="card" id="hard-card"><div class="card-head"><div><div class="kicker">'+esc(t('kRules'))+'</div><h2 class="ctitle">'+esc(t('hardT'))+'</h2></div></div><div class="setgrid">'
    +'<div class="setrow"><span class="rl">'+esc(t('perDay'))+'<small>'+esc(t('perDayN'))+'</small></span>'+stepper('ruleStep','data-k="perDay"',R.perDay)+'</div>'
    +'<div class="setrow"><span class="rl">'+esc(t('siteGap'))+'</span>'+stepper('ruleStep','data-k="siteGap"',R.siteGap)+'</div>'
    +'<div class="setrow"><span class="rl">'+esc(t('distinct'))+'</span>'+swBtn(R.distinct,'ruleToggle','data-k="distinct"')+'</div>'
    +'<div class="setrow"><span class="rl">'+esc(t('whenFail'))+'</span><div class="seg">'+['bend','strict'].map(k=>'<button class="'+(R.mode===k?'on':'')+'" data-act="ruleMode" data-v="'+k+'">'+esc(t(k))+'</button>').join('')+'</div></div>'
    +'<div class="setrow"><span class="rl">'+esc(t('nearKm'))+'</span><span class="numwrap"><input class="inp num" type="number" min="0" data-bind="rule" data-k="nearKm" value="'+R.nearKm+'"><span class="unit">'+unitL()+'</span></span></div>'
    +'<div class="setrow"><span class="rl">'+esc(t('weekStart'))+'</span>'+dd('rule','data-k="weekStart"',R.weekStart,[0,1,6].map(i=>[i,arr('dows')[i]]))+'</div>'
    +'</div></section>';
  h=h.replace('<div class="grid2"><section class="card" id="hard-card">',patternCard(R)+rankCard(R)+'<div class="grid2"><section class="card" id="hard-card">');
  const E=ws.engine;
  h+='<section class="card"><div class="card-head"><div><div class="kicker">'+esc(t('kEngine'))+'</div><h2 class="ctitle">'+esc(t('engineT'))+'</h2></div></div><div class="setgrid">'
    +'<div class="setrow"><span class="rl">'+esc(t('seed'))+'</span><input class="inp num" style="width:120px" type="number" min="1" data-bind="engine" data-k="seed" value="'+E.seed+'"><button class="ibtn" data-act="reroll">'+ic('ic-dice')+'</button></div>'
    +'<div class="setrow"><span class="rl">'+esc(t('quality'))+'</span><div class="seg">'+[['fast','qFast'],['balanced','qBal'],['thorough','qTh'],['max','qMax']].map(([k,l])=>'<button class="'+(E.quality===k?'on':'')+'" data-act="engQuality" data-v="'+k+'">'+esc(t(l))+'</button>').join('')+'</div></div>'
    +'<div class="setrow"><span class="rl">'+esc(t('runs'))+'</span>'+stepper('engRuns','',E.runs)+'</div>'
    +'<div class="setrow"><span class="rl">'+esc(t('live'))+'</span>'+swBtn(E.live,'engLive','')+'</div>'
    +'</div><p class="quiet">'+ic('ic-info')+esc(t('engineNote'))+'</p></section></div>';
  h+='<section class="card" id="weights-card"><div class="card-head"><div><div class="kicker">'+esc(t('kWeights'))+'</div><h2 class="ctitle">'+esc(t('weightsT'))+'</h2></div><button class="linkbtn" data-act="restoreW">'+ic('ic-undo')+esc(t('restoreW'))+'</button></div><div>';
  M.WEIGHT_KEYS.forEach(k=>{const on=ws.useW[k],v=ws.weights[k];
    h+='<div class="wrow'+(on?'':' off')+'">'+swBtn(on,'useW','data-k="'+k+'"',true)+'<span class="wlab">'+esc(t('wt_'+k))+'</span><input type="range" class="rng" min="0" max="100" step="1" value="'+v+'" style="--fill:'+v+'%" data-bind="weight" data-k="'+k+'"><span class="wv">'+v+'</span></div>'});
  h+='</div><p class="quiet">'+ic('ic-info')+esc(t('weightsNote'))+'</p></section>';
  return h;
}

const PATTERNS=[['free',0,0],['alt',1,1],['alt2',1,2],['p21',2,1],['p22',2,2],['p31',3,1],['p52',5,2]];
function patternStrip(rm,om){
  let h='<div class="pstrip" aria-hidden="true">';
  if(!rm){for(let i=0;i<14;i++)h+='<i class="w"></i>';return h+'</div>'}
  let i=0;while(i<14){for(let k=0;k<rm&&i<14;k++,i++)h+='<i class="w"></i>';for(let k=0;k<Math.max(1,om)&&i<14;k++,i++)h+='<i></i>'}
  return h+'</div>';
}
function patternCard(R){
  const cur=PATTERNS.find(p=>p[1]===R.runMax&&p[2]===R.offMin);
  let h='<section class="card" id="pattern-card"><div class="card-head"><div><div class="kicker">'+esc(t('kPattern'))+'</div><h2 class="ctitle">'+esc(t('patternT'))+'</h2></div>'+(cur?'':'<span class="chip">'+esc(t('customPat'))+'</span>')+'</div><div class="patgrid">';
  PATTERNS.forEach(([k,rm,om])=>{h+='<button class="patcard'+(cur&&cur[0]===k?' on':'')+'" data-act="pattern" data-rm="'+rm+'" data-om="'+om+'"><b>'+esc(t('pat_'+k))+'</b>'+patternStrip(rm,om)+'<small>'+esc(t('patD_'+k))+'</small></button>'});
  h+='</div><div class="patcustom"><span class="lbl">'+esc(t('patCustom'))+'</span><span class="sc">'+esc(t('patWork'))+stepper('ruleStep','data-k="runMax"',R.runMax||'∞')+'</span><span class="sc">'+esc(t('patRest'))+stepper('ruleStep','data-k="offMin"',R.offMin)+'</span>'+patternStrip(R.runMax,R.offMin)+'</div>'
    +'<p class="quiet">'+ic('ic-info')+esc(t('patternNote'))+'</p></section>';
  return h;
}
function rankCard(R){
  return '<section class="card" id="rank-card"><div class="card-head"><div><div class="kicker">'+esc(t('kRank'))+'</div><h2 class="ctitle">'+esc(t('rankT'))+'</h2></div></div><div class="setgrid">'
    +'<div class="setrow"><span class="rl">'+esc(t('rankGate'))+'<small>'+esc(t('rankGateN'))+'</small></span><div class="seg">'+['off','lead','all'].map(k=>'<button class="'+(R.rankGate===k?'on':'')+'" data-act="rankGate" data-v="'+k+'">'+esc(t('rg_'+k))+'</button>').join('')+'</div></div>'
    +'<div class="setrow"><span class="rl">'+esc(t('rankTol'))+'<small>'+esc(t('rankTolN'))+'</small></span>'+dd('rule','data-k="rankTol"',R.rankTol,[[0,'0 · '+t('tol0')],[25,'25 · '+t('tol25')],[50,'50 · '+t('tol50')]])+'</div>'
    +'<div class="setrow"><span class="rl">'+esc(t('rankScale'))+'</span><div class="lvrow">'+M.LEVELS.map(v=>lvlChip(v)+'<span class="tiny muted">'+esc(t('lvl'+v))+'</span>').join('')+'</div></div>'
    +'</div><p class="quiet">'+ic('ic-info')+esc(t('rankNote'))+'</p></section>';
}

function modelView(){
  const a=A(),ws=a.ws,C=a.compiled(),D=derive(),stale=a.isStale();
  const W=C.P.w,R=ws.rules;
  const bd=D&&!stale?D.r.breakdown||{}:null;
  const tot=bd?Math.max(1,sum(Object.keys(bd).map(k=>Math.max(0,bd[k])))):1;
  const E=eqDefs();
  const rows=E.soft;
  const hard=E.hard.map(x=>[x[0],x[1],x[2]]);
  let h='<section class="card" id="equation-card"><div class="card-head"><div><div class="kicker">'+esc(t('kModel'))+'</div><h2 class="ctitle">'+esc(t('modelT'))+'</h2></div><div class="row">'+(bd?'<span class="chip">'+esc(t('cost'))+' '+fmtN(D.r.cost)+'</span>':'<button class="btn sm" data-act="solve">'+ic('ic-wand')+esc(t('solve'))+'</button>')
    +'<div class="eqbar"><span class="lbl">'+esc(t('eqCopy'))+'</span><div class="seg mini">'+[['text','Text'],['latex','LaTeX'],['md','MD'],['json','JSON']].map(([k,l])=>'<button data-act="eqCopyAs" data-v="'+k+'" title="'+esc(t('eqCopy'))+' · '+l+'">'+ic('ic-copy')+l+'</button>').join('')+'</div></div><button class="btn sm primary" data-act="eqExport">'+ic('ic-down')+esc(t('eqExport'))+'</button></div></div>';
  const on=rows.filter(r=>W[r[1]]>0);
  h+='<div class="eq" dir="ltr"><span class="eqf">min&nbsp;J =</span> '+hard.map(x=>'<span class="eqt hard">'+esc(t(x[1]))+'</span>').join(' + ')+(on.length?' + '+on.map(r=>'<span class="eqt"><b>'+ws.weights[r[1]]+'</b>·'+esc(t(r[2]))+'</span>').join(' + '):'')+'</div>';
  h+='<p class="quiet">'+ic('ic-info')+esc(t('modelNote'))+'</p></section>';
  h+='<section class="card"><div class="card-head"><div><div class="kicker">'+esc(t('kNeedle'))+'</div><h2 class="ctitle">'+esc(t('needleT'))+'</h2></div><button class="linkbtn" data-act="restoreW">'+ic('ic-undo')+esc(t('restoreW'))+'</button></div>';
  h+='<div class="needle"><div class="nhead"><span></span><span>'+esc(t('term'))+'</span><span>'+esc(t('formula'))+'</span><span>'+esc(t('weightW'))+'</span><span>'+esc(t('share'))+'</span></div>';
  hard.forEach(([k,l,f])=>{const v=bd?bd[k]||0:0;h+='<div class="nrow hard"><span class="lock">'+ic('ic-lock')+'</span><span class="nl">'+esc(t(l))+'</span><code>'+esc(f)+'</code><span class="tiny muted">'+esc(t('fixed'))+'</span>'+shareBar(v,tot,bd)+'</div>'});
  rows.forEach(([k,wk,l,f])=>{const onW=ws.useW[wk],val=ws.weights[wk];const v=bd?Math.abs(bd[k]||0):0;
    h+='<div class="nrow'+(onW?'':' off')+'">'+swBtn(onW,'useW','data-k="'+wk+'"',true)+'<span class="nl">'+esc(t('wt_'+wk))+'<small>'+esc(t('why_'+wk))+'</small></span><code>'+esc(f)+'</code><span class="nw"><input type="range" class="rng" min="0" max="100" step="1" value="'+val+'" style="--fill:'+val+'%" data-bind="weight" data-k="'+wk+'"><span class="wv">'+val+'</span></span>'+shareBar(v,tot,bd)+'</div>'});
  h+='</div><p class="quiet">'+ic('ic-info')+esc(t('needleNote'))+'</p></section>';
  const P=C.P;
  h+='<div class="grid2"><section class="card"><div class="card-head"><div><div class="kicker">'+esc(t('kSize'))+'</div><h2 class="ctitle">'+esc(t('sizeT'))+'</h2></div></div><div class="kpis">'
    +kpi(t('kVisits'),P.V,t('sz_'+ws.sizing.mode))+kpi(t('seatsK'),P.Z,P.R+' '+t('roles').toLowerCase())+kpi(t('tabSites'),P.S,P.C+' '+t('catsK'))+kpi(t('tabPeople'),P.N,'')+kpi(t('itersK'),fmtN(P.iters),P.runs+'× · '+t(({fast:'qFast',balanced:'qBal',thorough:'qTh',max:'qMax'})[ws.engine.quality]))
    +'</div><p class="quiet">'+ic('ic-info')+esc(t('algoNote'))+'</p></section>';
  h+='<section class="card"><div class="card-head"><div><div class="kicker">'+esc(t('kFlow'))+'</div><h2 class="ctitle">'+esc(t('flowT'))+'</h2></div></div><ol class="flow">'+['f1','f2','f3','f4','f5'].map(k=>'<li><b>'+esc(t(k+'a'))+'</b><span>'+esc(t(k+'b'))+'</span></li>').join('')+'</ol></section></div>';
  return h;
}
function shareBar(v,tot,bd){if(!bd)return '<span class="nshare muted tiny">—</span>';const p=Math.max(0,v)/tot*100;return '<span class="nshare"><span class="bar"><i style="width:'+Math.min(100,p)+'%"></i></span><span class="mono tiny">'+(p<1&&v>0?'<1':Math.round(p))+'%</span></span>'}

function insightsView(){
  const a=A(),ws=a.ws,D=derive();
  if(!D||!D.m.visits.length)return '<section class="card"><div class="empty-state">'+ic('ic-chart','bigic')+'<h3 class="ctitle">'+esc(t('insightsT'))+'</h3><p>'+esc(t('noInsights'))+'</p><button class="btn primary" data-act="solve">'+ic('ic-wand')+esc(t('solve'))+'</button></div></section>';
  const m=D.m,r=D.r,st=r.stats;
  const stale=a.isStale();
  const ld=m.people.map((id,i)=>st.loads[i]);
  const nBreak=D.iss.filter(x=>x.sev==='warn').length,nOpen=D.iss.filter(x=>x.k==='open').reduce((s,x)=>s+x.n,0);
  const perRoleG=m.roles.map((rid,ri)=>{const ps=m.people.map((id,i)=>i).filter(i=>{const p=byId(ws.people,m.people[i]);return p&&p.roles[0]===rid});return gini(ps.map(i=>st.loads[i]/Math.max(.01,m.pTarget[i])))});
  const G=avg(perRoleG.filter(x=>isFinite(x)));
  let h=(stale?'<div class="banner stale">'+ic('ic-info')+'<span class="grow">'+esc(t('stale'))+'</span><button class="btn sm" data-act="solve">'+ic('ic-wand')+esc(t('resolve'))+'</button></div>':'');
  h+='<section class="card"><div class="card-head"><div><div class="kicker">'+esc(t('kKpi'))+'</div><h2 class="ctitle">'+esc(t('insightsT'))+'</h2></div><button class="btn sm" data-act="copyReport">'+ic('ic-copy')+esc(t('copyReport'))+'</button></div><div class="kpis">'
    +kpi(t('kWorkDays'),m.days.length,fmtDS(m.start)+' – '+fmtDS(m.end))
    +kpi(t('kVisits'),m.visits.length,r1(m.visits.length/Math.max(1,m.days.length))+' / '+t('day'))
    +kpi(t('kFilled'),st.filled+' / '+st.seats,Math.round(st.filled/Math.max(1,st.seats)*100)+'%',st.filled<st.seats?'bad':'good')
    +kpi(t('kDist'),fmtN(st.km)+' '+unitL(),'avg '+r1(st.km/Math.max(1,m.visits.length))+' '+unitL())
    +kpi(t('kFair'),G.toFixed(3),t('lowerBetter'),G<.08?'good':'')
    +kpi(t('kBreaks'),nBreak+nOpen,nOpen+' '+t('open')+' · '+nBreak+' ⚠',nBreak+nOpen?'bad':'good')
    +kpi(t('kCover'),(st.covered||0)+' / '+m.sites.length,Math.round((st.covered||0)/Math.max(1,m.sites.length)*100)+'%')
    +kpi(t('kCrit'),st.critN?Math.round(st.critHit/st.critN*100)+'%':'—',t('kCritS',{g:r1(st.rankGap||0)}),st.critN&&st.critHit<st.critN?'':'good')
    +(st.rc?kpi(t('kRc'),st.rc.due?Math.round(st.rc.met/Math.max(1,st.rc.due)*100)+'%':'—',t('kRcS',{e:st.rc.early,o:st.rc.over}),st.rc.early+st.rc.over?'':'good'):'')
    +kpi(t('kCost'),fmtN(r.cost),r.runs+'× · '+fmtMs(r.ms))
    +'</div></section>';
  const cnt=k=>D.iss.filter(x=>x.k===k).length;
  const R=ws.rules;
  const chk=(lbl,n,on)=>'<div class="check '+(on===false?'na':n?'bad':'ok')+'">'+ic(on===false?'ic-minus':n?'ic-alert':'ic-check')+'<span class="clbl">'+esc(lbl)+'</span><span class="cval">'+esc(on===false?t('off'):n?t('nFound',{n}):t('ok'))+'</span></div>';
  h+='<div class="grid2"><section class="card"><div class="card-head"><div><div class="kicker">'+esc(t('kRules'))+'</div><h2 class="ctitle">'+esc(t('auditT'))+'</h2></div></div><div class="checks">'
    +chk(t('a_cover'),nOpen+cnt('nosite'))
    +chk(t('a_rest'),cnt('rest')+cnt('run'),R.runMax>0)
    +chk(t('a_goals'),cnt('goalmiss')+cnt('goalover')+cnt('goalgrp'),(ws.goals||[]).some(g=>g.on))
    +chk(t('a_rank'),cnt('rankgap'),R.rankGate!=='off')
    +chk(t('a_perday'),cnt('perday'),R.perDay>0)
    +chk(t('a_limits'),cnt('maxload')+cnt('maxweek'))
    +chk(t('a_avail'),cnt('unavail')+cnt('ban')+cnt('siteoff'))
    +chk(t('a_dup'),cnt('dup'),R.distinct)
    +chk(t('a_bounds'),cnt('sitemax')+cnt('sitemin'))
    +chk(t('a_gap'),cnt('sitegap'),R.siteGap>0)
    +chk(t('a_recency'),cnt('rcearly')+cnt('rcover'),M.normRecency(ws.recency).mode!=='off')
    +chk(t('a_pairs'),cnt('avoid'))
    +chk(t('a_book'),cnt('rulesite')+cnt('ruleday')+cnt('rulewith')+D.iss.filter(x=>(x.k==='ruleteam'||x.k==='rulecount')&&x.sev==='warn').length,(ws.book||[]).some(r=>r.on))
    +'</div></section>';
  const cats=m.cats.map(id=>catOf(id)).filter(Boolean);
  const tot=Math.max(1,sum(st.catCount));
  h+='<section class="card"><div class="card-head"><div><div class="kicker">'+esc(t('kCats'))+'</div><h2 class="ctitle">'+esc(t('mixT'))+'</h2></div></div>'
    +'<div class="lbl">'+esc(t('achieved'))+'</div><div class="mixbar">'+cats.map((c,i)=>'<i style="--c:'+esc(c.color)+';width:'+(st.catCount[i]/tot*100)+'%"></i>').join('')+'</div>'
    +'<div class="lbl">'+esc(t('targeted'))+'</div><div class="mixbar">'+cats.map((c,i)=>'<i style="--c:'+esc(c.color)+';opacity:.55;width:'+(m.catTarget[i]/tot*100)+'%"></i>').join('')+'</div>'
    +'<div class="legend">'+cats.map((c,i)=>'<span><span class="dot" style="--c:'+esc(c.color)+'"></span>'+esc(c.name)+' <b>'+st.catCount[i]+'</b><span class="muted mono tiny">/ '+r1(m.catTarget[i])+'</span></span>').join('')+'</div>';
  const bd=r.breakdown||{};const bks=Object.keys(bd).filter(k=>bd[k]>.05).sort((x,y)=>bd[y]-bd[x]);const bmax=Math.max(1,...bks.map(k=>bd[k]));
  h+='<div class="grouplbl" style="margin-top:22px">'+esc(t('costT'))+'</div>'+bks.map(k=>'<div class="costrow"><span>'+esc(t('term_'+k))+'</span><div class="bar"><i style="width:'+(bd[k]/bmax*100)+'%"></i></div><span class="cv2">'+fmtN(bd[k])+'</span></div>').join('')
    +'<p class="quiet">'+ic('ic-info')+esc(t('costNote'))+'</p></section></div>';
  const maxL=Math.max(1,...ld,...m.pTarget.map(Math.ceil));
  h+='<div class="grid2"><section class="card"><div class="card-head"><div><div class="kicker">'+esc(t('kFair'))+'</div><h2 class="ctitle">'+esc(t('loadT'))+'</h2></div></div>';
  const seen=new Set();
  m.roles.forEach(rid=>{
    const ro=roleOf(rid);if(!ro)return;
    const idx=m.people.map((id,i)=>i).filter(i=>{const p=byId(ws.people,m.people[i]);return p&&p.roles.includes(rid)&&!seen.has(p.id)});
    if(!idx.length)return;
    h+='<div class="grouplbl"><span class="dot" style="--c:'+esc(ro.color)+'"></span>'+esc(ro.name)+'</div>';
    idx.sort((x,y)=>st.loads[y]-st.loads[x]).forEach(i=>{
      const p=byId(ws.people,m.people[i]);seen.add(p.id);
      const L2=st.loads[i],T2=m.pTarget[i];
      h+='<div class="loadrow"><span class="ln" data-pid="'+esc(p.id)+'">'+esc(p.name)+'</span><div class="bar'+(L2>T2+1.01?' over':'')+'" style="--c:'+esc(ro.color)+'"><i style="width:'+(L2/maxL*100)+'%"></i><span class="tick" style="--t:'+(T2/maxL*100)+'%"></span></div><span class="lv">'+L2+' <small>/ '+r1(T2)+'</small></span></div>';
    });
  });
  h+='<p class="quiet">'+ic('ic-info')+esc(t('loadNote'))+'</p></section>';
  const sites=m.sites.map((id,i)=>({s:byId(ws.sites,id),u:st.siteUse[i]})).filter(x=>x.s);
  const unused=sites.filter(x=>!x.u);
  const top=sites.slice().sort((x,y)=>y.u-x.u).slice(0,12);const umax=Math.max(1,...top.map(x=>x.u));
  h+='<section class="card"><div class="card-head"><div><div class="kicker">'+esc(t('term_rotate'))+'</div><h2 class="ctitle">'+esc(t('usageT'))+'</h2></div><span class="chip">'+esc(t('unused'))+' · '+unused.length+'</span></div>'
    +top.map(x=>'<div class="loadrow"><span class="ln"><span class="dot" style="--c:'+esc(catColor(x.s.cat))+'"></span>'+esc(x.s.name)+'</span><div class="bar" style="--c:'+esc(catColor(x.s.cat))+'"><i style="width:'+(x.u/umax*100)+'%"></i></div><span class="lv">'+x.u+'×</span></div>').join('')
    +(unused.length?'<div class="grouplbl" style="margin-top:16px">'+esc(t('unused'))+'</div><div class="tokens">'+unused.slice(0,40).map(x=>'<span class="chip"><span class="dot" style="--c:'+esc(catColor(x.s.cat))+'"></span>'+esc(x.s.name)+'</span>').join('')+(unused.length>40?'<span class="more">+'+(unused.length-40)+'</span>':'')+'</div>':'')
    +'</section></div>';
  h+='<section class="card"><div class="card-head"><div><div class="kicker">'+esc(t('kSched'))+'</div><h2 class="ctitle">'+esc(t('ledgerT'))+'</h2></div></div><div class="tblwrap"><table><thead><tr><th>'+esc(t('day'))+'</th><th class="numc">'+esc(t('kVisits'))+'</th><th>'+esc(t('focus'))+'</th><th class="numc">'+esc(t('dist'))+'</th><th class="numc">'+esc(t('kFilled'))+'</th><th>'+esc(t('issues'))+'</th></tr></thead><tbody>'
    +m.days.map((dd,d)=>{const vs=D.byDay[d];const km=sum(vs.map(v=>{const s=D.siteOfV(v);return s?+s.km:0}));let seats=0,fl=0;vs.forEach(v=>{const vis=m.visits[v];for(let z=vis.z0;z<vis.z0+vis.zn;z++)if(st.active[z]){seats++;if(r.seatP[z]>=0)fl++}});
      const ni=D.iss.filter(x=>issueDay(x,D)===dd.iso&&x.sev!=='info').length;
      const foc=dd.focus==='near'?t('fNear'):dd.focus==='far'?t('fFar'):(catOf(dd.focus)?catOf(dd.focus).name:t('fAuto'));
      return '<tr><td>'+esc(fmtD(dd.iso))+'</td><td class="numc">'+vs.length+'</td><td>'+esc(foc)+'</td><td class="numc">'+r1(km)+' '+unitL()+'</td><td class="numc">'+fl+'/'+seats+'</td><td>'+(ni?'<span class="chip bad">'+ni+'</span>':'<span class="chip good">'+ic('ic-check')+'</span>')+'</td></tr>'}).join('')
    +'</tbody></table></div></section>';
  return h;
}
function kpi(l,v,s,cls){return '<div class="kpi '+(cls||'')+'"><div class="kl">'+esc(l)+'</div><div class="kv">'+esc(v)+'</div><div class="ks">'+esc(s||'')+'</div></div>'}

function workspaceView(){
  const a=A(),ws=a.ws;
  let h=sourceCard()+templatesHub()+'<section class="card"><div class="card-head"><div><div class="kicker">'+esc(t('kWsList'))+'</div><h2 class="ctitle">'+esc(t('wsT'))+'</h2></div>'
    +'<label class="fld"><span>'+esc(t('wsName'))+'</span><input class="inp slim" data-bind="wsName" value="'+esc(ws.name)+'" style="min-width:220px"></label></div><div class="wscards">';
  a.ix.list.slice().sort((x,y)=>y.updated-x.updated).forEach(it=>{
    const on=it.id===ws.id;
    h+='<div class="wscard'+(on?' on':'')+'"><div class="wn">'+esc(it.name)+'</div><div class="wm">'+esc(new Date(it.updated).toLocaleString(L()==='ar'?'ar-EG':'en-GB',{dateStyle:'medium',timeStyle:'short'}))+(on?' · '+esc(t('activeWs')):'')+'</div><div class="wa">'
      +(on?'':'<button class="btn sm" data-act="wsOpen" data-id="'+esc(it.id)+'">'+esc(t('open_'))+'</button>')
      +'<button class="btn sm ghost" data-act="wsDup" data-id="'+esc(it.id)+'">'+ic('ic-copy')+esc(t('duplicate'))+'</button>'
      +(a.ix.list.length>1?'<button class="ibtn" data-act="wsDel" data-id="'+esc(it.id)+'" title="'+esc(t('del'))+'">'+ic('ic-trash')+'</button>':'')+'</div></div>';
  });
  h+='</div><div class="grouplbl" style="margin-top:22px">'+esc(t('newFrom'))+'</div><div class="wscards">'
    +M.TEMPLATE_ORDER.map(k=>'<button class="tplcard" data-act="wsNew" data-tpl="'+k+'"><b>'+ic('ic-plus')+esc(t('tpl_'+k))+'</b><span>'+esc(t('tplD_'+k))+'</span></button>').join('')
    +'</div><p class="quiet">'+ic('ic-info')+esc(t('wsNote'))+'</p></section>';
  h+='<div class="grid2"><section class="card"><div class="card-head"><div><div class="kicker">'+esc(t('kSnaps'))+'</div><h2 class="ctitle">'+esc(t('snapsT'))+'</h2></div><button class="btn sm" data-act="snapSave" '+(ws.plan?'':'disabled')+'>'+ic('ic-camera')+esc(t('saveSnap'))+'</button></div>';
  if(!ws.snapshots.length)h+='<div class="muted tiny">'+esc(t('noSnaps'))+'</div>';
  ws.snapshots.forEach(s=>{h+='<div class="snap"><span class="sn">'+esc(s.name)+'</span><span class="sm">'+esc(new Date(s.at).toLocaleString(L()==='ar'?'ar-EG':'en-GB',{dateStyle:'short',timeStyle:'short'}))+' · '+esc(t('cost'))+' '+fmtN(s.plan.res.cost)+'</span><button class="btn sm" data-act="snapRestore" data-id="'+esc(s.id)+'">'+esc(t('restore'))+'</button><button class="btn sm ghost" data-act="snapHist" data-id="'+esc(s.id)+'" title="'+esc(t('histAddPlan'))+'">'+ic('ic-hist')+esc(t('histSnap'))+'</button><button class="ibtn" data-act="snapDel" data-id="'+esc(s.id)+'">'+ic('ic-trash')+'</button></div>'});
  h+='<p class="quiet">'+ic('ic-info')+esc(t('snapNote'))+'</p></section>';
  h+='<section class="card"><div class="card-head"><div><div class="kicker">'+esc(t('kIO'))+'</div><h2 class="ctitle">'+esc(t('ioT'))+'</h2></div></div><div class="setgrid">'
    +'<div class="setrow"><span class="rl">JSON</span><button class="btn sm" data-act="wsExport">'+ic('ic-down')+esc(t('expJson'))+'</button><button class="btn sm" data-act="wsImport">'+ic('ic-up')+esc(t('impJson'))+'</button></div>'
    +'<div class="setrow"><span class="rl">'+esc(t('eqExportT'))+'</span><button class="btn sm" data-act="eqExport">'+ic('ic-sigma')+esc(t('eqExport'))+'</button></div>'
    +'<div class="setrow"><span class="rl">'+esc(t('dataset'))+'<small>'+esc(t('datasetN'))+'</small></span><button class="btn sm primary" data-act="loadDataset">'+ic('ic-layers')+esc(t('loadDataset'))+'</button><button class="btn sm" data-act="wsImport">'+ic('ic-up')+esc(t('impDataset'))+'</button></div>'
    +'<div class="setrow"><span class="rl">'+esc(t('language'))+'</span><div class="seg"><button class="'+(L()==='en'?'on':'')+'" data-act="lang" data-v="en">English</button><button class="'+(L()==='ar'?'on':'')+'" data-act="lang" data-v="ar">العربية</button></div></div>'
    +'<div class="setrow"><span class="rl">'+esc(t('theme'))+'</span><div class="seg"><button class="'+(a.prefs.theme!=='dusk'?'on':'')+'" data-act="themeSet" data-v="light">'+ic('ic-sun')+esc(t('light'))+'</button><button class="'+(a.prefs.theme==='dusk'?'on':'')+'" data-act="themeSet" data-v="dusk">'+ic('ic-moon')+esc(t('dusk'))+'</button></div></div>'
    +'<div class="setrow"><span class="rl">'+esc(t('storage'))+'</span><span class="mono tiny">'+(M.Store.usage()/1024).toFixed(0)+' KB</span></div>'
    +'<div class="setrow"><span class="rl">'+esc(t('resetWs'))+'</span><button class="btn sm" data-act="wsReset">'+ic('ic-undo')+esc(t('resetWs').split(' ')[0])+'</button></div>'
    +'</div></section></div>';
  return h;
}

function exportModal(st){
  const a=A(),ws=a.ws;
  const fmts=[['csv','CSV'],['tsv','Excel (TSV)'],['md','Markdown'],['wa','WhatsApp'],['ics','Calendar (.ics)'],['json','JSON']];
  const ppl=ws.people.filter(p=>p.active);
  const cols=[['cat','colCat'],['km','colDist'],['zone','colZone'],['dow','colDow']];
  let h='<div class="modal" role="dialog" aria-modal="true"><div class="mhead"><div><div class="kicker">'+esc(t('exportB'))+'</div><h2 class="ctitle">'+esc(t('exportT'))+'</h2></div><button class="ibtn" data-act="modalClose">'+ic('ic-x')+'</button></div>'
    +'<div class="msec"><div class="mlab">'+esc(t('fmt'))+'</div><div class="seg">'+fmts.map(([k,l])=>'<button class="'+(st.fmt===k?'on':'')+'" data-act="expFmt" data-v="'+k+'">'+esc(l)+'</button>').join('')+'</div></div>'
    +'<div class="msec row"><div><div class="mlab">'+esc(t('forWho'))+'</div>'+dd('expWho','',st.who,[['',t('everyone')]].concat(ppl.map(p=>[p.id,p.name])))+'</div>'
    +'<div class="grow"><div class="mlab">'+esc(t('cols'))+'</div><div class="colgrid">'+cols.map(([k,l])=>'<span class="colcell">'+swBtn(st.cols[k],'expCol','data-k="'+k+'"',true)+esc(t(l))+'</span>').join('')+'</div></div></div>'
    +'<div class="msec"><div class="mlab">'+esc(t('preview'))+'</div><pre class="export-preview" id="expPrev" dir="auto"></pre></div>'
    +'<div class="mfoot"><button class="btn primary" data-act="expDownload">'+ic('ic-down')+esc(t('download'))+'</button><button class="btn" data-act="expCopy">'+ic('ic-copy')+esc(t('copy'))+'</button><span class="grow"></span><button class="btn ghost" data-act="modalClose">'+esc(t('close'))+'</button></div></div>';
  return h;
}
function paletteHTML(q,items,sel){
  return '<div class="palette" role="dialog" aria-modal="true"><div class="pin">'+ic('ic-search')+'<input id="palIn" autocomplete="off" placeholder="'+esc(t('palPh'))+'" value="'+esc(q)+'"><kbd>Esc</kbd></div><div class="pal-list" id="palList">'+paletteList(items,sel)+'</div></div>';
}
function paletteList(items,sel){
  if(!items.length)return '<div class="pal-item muted">'+esc(t('palNone'))+'</div>';
  return items.map((it,i)=>'<div class="pal-item'+(i===sel?' on':'')+'" data-act="palRun" data-i="'+i+'">'+ic(it.icon||'ic-cmd')+'<span>'+esc(it.label)+'</span><small>'+esc(it.kind)+'</small></div>').join('');
}
function kbdModal(){
  const rows=[['<kbd>1</kbd>–<kbd>8</kbd>',t('kbTabs')],['<kbd>G</kbd>',t('kbSolve')],['<kbd>R</kbd>',t('kbReroll')],['<kbd>E</kbd>',t('kbExport')],['<kbd>L</kbd>',t('kbLayout')],['<kbd>Ctrl</kbd><kbd>K</kbd>',t('kbPalette')],['<kbd>Ctrl</kbd><kbd>Z</kbd> / <kbd>Ctrl</kbd><kbd>⇧</kbd><kbd>Z</kbd>',t('kbUndo')],['<kbd>?</kbd>',t('kbHelp')]];
  return '<div class="modal sm" role="dialog" aria-modal="true"><div class="mhead"><div><div class="kicker">'+esc(t('kbdT'))+'</div><h2 class="ctitle">'+esc(t('kbdT'))+'</h2></div><button class="ibtn" data-act="modalClose">'+ic('ic-x')+'</button></div><div class="kbgrid msec">'+rows.map(([k,l])=>'<span>'+k+'</span><span>'+esc(l)+'</span>').join('')+'</div></div>';
}
const lvlSel=()=>M.LEVELS.map(v=>[String(v),v+' · '+t('lvl'+v)]);
function whoKOpts(){return M.WHO_K.map(k=>[k,t('bw_'+k)])}
function whatKOpts(){return M.WHAT_K.map(k=>[k,t('bx_'+k)])}
function whoVOpts(k){
  const ws=A().ws;
  if(k==='person')return ws.people.map(p=>[p.id,p.name,(roleOf(p.roles[0])||{}).color,p.gender?t('g_'+p.gender):'']);
  if(k==='role')return ws.roles.map(r=>[r.id,r.name,r.color]);
  if(k==='gender')return [['m',t('g_m')],['f',t('g_f')]];
  if(k==='rankGe'||k==='rankLe')return lvlSel();
  if(k==='homeLoc')return (ws.locations||[]).filter(l=>ws.people.some(p=>p.homeLoc===l.id)).sort((a,b)=>a.km-b.km).map(l=>[l.id,l.name,null,ws.people.filter(p=>p.homeLoc===l.id).length+'']);
  return [];
}
function goalWhatVOpts(k){
  const ws=A().ws,pl=M.plannable(ws);
  if(k==='site')return pl.map(s=>[s.id,s.name,catColor(s.cat),(locOf(s.loc)||{}).name||'']);
  if(k==='cat')return ws.categories.filter(c=>c.planned&&pl.some(s=>s.cat===c.id)).map(c=>[c.id,c.name,c.color,pl.filter(s=>s.cat===c.id).length+'']);
  if(k==='loc')return (ws.locations||[]).filter(l=>pl.some(s=>s.loc===l.id)).sort((a,b)=>a.km-b.km).map(l=>[l.id,l.name,null,r1(l.km)+' '+unitL()+' · '+pl.filter(s=>s.loc===l.id).length]);
  if(k==='tag'){const c={};pl.forEach(x=>{if(x.tag)c[x.tag]=(c[x.tag]||0)+1});return Object.keys(c).sort().map(x=>[x,x,null,c[x]+''])}
  return whatVOpts(k);
}
function whatVOpts(k){
  const ws=A().ws;
  if(k==='site')return ws.sites.filter(s=>s.active).map(s=>[s.id,s.name,catColor(s.cat),(locOf(s.loc)||{}).name||'']);
  if(k==='cat')return ws.categories.map(c=>[c.id,c.name,c.color]);
  if(k==='loc')return (ws.locations||[]).slice().sort((a,b)=>a.km-b.km).map(l=>[l.id,l.name,null,r1(l.km)+' '+unitL()]);
  if(k==='tag'){const s=new Set();ws.sites.forEach(x=>{if(x.tag)s.add(x.tag)});return Array.from(s).sort().map(x=>[x,x])}
  if(k==='critGe'||k==='critLe')return lvlSel();
  return [];
}
function mLabel(m,isWho){
  const one=mLabel1(m,isWho);
  return m.more&&m.more.length?one+m.more.map(c=>' '+t(m.join==='or'?'bj_or':'bj_and')+' '+mLabel1(c,isWho)).join(''):one;
}
function mLabel1(m,isWho){
  const ws=A().ws;
  if(m.k==='all')return t(isWho?'bw_all':'bx_all');
  const nm=(arr,id)=>{const x=byId(arr,id);return x?x.name:'?'};
  const one=x=>{if(m.k==='person')return nm(ws.people,x);if(m.k==='role')return nm(ws.roles,x);if(m.k==='gender')return t('g_'+x);if(m.k==='site')return nm(ws.sites,x);if(m.k==='cat')return nm(ws.categories,x);if(m.k==='loc'||m.k==='homeLoc')return nm(ws.locations||[],x);if(m.k==='kmGe'||m.k==='kmLe')return x+' '+unitL();return x};
  let v=Array.isArray(m.v)?(m.v.length?(m.v.length>3?m.v.slice(0,3).map(one).join(' / ')+' +'+(m.v.length-3):m.v.map(one).join(' / ')):'?'):one(m.v);
  return (m.not?t('bNotW')+' ':'')+t((isWho?'bw_':'bx_')+m.k)+' '+v;
}
function ruleText(r){
  if(!r)return '—';
  if(r.rel==='team')return t('bt_sent',{what:mLabel(r.what),sense:t('bs_team_'+r.sense),op:t('op_'+r.op),n:r.n,who:mLabel(r.who,true)});
  if(r.rel==='count')return t('bc_sent',{who:mLabel(r.who,true),sense:t('bs_count_'+r.sense),op:t('op_'+r.op),n:r.n,what:mLabel(r.what),per:t(r.per==='week'?'bc_week':'bc_plan')});
  let obj;
  if(r.rel==='day'&&r.what.k==='dates')obj=r.what.v||'—';
  else if(r.rel==='day')obj=r.what.v.map((x,i)=>x?arr('dows')[i]:null).filter(Boolean).join(', ')||'—';
  else obj=mLabel(r.what,r.rel==='with');
  return mLabel(r.who,true)+' '+t('bs_'+r.rel+'_'+r.sense)+' '+obj;
}
function mPicker(rid,side,m,isWho,rel){
  let h='<span class="mgrp">'+mPicker1(rid,side,m,isWho,'');
  (m.more||[]).forEach((c,i)=>{h+='<button class="joinbtn" data-act="bookJoin" data-id="'+esc(rid)+'" data-side="'+side+'">'+esc(t(m.join==='or'?'bj_or':'bj_and'))+'</button>'+mPicker1(rid,side,c,isWho,i)+'<button class="ibtn xs" data-act="bookLess" data-id="'+esc(rid)+'" data-side="'+side+'" data-i="'+i+'" title="'+esc(t('remove'))+'">'+ic('ic-x')+'</button>'});
  if(m.k!=='all'&&(m.more||[]).length<3)h+='<button class="ibtn xs" data-act="bookMore" data-id="'+esc(rid)+'" data-side="'+side+'" title="'+esc(t('bMore'))+'">'+ic('ic-plus')+'</button>';
  return h+'</span>';
}
function mPicker1(rid,side,m,isWho,mi){
  const kOpts=(isWho?whoKOpts():whatKOpts()).filter(o=>mi===''||o[0]!=='all');
  const at='data-id="'+esc(rid)+'" data-side="'+side+'"'+(mi===''?'':' data-mi="'+mi+'"');
  let h=(m.k!=='all'?'<button class="notbtn'+(m.not?' on':'')+'" data-act="bookNot" '+at+' title="'+esc(t('bNotT'))+'">'+esc(t('bNot'))+'</button>':'')+dd('book',at+' data-f="k"',m.k,kOpts,{cls:'bdd'});
  if(m.k==='kmGe'||m.k==='kmLe')h+='<span class="numwrap"><input class="inp num s" type="number" min="0" data-bind="bookNum" '+at+' value="'+esc(m.v)+'"><span class="unit">'+unitL()+'</span></span>';
  else if(m.k!=='all'){const vo=isWho?whoVOpts(m.k):whatVOpts(m.k);h+=dd('book',at+' data-f="v"',m.v,vo,{search:vo.length>8,ph:vo.some(o=>String(o[0])===String(m.v))?null:t('pick'),cls:'bdd'})}
  return h;
}
function bookRow(r,vio){
  const hard=M.isHard(r);
  const id=esc(r.id);
  const relOpts=M.RELS.map(k=>[k,t('br_'+k)]);
  const grp=r.rel==='team'||r.rel==='count';
  const senses=grp?['prefer','only']:M.SENSES;
  const sOpts=senses.map(k=>[k,t('bs_'+r.rel+'_'+k)]);
  let sent='';
  if(r.rel==='team'){
    sent='<span class="gw">'+esc(t('bt_visitsTo'))+'</span>'+mPicker(r.id,'what',r.what,false,r.rel)
      +dd('book','data-id="'+id+'" data-f="sense"',r.sense,sOpts,{cls:'bdd sense pos '+(hard?'hard':'soft')})
      +dd('book','data-id="'+id+'" data-f="op"',r.op,M.TEAM_OPS.map(k=>[k,t('op_'+k)]),{cls:'bdd'})
      +stepper('bookN','data-id="'+id+'"',r.n)+mPicker(r.id,'who',r.who,true,r.rel);
  }else if(r.rel==='count'){
    sent=mPicker(r.id,'who',r.who,true,r.rel)
      +dd('book','data-id="'+id+'" data-f="sense"',r.sense,sOpts,{cls:'bdd sense pos '+(hard?'hard':'soft')})
      +dd('book','data-id="'+id+'" data-f="op"',r.op,M.COUNT_OPS.map(k=>[k,t('op_'+k)]),{cls:'bdd'})
      +stepper('bookN','data-id="'+id+'"',r.n)+'<span class="gw">'+esc(t('bc_visitsTo'))+'</span>'+mPicker(r.id,'what',r.what,false,r.rel)
      +'<div class="seg mini"><button class="'+(r.per!=='week'?'on':'')+'" data-act="bookPer" data-id="'+id+'">'+esc(t('bc_plan'))+'</button><button class="'+(r.per==='week'?'on':'')+'" data-act="bookPer" data-id="'+id+'">'+esc(t('bc_week'))+'</button></div>';
  }else{
    sent=mPicker(r.id,'who',r.who,true,r.rel)+dd('book','data-id="'+id+'" data-f="sense"',r.sense,sOpts,{cls:'bdd sense '+(r.sense==='prefer'||r.sense==='only'?'pos':'neg')+' '+(hard?'hard':'soft')});
    if(r.rel==='day'){const dts=r.what.k==='dates';sent+='<div class="seg mini"><button class="'+(dts?'':'on')+'" data-act="bookDayMode" data-id="'+id+'" data-v="dow">'+esc(t('bd_dow'))+'</button><button class="'+(dts?'on':'')+'" data-act="bookDayMode" data-id="'+id+'" data-v="dates">'+esc(t('bd_dates'))+'</button></div>';
      if(dts)sent+='<input class="inp slim bdates" dir="ltr" data-bind="bookDates" data-id="'+id+'" value="'+esc(r.what.v)+'" placeholder="2026-10-06, 2026-10-12..2026-10-15">';
      else{const n=arr('dows1');const w0=A().ws.rules.weekStart;sent+='<div class="wds">';for(let k=0;k<7;k++){const i=(w0+k)%7;sent+='<button class="wd'+(r.what.v[i]?' on':'')+'" data-act="bookDow" data-id="'+id+'" data-i="'+i+'" title="'+esc(arr('dows')[i])+'">'+n[i]+'</button>'}sent+='</div>'}}
    else sent+=mPicker(r.id,'what',r.what,r.rel==='with',r.rel);
  }
  const vc=vio==null?'':(vio?'<span class="chip '+(hard?'bad':'warn')+'" title="'+esc(t('bookVio'))+'">'+ic('ic-alert')+vio+'</span>':'<span class="chip good">'+ic('ic-check')+'</span>');
  return '<div class="brule'+(r.on?'':' off')+(hard?' hard':'')+'" data-rid="'+id+'">'
    +swBtn(r.on,'bookOn','data-id="'+id+'"',true)
    +'<div class="bmain"><div class="bsent">'+dd('book','data-id="'+id+'" data-f="rel"',r.rel,relOpts,{cls:'bdd rel'})+sent+'</div>'
    +'<div class="bmeta">'+(hard?'<span class="bstrength hard">'+ic('ic-lock')+esc(t('bHard'))+'</span>':'<span class="bstrength">'+esc(t('bSoft'))+'<input type="range" class="rng sm" min="0" max="100" step="5" value="'+r.w+'" style="--fill:'+r.w+'%" data-bind="bookW" data-id="'+id+'"><span class="wv">'+r.w+'</span></span>')
    +'<input class="inp bare bnote" data-bind="bookNote" data-id="'+id+'" value="'+esc(r.note||'')+'" placeholder="'+esc(t('bNotePh'))+'">'+vc+'</div></div>'
    +'<div class="bacts"><button class="ibtn" data-act="bookFlip" data-id="'+id+'" title="'+esc(t('bFlip'))+'">'+ic('ic-flip')+'</button>'
    +'<button class="ibtn'+(hard?' on':'')+'" data-act="bookHard" data-id="'+id+'" title="'+esc(hard?t('bMakeSoft'):t('bMakeHard'))+'">'+ic('ic-lock')+'</button>'
    +'<button class="ibtn" data-act="bookDup" data-id="'+id+'" title="'+esc(t('duplicate'))+'">'+ic('ic-copy')+'</button>'
    +'<button class="ibtn" data-act="bookDel" data-id="'+id+'" title="'+esc(t('remove'))+'">'+ic('ic-trash')+'</button></div></div>';
}
function bookVio(){
  const a=A(),D=derive();if(!D||a.isStale())return null;
  const ids=D.m.book||[];const c={};ids.forEach(id=>c[id]=0);
  D.iss.forEach(x=>{if(x.b!=null&&ids[x.b]!=null&&/^rule/.test(x.k))c[ids[x.b]]++});
  return c;
}
const BOOK_F=[['all','bf_all'],['person','bf_person'],['gender','bf_gender'],['group','bf_group'],['hard','bf_hard']];
function bookKind(r,k){
  const pk=r.who.k==='person'||r.what.k==='person';
  if(k==='person')return pk;
  if(k==='gender')return r.who.k==='gender'||r.what.k==='gender';
  if(k==='group')return !pk;
  if(k==='hard')return M.isHard(r);
  return true;
}
function bookCard(){
  const a=A(),ws=a.ws,book=ws.book||[];
  const vio=bookVio();
  const tpl=(a.config&&a.config.ruleTemplates)||[];
  const fk=a.f.bookQ||'all';
  const addOpts=[['__blank',t('bBlank')]].concat(tpl.map((x,i)=>[String(i),(x.label&&(x.label[L()]||x.label.en))||('#'+(i+1))]));
  const list=book.filter(r=>bookKind(r,fk));
  let h='<section class="card" id="book-card"><div class="card-head"><div><div class="kicker">'+esc(t('kBook'))+'</div><h2 class="ctitle">'+esc(t('bookT'))+' <span class="muted mono tiny">'+book.filter(r=>r.on).length+' / '+book.length+'</span></h2></div>'
    +'<div class="row">'+dd('bookAdd','','',addOpts,{ph:'+ '+t('bAdd'),cls:'btn-dd'})
    +'<button class="ibtn" data-act="bookJson" title="'+esc(t('bJson'))+'">'+ic('ic-code')+'</button>'
    +'<button class="ibtn" data-act="bookRestore" title="'+esc(t('bRestore'))+'">'+ic('ic-undo')+'</button>'
    +(book.length?'<button class="ibtn" data-act="bookAllOn" title="'+esc(t('bAllOn'))+'">'+ic('ic-check')+'</button>':'')+'</div></div>';
  if(book.length>3)h+='<div class="toolbar slim">'+BOOK_F.map(([k,l])=>{const n=book.filter(r=>bookKind(r,k)).length;return n||k==='all'?'<button class="fchip'+(fk===k?' on':'')+'" data-act="bookFilter" data-v="'+k+'">'+esc(t(l))+' <small>'+n+'</small></button>':''}).join('')+'</div>';
  if(!book.length)h+='<div class="goal-empty">'+ic('ic-flip')+'<span>'+esc(t('bookEmpty'))+'</span></div>';
  else if(!list.length)h+='<div class="goal-empty">'+esc(t('noMatch'))+'</div>';
  else h+='<div class="brules">'+list.map(r=>bookRow(r,vio?vio[r.id]:null)).join('')+'</div>';
  h+='<details class="hint"><summary>'+ic('ic-info')+esc(t('bHowT'))+'</summary><div class="blegend"><span><b class="pos">'+esc(t('bLgPrefer'))+'</b> ⇄ <b class="neg">'+esc(t('bLgAvoid'))+'</b></span><span>'+ic('ic-lock')+'<b class="pos">'+esc(t('bLgOnly'))+'</b> ⇄ <b class="neg">'+esc(t('bLgNever'))+'</b></span><span>'+ic('ic-flip')+esc(t('bLgFlip'))+'</span><span><b class="notdemo">'+esc(t('bNot'))+'</b>'+esc(t('bLgNot'))+'</span></div><p class="quiet">'+esc(t('bookNote'))+'</p></details></section>';
  return h;
}
function jsonModal(st){
  return '<div class="modal" role="dialog" aria-modal="true"><div class="mhead"><div><div class="kicker">JSON</div><h2 class="ctitle">'+esc(t(st.title))+'</h2></div><button class="ibtn" data-act="modalClose">'+ic('ic-x')+'</button></div>'
    +'<p class="quiet" style="margin-top:4px">'+ic('ic-info')+esc(t(st.note))+'</p>'
    +'<div class="msec"><textarea class="jsonedit" id="jsonEd" spellcheck="false" dir="ltr"></textarea><div class="jsonerr" id="jsonErr"></div></div>'
    +'<div class="mfoot">'+(st.apply?'<button class="btn primary" data-act="jsonApply">'+ic('ic-check')+esc(t('apply'))+'</button>':'')+'<button class="btn" data-act="jsonCopy">'+ic('ic-copy')+esc(t('copy'))+'</button><button class="btn" data-act="jsonDownload">'+ic('ic-down')+esc(t('download'))+'</button><span class="grow"></span><button class="btn ghost" data-act="modalClose">'+esc(t('close'))+'</button></div></div>';
}

function eqDefs(){
  const ws=A().ws,R=ws.rules,st=R.mode==='strict';
  return {
    hard:[
      ['coverage','t_coverage','1000·open seats + 6000·empty visits','1000\\,n_{open} + 6000\\,n_{empty}'],
      ['hard','t_hard','20000 per breach','20000\\,n_{hard}'],
      ['rest','t_restH',(st?'40000':'300')+' per breach',(st?'40000':'300')+'\\,n_{rest}'],
      ['distinct','t_distinct','2500 per duplicate','2500\\,n_{dup}'],
      ['bookH','t_bookH',(st?'40000':'5000')+' per must-rule breach',(st?'40000':'5000')+'\\,n_{must}'],
      ['goalsH','t_goalsH',(st?'40000':'5000')+' per unit a must-goal is off (each bucket = place|all|person × plan|week)',(st?'40000':'5000')+'\\sum_{g,b}|\\mathrm{gap}_{g,b}|'],
      ['recencyH','t_recencyH',(st?'40000':'5000')+'·(1+short/min) per too-early revisit (when the minimum is a must)',(st?'40000':'5000')+'\\,(1+\\frac{m-g}{m})']
    ],
    soft:[
      ['goals','goals','t_goals','Σ_g Σ_bucket w·w_g·(120·short + 250·over); count = visits | distinct places matching what ∧ who(any | k together) ∧ when','\\sum_g\\sum_b w\\,w_g\\big(120\\,\\mathrm{short}_{g,b} + 250\\,\\mathrm{over}_{g,b}\\big)'],
      ['recency','recency','t_recency','Σ_s w·(20+80·(min−gap)/min)[early] + 25·w·(gap−max)/max[late] + 120·w[overdue] + 30·w·(P−g)/P[same person]','\\sum_s w\\big(20+80\\tfrac{m-g}{m}\\big)[g<m] + 25\\,w\\tfrac{g-M}{M}[g>M] + 120\\,w\\,[\\mathrm{overdue}]'],
      ['book','book','t_book','Σ_r w_r·(1.2·[site/day] + 3·[avoid-with] − 0.8·[pair-with] + 2·team_gap + 2·count_gap)','\\sum_r w_r\\big(1.2\\,[\\mathrm{site/day}] + 3\\,[\\mathrm{avoid}] - 0.8\\,[\\mathrm{pair}] + 2\\,\\mathrm{team}_r + 2\\,\\mathrm{count}_r\\big)'],
      ['rank','rank','t_rank','Σ w·(4·def·(1.5+4·def) + 0.6·waste)','\\sum w\\big(4\\,\\delta(1.5+4\\delta) + 0.6\\,\\omega\\big)'],
      ['fair','fair','t_fair','Σ 1.5·w·(load − target)²','\\sum_p 1.5\\,w\\,(L_p - T_p)^2'],
      ['rotate','rotate','t_rotate','Σ 1.2·w·(uses − expected)²','\\sum_s 1.2\\,w\\,(u_s - e_s)^2'],
      ['mix','mix','t_mix','Σ w·(count − target)²','\\sum_c w\\,(n_c - t_c)^2'],
      ['pref','pref','t_pref','2·w·km/Dmax','2\\,w\\,\\frac{km}{D_{max}}'],
      ['home','home','t_home','2·w·dist(home, site)/Dmax','2\\,w\\,\\frac{d(h_p,s)}{D_{max}}'],
      ['route','route','t_route','2·w·(tour_km − solo_km/k)/Dmax per multi-stop day','2\\,w\\,\\frac{\\mathrm{tour}-\\overline{\\mathrm{solo}}}{D_{max}}'],
      ['focus','focus','t_focus','4·w·Δkm/Dmax  |  6·w','4\\,w\\,\\frac{\\Delta km}{D_{max}} \\;\\vert\\; 6\\,w'],
      ['cluster','cluster','t_cluster','3·w·span/Dmax + 2·w·(zones−1)','3\\,w\\,\\frac{\\mathrm{span}}{D_{max}} + 2\\,w\\,(z-1)'],
      ['spacing','spacing','t_spacing','2·w·((ideal−gap)/ideal)²','2\\,w\\left(\\frac{g^*-g}{g^*}\\right)^2'],
      ['pairs','pairs','t_pairs','avoid +150·w, prefer −3·w','150\\,w\\,[\\mathrm{avoid}] - 3\\,w\\,[\\mathrm{pair}]'],
      ['likes','likes','t_likes','−1.5·w per liked visit','-1.5\\,w\\,[\\mathrm{liked}]']
    ]
  };
}
function eqText(fmt){
  const a=A(),ws=a.ws,E=eqDefs(),D=derive(),stale=a.isStale();
  const bd=D&&!stale?D.r.breakdown||{}:null;
  const on=E.soft.filter(r=>ws.useW[r[1]]&&ws.weights[r[1]]>0);
  const val=k=>bd?fmtN(bd[k]||0):'';
  const nm=k=>t(k);
  if(fmt==='latex'){
    const hard=E.hard.map(x=>x[3]).join(' + ');
    const soft=on.map(r=>'+ '+ws.weights[r[1]]+'\\cdot f_{\\mathrm{'+r[0]+'}}').join(' ');
    let s='% '+ws.name+' — Cadence objective\n% w = W/50, W = weight 0–100\n\\begin{aligned}\n\\min J &= '+hard+'\\\\\n&\\quad '+soft+'\\\\[4pt]\n';
    on.forEach(r=>{s+='f_{\\mathrm{'+r[0]+'}} &= '+r[4]+'\\\\\n'});
    return s+'\\end{aligned}\n';
  }
  if(fmt==='json'){
    return JSON.stringify({workspace:ws.name,objective:'min J',note:'w = weight/50',solved:!!bd,cost:bd?D.r.cost:null,
      hard:E.hard.map(x=>({term:x[0],label:nm(x[1]),formula:x[2],value:bd?bd[x[0]]||0:null})),
      soft:E.soft.map(r=>({term:r[0],label:nm(r[2]),weight:ws.weights[r[1]],enabled:!!ws.useW[r[1]],formula:r[3],latex:r[4],value:bd?bd[r[0]]||0:null})),
      rulebook:M.bookForExport(ws).filter(r=>r.on).map(r=>Object.assign({text:ruleText(M.normRule(r))},r))},null,2);
  }
  const md=fmt==='md';
  const bookRules=(ws.book||[]).filter(r=>r.on);
  let s=md?'# '+ws.name+' — objective\n\n':ws.name+' — objective\n';
  const full='min J = '+E.hard.map(x=>nm(x[1])).join(' + ')+(on.length?' '+on.map(r=>'+ '+ws.weights[r[1]]+'·'+nm(r[2])).join(' '):'');
  s+=md?'```\n'+full+'\n```\n\n':full+'\n\n';
  if(md){
    s+='| '+t('term')+' | '+t('formula')+' | '+t('weightW')+' | '+t('cost')+' |\n|---|---|---|---|\n';
    E.hard.forEach(x=>{s+='| '+nm(x[1])+' | `'+x[2]+'` | '+t('fixed')+' | '+val(x[0])+' |\n'});
    E.soft.forEach(r=>{s+='| '+nm(r[2])+' | `'+r[3]+'` | '+(ws.useW[r[1]]?ws.weights[r[1]]:t('off'))+' | '+val(r[0])+' |\n'});
    if(bookRules.length)s+='\n## '+t('bookT')+'\n\n'+bookRules.map(r=>'- '+ruleText(r)+(M.isHard(r)?' 🔒':' (w '+r.w+')')).join('\n')+'\n';
    return s+'\n_w = W/50_\n';
  }
  const pad=(x,n)=>{x=String(x);return x.length>=n?x+' ':x+' '.repeat(n-x.length)};
  s+=t('hardT')+'\n';E.hard.forEach(x=>{s+='  '+pad(nm(x[1]),18)+pad(x[2],44)+val(x[0])+'\n'});
  s+='\n'+t('weightsT')+' (w = W/50)\n';E.soft.forEach(r=>{s+='  '+pad(nm(r[2]),18)+pad(ws.useW[r[1]]?'W='+ws.weights[r[1]]:t('off'),8)+pad(r[3],56)+val(r[0])+'\n'});
  if(bookRules.length)s+='\n'+t('bookT')+'\n'+bookRules.map(r=>'  • '+ruleText(r)+(M.isHard(r)?' [must]':' [w '+r.w+']')).join('\n')+'\n';
  const gl=(ws.goals||[]).filter(g=>g.on);if(gl.length)s+='\n'+t('goalsT')+'\n'+gl.map(g=>'  • '+goalText(g)+(g.hard?' [must]':' [w '+g.w+']')).join('\n')+'\n';
  if(bd)s+='\nJ = '+fmtN(D.r.cost)+'\n';
  return s;
}
function eqModal(st){
  const fmts=[['text','Text'],['latex','LaTeX'],['md','Markdown'],['json','JSON']];
  return '<div class="modal" role="dialog" aria-modal="true"><div class="mhead"><div><div class="kicker">'+esc(t('kModel'))+'</div><h2 class="ctitle">'+esc(t('eqExportT'))+'</h2></div><button class="ibtn" data-act="modalClose">'+ic('ic-x')+'</button></div>'
    +'<div class="msec"><div class="mlab">'+esc(t('fmt'))+'</div><div class="seg">'+fmts.map(([k,l])=>'<button class="'+(st.fmt===k?'on':'')+'" data-act="eqFmt" data-v="'+k+'">'+esc(l)+'</button>').join('')+'</div></div>'
    +'<div class="msec"><div class="mlab">'+esc(t('preview'))+'</div><pre class="export-preview" id="eqPrev" dir="ltr"></pre></div>'
    +'<div class="mfoot"><button class="btn primary" data-act="eqCopy">'+ic('ic-copy')+esc(t('copy'))+'</button><button class="btn" data-act="eqDownload">'+ic('ic-down')+esc(t('download'))+'</button><span class="grow"></span><button class="btn ghost" data-act="modalClose">'+esc(t('close'))+'</button></div></div>';
}
function routesBlock(){
  const ws=A().ws,L0=ws.locations||[],rs=ws.routes||[];
  if(L0.length<2)return '';
  const lo=L0.slice().sort((x,y)=>x.km-y.km).map(l=>[l.id,l.name,null,r1(l.km)+' '+unitL()]);
  const byLoc=id=>byId(L0,id);
  let h='<div class="grouplbl" style="margin-top:20px">'+ic('ic-route')+esc(t('routesT'))+' <span class="muted mono tiny">'+rs.length+'</span><span class="grow"></span><button class="btn sm" data-act="addRoute">'+ic('ic-plus')+esc(t('addRoute'))+'</button></div>';
  if(!rs.length)h+='<div class="muted tiny" style="padding:6px 2px">'+esc(t('routesEmpty'))+'</div>';
  else h+='<div class="routes">'+rs.map(r=>{const la=byLoc(r.a),lb=byLoc(r.b);const est=la&&lb?Math.abs(la.km-lb.km):0;
    return '<div class="route">'+dd('route','data-id="'+esc(r.id)+'" data-f="a"',r.a,lo,{search:true})+'<span class="muted">↔</span>'+dd('route','data-id="'+esc(r.id)+'" data-f="b"',r.b,lo,{search:true})
      +'<span class="numwrap"><input class="inp num s" type="number" min="0" step="1" data-bind="routeKm" data-id="'+esc(r.id)+'" value="'+r.km+'"><span class="unit">'+unitL()+'</span></span><span class="mono tiny muted" title="'+esc(t('routeEst'))+'">≈'+r1(est)+'</span><button class="ibtn" data-act="delRoute" data-id="'+esc(r.id)+'">'+ic('ic-trash')+'</button></div>'}).join('')+'</div>';
  return h+'<p class="quiet">'+ic('ic-info')+esc(t('routesNote'))+'</p>';
}
function sourceCard(){
  const a=A(),ws=a.ws,src=ws.source,cfg=a.config||{};
  const url=src&&src.url||'';
  return '<section class="card" id="source-card"><div class="card-head"><div><div class="kicker">'+esc(t('kSource'))+'</div><h2 class="ctitle">'+esc(t('sourceT'))+'</h2></div>'
    +(a.srcUpdate?'<span class="chip warn">'+ic('ic-alert')+esc(t('srcChanged'))+'</span>':(src?'<span class="chip good">'+ic('ic-check')+esc(t('srcLinked'))+'</span>':'<span class="chip">'+esc(t('srcNone'))+'</span>'))+'</div><div class="setgrid">'
    +'<div class="setrow"><span class="rl">'+esc(t('srcFile'))+'<small>'+esc(src?t('srcAt',{d:new Date(src.at).toLocaleString(L()==='ar'?'ar-EG':'en-GB',{dateStyle:'medium',timeStyle:'short'})}):t('srcNoneN'))+'</small></span><code class="srcpath">'+esc(url||(cfg.datasetLabel||'data/complete_data.json'))+'</code></div>'
    +'<div class="setrow"><span class="rl">'+esc(t('srcRefresh'))+'<small>'+esc(t('srcRefreshN'))+'</small></span><button class="btn sm primary" data-act="srcRefresh" data-keep="1">'+ic('ic-undo')+esc(t('srcKeep'))+'</button><button class="btn sm" data-act="srcRefresh" data-keep="0">'+esc(t('srcReplace'))+'</button></div>'
    +'<div class="setrow"><span class="rl">'+esc(t('srcAuto'))+'<small>'+esc(t('srcAutoN'))+'</small></span>'+swBtn(!src||src.auto!==false,'srcAuto','')+'</div>'
    +'<div class="setrow"><span class="rl">'+esc(t('srcExport'))+'<small>'+esc(t('srcExportN'))+'</small></span><button class="btn sm" data-act="dsExport">'+ic('ic-down')+esc(t('srcExportB'))+'</button><button class="btn sm ghost" data-act="dsJson">'+ic('ic-code')+esc(t('bJson'))+'</button></div>'
    +'</div><p class="quiet">'+ic('ic-info')+esc(t('sourceNote'))+'</p></section>';
}
/* ================= Templates & uploads ================= */
function tplMenu(kind){
  return '<button class="btn sm ghost" data-act="tplDl" data-kind="'+kind+'" data-fmt="csv" title="'+esc(t('template'))+' CSV">'+ic('ic-file')+esc(t('template'))+'</button>'
    +'<button class="btn sm ghost" data-act="tplDl" data-kind="'+kind+'" data-fmt="xlsx" title="'+esc(t('template'))+' Excel">'+ic('ic-sheet')+'xlsx</button>';
}
const TPL_KINDS=[['history','ic-hist',['csv','xlsx']],['sites','ic-build',['csv','xlsx']],['people','ic-users',['csv','xlsx']],['locations','ic-pin',['csv','xlsx']],['book','ic-flip',['json']],['dataset','ic-layers',['json']]];
function templatesHub(){
  let h='<section class="card" id="templates-card"><div class="card-head"><div><div class="kicker">'+esc(t('kTpl'))+'</div><h2 class="ctitle">'+esc(t('tplHubT'))+'</h2></div></div><div class="tplhub">';
  TPL_KINDS.forEach(([k,i,f])=>{
    h+='<div class="tplrow"><span class="tplname">'+ic(i)+esc(t('tk_'+k))+'</span><span class="tplacts">'
      +f.map(x=>'<button class="btn sm ghost" data-act="tplDl" data-kind="'+k+'" data-fmt="'+x+'">'+ic('ic-down')+esc(t(x==='csv'?'tplCsv':x==='xlsx'?'tplXlsx':'tplJson'))+'</button>').join('')
      +'<button class="btn sm" data-act="tplUp" data-kind="'+k+'">'+ic('ic-up')+esc(t('upload'))+'</button></span></div>';
  });
  return h+'</div><p class="quiet">'+ic('ic-info')+esc(t('tplHubNote'))+'</p></section>';
}

/* ================= History view ================= */
const RC_PRESETS=[['m1',{mode:'range',min:25,max:40}],['m2',{mode:'range',min:45,max:75}],['q',{mode:'range',min:80,max:100}],['rnd',{mode:'random',min:30,max:90,jitter:5}],['min60',{mode:'min',min:60}]];
function historyView(){return timingCard()+dueCard()+historyCard()}
function rcStrip(rc){
  if(rc.mode==='off')return '';
  const lo=rc.min,hi=rc.mode==='min'?0:rc.max,top=Math.max(30,(hi||lo)*1.35,lo+20);
  const j=rc.mode==='random'?rc.jitter:0;
  const pos=x=>clamp(x/top*100,0,100);
  let h='<div class="rcstrip" dir="ltr"><div class="rctrack"><i class="rcearly" style="width:'+pos(lo)+'%"></i>';
  h+='<i class="rcok'+(hi?'':' open')+'" style="left:'+pos(lo)+'%;width:'+((hi?pos(hi):100)-pos(lo))+'%"></i>';
  if(hi)h+='<i class="rclate" style="left:'+pos(hi)+'%;width:'+(100-pos(hi))+'%"></i>';
  if(j)h+='<i class="rcjit" style="left:'+pos(Math.max(0,lo-j))+'%;width:'+(pos(hi+j)-pos(Math.max(0,lo-j)))+'%"></i>';
  h+='</div><div class="rclabels"><span style="left:0">0</span><span style="left:'+pos(lo)+'%">'+lo+'</span>'+(hi?'<span style="left:'+pos(hi)+'%">'+hi+'</span>':'<span style="left:97%">∞</span>')+'</div>'
    +'<div class="rclegend"><span><i class="rcearly"></i>'+esc(t('st_early'))+'</span><span><i class="rcok"></i>'+esc(t('st_due'))+'</span>'+(hi?'<span><i class="rclate"></i>'+esc(t('st_late'))+'</span>':'')+(j?'<span><i class="rcjit"></i>± '+j+'</span>':'')+'</div></div>';
  return h;
}
function timingCard(){
  const a=A(),ws=a.ws,rc=M.normRecency(ws.recency);
  const num=(k,v)=>'<input class="inp num" type="number" min="0" data-bind="rc" data-k="'+k+'" value="'+v+'">';
  let h='<section class="card" id="timing-card"><div class="card-head"><div><div class="kicker">'+esc(t('kTiming'))+'</div><h2 class="ctitle">'+esc(t('rcT'))+'</h2></div>'
    +'<div class="row">'+dd('rcPreset','','',RC_PRESETS.map(([k])=>[k,t('rcp_'+k)]),{ph:t('rcPresets'),cls:'ghostdd'})+'</div></div>';
  h+='<div class="rcmodes">'+M.RC_MODES.map(k=>'<button class="rcmode'+(rc.mode===k?' on':'')+'" data-act="rcMode" data-v="'+k+'"><b>'+esc(t('rc_'+k))+'</b><small>'+esc(t('rcD_'+k))+'</small></button>').join('')+'</div>';
  if(rc.mode!=='off'){
    h+=rcStrip(rc)+'<div class="grid2 tight"><div class="setgrid">'
      +'<div class="setrow"><span class="rl">'+esc(t('rcMin'))+'</span><span class="numwrap">'+num('min',rc.min)+'<span class="unit">d</span></span></div>'
      +(rc.mode!=='min'?'<div class="setrow"><span class="rl">'+esc(t('rcMax'))+'</span><span class="numwrap">'+num('max',rc.max)+'<span class="unit">d</span></span></div>':'')
      +(rc.mode==='random'?'<div class="setrow"><span class="rl">'+esc(t('rcJitter'))+'</span><span class="numwrap">'+num('jitter',rc.jitter)+'<span class="unit">d</span></span><button class="btn sm" data-act="rcReroll">'+ic('ic-dice')+esc(t('rcReroll'))+'</button></div>':'')
      +'<div class="setrow"><span class="rl">'+esc(t('rcHard'))+'<small>'+esc(t('rcHardN'))+'</small></span>'+swBtn(rc.hard,'rcToggle','data-k="hard"')+'</div>'
      +'<div class="setrow"><span class="rl">'+esc(t('rcInPlan'))+'<small>'+esc(t('rcInPlanN'))+'</small></span>'+swBtn(rc.inPlan,'rcToggle','data-k="inPlan"')+'</div>'
      +(rc.mode!=='min'?'<div class="setrow"><span class="rl">'+esc(t('rcOver'))+'<small>'+esc(t('rcOverN'))+'</small></span>'+swBtn(rc.overdue,'rcToggle','data-k="overdue"')+'</div>':'')
      +'</div><div class="setgrid">'
      +'<div class="setrow"><span class="rl">'+esc(t('rcFresh'))+'<small>'+esc(t('rcFreshN'))+'</small></span><div class="seg">'+['neutral','due'].map(k=>'<button class="'+(rc.fresh===k?'on':'')+'" data-act="rcFresh" data-v="'+k+'">'+esc(t('rcF_'+k))+'</button>').join('')+'</div></div>'
      +'<div class="setrow"><span class="rl">'+esc(t('rcLook'))+'<small>'+esc(t('rcLookN'))+'</small></span><span class="numwrap">'+num('lookback',rc.lookback)+'<span class="unit">d</span></span></div>'
      +'<div class="setrow"><span class="rl">'+esc(t('rcPerson'))+'<small>'+esc(t('rcPersonN'))+'</small></span><span class="numwrap">'+num('personDays',rc.personDays)+'<span class="unit">d</span></span></div>'
      +'<div class="setrow"><span class="rl">'+esc(t('rcWin'))+'<small>'+esc(t('rcWinN'))+'</small></span>'+swBtn(rc.inWindow,'rcToggle','data-k="inWindow"')+'</div>'
      +'</div></div>';
    const pc=ws.categories.filter(c=>c.planned);
    if(pc.length){
      h+='<div class="grouplbl" style="margin-top:16px">'+esc(t('rcCat'))+'</div><div class="rccats">'+pc.map(c=>{const x=rc.cat[c.id]||{};
        return '<div class="rccat">'+ctag(c)+'<span class="numwrap"><input class="inp num s" type="number" min="0" placeholder="'+rc.min+'" data-bind="rcCat" data-c="'+esc(c.id)+'" data-k="min" value="'+(x.min==null?'':x.min)+'">'+(rc.mode!=='min'?'<span class="muted">–</span><input class="inp num s" type="number" min="0" placeholder="'+rc.max+'" data-bind="rcCat" data-c="'+esc(c.id)+'" data-k="max" value="'+(x.max==null?'':x.max)+'">':'')+'<span class="unit">d</span></span></div>'}).join('')+'</div>'
        +'<p class="quiet">'+ic('ic-info')+esc(t('rcCatN'))+'</p>';
    }
  }
  return h+'<p class="quiet">'+ic('ic-info')+esc(t('rcNote'))+'</p></section>';
}
const DUE_ORDER={late:0,due:1,never:2,early:3,ok:4};
function dueCard(){
  const a=A(),ws=a.ws,rc=M.normRecency(ws.recency);
  const rg=rangeOf(ws);const withPlan=!!a.f.dueWithPlan;
  const asOf=withPlan?rg.end:rg.start;
  const board=M.recencyBoard(ws,asOf,withPlan);
  const cnt={};board.forEach(x=>cnt[x.st]=(cnt[x.st]||0)+1);
  const fs=a.f.dueSt||'all';
  const list=board.filter(x=>fs==='all'||x.st===fs);
  list.sort((x,y)=>DUE_ORDER[x.st]-DUE_ORDER[y.st]||((y.ago==null?-1:y.ago)-(x.ago==null?-1:x.ago))||x.s.name.localeCompare(y.s.name));
  const per=30,pages=Math.max(1,Math.ceil(list.length/per));a.f.duePage=clamp(a.f.duePage||0,0,pages-1);
  const page=list.slice(a.f.duePage*per,(a.f.duePage+1)*per);
  let h='<section class="card" id="due-card"><div class="card-head"><div><div class="kicker">'+esc(t('kDue'))+'</div><h2 class="ctitle">'+esc(t('dueT'))+' <span class="muted mono tiny">'+esc(t('dueAsOf',{d:fmtDS(asOf)+' '+pISO(asOf).getFullYear()}))+'</span></h2></div>'
    +'<div class="row"><span class="lbl">'+esc(t('dueWithPlan'))+'</span>'+swBtn(withPlan,'dueWithPlan','',true)+'</div></div>';
  if(rc.mode==='off')h+='<div class="banner">'+ic('ic-info')+'<span class="grow">'+esc(t('dueOff'))+'</span></div>';
  h+='<div class="toolbar slim"><button class="fchip'+(fs==='all'?' on':'')+'" data-act="dueSt" data-v="all">'+esc(t('all'))+' <small>'+board.length+'</small></button>'
    +['late','due','never','early','ok'].filter(k=>cnt[k]).map(k=>'<button class="fchip'+(fs===k?' on':'')+'" data-act="dueSt" data-v="'+k+'"><span class="stdot st-'+k+'"></span>'+esc(t('st_'+k))+' <small>'+cnt[k]+'</small></button>').join('')+'</div>';
  if(!board.length)return h+'</section>';
  h+='<div class="tblwrap"><table class="duetbl"><thead><tr><th>'+esc(t('site'))+'</th><th>'+esc(t('dueLast'))+'</th><th class="numc">'+esc(t('dueAgo'))+'</th><th>'+esc(t('dueWin'))+'</th><th>'+esc(t('dueNext'))+'</th><th class="numc">'+esc(t('dueN'))+'</th><th></th></tr></thead><tbody>';
  page.forEach(x=>{
    const w=x.w;const top=w?Math.max(w.hi||w.lo*1.5,x.ago||0,10):1;
    const bar=w&&x.ago!=null?'<div class="duebar" dir="ltr"><i class="dwin" style="left:'+(w.lo/top*100)+'%;width:'+(((w.hi||top)-w.lo)/top*100)+'%"></i><b style="left:'+Math.min(100,x.ago/top*100)+'%"></b></div>':'';
    h+='<tr><td><span class="fname"><span class="dot" style="--c:'+esc(catColor(x.s.cat))+'"></span>'+esc(x.s.name)+'</span></td>'
      +'<td class="mono tiny">'+(x.last?esc(x.last):'—')+'</td>'
      +'<td class="numc mono">'+(x.ago==null?'—':x.ago)+'</td>'
      +'<td>'+(w?'<span class="mono tiny">'+w.lo+(w.hi?'–'+w.hi:'+')+' d'+(w.target!=null?' · ≈'+w.target:'')+'</span>'+bar:'<span class="muted">—</span>')+'</td>'
      +'<td class="mono tiny">'+(x.from?esc(fmtDS(x.from))+(x.by?' → '+esc(fmtDS(x.by)):' →'):'—')+'</td>'
      +'<td class="numc mono">'+x.n+'</td>'
      +'<td><span class="stchip st-'+x.st+'">'+esc(t('st_'+x.st))+'</span></td></tr>';
  });
  return h+'</tbody></table></div>'+pager(list.length,a.f.duePage,per,'duePage')+'</section>';
}
function historyCard(){
  const a=A(),ws=a.ws,H=ws.history||[];
  const q=(a.f.histQ||'').trim().toLowerCase(),fk=a.f.histF||'all';
  const sName=h=>{const s=h.site&&byId(ws.sites,h.site);return s?s.name:h.sn||'—'};
  const pNames=h=>h.people.map(id=>(byId(ws.people,id)||{}).name).filter(Boolean);
  const unm=h=>!h.site||(h.pn&&h.pn.length);
  const list=H.filter(h=>(fk==='all'||(fk==='unm'&&unm(h)))&&(!q||sName(h).toLowerCase().includes(q)||h.date.includes(q)||pNames(h).concat(h.pn||[]).join(' ').toLowerCase().includes(q)||(h.note||'').toLowerCase().includes(q)));
  const per=50,pages=Math.max(1,Math.ceil(list.length/per));a.f.histPage=clamp(a.f.histPage||0,0,pages-1);
  const page=list.slice(a.f.histPage*per,(a.f.histPage+1)*per);
  const places=new Set(H.filter(h=>h.site).map(h=>h.site)).size;
  const nUnm=H.filter(unm).length;
  const span=H.length?H[H.length-1].date+' – '+H[0].date:'';
  let h='<section class="card" id="history-card"><div class="card-head"><div><div class="kicker">'+esc(t('kHist'))+'</div><h2 class="ctitle">'+esc(t('histT'))+' <span class="muted mono tiny">'+H.length+'</span></h2></div>'
    +'<div class="row"><button class="btn primary sm" data-act="tplUp" data-kind="history">'+ic('ic-up')+esc(t('histUpload'))+'</button>'
    +'<button class="btn sm ghost" data-act="tplDl" data-kind="history" data-fmt="csv">'+ic('ic-file')+esc(t('histTplCsv'))+'</button>'
    +'<button class="btn sm ghost" data-act="tplDl" data-kind="history" data-fmt="xlsx">'+ic('ic-sheet')+esc(t('histTplXlsx'))+'</button>'
    +'<button class="btn sm" data-act="histFromPlan" '+(ws.plan?'':'disabled')+'>'+ic('ic-cal')+esc(t('histAddPlan'))+'</button></div></div>';
  if(H.length)h+='<div class="scope-stats" style="margin-bottom:10px"><span class="chip">'+esc(span)+'</span><span class="chip">'+places+' '+esc(t('sites'))+'</span>'+(nUnm?'<span class="chip warn">'+ic('ic-alert')+nUnm+' '+esc(t('histFilterUnk'))+'</span>':'')+'</div>';
  h+='<div class="toolbar"><label class="search">'+ic('ic-search')+'<input class="inp slim" type="search" placeholder="'+esc(t('search'))+'" data-bind="histQ" value="'+esc(a.f.histQ||'')+'"></label>'
    +'<button class="fchip'+(fk==='all'?' on':'')+'" data-act="histF" data-v="all">'+esc(t('histFilterAll'))+' <small>'+H.length+'</small></button>'
    +(nUnm?'<button class="fchip'+(fk==='unm'?' on':'')+'" data-act="histF" data-v="unm">'+esc(t('histFilterUnk'))+' <small>'+nUnm+'</small></button>':'')
    +(H.length?'<span class="grow"></span><button class="btn sm ghost" data-act="histExport" data-fmt="csv">'+ic('ic-down')+esc(t('histExpCsv'))+'</button><button class="btn sm ghost" data-act="histExport" data-fmt="xlsx">'+ic('ic-down')+esc(t('histExpXlsx'))+'</button>'+(nUnm?'<button class="btn sm ghost" data-act="histRelink">'+ic('ic-undo')+esc(t('histRelink'))+'</button>':'')+'<button class="btn sm ghost" data-act="histClear">'+ic('ic-trash')+esc(t('histClear'))+'</button>':'')+'</div>';
  const so=ws.sites.map(s=>[s.id,s.name,catColor(s.cat),(locOf(s.loc)||{}).name||'']);
  h+='<div class="histadd"><input class="inp slim" type="date" id="hAddDate" value="'+esc(a.f.hAddDate||addISO(todayISO(),-1))+'" aria-label="'+esc(t('histDate'))+'">'
    +dd('hAddSite','',a.f.hAddSite||'',so,{search:true,ph:a.f.hAddSite&&byId(ws.sites,a.f.hAddSite)?null:t('histPickPlace')})
    +'<input class="inp slim grow" id="hAddPeople" placeholder="'+esc(t('histPeople'))+' · '+esc(ws.people.slice(0,2).map(p=>p.name).join(', '))+'" value="'+esc(a.f.hAddPeople||'')+'">'
    +'<button class="btn sm" data-act="histAddOne">'+ic('ic-plus')+esc(t('histAddOne'))+'</button></div>';
  if(!H.length)h+='<div class="goal-empty">'+ic('ic-hist')+'<span>'+esc(t('histEmpty'))+'</span></div>';
  else{
    h+='<div class="tblwrap"><table class="histtbl"><thead><tr><th>'+esc(t('histDate'))+'</th><th>'+esc(t('histPlace'))+'</th><th>'+esc(t('histPeople'))+'</th><th>'+esc(t('histSrc'))+'</th><th>'+esc(t('histNote'))+'</th><th></th></tr></thead><tbody>';
    if(!page.length)h+='<tr><td colspan="6" class="empty">'+esc(t('noMatch'))+'</td></tr>';
    page.forEach(x=>{const s=x.site&&byId(ws.sites,x.site);
      h+='<tr><td class="mono tiny">'+esc(x.date)+' <small class="muted">'+esc(arr('dows')[dowOf(x.date)])+'</small></td>'
        +'<td>'+(s?'<span class="fname"><span class="dot" style="--c:'+esc(catColor(s.cat))+'"></span>'+esc(s.name)+'</span>':'<span class="fname">'+esc(x.sn||'—')+'</span> <span class="chip warn">'+esc(t('histUnknown'))+'</span>')+'</td>'
        +'<td><div class="team">'+x.people.map(id=>{const p=byId(ws.people,id);if(!p)return '';const ro=roleOf(p.roles[0]);return '<span class="pill" style="--c:'+esc(ro?ro.color:'#999')+'" data-pid="'+esc(p.id)+'">'+esc(p.name)+'</span>'}).join('')+(x.pn||[]).map(n=>'<span class="pill open" title="'+esc(t('histUnknown'))+'">'+esc(n)+'</span>').join('')+'</div></td>'
        +'<td><span class="chip">'+esc(t('hs_'+x.src))+'</span></td>'
        +'<td class="tiny">'+esc(x.note||'')+'</td>'
        +'<td><button class="ibtn" data-act="histDel" data-id="'+esc(x.id)+'" title="'+esc(t('remove'))+'">'+ic('ic-trash')+'</button></td></tr>'});
    h+='</tbody></table></div>'+pager(list.length,a.f.histPage,per,'histPage');
  }
  return h+'<p class="quiet">'+ic('ic-info')+esc(t('histNote2'))+'</p></section>';
}

function swatches(){return M.COLORS.map(c=>'<button style="--c:'+c+'" data-act="colorPick" data-c="'+c+'" aria-label="'+c+'"></button>').join('')}

G.VIEWS={historyView,templatesHub,DD,ddPop,modelView,goalText,ruleText,jsonModal,eqModal,eqText,bookCard,ic,fmtD,fmtDL,fmtDS,unitL,derive,issueText,warnText,mast,tagline,tabs,statusHTML,planView,sitesView,peopleView,rulesView,insightsView,workspaceView,explainPop,dpkHTML,exportModal,paletteHTML,paletteList,kbdModal,swatches,r1,fmtN};
})(window);
