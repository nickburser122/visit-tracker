(function(G){
'use strict';
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const esc=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let uidN=0;
const uid=p=>(p||'')+Date.now().toString(36).slice(-4)+Math.random().toString(36).slice(2,7)+(uidN++).toString(36);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sum=a=>a.reduce((x,y)=>x+y,0);
const avg=a=>a.length?sum(a)/a.length:0;
const num=(v,d)=>{const x=parseFloat(v);return isFinite(x)?x:d};
const intOr=(v,d)=>{if(v===''||v==null)return d;const x=parseInt(v,10);return isFinite(x)?x:d};
const byId=(arr,id)=>arr.find(x=>x.id===id);
const clone=o=>JSON.parse(JSON.stringify(o));
function fnv(str){let h=0x811c9dc5;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,0x01000193)}return(h>>>0).toString(36)}
function gini(xs){const n=xs.length;if(!n)return 0;const s=sum(xs);if(!s)return 0;const a=xs.slice().sort((x,y)=>x-y);let g=0;for(let i=0;i<n;i++)g+=(2*(i+1)-n-1)*a[i];return g/(n*s)}
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296}}

const pISO=s=>{const p=s.split('-').map(Number);return new Date(p[0],p[1]-1,p[2])};
const fISO=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const addISO=(s,n)=>{const d=pISO(s);d.setDate(d.getDate()+n);return fISO(d)};
const dowOf=s=>pISO(s).getDay();
const dayNum=s=>{const p=s.split('-').map(Number);return Math.round(Date.UTC(p[0],p[1]-1,p[2])/864e5)};
const diffDays=(a,b)=>dayNum(b)-dayNum(a);
const todayISO=()=>fISO(new Date());
const validISO=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&fISO(pISO(s))===s;
function weekStartOf(iso,ws){const d=dowOf(iso);return addISO(iso,-((d-ws+7)%7))}

const COLORS=['#5A4E7C','#6F8AA3','#4D7178','#B0765A','#6E8A63','#A0596A','#8A7A4C','#4F7C72','#7B6592','#98806C'];
const LEVELS=[0,25,50,75,100];
const WEIGHT_KEYS=['goals','book','recency','rank','fair','rotate','mix','pref','home','route','focus','cluster','spacing','pairs','likes'];
const defaultWeights=()=>({fair:70,pref:45,home:35,route:40,rotate:60,mix:60,focus:55,cluster:45,spacing:35,pairs:50,likes:40,rank:60,goals:80,book:50,recency:60});
/* Revisit timing (previous visits / earlier plans). mode: off | min | range | random */
const RC_MODES=['off','min','range','random'];
const defaultRecency=()=>({mode:'off',min:45,max:75,jitter:7,salt:1,hard:false,inPlan:true,inWindow:false,overdue:true,fresh:'neutral',lookback:365,personDays:0,cat:{}});
function normRecency(o){
  o=o&&typeof o==='object'?o:{};const d=defaultRecency();
  const r={mode:RC_MODES.includes(o.mode)?o.mode:d.mode,min:clamp(intOr(o.min,d.min),0,1000),max:clamp(intOr(o.max,d.max),0,1000),jitter:clamp(intOr(o.jitter,d.jitter),0,365),salt:Math.max(1,intOr(o.salt,1)),
    hard:!!o.hard,inPlan:o.inPlan!==false,inWindow:!!o.inWindow,overdue:o.overdue!==false,fresh:o.fresh==='due'?'due':'neutral',lookback:clamp(intOr(o.lookback,d.lookback),0,3650),personDays:clamp(intOr(o.personDays,0),0,730),cat:{}};
  if(r.max&&r.max<r.min){const x=r.max;r.max=r.min;r.min=x}
  if(o.cat&&typeof o.cat==='object')for(const k in o.cat){const c=o.cat[k]||{};const mn=c.min===''||c.min==null?'':clamp(intOr(c.min,0),0,1000),mx=c.max===''||c.max==null?'':clamp(intOr(c.max,0),0,1000);if(mn!==''||mx!=='')r.cat[k]={min:mn,max:mx}}
  return r;
}
const defaultUseW=()=>{const o={};WEIGHT_KEYS.forEach(k=>o[k]=true);return o};
const defaultRules=()=>({perDay:1,runMax:1,offMin:1,distinct:true,siteGap:0,mode:'bend',nearKm:10,weekStart:0,rankGate:'off',rankTol:25});
const defaultEngine=()=>({seed:20260907,quality:'balanced',runs:3,live:true});
const defaultSizing=()=>({mode:'rhythm',total:40});
const WEEK5=(start,n)=>{const w=[];for(let i=0;i<7;i++)w.push({on:false,n:0,focus:'auto'});for(let i=0;i<5;i++)w[(start+i)%7]={on:true,n,focus:'auto'};return w};

const TERM_DEFAULT={
  en:{visit:'visit',visits:'visits',site:'site',sites:'sites',person:'person',people:'people'},
  ar:{visit:'زيارة',visits:'زيارات',site:'موقع',sites:'مواقع',person:'فرد',people:'أفراد'}
};

function blankWS(name){
  const now=Date.now();
  return {v:3,id:uid('w'),name:name||'Untitled plan',created:now,updated:now,
    template:'blank',
    terms:clone(TERM_DEFAULT),unit:'km',
    roles:[],categories:[],sites:[],people:[],locations:[],routes:[],goals:[],book:[],sizing:defaultSizing(),source:null,
    history:[],histRev:0,recency:defaultRecency(),
    week:WEEK5(1,1),overrides:{},
    scope:{mode:'month',start:fISO(new Date(new Date().getFullYear(),new Date().getMonth(),1)),end:''},
    rules:defaultRules(),weights:defaultWeights(),useW:defaultUseW(),engine:defaultEngine(),
    locks:{sites:{},seats:{}},snapshots:[],plan:null};
}
function mkRole(name,color){return {id:uid('r'),name,color}}
function mkCat(name,color,staff,share,planned){return {id:uid('c'),name,color,staff:staff||{},share:share==null?1:share,planned:planned!==false}}
function mkLoc(name,km,o){return Object.assign({id:uid('l'),name,km:km||0},o||{})}
function mkSite(name,cat,km,o){return Object.assign({id:uid('s'),name,cat,km:km||0,loc:'',crit:50,tag:'',zone:'',weight:1,minV:'',maxV:'',gapMin:'',gapMax:'',days:[true,true,true,true,true,true,true],blackout:[],active:true,note:''},o||{})}
function mkPerson(name,roles,o){return Object.assign({id:uid('p'),name,roles:roles||[],home:0,homeLoc:'',rank:50,rankBy:{},gender:'',pref:'none',weight:1,days:[true,true,true,true,true,true,true],off:[],maxLoad:'',maxWeek:'',runMax:'',offMin:'',avoid:[],pair:[],likes:[],bans:[],active:true},o||{})}

const SENSES=['prefer','avoid','only','never'];
const WHO_K=['all','person','role','gender','rankGe','rankLe','homeLoc'];
const WHAT_K=['all','site','cat','loc','tag','critGe','critLe','kmGe','kmLe'];
const RELS=['site','day','with','team','count'];
const TEAM_OPS=['min','max','exact','ifany'],COUNT_OPS=['min','max','exact'];
const FLIP={prefer:'avoid',avoid:'prefer',only:'never',never:'only'};
const isHard=r=>r.sense==='only'||r.sense==='never';
const MULTI_K=['person','role','homeLoc','site','cat','loc','tag'];
function normV(v){if(Array.isArray(v))return Array.from(new Set(v.map(x=>String(x==null?'':x)).filter(Boolean)));return v==null?'':String(v)}
function normC(m,ks){m=m||{};const k=ks.includes(m.k)?m.k:'all';return {k,v:k==='all'?'':normV(m.v),not:!!m.not&&k!=='all'}}
function normM(m,ks){const x=normC(m,ks);const more=(Array.isArray(m&&m.more)?m.more:[]).slice(0,3).map(c=>normC(c,ks)).filter(c=>c.k!=='all');if(more.length){x.more=more;x.join=m.join==='or'?'or':'and'}return x}
function parseDates(s){const out=new Set();String(s||'').split(/[\s,;]+/).forEach(tk=>{const m=tk.split('..');if(m.length===2&&validISO(m[0])&&validISO(m[1])){for(let d=m[0];d<=m[1]&&out.size<800;d=addISO(d,1))out.add(d)}else if(validISO(tk))out.add(tk)});return out}
function normRule(r){
  r=r||{};const rel=RELS.includes(r.rel)?r.rel:'site';
  let sense=SENSES.includes(r.sense)?r.sense:'avoid';
  const grp=rel==='team'||rel==='count';
  if(grp){if(sense==='avoid')sense='prefer';if(sense==='never')sense='only'}
  const ops=rel==='team'?TEAM_OPS:rel==='count'?COUNT_OPS:['min','max'];
  let what;
  if(rel==='day')what=r.what&&r.what.k==='dates'?{k:'dates',v:String(r.what.v||'')}:{k:'dow',v:arr7(r.what&&r.what.v,false)};
  else what=normM(r.what,rel==='with'?WHO_K:WHAT_K);
  return {id:typeof r.id==='string'&&r.id?r.id:uid('b'),on:r.on!==false,rel,sense,who:normM(r.who,WHO_K),what,
    op:ops.includes(r.op)?r.op:'max',n:clamp(intOr(r.n,1),0,rel==='count'?99:20),per:r.per==='week'?'week':'plan',w:clamp(num(r.w,50),0,100),note:String(r.note||'').slice(0,160)};
}
function mkRule(o){return normRule(Object.assign({on:true,rel:'site',sense:'avoid',who:{k:'all',v:''},what:{k:'all',v:''},op:'max',n:1,w:50},o||{}))}
const inV=(m,x)=>Array.isArray(m.v)?m.v.includes(x):x===m.v;
const numV=m=>+(Array.isArray(m.v)?m.v[0]:m.v)||0;
function whoRaw(p,m){
  switch(m.k){
    case 'person':return inV(m,p.id);
    case 'role':return Array.isArray(m.v)?m.v.some(r=>p.roles.includes(r)):p.roles.includes(m.v);
    case 'gender':return inV(m,p.gender||'');
    case 'rankGe':return (+p.rank||0)>=numV(m);
    case 'rankLe':return (+p.rank||0)<=numV(m);
    case 'homeLoc':return inV(m,p.homeLoc||'');
  }
  return true;
}
function whatRaw(s,m){
  switch(m.k){
    case 'site':return inV(m,s.id);
    case 'cat':return inV(m,s.cat);
    case 'loc':return inV(m,s.loc);
    case 'tag':return inV(m,s.tag||'');
    case 'critGe':return (+s.crit||0)>=numV(m);
    case 'critLe':return (+s.crit||0)<=numV(m);
    case 'kmGe':return (+s.km||0)>=numV(m);
    case 'kmLe':return (+s.km||0)<=numV(m);
  }
  return true;
}
function mc(raw,o,c){const x=raw(o,c);return c.not&&c.k!=='all'?!x:x}
function mAll(raw,o,m){let r=mc(raw,o,m);if(m.more)for(const c of m.more){const y=mc(raw,o,c);r=m.join==='or'?(r||y):(r&&y)}return r}
function whoMatch(p,m){return mAll(whoRaw,p,m)}
function whatMatch(s,m){return mAll(whatRaw,s,m)}
function refResolver(ws){
  const by=(arr,v,pre)=>{if(v==null||v==='')return '';v=String(v);const x=arr.find(a=>a.id===v)||arr.find(a=>a.id===pre+v)||arr.find(a=>String(a.name).trim()===v.trim());return x?x.id:v};
  return (k,v)=>{
    switch(k){
      case 'person':return by(ws.people,v,'p_');
      case 'role':return by(ws.roles,v,'r_');
      case 'cat':return by(ws.categories,v,'c_');
      case 'loc':case 'homeLoc':return by(ws.locations||[],v,'l_');
      case 'site':return by(ws.sites,v,'f_');
    }
    return v==null?'':String(v);
  };
}
function resolveBook(ws,list){
  const R=refResolver(ws);
  return (Array.isArray(list)?list:[]).map(r=>{
    const x=normRule(r);
    const rv=c=>{c.v=Array.isArray(c.v)?c.v.map(x=>R(c.k,x)):R(c.k,c.v)};
    const rs=m=>{rv(m);(m.more||[]).forEach(rv)};
    rs(x.who);
    if(x.rel!=='day')rs(x.what);
    if(!(r&&typeof r.id==='string'&&r.id))x.id=uid('b');
    return x;
  });
}
/* ======== Goals: count goals (who × what × when × per × period × measure) and visit injection ======== */
const G_KIND=['count','inject'],G_PER=['each','total','person'],G_OP=['min','max','exact','between'],G_MODE=['any','together','all','exact','only','none'];
function legacyWhat(g){switch(g.scope){case 'cat':case 'loc':case 'tag':case 'site':return {k:g.scope,v:g.ref?[String(g.ref)]:[]};case 'crit':return {k:'critGe',v:String(g.ref||75)}}return {k:'all',v:''}}
function normWhen(w){w=w||{};if(w.k==='dow')return {k:'dow',v:arr7(w.v,false)};if(w.k==='dates')return {k:'dates',v:String(w.v||'').slice(0,600)};return {k:'all',v:''}}
function whenMatch(w,iso,ds){if(!w||w.k==='all')return true;if(w.k==='dow')return !!w.v[dowOf(iso)];return (ds||parseDates(w.v)).has(iso)}
function normGoal(g){
  g=g||{};
  const what=normM(g.what||legacyWhat(g),WHAT_K);
  const n=clamp(intOr(g.n,1),0,9999);let n2=clamp(intOr(g.n2,n+1),0,9999);if(n2<n)n2=n;
  const inj=g.inject||{};
  const kind=G_KIND.includes(g.kind)?g.kind:'count';
  let mode=g.mode==='each'?'any':G_MODE.includes(g.mode)?g.mode:'any';if(kind==='count'&&mode==='exact')mode='only';
  const iop=G_OP.includes(inj.op)?inj.op:'exact';const in1=clamp(intOr(inj.n,1),iop==='max'?0:1,50);let in2=clamp(intOr(inj.n2,in1+1),0,60);if(in2<in1)in2=in1;
  return {id:typeof g.id==='string'&&g.id?g.id:uid('g'),on:g.on!==false,kind,label:String(g.label||'').slice(0,80),
    what,who:normM(g.who,WHO_K),mode,k:clamp(intOr(g.k,2),1,20),when:normWhen(g.when),
    per:G_PER.includes(g.per)?g.per:'each',period:g.period==='week'?'week':'plan',measure:g.measure==='places'?'places':'visits',
    op:G_OP.includes(g.op)?g.op:'min',n,n2,hard:!!g.hard,w:clamp(num(g.w,50),0,100),
    inject:{mode:inj.mode==='pick'?'pick':'dates',dates:String(inj.dates||'').slice(0,600),n:in1,n2:in2,op:iop,per:inj.per==='each'?'each':'any',add:inj.add==='replace'?'replace':'extra'}};
}
function mkGoal(o){return normGoal(Object.assign({on:true,per:'each',op:'min',n:1},o||{}))}
function goalBounds(g){const lo=g.op==='max'?0:g.n,hi=g.op==='min'?-1:(g.op==='between'?g.n2:g.n);return {lo,hi}}
function resolveM(R,m){if(!m||typeof m!=='object')return m;const x=JSON.parse(JSON.stringify(m));const f=c=>{c.v=Array.isArray(c.v)?c.v.map(y=>R(c.k,y)):R(c.k,c.v)};f(x);(x.more||[]).forEach(f);return x}
function resolveGoals(ws,list){
  const R=refResolver(ws);
  return (Array.isArray(list)?list:[]).map(g0=>{const g=Object.assign({},g0);if(!g.what&&g.scope)g.what=legacyWhat(g);if(g.what)g.what=resolveM(R,g.what);if(g.who)g.who=resolveM(R,g.who);delete g.id;return normGoal(g)});
}
function sideExporter(ws){
  const nm=(arr,id)=>{const x=byId(arr,id);return x?x.name:id};
  const out=(k,v)=>{
    switch(k){
      case 'role':return String(v).replace(/^r_/,'');
      case 'cat':return /^c_/.test(v)?v.slice(2):nm(ws.categories,v);
      case 'loc':case 'homeLoc':return nm(ws.locations||[],v);
      case 'site':return nm(ws.sites,v);
      case 'person':return nm(ws.people,v);
    }
    return v;
  };
  const side=(m)=>{const o={k:m.k,v:Array.isArray(m.v)?m.v.map(x=>out(m.k,x)):out(m.k,m.v)};if(m.not)o.not=true;if(m.more&&m.more.length){o.more=m.more.map(side);o.join=m.join}return o};
  return side;
}
function goalsForExport(ws){
  const side=sideExporter(ws);
  return (ws.goals||[]).map(g=>{const o=Object.assign({},g);delete o.id;o.what=side(g.what);o.who=side(g.who);o.when=JSON.parse(JSON.stringify(g.when));o.inject=Object.assign({},g.inject);return o});
}
function bookForExport(ws,list){
  const side0=sideExporter(ws);
  const side=m=>{const o=side0(m);if(m.k==='person'&&!Array.isArray(m.v))o.v=m.v;return o};
  return (list||ws.book||[]).map(r=>{const o={on:r.on,rel:r.rel,sense:r.sense,who:side(r.who),what:r.rel==='day'?(r.what.k==='dates'?{k:'dates',v:r.what.v}:{k:'dow',v:r.what.v.slice()}):side(r.what),w:r.w};
    if(r.rel==='team'||r.rel==='count'){o.op=r.op;o.n=r.n}if(r.rel==='count')o.per=r.per;if(r.note)o.note=r.note;return o});
}

function tplBlank(){
  const w=blankWS('Untitled plan');
  const r=mkRole('Lead',COLORS[0]);w.roles=[r];
  w.categories=[mkCat('Standard',COLORS[0],{[r.id]:1},1)];
  return w;
}
function tplField(){
  const w=blankWS('Field inspections');w.template='field';
  w.terms={en:{visit:'visit',visits:'visits',site:'facility',sites:'facilities',person:'inspector',people:'inspectors'},
           ar:{visit:'زيارة',visits:'زيارات',site:'مرفق',sites:'مرافق',person:'مفتش',people:'مفتشون'}};
  const fin=mkRole('Financial',COLORS[0]),cli=mkRole('Clinical',COLORS[2]);w.roles=[fin,cli];
  const main=mkCat('Main',COLORS[0],{[fin.id]:2,[cli.id]:2},3),con=mkCat('Contracted',COLORS[3],{[fin.id]:1,[cli.id]:2},1),exc=mkCat('Excluded',COLORS[6],{},0,false);
  w.categories=[main,con,exc];
  const locs=[['Central',0],['North',18],['Old Town',25],['East',26],['Westgate',29],['Riverside',37],['South',45],['Harbour',50],['Hills',66],['Valley',82]].map(([n,k])=>mkLoc(n,k));
  w.locations=locs;const L=n=>locs.find(l=>l.name===n).id;
  const mains=[['Branch HQ','Central',100],['Records Office','Central',75],['Medical Affairs','Central',75],['Legal Affairs','Central',50],['Fleet Depot','Central',50],['Annex','Central',50],['North Clinic','North',75],['North Students Unit','North',75],['East Workforce Unit','East',100],['East Evening Clinic','East',50],['Riverside Clinic','Riverside',75],['Harbour Clinic','Harbour',75],['South Students Unit','South',75],['South Evening Clinic','South',50],['Westgate Clinic','Westgate',75],['Hill District Unit','Hills',75],['Valley Unit','Valley',50],['Old Town Clinic','Old Town',75]];
  const cons=[['Alpha Imaging','Central'],['Crescent Hospital','Central'],['Nile Heart Center','Central'],['Royal East Hospital','Central'],['Family Lab','Central'],['Delta Scan','Riverside'],['Riverside Radiology','Riverside'],['Harbour Dialysis','Harbour'],['Sunrise Nursery','Old Town'],['Hope Kidney Center','Hills'],['Prime Lab','North'],['Grand Hospital','South']];
  const excl=[['Governorate Office','Central'],['Election Committee','Central'],['Prosecution Office','East']];
  w.sites=mains.map(([n,l,c])=>mkSite(n,main.id,0,{loc:L(l),crit:c,tag:'Clinic'})).concat(cons.map(([n,l])=>mkSite(n,con.id,0,{loc:L(l),crit:50,tag:'Provider'}))).concat(excl.map(([n,l])=>mkSite(n,exc.id,0,{loc:L(l),crit:0})));
  const P=(n,r,home,pref,rank)=>mkPerson(n,[r],{homeLoc:L(home),pref,rank,days:[true,true,true,true,true,false,false]});
  w.people=[P('Lubna',fin.id,'Central','near',50),P('Abaza',fin.id,'North','none',75),P('Shaltout',fin.id,'East','near',50),P('Amani',fin.id,'Central','none',100),P('Ghada',fin.id,'Old Town','near',50),
    P('Hamoudin',cli.id,'Central','near',75),P('Shawky',cli.id,'South','far',25),P('Asmaa',cli.id,'Central','none',50),P('Mariam',cli.id,'Riverside','near',100),P('Sharnouby',cli.id,'North','none',50),P('Maysara',cli.id,'Central','near',75)];
  w.week=[{on:true,n:1,focus:'auto'},{on:true,n:1,focus:'auto'},{on:true,n:1,focus:'auto'},{on:true,n:1,focus:'auto'},{on:true,n:2,focus:'near'},{on:false,n:0,focus:'auto'},{on:false,n:0,focus:'auto'}];
  w.rules.weekStart=0;w.rules.rankGate='lead';
  syncLoc(w);
  return w;
}
function tplRetail(){
  const w=blankWS('Store audits');w.template='retail';
  w.terms={en:{visit:'audit',visits:'audits',site:'store',sites:'stores',person:'auditor',people:'field team'},
           ar:{visit:'تدقيق',visits:'تدقيقات',site:'متجر',sites:'متاجر',person:'مدقق',people:'الفريق الميداني'}};
  const au=mkRole('Auditor',COLORS[0]),me=mkRole('Merchandiser',COLORS[4]);w.roles=[au,me];
  const fl=mkCat('Flagship',COLORS[0],{[au.id]:1,[me.id]:2},2),fr=mkCat('Franchise',COLORS[2],{[au.id]:1,[me.id]:1},3),ki=mkCat('Kiosk',COLORS[7],{[me.id]:1},2);
  w.categories=[fl,fr,ki];
  const zones=['North','South','East','West','Central'];const rnd=mulberry32(77);
  const names=['Market Square','Harbor Point','Maple Row','Station Plaza','Cedar Mall','Riverside','Old Mill','Lakeside','Grand Avenue','Park Lane','Union Street','Hilltop','Oak Court','Bayview','Kings Cross','Garden City','Metro Hub','Airport','University','Seafront','Westfield','East Gate','Pine Ridge','Canal Walk','Sunset Blvd','Highland','Queensway','Mill Road'];
  names.forEach((n,i)=>{const cat=i<5?fl.id:i<17?fr.id:ki.id;const z=i%5;w.sites.push(mkSite(n,cat,Math.round(2+rnd()*40),{zone:zones[z],weight:i<5?1.5:1,crit:i<5?75:50}))});
  const P=(n,r,home,pref)=>mkPerson(n,[r],{home,pref,days:[false,true,true,true,true,true,false]});
  w.people=[P('Noah',au.id,8,'none'),P('Layla',au.id,20,'far'),P('Omar',au.id,5,'near'),P('Zara',au.id,14,'none'),
    P('Ivy',me.id,6,'near'),P('Sami',me.id,18,'none'),P('Rana',me.id,11,'far'),P('Theo',me.id,3,'near'),P('Mina',me.id,25,'none'),P('Karim',me.id,9,'none')];
  w.people[0].roles=[au.id,me.id];
  w.week=WEEK5(1,3);w.rules.weekStart=1;w.rules.siteGap=5;w.rules.runMax=0;w.rules.offMin=0;
  return w;
}
function tplCare(){
  const w=blankWS('Home-care rounds');w.template='care';
  w.terms={en:{visit:'round',visits:'rounds',site:'client',sites:'clients',person:'carer',people:'carers'},
           ar:{visit:'جولة',visits:'جولات',site:'عميل',sites:'عملاء',person:'مقدّم رعاية',people:'مقدّمو الرعاية'}};
  const nu=mkRole('Nurse',COLORS[0]),ai=mkRole('Aide',COLORS[4]);w.roles=[nu,ai];
  const cx=mkCat('Complex care',COLORS[0],{[nu.id]:1,[ai.id]:1},1),rt=mkCat('Routine',COLORS[4],{[ai.id]:1},2);
  w.categories=[cx,rt];
  const rnd=mulberry32(19);const zones=['A','B','C'];
  const names=['Mrs. Adams','Mr. Baker','Ms. Chen','Mr. Diaz','Mrs. Evans','Mr. Farouk','Ms. Grant','Mr. Hughes','Mrs. Ito','Mr. Jensen','Ms. Khan','Mr. Lopez','Mrs. Moreau','Mr. Novak','Ms. Okafor','Mr. Patel'];
  names.forEach((n,i)=>w.sites.push(mkSite(n,i<6?cx.id:rt.id,Math.round(1+rnd()*18),{zone:zones[i%3],minV:i<6?2:'',weight:i<6?1.3:1,crit:i<6?75:25})));
  const P=(n,r,home,pref,days)=>mkPerson(n,[r],{home,pref,days,maxWeek:5});
  const wd=[false,true,true,true,true,true,false],all=[true,true,true,true,true,true,true];
  w.people=[P('Alice',nu.id,4,'near',wd),P('Ben',nu.id,9,'none',all),P('Carla',nu.id,12,'far',wd),
    P('Dev',ai.id,2,'near',wd),P('Ella',ai.id,7,'none',all),P('Femi',ai.id,15,'none',wd),P('Gia',ai.id,5,'near',wd),P('Hugo',ai.id,10,'none',all)];
  w.week=[{on:true,n:2,focus:'auto'},{on:true,n:4,focus:'auto'},{on:true,n:4,focus:'auto'},{on:true,n:4,focus:'auto'},{on:true,n:4,focus:'auto'},{on:true,n:4,focus:'auto'},{on:true,n:2,focus:'auto'}];
  w.rules.weekStart=1;w.rules.runMax=0;w.rules.offMin=0;w.rules.nearKm=8;w.scope={mode:'week',start:weekStartOf(todayISO(),1),end:''};
  return w;
}
const TEMPLATES={blank:tplBlank,field:tplField,retail:tplRetail,care:tplCare};
const TEMPLATE_ORDER=['field','retail','care','blank'];

function fromDataset(o,name){
  const w=blankWS(name||o.name||'Beheira branch');w.template='dataset';
  w.terms={en:{visit:'visit',visits:'visits',site:'facility',sites:'facilities',person:'member',people:'team'},
           ar:{visit:'زيارة',visits:'زيارات',site:'منشأة',sites:'منشآت',person:'عضو',people:'الفريق'}};
  if(o.terms&&typeof o.terms==='object'){w.terms.en=Object.assign(w.terms.en,o.terms.en||{});w.terms.ar=Object.assign(w.terms.ar,o.terms.ar||{})}
  const dist=o.location_distances_km||{};
  const lid=n=>'l_'+fnv(String(n));
  w.locations=Object.keys(dist).map(n=>mkLoc(n,Math.max(0,num(dist[n],0)),{id:lid(n)}));
  const locId=n=>{if(!n)return '';let l=w.locations.find(x=>x.name===n);if(!l){l=mkLoc(n,0,{id:lid(n),unknown:true});w.locations.push(l)}return l.id};
  const pools=o.pools||{fin:{id:'fin',name:'Financial/Admin',seats:{basic:2,contracted:1}},clin:{id:'clin',name:'Clinical',seats:{basic:2,contracted:2}}};
  const pk=Object.keys(pools);
  const roles={};pk.forEach((k,i)=>{roles[k]=mkRole(pools[k].name||k,pools[k].color||COLORS[i===0?0:2+i]);roles[k].id='r_'+k});
  w.roles=pk.map(k=>roles[k]);
  const st=kind=>{const s={};pk.forEach(k=>s[roles[k].id]=intOr(pools[k].seats&&pools[k].seats[kind],0));return s};
  const ds=o.default_settings||{};
  const rp=num(ds.ratioP,.25);const bShare=rp>0&&rp<1?Math.max(1,Math.round((1-rp)/rp)):3;
  const cBasic=mkCat('Basic',COLORS[0],st('basic'),bShare),cCon=mkCat('Contracted',COLORS[3],st('contracted'),1),cExc=mkCat('Excluded',COLORS[6],{},0,false);
  cBasic.id='c_basic';cCon.id='c_contracted';cExc.id='c_excluded';
  w.categories=[cBasic,cCon,cExc];
  const kindCat={basic:cBasic.id,contracted:cCon.id,excluded:cExc.id};
  const cg=o.categories||{};const pats=cg.excluded_by_name_pattern||[];
  const kindOf=f=>{if(f.kind)return f.kind;if(pats.some(p=>String(f.name).includes(p)))return 'excluded';for(const k of ['basic','contracted','excluded'])if((cg[k]||[]).includes(f.category))return k;return 'basic'};
  const crits=o.facility_criticality||{};
  const facs=o.facilities||[];
  w.sites=facs.map((f,i)=>{const k=kindOf(f);const cr=f.crit!=null?f.crit:crits[f.name]!=null?crits[f.name]:(k==='excluded'?0:50);
    const low=(o.admin_low_frequency_facilities||[]).includes(f.name);
    const gmn=f.gapMin!=null?f.gapMin:f.gap_min,gmx=f.gapMax!=null?f.gapMax:f.gap_max;
    return mkSite(String(f.name),kindCat[k]||cBasic.id,0,{id:f.id||('f_'+i),loc:locId(f.location),tag:f.category||'',crit:clamp(num(cr,50),0,100),weight:clamp(num(f.weight,low?.5:1),.1,3),active:f.active!==false,minV:f.min==null?'':f.min,maxV:f.max==null?'':f.max,gapMin:gmn==null||gmn===''?'':Math.max(0,intOr(gmn,0)),gapMax:gmx==null||gmx===''?'':Math.max(0,intOr(gmx,0))})});
  const wd=Array.isArray(ds.weekdays)?ds.weekdays:[0,1,2,3,4];
  const per=Math.max(1,intOr(ds.maxVisitsPerDay,1));
  w.week=[0,1,2,3,4,5,6].map(i=>({on:wd.includes(i),n:wd.includes(i)?per:0,focus:'auto'}));
  w.people=(o.people||[]).map((p,i)=>{
    const rr=roles[p.pool]?[roles[p.pool].id]:w.roles.map(r=>r.id);
    const rb=num(p.rankBasic,null),rc=num(p.rankContracted,null);
    const rank=p.rank!=null?num(p.rank,50):(rb!=null&&rc!=null?Math.round((rb+rc)/2):50);
    const rankBy={};if(rb!=null)rankBy[cBasic.id]=rb;if(rc!=null)rankBy[cCon.id]=rc;
    const days=Array.isArray(p.workWeekdays)?[0,1,2,3,4,5,6].map(d=>p.workWeekdays.includes(d)):[true,true,true,true,true,true,true];
    const pat=p.pattern&&typeof p.pattern==='object'?p.pattern:{};
    return mkPerson(String(p.name),rr,{id:p.id||('p_'+i),homeLoc:locId(p.originLocationId||''),rank,rankBy,gender:p.gender||'',weight:clamp(num(p.weight,1),.1,3),active:p.active!==false,days,
      off:(Array.isArray(p.unavailable)?p.unavailable:[]).filter(validISO),bans:Array.isArray(p.blockedFacilities)?p.blockedFacilities:[],pref:num(p.distanceAffinity,0)>0?'far':num(p.distanceAffinity,0)<0?'near':'none',note:p.title||'',
      runMax:pat.work==null?'':intOr(pat.work,''),offMin:pat.rest==null?'':intOr(pat.rest,''),maxLoad:p.maxTotal==null?'':p.maxTotal,maxWeek:p.maxWeek==null?'':p.maxWeek})});
  const cad=ds.cadence||{};const gap=intOr(cad.gapDays,2);
  w.rules.runMax=gap>=2?1:0;w.rules.offMin=gap>=2?gap-1:0;
  w.rules.perDay=1;w.rules.weekStart=6;
  w.rules.rankGate=ds.critMode==='require'?'lead':'off';w.rules.rankTol=25;
  if(cad.mode==='strict')w.rules.mode='strict';
  (Array.isArray(ds.holidays)?ds.holidays:[]).filter(validISO).forEach(iso=>{w.overrides[iso]={on:false,n:0,focus:'auto'}});
  const d=new Date();w.scope={mode:'month',start:fISO(new Date(d.getFullYear(),d.getMonth(),1)),end:''};
  const R=refResolver(w);
  w.routes=(Array.isArray(o.routes)?o.routes:[]).map(r=>({id:uid('t'),a:R('loc',r.from!=null?r.from:r.a),b:R('loc',r.to!=null?r.to:r.b),km:Math.max(0,num(r.km,0))})).filter(r=>r.a&&r.b&&r.a!==r.b);
  const se=o.settings&&typeof o.settings==='object'?o.settings:{};
  if(se.rules)Object.assign(w.rules,se.rules);
  if(se.weights)Object.assign(w.weights,se.weights);
  if(se.useW)Object.assign(w.useW,se.useW);
  if(se.engine)Object.assign(w.engine,se.engine);
  if(se.sizing)Object.assign(w.sizing,se.sizing);
  if(se.unit)w.unit=se.unit;
  if(Array.isArray(se.week))w.week=normWeek(se.week);
  if(se.categories&&typeof se.categories==='object')for(const k in se.categories){const c=w.categories.find(x=>x.id==='c_'+k||x.name===k);if(c)Object.assign(c,se.categories[k])}
  if(Array.isArray(se.goals))w.goals=resolveGoals(w,se.goals);
  const book=o.rulebook||se.rulebook;
  if(Array.isArray(book))w.book=resolveBook(w,book);
  if(se.recency){const rc=clone(se.recency);const cm={};if(rc.cat)for(const k in rc.cat){const c=w.categories.find(x=>x.id==='c_'+k||x.id===k||x.name===k);if(c)cm[c.id]=rc.cat[k]}rc.cat=cm;w.recency=normRecency(rc)}
  if(Array.isArray(o.history)&&o.history.length){const res=parseHistoryRows(w,historyAoa(o.history));w.history=mergeHistory([],res.recs).list;w.histRev=1}
  const gr=ds.genderRule&&typeof ds.genderRule==='object'?ds.genderRule:{};
  Object.keys(gr).forEach(kind=>{
    const v=String(gr[kind]==null?'':gr[kind]).trim();if(!/^\d\d$/.test(v))return;
    const cid='c_'+kind;if(!w.categories.some(c=>c.id===cid))return;
    if(w.book.some(r=>r.rel==='team'&&r.who.k==='gender'&&r.who.v==='f'&&r.what.k==='cat'&&r.what.v===cid))return;
    w.book.push(normRule({rel:'team',sense:'prefer',what:{k:'cat',v:cid},op:'max',n:+v[1],who:{k:'gender',v:'f'},w:40,note:'genderRule.'+kind+' = '+v}));
  });
  syncLoc(w);
  return normalize(w);
}
function overlayList(kind,base,add){
  base=Array.isArray(base)?base:[];const used=new Set();
  return add.filter(x=>x&&x.name).map(x=>{
    const b=base.find(y=>!used.has(y)&&((x.id&&y.id===x.id)||y.name===x.name));if(b)used.add(b);
    const o=Object.assign({},b||{},x);
    if(kind==='people'){if(x.rank==null)delete o.rank;if(!o.id)o.id='p_'+fnv(x.name)}
    else{if(b&&x.category!=null&&x.category!==b.category)delete o.kind;if(!o.id)o.id='f_'+fnv(x.name)}
    return o;
  });
}
function mergeDataset(old,nw){
  const remap={};
  const match=(oa,na)=>na.forEach(n=>{const o=oa.find(x=>x.id===n.id)||oa.find(x=>x.name===n.name);if(o&&o.id!==n.id)remap[n.id]=o.id});
  match(old.roles,nw.roles);match(old.categories,nw.categories);match(old.locations||[],nw.locations);match(old.sites,nw.sites);match(old.people,nw.people);
  const R=id=>remap[id]||id;
  const rk=o=>{const x={};for(const k in o)x[R(k)]=o[k];return x};
  nw.roles.forEach(r=>r.id=R(r.id));
  nw.categories.forEach(c=>{c.id=R(c.id);c.staff=rk(c.staff)});
  nw.locations.forEach(l=>l.id=R(l.id));
  nw.sites.forEach(s=>{s.id=R(s.id);s.cat=R(s.cat);s.loc=R(s.loc)});
  nw.people.forEach(p=>{p.id=R(p.id);p.roles=p.roles.map(R);p.homeLoc=R(p.homeLoc);p.rankBy=rk(p.rankBy);p.bans=p.bans.map(R);p.likes=p.likes.map(R)});
  (nw.routes||[]).forEach(r=>{r.a=R(r.a);r.b=R(r.b)});
  const out=clone(old);
  out.roles=nw.roles.map(r=>{const o=byId(old.roles,r.id);return o?Object.assign({},r,{name:o.name,color:o.color}):r});
  const oldExtraCats=old.categories.filter(c=>!nw.categories.some(n=>n.id===c.id)&&old.sites.some(s=>s.cat===c.id&&!nw.sites.some(n=>n.id===s.id)));
  out.categories=nw.categories.map(c=>{const o=byId(old.categories,c.id);return o?clone(o):c}).concat(oldExtraCats.map(clone));
  out.locations=nw.locations;
  const uniq=a=>Array.from(new Set(a));
  out.sites=nw.sites.map(s=>{const o=byId(old.sites,s.id);if(!o)return s;return Object.assign({},s,{days:o.days,blackout:o.blackout,zone:o.zone,note:o.note,weight:o.weight,active:s.active&&o.active,minV:o.minV!==''?o.minV:s.minV,maxV:o.maxV!==''?o.maxV:s.maxV,gapMin:o.gapMin!==''&&o.gapMin!=null?o.gapMin:s.gapMin,gapMax:o.gapMax!==''&&o.gapMax!=null?o.gapMax:s.gapMax})});
  out.people=nw.people.map(p=>{const o=byId(old.people,p.id);if(!o)return p;return Object.assign({},p,{days:o.days,off:uniq(o.off.concat(p.off)),avoid:o.avoid,pair:o.pair,likes:uniq(o.likes.concat(p.likes)),bans:uniq(o.bans.concat(p.bans)),
    maxLoad:o.maxLoad!==''?o.maxLoad:p.maxLoad,maxWeek:o.maxWeek!==''?o.maxWeek:p.maxWeek,runMax:o.runMax!==''?o.runMax:p.runMax,offMin:o.offMin!==''?o.offMin:p.offMin,pref:o.pref!=='none'?o.pref:p.pref,active:p.active&&o.active})});
  out.routes=(nw.routes||[]).length?nw.routes:(old.routes||[]);
  out.book=(old.book||[]).length?old.book:(nw.book||[]);
  out.goals=old.goals.length?old.goals:nw.goals;
  if(!(old.history||[]).length&&(nw.history||[]).length){out.history=nw.history;out.histRev=(old.histRev||0)+1}
  out.source=nw.source||old.source;
  out.updated=Date.now();
  syncLoc(out);
  return normalize(out);
}
function toDataset(ws){
  const ln=id=>{const l=byId(ws.locations||[],id);return l?l.name:''};
  const kindOf=cid=>/^c_/.test(cid)?cid.slice(2):String((byId(ws.categories,cid)||{}).name||cid).toLowerCase();
  const pools={};ws.roles.forEach(r=>{const k=r.id.replace(/^r_/,'');const seats={};ws.categories.forEach(c=>{if(c.planned)seats[kindOf(c.id)]=c.staff[r.id]||0});pools[k]={id:k,name:r.name,color:r.color,seats}});
  const dist={};(ws.locations||[]).slice().sort((a,b)=>a.km-b.km).forEach(l=>dist[l.name]=l.km);
  const crit={};ws.sites.forEach(s=>crit[s.name]=s.crit);
  const cats={};ws.categories.forEach(c=>{const k=kindOf(c.id);cats[k]=Array.from(new Set(ws.sites.filter(s=>s.cat===c.id).map(s=>s.tag).filter(Boolean)))});
  const pc=ws.categories.filter(c=>c.planned);
  const weekdays=[];ws.week.forEach((d,i)=>{if(d.on)weekdays.push(i)});
  return {
    format:'cadence-dataset',version:2,exported:new Date().toISOString(),name:ws.name,terms:ws.terms,
    location_distances_km:dist,categories:cats,facility_criticality:crit,pools,
    default_settings:{weekdays,maxVisitsPerDay:Math.max(1,...ws.week.map(d=>d.n)),holidays:Object.keys(ws.overrides).filter(k=>ws.overrides[k].on===false),critMode:ws.rules.rankGate!=='off'?'require':'prefer',cadence:{mode:ws.rules.mode==='strict'?'strict':'prefer',gapDays:ws.rules.runMax===1?ws.rules.offMin+1:1}},
    people:ws.people.map(p=>{const o={id:p.id,name:p.name,gender:p.gender||'',pool:p.roles.length>1&&p.roles.length===ws.roles.length?'any':(p.roles[0]||'').replace(/^r_/,''),rank:p.rank,weight:p.weight,active:p.active,originLocationId:ln(p.homeLoc),unavailable:p.off.slice(),blockedFacilities:p.bans.slice(),distanceAffinity:p.pref==='far'?1:p.pref==='near'?-1:0,workWeekdays:p.days.every(Boolean)?null:p.days.map((x,i)=>x?i:-1).filter(i=>i>=0)};
      pc.forEach(c=>{if(p.rankBy[c.id]!=null){const k=kindOf(c.id);o['rank'+k.charAt(0).toUpperCase()+k.slice(1)]=p.rankBy[c.id]}});
      if(p.runMax!==''||p.offMin!=='')o.pattern={work:p.runMax===''?null:p.runMax,rest:p.offMin===''?null:p.offMin};
      if(p.maxLoad!=='')o.maxTotal=p.maxLoad;if(p.maxWeek!=='')o.maxWeek=p.maxWeek;if(p.note)o.title=p.note;return o}),
    facilities:ws.sites.map(s=>{const o={id:s.id,name:s.name,category:s.tag||'',location:ln(s.loc),kind:kindOf(s.cat),weight:s.weight,crit:s.crit};if(!s.active)o.active=false;if(s.minV!=='')o.min=s.minV;if(s.maxV!=='')o.max=s.maxV;if(s.gapMin!==''&&s.gapMin!=null)o.gapMin=s.gapMin;if(s.gapMax!==''&&s.gapMax!=null)o.gapMax=s.gapMax;return o}),
    routes:(ws.routes||[]).map(r=>({from:ln(r.a),to:ln(r.b),km:r.km})),
    history:(ws.history||[]).map(h=>{const s=byId(ws.sites,h.site);const o={date:h.date,place:s?s.name:(h.sn||''),people:h.people.map(id=>(byId(ws.people,id)||{}).name).filter(Boolean).concat(h.pn||[])};if(h.note)o.note=h.note;if(h.src&&h.src!=='upload')o.src=h.src;return o}),
    settings:{rules:ws.rules,weights:ws.weights,useW:ws.useW,engine:{seed:ws.engine.seed,quality:ws.engine.quality,runs:ws.engine.runs},sizing:ws.sizing,unit:ws.unit,week:ws.week,
      recency:(()=>{const r=clone(ws.recency||defaultRecency());const cm={};for(const k in r.cat||{})cm[kindOf(k)]=r.cat[k];r.cat=cm;return r})(),
      goals:goalsForExport(ws)},
    rulebook:bookForExport(ws)
  };
}

function locDist(ws){
  const L={};(ws.locations||[]).forEach(l=>L[l.id]=+l.km||0);
  const R={};(ws.routes||[]).forEach(r=>{R[r.a+'|'+r.b]=+r.km;R[r.b+'|'+r.a]=+r.km});
  return (la,ka,lb,kb)=>{if(la&&lb){if(la===lb)return 0;const x=R[la+'|'+lb];if(x!=null)return x}return Math.abs((la&&L[la]!=null?L[la]:ka)-(lb&&L[lb]!=null?L[lb]:kb))};
}
function syncLoc(ws){
  const m={};(ws.locations||[]).forEach(l=>m[l.id]=l);
  ws.sites.forEach(s=>{if(s.loc){const l=m[s.loc];if(l)s.km=+l.km||0;else s.loc=''}});
  ws.people.forEach(p=>{if(p.homeLoc){const l=m[p.homeLoc];if(l)p.home=+l.km||0;else p.homeLoc=''}});
  return ws;
}

function normWeek(w){
  const out=[];for(let i=0;i<7;i++){const x=(w&&w[i])||{};out.push({on:!!x.on,n:clamp(intOr(x.n,x.on?1:0),0,50),focus:typeof x.focus==='string'?x.focus:'auto'})}
  return out;
}
function arr7(a,def){if(!Array.isArray(a)||a.length!==7)return [def,def,def,def,def,def,def];return a.map(Boolean)}
const lvl=(v,d)=>clamp(num(v,d),0,100);
function normalize(o){
  if(!o||typeof o!=='object')throw new Error('not an object');
  if(!Array.isArray(o.sites)||!Array.isArray(o.people)||!Array.isArray(o.roles)||!Array.isArray(o.categories))throw new Error('missing sites / people / roles / categories');
  const w=blankWS(o.name);
  w.id=typeof o.id==='string'&&o.id?o.id:w.id;
  w.name=String(o.name||'Imported plan').slice(0,80);
  w.created=+o.created||Date.now();w.updated=+o.updated||Date.now();
  w.template=o.template||'custom';
  w.terms={en:Object.assign({},TERM_DEFAULT.en,(o.terms&&o.terms.en)||{}),ar:Object.assign({},TERM_DEFAULT.ar,(o.terms&&o.terms.ar)||{})};
  w.unit=o.unit==='mi'?'mi':'km';
  const ids=new Set();
  const okId=(x,p)=>{let id=typeof x==='string'&&x?x:uid(p);while(ids.has(id))id=uid(p);ids.add(id);return id};
  w.roles=o.roles.map((r,i)=>({id:okId(r.id,'r'),name:String(r.name||'Role '+(i+1)),color:r.color||COLORS[i%COLORS.length]}));
  const rIds=new Set(w.roles.map(r=>r.id));
  w.categories=o.categories.map((c,i)=>{const st={};if(c.staff)for(const k in c.staff)if(rIds.has(k))st[k]=clamp(intOr(c.staff[k],0),0,20);
    return {id:okId(c.id,'c'),name:String(c.name||'Category '+(i+1)),color:c.color||COLORS[i%COLORS.length],staff:st,share:Math.max(0,num(c.share,1)),planned:c.planned!==false}});
  const cIds=new Set(w.categories.map(c=>c.id));
  w.locations=(Array.isArray(o.locations)?o.locations:[]).map((l,i)=>({id:okId(l.id,'l'),name:String(l.name||'Location '+(i+1)),km:Math.max(0,num(l.km,0)),unknown:!!l.unknown}));
  const lIds=new Set(w.locations.map(l=>l.id));
  w.routes=(Array.isArray(o.routes)?o.routes:[]).filter(r=>r&&lIds.has(r.a)&&lIds.has(r.b)&&r.a!==r.b).map(r=>({id:typeof r.id==='string'&&r.id?r.id:uid('t'),a:r.a,b:r.b,km:Math.max(0,num(r.km,0))}));
  w.source=o.source&&typeof o.source==='object'?{url:String(o.source.url||''),hash:String(o.source.hash||''),at:+o.source.at||0,auto:o.source.auto!==false}:null;
  w.sites=o.sites.map((s,i)=>({id:okId(s.id,'s'),name:String(s.name||'Site '+(i+1)),cat:cIds.has(s.cat)?s.cat:(w.categories[0]&&w.categories[0].id),
    km:Math.max(0,num(s.km,0)),loc:lIds.has(s.loc)?s.loc:'',crit:lvl(s.crit,50),tag:String(s.tag||''),zone:String(s.zone||''),weight:clamp(num(s.weight,1),.1,3),minV:s.minV===''||s.minV==null?'':Math.max(0,intOr(s.minV,0)),maxV:s.maxV===''||s.maxV==null?'':Math.max(0,intOr(s.maxV,0)),
    gapMin:s.gapMin===''||s.gapMin==null?'':clamp(intOr(s.gapMin,0),0,1000),gapMax:s.gapMax===''||s.gapMax==null?'':clamp(intOr(s.gapMax,0),0,1000),
    days:arr7(s.days,true),blackout:Array.isArray(s.blackout)?s.blackout.filter(validISO):[],active:s.active!==false,note:String(s.note||'')}));
  const sIds=new Set(w.sites.map(s=>s.id));
  w.people=o.people.map((p,i)=>{const rb={};if(p.rankBy&&typeof p.rankBy==='object')for(const k in p.rankBy)if(cIds.has(k))rb[k]=lvl(p.rankBy[k],50);
    return {id:okId(p.id,'p'),name:String(p.name||'Person '+(i+1)),roles:(Array.isArray(p.roles)?p.roles:[]).filter(r=>rIds.has(r)),
    home:Math.max(0,num(p.home,0)),homeLoc:lIds.has(p.homeLoc)?p.homeLoc:'',rank:lvl(p.rank,50),rankBy:rb,gender:String(p.gender||''),note:String(p.note||''),
    pref:['near','far','none'].includes(p.pref)?p.pref:'none',weight:clamp(num(p.weight,1),.1,3),
    days:arr7(p.days,true),off:Array.isArray(p.off)?p.off.filter(validISO):[],maxLoad:p.maxLoad===''||p.maxLoad==null?'':Math.max(0,intOr(p.maxLoad,0)),maxWeek:p.maxWeek===''||p.maxWeek==null?'':Math.max(0,intOr(p.maxWeek,0)),
    runMax:p.runMax===''||p.runMax==null?'':clamp(intOr(p.runMax,0),0,14),offMin:p.offMin===''||p.offMin==null?'':clamp(intOr(p.offMin,0),0,14),
    avoid:Array.isArray(p.avoid)?p.avoid:[],pair:Array.isArray(p.pair)?p.pair:[],likes:(Array.isArray(p.likes)?p.likes:[]).filter(x=>sIds.has(x)),bans:(Array.isArray(p.bans)?p.bans:[]).filter(x=>sIds.has(x)),active:p.active!==false}});
  const pIds=new Set(w.people.map(p=>p.id));
  w.people.forEach(p=>{p.avoid=p.avoid.filter(x=>pIds.has(x)&&x!==p.id);p.pair=p.pair.filter(x=>pIds.has(x)&&x!==p.id)});
  w.book=(Array.isArray(o.book)?o.book:[]).map(normRule);
  w.history=(Array.isArray(o.history)?o.history:[]).filter(h=>h&&validISO(h.date)).slice(0,20000).map(h=>({id:typeof h.id==='string'&&h.id?h.id:uid('h'),date:h.date,site:sIds.has(h.site)?h.site:'',sn:String(h.sn||''),
    people:(Array.isArray(h.people)?h.people:[]).filter(x=>pIds.has(x)),pn:(Array.isArray(h.pn)?h.pn:[]).map(String).filter(Boolean),note:String(h.note||'').slice(0,200),src:['upload','plan','manual'].includes(h.src)?h.src:'upload'}));
  w.histRev=Math.max(0,intOr(o.histRev,0));
  w.recency=normRecency(o.recency);
  w.goals=(Array.isArray(o.goals)?o.goals:[]).map(g=>{const x=normGoal(g);x.id=okId(g&&g.id,'g');return x});
  const sz=o.sizing||{};w.sizing={mode:['rhythm','total','goals'].includes(sz.mode)?sz.mode:'rhythm',total:clamp(intOr(sz.total,40),0,9999)};
  w.week=normWeek(o.week);
  w.overrides={};if(o.overrides&&typeof o.overrides==='object')for(const k in o.overrides)if(validISO(k))w.overrides[k]=o.overrides[k];
  const sc=o.scope||{};w.scope={mode:['week','month','custom'].includes(sc.mode)?sc.mode:'month',start:validISO(sc.start)?sc.start:w.scope.start,end:validISO(sc.end)?sc.end:''};
  const ru=o.rules||{};
  w.rules=Object.assign(defaultRules(),ru);
  if(ru.runMax===undefined&&ru.rest!==undefined){const r=intOr(ru.rest,0);w.rules.runMax=r>0?1:0;w.rules.offMin=r}
  delete w.rules.rest;
  w.rules.perDay=clamp(intOr(w.rules.perDay,1),0,10);w.rules.runMax=clamp(intOr(w.rules.runMax,0),0,14);w.rules.offMin=clamp(intOr(w.rules.offMin,0),0,14);w.rules.siteGap=clamp(intOr(w.rules.siteGap,0),0,60);
  w.rules.nearKm=Math.max(0,num(w.rules.nearKm,10));w.rules.weekStart=clamp(intOr(w.rules.weekStart,0),0,6);w.rules.mode=w.rules.mode==='strict'?'strict':'bend';w.rules.distinct=!!w.rules.distinct;
  w.rules.rankGate=['off','lead','all'].includes(w.rules.rankGate)?w.rules.rankGate:'off';w.rules.rankTol=clamp(intOr(w.rules.rankTol,25),0,100);
  w.weights=Object.assign(defaultWeights(),o.weights||{});WEIGHT_KEYS.forEach(k=>w.weights[k]=clamp(num(w.weights[k],50),0,100));
  w.useW=Object.assign(defaultUseW(),o.useW||{});
  w.engine=Object.assign(defaultEngine(),o.engine||{});w.engine.seed=Math.max(1,intOr(w.engine.seed,1));w.engine.runs=clamp(intOr(w.engine.runs,3),1,16);
  if(!['fast','balanced','thorough','max'].includes(w.engine.quality))w.engine.quality='balanced';
  w.locks={sites:Object.assign({},(o.locks&&o.locks.sites)||{}),seats:Object.assign({},(o.locks&&o.locks.seats)||{})};
  w.snapshots=Array.isArray(o.snapshots)?o.snapshots.filter(s=>s&&s.plan).slice(0,30):[];
  w.plan=o.plan&&o.plan.res&&o.plan.map?o.plan:null;
  syncLoc(w);
  return w;
}
function migrateLegacy(o){
  const w=blankWS('Imported rota');w.template='field';
  w.terms={en:{visit:'visit',visits:'visits',site:'facility',sites:'facilities',person:'person',people:'people'},ar:{visit:'زيارة',visits:'زيارات',site:'مرفق',sites:'مرافق',person:'فرد',people:'الفريق'}};
  const st=o.settings||{};
  const fin=mkRole('Financial',COLORS[0]),cli=mkRole('Clinical',COLORS[2]);w.roles=[fin,cli];
  const sf=st.staffing||{main:{fin:2,clin:2},contracted:{fin:1,clin:2}};
  const ratio=st.ratio||{m:3,c:1};
  const main=mkCat('Main',COLORS[0],{[fin.id]:sf.main.fin,[cli.id]:sf.main.clin},ratio.m);
  const con=mkCat('Contracted',COLORS[3],{[fin.id]:sf.contracted.fin,[cli.id]:sf.contracted.clin},ratio.c);
  const exc=mkCat('Excluded',COLORS[6],{},0,false);
  w.categories=[main,con,exc];
  const cmap={main:main.id,contracted:con.id,excluded:exc.id};
  w.sites=(o.facilities||[]).map(f=>mkSite(f.name,cmap[f.type]||main.id,f.km,{id:f.id||uid('s'),weight:f.weight||1,active:f.active!==false}));
  w.people=(o.people||[]).map(p=>mkPerson(p.name,[p.pool==='clin'?cli.id:fin.id],{id:p.id||uid('p'),home:p.originKm||0,pref:p.pref||'none',weight:p.weight||1,days:arr7(p.weekdays,true),off:Array.isArray(p.offDates)?p.offDates:[],active:p.active!==false}));
  if(Array.isArray(st.weekdayDefaults))w.week=st.weekdayDefaults.map(d=>({on:!!d.on,n:d.visits||0,focus:d.pref==='near'?'near':d.pref==='main'?main.id:'auto'}));
  if(o.dayOverrides)for(const k in o.dayOverrides){const x=o.dayOverrides[k],y={};if(x.on!==undefined)y.on=x.on;if(x.visits!==undefined)y.n=x.visits;if(x.pref)y.focus=x.pref==='near'?'near':x.pref==='main'?main.id:'auto';w.overrides[k]=y}
  if(o.scope)w.scope={mode:o.scope.mode||'custom',start:o.scope.start||w.scope.start,end:o.scope.end||''};
  w.rules.runMax=st.noConsecutive===false?0:1;w.rules.offMin=w.rules.runMax;w.rules.perDay=st.oneVisitPerDay===false?2:1;w.rules.mode=st.relaxMode==='strict'?'strict':'bend';w.rules.nearKm=st.nearKm||10;w.rules.distinct=st.distinctPerDay!==false;
  if(st.weights){const x=st.weights;w.weights.fair=x.fairness!=null?x.fairness:70;w.weights.pref=x.pref!=null?x.pref:45;w.weights.home=x.distance!=null?x.distance:35;w.weights.rotate=x.facility!=null?x.facility:60}
  if(st.seed)w.engine.seed=st.seed;
  return normalize(w);
}

const IDX='mauvine.v2.index',WSK='mauvine.v2.ws.',LEGACY='mauveineRota.v1';
const Store={
  quotaErr:false,
  index(){try{const o=JSON.parse(localStorage.getItem(IDX)||'null');if(o&&Array.isArray(o.list))return Object.assign({active:null,list:[],prefs:{}},o)}catch(e){}return {active:null,list:[],prefs:{}}},
  saveIndex(ix){try{localStorage.setItem(IDX,JSON.stringify(ix));return true}catch(e){return false}},
  load(id){try{const raw=localStorage.getItem(WSK+id);if(raw)return normalize(JSON.parse(raw))}catch(e){}return null},
  save(ws,ix){
    try{localStorage.setItem(WSK+ws.id,JSON.stringify(ws));this.quotaErr=false}
    catch(e){try{const lite=Object.assign({},ws,{snapshots:[]});localStorage.setItem(WSK+ws.id,JSON.stringify(lite))}catch(e2){this.quotaErr=true;return false}}
    const it=ix.list.find(x=>x.id===ws.id);
    if(it){it.name=ws.name;it.updated=ws.updated;it.template=ws.template}else ix.list.push({id:ws.id,name:ws.name,updated:ws.updated,template:ws.template});
    ix.active=ws.id;this.saveIndex(ix);return true;
  },
  remove(id,ix){try{localStorage.removeItem(WSK+id)}catch(e){}ix.list=ix.list.filter(x=>x.id!==id);if(ix.active===id)ix.active=ix.list[0]?ix.list[0].id:null;this.saveIndex(ix)},
  legacy(){try{const raw=localStorage.getItem(LEGACY);if(!raw)return null;const o=JSON.parse(raw);if(Array.isArray(o.facilities)&&Array.isArray(o.people))return o}catch(e){}return null},
  usage(){let n=0;try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.indexOf('mauvine')===0)n+=(localStorage.getItem(k)||'').length*2}}catch(e){}return n}
};

function rangeOf(ws){
  const sc=ws.scope;let start=validISO(sc.start)?sc.start:todayISO(),end;
  if(sc.mode==='week'){start=weekStartOf(start,ws.rules.weekStart);end=addISO(start,6)}
  else if(sc.mode==='month'){const d=pISO(start);start=fISO(new Date(d.getFullYear(),d.getMonth(),1));end=fISO(new Date(d.getFullYear(),d.getMonth()+1,0))}
  else{end=validISO(sc.end)&&sc.end>=start?sc.end:start;if(diffDays(start,end)>365)end=addISO(start,365)}
  return {start,end};
}
function daysIn(start,end){const out=[];for(let d=start;d<=end;d=addISO(d,1))out.push(d);return out}
function dayCfg(ws,iso){
  const b=ws.week[dowOf(iso)],o=ws.overrides[iso];
  const c={on:b.on,n:b.n,focus:b.focus||'auto',over:!!o};
  if(o){if(o.on!==undefined)c.on=o.on;if(o.n!==undefined)c.n=o.n;if(o.focus)c.focus=o.focus}
  if(!c.on)c.n=0;
  return c;
}
function plannable(ws){const pc=new Set(ws.categories.filter(c=>c.planned).map(c=>c.id));return ws.sites.filter(s=>s.active&&pc.has(s.cat))}
function goalSites(ws,g,list){
  list=list||plannable(ws);
  return list.filter(s=>whatMatch(s,g.what));
}
function goalPeople(ws,g){return ws.people.filter(p=>p.active&&(g.who.k==='all'||whoMatch(p,g.who)))}
const INJ_EACH_MAX=40;
function injPlaces(ws,g,list){return goalSites(ws,g,list).slice(0,INJ_EACH_MAX)}
function injBounds(ij){return ij.op==='min'?{lo:ij.n,hi:-1}:ij.op==='max'?{lo:0,hi:ij.n}:ij.op==='between'?{lo:ij.n,hi:ij.n2}:{lo:ij.n,hi:ij.n}}
const injPinned=g=>g.kind==='inject'&&g.who.k!=='all'&&(g.mode==='exact'||g.mode==='all');
function weeksIn(ws){const {start,end}=rangeOf(ws);return new Set(daysIn(start,end).map(d=>weekStartOf(d,ws.rules.weekStart))).size||1}
const simpleGoal=g=>g.on&&g.kind==='count'&&g.measure==='visits'&&g.who.k==='all'&&g.per!=='person';
function goalNeed(ws){
  const list=plannable(ws);const minE={};let allT=-1,allCap=Infinity;const tots=[];const nW=weeksIn(ws);
  ws.goals.forEach(g=>{if(!simpleGoal(g))return;const set=goalSites(ws,g,list);const mul=g.period==='week'?nW:1;const b=goalBounds(g);const lo=b.lo*mul,hi=b.hi<0?Infinity:b.hi*mul;
    if(g.per==='each'){if(lo>0)set.forEach(s=>minE[s.id]=Math.max(minE[s.id]||0,lo))}
    else if(g.what.k==='all'&&!g.what.more){if(lo>0)allT=Math.max(allT,lo);if(isFinite(hi))allCap=Math.min(allCap,hi)}
    else if(lo>0)tots.push({set,n:lo});
  });
  let need=0;for(const k in minE)need+=minE[k];
  tots.forEach(x=>{let inside=0;x.set.forEach(s=>inside+=minE[s.id]||0);need+=Math.max(0,x.n-inside)});
  need=Math.max(need,allT);if(isFinite(allCap))need=Math.min(need,allCap);
  return Math.max(0,Math.round(need));
}
function planTotal(ws,days){
  const md=ws.sizing.mode;
  if(md==='total')return Math.max(0,intOr(ws.sizing.total,0));
  if(md==='goals'){const g=goalNeed(ws);if(g>0)return g}
  return sum(days.map(d=>d.cfg.n));
}
function planDays(ws,keepZero){
  const {start,end}=rangeOf(ws);let out=[];
  for(const iso of daysIn(start,end)){const c=dayCfg(ws,iso);if(c.on&&c.n>0)out.push({iso,cfg:c,n:c.n,extra:[]})}
  if(ws.sizing.mode!=='rhythm'&&out.length){
    const T=planTotal(ws,out);
    const W=sum(out.map(d=>d.cfg.n));let acc=0,prev=0;
    out.forEach(d=>{acc+=d.cfg.n;const cur=Math.round(T*acc/W);d.n=cur-prev;prev=cur});
  }
  const work=out.slice();
  const at={};out.forEach(d=>at[d.iso]=d);
  const entry=iso=>{if(!at[iso]){at[iso]={iso,cfg:dayCfg(ws,iso),n:0,extra:[]};out.push(at[iso])}return at[iso]};
  let plist=null;
  const take=(days,k)=>{const pool=days.filter(d=>d.n>0);while(k>0&&pool.length){pool.sort((a,b)=>b.n-a.n||(a.iso<b.iso?-1:1));const d=pool[0];d.n--;k--;if(!d.n)pool.shift()}};
  (ws.goals||[]).forEach(g=>{
    if(!g.on||g.kind!=='inject')return;
    const ij=g.inject,each=ij.per==='each';
    let tgt=null;if(each){plist=plist||plannable(ws);tgt=injPlaces(ws,g,plist);if(!tgt.length)return}
    const mult=each?tgt.length:1;
    if(ij.mode==='dates'){
      const ds=Array.from(parseDates(ij.dates)).filter(iso=>iso>=start&&iso<=end).sort();
      ds.forEach(iso=>{const e=entry(iso);
        if(each)tgt.forEach(s=>{for(let i=0;i<ij.n;i++)e.extra.push({g:g.id,opt:0,i,site:s.id})});
        else for(let i=0;i<ij.n;i++)e.extra.push({g:g.id,opt:0,i});
        if(ij.add==='replace')e.n=Math.max(0,e.n-ij.n*mult);
      });
    }else{
      let cand;
      if(g.when.k==='dates')cand=Array.from(parseDates(g.when.v)).filter(iso=>iso>=start&&iso<=end).sort().map(entry);
      else cand=work.filter(d=>whenMatch(g.when,d.iso));
      cand=cand.slice(0,92);if(!cand.length)return;
      const b=injBounds(ij),hi=b.hi<0?ij.n+2:b.hi;const tot=hi*mult;if(!tot)return;
      const per=Math.min(tot,Math.max(each?2:Math.min(hi,4),Math.ceil(tot/cand.length)+1),12);
      cand.forEach(e=>{for(let i=0;i<per;i++)e.extra.push({g:g.id,opt:1,i})});
      if(ij.add==='replace')take(cand,b.lo*mult);
    }
  });
  out.sort((a,b)=>a.iso<b.iso?-1:a.iso>b.iso?1:0);
  return keepZero?out:out.filter(d=>d.n>0||d.extra.length);
}
function injectCount(ws){let n=0;(ws.goals||[]).forEach(g=>{if(!g.on||g.kind!=='inject')return;const m=g.inject.per==='each'?injPlaces(ws,g).length:1;if(g.inject.mode==='dates'){const {start,end}=rangeOf(ws);n+=Array.from(parseDates(g.inject.dates)).filter(iso=>iso>=start&&iso<=end).length*g.inject.n*m}else n+=g.inject.n*m});return n}
function fpOf(ws){
  return fnv(JSON.stringify([ws.roles.map(r=>r.id),ws.categories.map(c=>[c.id,c.staff,c.share,c.planned]),
    ws.sites.map(s=>[s.id,s.cat,s.km,s.loc,s.crit,s.tag,s.zone,s.weight,s.minV,s.maxV,s.days,s.blackout,s.active,s.gapMin,s.gapMax]),
    ws.people.map(p=>[p.id,p.roles,p.home,p.homeLoc,p.rank,p.rankBy,p.gender,p.pref,p.weight,p.days,p.off,p.maxLoad,p.maxWeek,p.runMax,p.offMin,p.avoid,p.pair,p.likes,p.bans,p.active]),
    ws.book||[],ws.routes||[],ws.goals,ws.sizing,ws.week,ws.overrides,ws.scope,ws.rules,ws.weights,ws.useW,ws.engine.seed,ws.engine.quality,ws.engine.runs,
    ws.recency||null,ws.histRev||0,(ws.history||[]).length]));
}
function fpWithLocks(ws){return fnv(fpOf(ws)+JSON.stringify(ws.locks))}

function compile(ws){
  const {start,end}=rangeOf(ws);
  const warn=[];
  const days=planDays(ws);
  const roles=ws.roles.slice();const R=roles.length;const rIx={};roles.forEach((r,i)=>rIx[r.id]=i);
  const siteActive=ws.sites.filter(s=>s.active);
  const cats=ws.categories.filter(c=>c.planned&&siteActive.some(s=>s.cat===c.id));const C=cats.length;const cIx={};cats.forEach((c,i)=>cIx[c.id]=i);
  const sites=siteActive.filter(s=>cIx[s.cat]!==undefined);const S=sites.length;const sIx={};sites.forEach((s,i)=>sIx[s.id]=i);
  const people=ws.people.filter(p=>p.active&&p.roles.some(r=>rIx[r]!==undefined));const N=people.length;const pIx={};people.forEach((p,i)=>pIx[p.id]=i);
  const D=days.length;
  const sCat=sites.map(s=>cIx[s.cat]);
  const need=new Array(C*R).fill(0);
  cats.forEach((c,ci)=>roles.forEach((r,ri)=>need[ci*R+ri]=Math.max(0,intOr(c.staff[r.id],0))));
  const seatsPerRole=roles.map((r,ri)=>{let m=0;for(let c=0;c<C;c++)m=Math.max(m,need[c*R+ri]);return m});
  const dayNumA=days.map(d=>dayNum(d.iso));
  const ws0=ws.rules.weekStart;
  const dayWeek=days.map(d=>dayNum(weekStartOf(d.iso,ws0)));
  const dayFocus=days.map(d=>{const f=d.cfg.focus;if(f==='near')return -2;if(f==='far')return -3;if(cIx[f]!==undefined)return cIx[f];return -1});
  const vDay=[],vLock=[],vSeat0=[],vSeatN=[],visits=[];
  const seatVisit=[],seatRole=[],seatIdx=[],seatLock=[],seats=[];
  const injG={};(ws.goals||[]).forEach(g=>{if(g.on&&g.kind==='inject')injG[g.id]=g});
  const vInj=[],vOptA=[],vInjS=[];
  days.forEach((d,di)=>{
    if(!C)return;
    const slots=[];for(let k=0;k<d.n;k++)slots.push({key:d.iso+'#'+k,k,g:null,opt:0});
    (d.extra||[]).forEach((x,j)=>slots.push({key:d.iso+'#x'+x.g+'#'+(x.site?x.site+'#':'')+x.i,k:d.n+j,g:x.g,opt:x.opt,site:x.site||''}));
    for(const sl of slots){
      const key=sl.key,k=sl.k,v=visits.length;
      visits.push({key,d:di,k,inj:sl.g,opt:sl.opt});vDay.push(di);vInj.push(sl.g);vOptA.push(sl.opt);vInjS.push(sl.site&&sIx[sl.site]!==undefined?sIx[sl.site]:-1);
      const ls=ws.locks.sites[key];vLock.push(ls&&sIx[ls]!==undefined?sIx[ls]:-2);
      vSeat0.push(seats.length);
      roles.forEach((r,ri)=>{for(let i=0;i<seatsPerRole[ri];i++){
        const sk=key+'#'+r.id+'#'+i;seats.push({key:sk,v,r:ri,i});
        seatVisit.push(v);seatRole.push(ri);seatIdx.push(i);
        const lp=ws.locks.seats[sk];
        seatLock.push(lp==='__open'?-1:(lp&&pIx[lp]!==undefined&&byId(people,lp).roles.includes(r.id)?pIx[lp]:-2));
      }});
      vSeatN.push(seats.length-vSeat0[v]);
      visits[v].z0=vSeat0[v];visits[v].zn=vSeatN[v];
    }
  });
  const V=visits.length,Z=seats.length;
  let Veff=V;{const cnt={};vInj.forEach((g,v)=>{if(vOptA[v]){Veff--;cnt[g]=(cnt[g]||0)+1}});for(const g in cnt){const x=injG[g];if(!x)continue;const b=injBounds(x.inject),mult=x.inject.per==='each'?injPlaces(ws,x,sites).length:1;Veff+=Math.min(cnt[g],(b.hi<0?b.lo+1:(b.lo+b.hi)/2)*mult)}}
  const sAvail=new Array(S*D).fill(0);
  sites.forEach((s,si)=>days.forEach((d,di)=>{sAvail[si*D+di]=s.days[dowOf(d.iso)]&&!s.blackout.includes(d.iso)?1:0}));
  const pAvail=new Array(N*D).fill(0);
  people.forEach((p,pi)=>days.forEach((d,di)=>{pAvail[pi*D+di]=p.days[dowOf(d.iso)]&&!p.off.includes(d.iso)?1:0}));
  const roleMembers=roles.map(r=>{const a=[];people.forEach((p,pi)=>{if(p.roles.includes(r.id))a.push(pi)});return a});

  const gMin=new Array(S).fill(0),gMax=new Array(S).fill(-1);
  const catFloor=new Array(C).fill(0),catCeil=new Array(C).fill(Infinity);
  const nWeeks0=new Set(dayWeek).size||1;
  const activeGoals=ws.goals.filter(g=>g.on);
  activeGoals.forEach(g=>{
    if(!simpleGoal(g)||g.when.k!=='all')return;
    const set=goalSites(ws,g,sites).map(s=>sIx[s.id]).filter(x=>x!==undefined);
    const mul=g.period==='week'?nWeeks0:1,b=goalBounds(g),lo=b.lo*mul,hi=b.hi<0?-1:b.hi*mul;
    if(g.per==='each'){set.forEach(si=>{if(lo>0)gMin[si]=Math.max(gMin[si],lo);if(hi>=0)gMax[si]=gMax[si]<0?hi:Math.min(gMax[si],hi)})}
    else if(g.what.k==='cat'&&!g.what.not&&!g.what.more&&Array.isArray(g.what.v)&&g.what.v.length===1&&cIx[g.what.v[0]]!==undefined){const ci=cIx[g.what.v[0]];if(lo>0)catFloor[ci]=Math.max(catFloor[ci],lo);if(hi>=0)catCeil[ci]=Math.min(catCeil[ci],hi)}
  });
  const goalsOn=activeGoals.some(g=>g.kind==='count');
  const shareSum=sum(cats.map(c=>c.share));
  const mixOn=shareSum>0&&C>1;
  const base=cats.map((c,ci)=>shareSum>0?c.share/shareSum:sites.filter(s=>s.cat===c.id).length/Math.max(1,S));
  let catTarget=cats.map((c,ci)=>Veff*base[ci]);
  if(goalsOn&&C){
    const floor=cats.map((c,ci)=>{let f=0;sites.forEach((s,si)=>{if(sCat[si]===ci)f+=gMin[si]});return Math.max(f,catFloor[ci])});
    const ceil=cats.map((c,ci)=>{const ms=[];sites.forEach((s,si)=>{if(sCat[si]===ci)ms.push(si)});let cap=catCeil[ci];if(ms.length&&ms.every(si=>gMax[si]>=0))cap=Math.min(cap,sum(ms.map(si=>gMax[si])));return Math.max(cap,floor[ci])});
    const rest=Math.max(0,Veff-sum(floor));
    catTarget=cats.map((c,ci)=>Math.min(ceil[ci],floor[ci]+rest*base[ci]));
    const left=Veff-sum(catTarget);
    if(left>.01){const open=cats.map((c,ci)=>ci).filter(ci=>catTarget[ci]<ceil[ci]-.01);const bs=sum(open.map(ci=>base[ci]))||1;open.forEach(ci=>catTarget[ci]=Math.min(ceil[ci],catTarget[ci]+left*(base[ci]||1/open.length)/bs))}
  }
  const demand=roles.map((r,ri)=>{let x=0;for(let c=0;c<C;c++)x+=catTarget[c]*need[c*R+ri];return x});
  const pTarget=new Array(N).fill(0);
  roles.forEach((r,ri)=>{
    const mem=roleMembers[ri];if(!mem.length)return;
    const wts=mem.map(pi=>people[pi].weight/people[pi].roles.filter(x=>rIx[x]!==undefined).length);
    const caps=mem.map(pi=>{let a=0;for(let d=0;d<D;d++)a+=pAvail[pi*D+d];let c=a*(ws.rules.perDay||10);const ml=people[pi].maxLoad;if(ml!==''&&ml!=null)c=Math.min(c,+ml);return c});
    const dem=demand[ri];
    const tot=l=>{let s=0;for(let i=0;i<mem.length;i++)s+=Math.min(caps[i],l*wts[i]);return s};
    let lo=0,hi=1;while(tot(hi)<dem&&hi<1e7)hi*=2;
    for(let it=0;it<60;it++){const m=(lo+hi)/2;if(tot(m)<dem)lo=m;else hi=m}
    mem.forEach((pi,i)=>pTarget[pi]+=Math.min(caps[i],hi*wts[i]));
  });
  const span=D?dayNumA[D-1]-dayNumA[0]+1:0;
  const pIdeal=pTarget.map(t=>t>=1.5?Math.min(7,span/t)*.8:0);
  /* ---- revisit timing: previous visits / earlier plans ---- */
  const rc=normRecency(ws.recency);const rcOn=rc.mode!=='off'&&S>0&&D>0;
  let rcMin=null,rcMax=null,rcFix=null,pLast=null,rcMul=null,rcTarget=null;
  const stN=D?dayNum(start):0,enN=D?dayNum(end):0;
  if(rcOn){
    const lb=rc.lookback>0?stN-rc.lookback:-1e9;
    rcMin=[];rcMax=[];rcTarget=[];sites.forEach(s=>{const w=rcWindow(ws,s,rc);rcMin.push(w?w.lo:0);rcMax.push(w?w.hi:0);rcTarget.push(w&&w.target!=null?w.target:-1)});
    rcFix=sites.map(()=>[]);
    const hist=ws.history||[];
    hist.forEach(h=>{const si=sIx[h.site];if(si===undefined)return;const dn=dayNum(h.date);if(dn<lb||dn>enN)return;if(dn>=stN&&!rc.inWindow)return;if(rcFix[si].indexOf(dn)<0)rcFix[si].push(dn)});
    rcFix.forEach(a=>a.sort((x,y)=>x-y));
    if(rc.personDays>0){pLast=new Array(N*S).fill(-1e9);hist.forEach(h=>{const si=sIx[h.site];if(si===undefined)return;const dn=dayNum(h.date);if(dn>=stN||dn<lb)return;h.people.forEach(pid=>{const pi=pIx[pid];if(pi===undefined)return;const j=pi*S+si;if(dn>pLast[j])pLast[j]=dn})})}
    rcMul=sites.map((s,si)=>{const f=rcFix[si].filter(x=>x<stN);const last=f.length?f[f.length-1]:null;
      if(last==null)return rc.fresh==='due'?1.3:1;
      if(rc.hard&&last+rcMin[si]>enN)return .05;
      if(last+rcMin[si]>enN)return .35;
      if(rcMax[si]>0&&last+rcMax[si]<=enN)return 1.6;
      return 1});
    if(!hist.length)warn.push({k:'rcnohist'});
    else{const blocked=rcMul.filter(x=>x<=.05).length;if(blocked)warn.push({k:'rcblocked',n:blocked})}
  }
  const sExp=new Array(S).fill(0);
  const sw=si=>sites[si].weight*(rcMul?rcMul[si]:1);
  cats.forEach((c,ci)=>{
    const ms=[];sites.forEach((s,si)=>{if(sCat[si]===ci)ms.push(si)});if(!ms.length)return;
    const b=sum(ms.map(si=>gMin[si]));const left=Math.max(0,catTarget[ci]-b);
    const free=ms.filter(si=>gMax[si]<0||gMax[si]>gMin[si]);const tw=sum(free.map(sw))||1;
    ms.forEach(si=>{let e=gMin[si]+(free.includes(si)?left*sw(si)/tw:0);if(gMax[si]>=0)e=Math.min(e,gMax[si]);sExp[si]=e});
  });
  const sMin=sites.map(s=>s.minV===''?0:+s.minV);
  const sMax=sites.map(s=>s.maxV===''?-1:+s.maxV);
  const zoneIx={};let zn=0;
  const sZone=sites.map(s=>{const z=((s.zone||'').trim().toLowerCase())||(s.loc?'@'+s.loc:'');if(!z)return -1;if(zoneIx[z]===undefined)zoneIx[z]=zn++;return zoneIx[z]});
  const rel=new Array(N*N).fill(0);
  people.forEach((p,pi)=>{p.avoid.forEach(q=>{const qi=pIx[q];if(qi!==undefined){rel[pi*N+qi]=1;rel[qi*N+pi]=1}});p.pair.forEach(q=>{const qi=pIx[q];if(qi!==undefined&&rel[pi*N+qi]!==1){rel[pi*N+qi]=2;rel[qi*N+pi]=2}})});
  const aff=new Array(N*S).fill(0);
  people.forEach((p,pi)=>{p.likes.forEach(s=>{if(sIx[s]!==undefined)aff[pi*S+sIx[s]]=1});p.bans.forEach(s=>{if(sIx[s]!==undefined)aff[pi*S+sIx[s]]=2})});
  const sCrit=sites.map(s=>+s.crit||0);
  const pRankC=new Array(N*Math.max(1,C)).fill(50);
  people.forEach((p,pi)=>cats.forEach((c,ci)=>{const v=p.rankBy&&p.rankBy[c.id]!=null?p.rankBy[c.id]:p.rank;pRankC[pi*C+ci]=+v}));
  const Dn=Math.max(10,...sites.map(s=>s.km),...people.map(p=>p.home));
  const w={};WEIGHT_KEYS.forEach(k=>w[k]=ws.useW[k]?ws.weights[k]/50:0);
  const q={fast:25000,balanced:90000,thorough:300000,max:900000}[ws.engine.quality]||90000;
  const iters=Math.round(q*clamp((Z+V)/120,.6,5));
  const gate={off:0,lead:1,all:2}[ws.rules.rankGate]||0;
  if(!D)warn.push({k:'nodays'});
  if(!C)warn.push({k:'nosites'});
  roles.forEach((r,ri)=>{if(demand[ri]>0&&!roleMembers[ri].length)warn.push({k:'norole',r:r.id})});
  const nWeeks=new Set(dayWeek).size||1;
  const pRun=people.map(p=>p.runMax===''?ws.rules.runMax:+p.runMax),pOff=people.map(p=>p.offMin===''?(p.runMax===''?ws.rules.offMin:Math.max(1,ws.rules.offMin)):+p.offMin);
  const capOf=pi=>{let a=0;for(let d=0;d<D;d++)a+=pAvail[pi*D+d];let c=a*(ws.rules.perDay||10);const p=people[pi];if(p.maxLoad!=='')c=Math.min(c,+p.maxLoad);if(p.maxWeek!=='')c=Math.min(c,+p.maxWeek*nWeeks);
    const rm=pRun[pi],om=pOff[pi];if(rm>0&&span>0)c=Math.min(c,Math.ceil(span*rm/(rm+Math.max(1,om)))*(ws.rules.perDay||1));return c};
  const wkIx={};const dayWk=dayWeek.map(w=>wkIx[w]!==undefined?wkIx[w]:(wkIx[w]=Object.keys(wkIx).length));const nWk=Object.keys(wkIx).length;
  const bk=compileBook(ws,people,sites,days,cats,roles);
  bk.warn.forEach(x=>warn.push(x));
  const dist=locDist(ws);
  const sDist=new Float64Array(S*S);
  for(let a=0;a<S;a++)for(let b=a+1;b<S;b++){const x=dist(sites[a].loc,+sites[a].km||0,sites[b].loc,+sites[b].km||0);sDist[a*S+b]=x;sDist[b*S+a]=x}
  const pSiteD=new Float64Array(N*S);
  people.forEach((p,pi)=>sites.forEach((s,si)=>{pSiteD[pi*S+si]=p.homeLoc?dist(p.homeLoc,+p.home||0,s.loc,+s.km||0):Math.abs((+p.home||0)-(+s.km||0))}));
  roles.forEach((r,ri)=>{if(!roleMembers[ri].length)return;let cap=0;roleMembers[ri].forEach(pi=>{cap+=capOf(pi)/people[pi].roles.filter(x=>rIx[x]!==undefined).length});cap=Math.floor(cap);if(demand[ri]>cap+.01)warn.push({k:'capacity',r:r.id,need:Math.round(demand[ri]),cap})});
  cats.forEach((c,ci)=>{const mins=sum(sites.filter(s=>s.cat===c.id).map(s=>s.minV===''?0:+s.minV));if(mins>catTarget[ci]+.5)warn.push({k:'minover',c:c.id,need:mins,have:Math.round(catTarget[ci])})});
  if(goalsOn&&ws.sizing.mode!=='goals'){const gn=goalNeed(ws);if(gn>V)warn.push({k:'goalshort',need:gn,have:V})}
  const GC=compileGoals(ws,{sites,people,days,cats,roles,sIx,pIx,dayWk,nWk,vInj,vInjS,vDay,vOptA,injG,capOf,warn,pAvail,need,seatsPerRole,R,C,cIx,plannableIds:new Set(plannable(ws).map(s=>s.id))});
  if(gate&&N){
    const bad=[];sites.forEach((s,si)=>{const cr=sCrit[si];if(!cr)return;const ci=sCat[si];let best=-1;for(let p=0;p<N;p++)best=Math.max(best,pRankC[p*C+ci]);if(best<cr-ws.rules.rankTol)bad.push(s.name)});
    if(bad.length)warn.push({k:'rankgap',n:bad.length,ex:bad.slice(0,3).join(', ')});
  }
  if(ws.rules.runMax===1&&ws.rules.offMin>0&&pRun.every(x=>x===1)){
    roles.forEach((r,ri)=>{const mem=roleMembers[ri];if(!mem.length)return;
      for(let i=0;i+1<D;i++){if(dayNumA[i+1]-dayNumA[i]>ws.rules.offMin)continue;
        const nA=days[i].n,nB=days[i+1].n;let minNeed=Infinity;for(let c=0;c<C;c++)if(catTarget[c]>0)minNeed=Math.min(minNeed,need[c*R+ri]);if(!isFinite(minNeed))minNeed=0;
        const needAB=minNeed*(nA+nB);let free=0;mem.forEach(pi=>{if(pAvail[pi*D+i]||pAvail[pi*D+i+1])free++});
        if(needAB>free+.01){warn.push({k:'tight',r:r.id,d1:days[i].iso,d2:days[i+1].iso,need:Math.ceil(needAB),free});break}}
    });
  }
  const P={D,V,S,N,R,C,Z,vDay,vLock,vSeat0,vSeatN,seatVisit,seatRole,seatIdx,seatLock,
    sCat,sKm:sites.map(s=>+s.km||0),sZone,sExp,sMin,sMax,sAvail,need,catTarget,mixOn,
    gMin,gMax,sCrit,pRankC,goals:GC.goals,vSet:GC.vSet,vsets:GC.vsets,vOpt:vOptA,vReq:GC.vReq,reqs:GC.reqs,vGrp:GC.vGrp,grps:GC.grps,
    pAvail,pHome:people.map(p=>+p.home||0),pPref:people.map(p=>p.pref==='near'?1:p.pref==='far'?2:0),pTarget,
    pMaxLoad:people.map(p=>p.maxLoad===''?-1:+p.maxLoad),pMaxWeek:people.map(p=>p.maxWeek===''?-1:+p.maxWeek),pIdeal,rel,aff,
    dayNum:dayNumA,dayWeek,dayFocus,roleMembers,w,pRun,pOff,sDist:Array.from(sDist),pSiteD:Array.from(pSiteD),
    bkS:bk.bkS,bkSH:bk.bkSH,bkSR:bk.bkSR,bkD:bk.bkD,bkDH:bk.bkDH,bkDR:bk.bkDR,bkP:bk.bkP,bkPH:bk.bkPH,bkPR:bk.bkPR,team:bk.team,cnt:bk.cnt,cntBy:bk.cntBy,dayWk,nWk,bookOn:bk.on,
    rules:{perDay:ws.rules.perDay,runMax:ws.rules.runMax,offMin:ws.rules.offMin,strict:ws.rules.mode==='strict',distinct:ws.rules.distinct,siteGap:ws.rules.siteGap,nearKm:ws.rules.nearKm,rankGate:gate,rankTol:ws.rules.rankTol},
    rcOn:rcOn?1:0,rcMin,rcMax,rcFix,rcTarget,pLast,rcHard:rc.hard?1:0,rcInPlan:rc.inPlan?1:0,rcOver:rc.overdue?1:0,rcFresh:rc.fresh==='due'?1:0,rcPD:rc.personDays,rcStart:stN,rcEnd:enN,
    Dn,seed:ws.engine.seed,iters,runs:ws.engine.runs};
  const map={start,end,days:days.map(d=>({iso:d.iso,n:d.n,focus:d.cfg.focus})),visits,seats:seats.map(s=>({key:s.key,v:s.v,r:s.r,i:s.i})),
    roles:roles.map(r=>r.id),cats:cats.map(c=>c.id),sites:sites.map(s=>s.id),people:people.map(p=>p.id),pTarget,catTarget,demand,sExp,gMin,gMax,book:bk.ids,weeks:(()=>{const o=[];days.forEach((d,i)=>{if(o[dayWk[i]]==null)o[dayWk[i]]=d.iso});return o})(),goalOf:GC.goals.map(q=>q.gid),goalInt:GC.goals.map(q=>q.vg>=0?1:0)};
  return {P,map,warn};
}

function compileGoals(ws,X){
  const {sites,people,days,sIx,pIx,dayWk,nWk,vInj,vOptA,injG,capOf,warn}=X;
  const S=sites.length,N=people.length,D=days.length,V=vInj.length;
  const out={goals:[],vSet:new Array(V).fill(-1),vsets:[],vReq:new Array(V).fill(-1),reqs:[],vGrp:new Array(V).fill(-1),grps:[]};
  if(!S||!D)return out;
  const PER={each:0,total:1,person:2};
  const mkWho=g=>{const all=g.who.k==='all';const pm=people.map(p=>all||whoMatch(p,g.who)?1:0);return {all,pm,n:pm.filter(Boolean).length}};
  (ws.goals||[]).forEach((g,gi)=>{
    if(!g.on)return;
    const b=goalBounds(g),wf=g.w/50;
    if(g.kind==='inject'){
      const ij=g.inject,each=ij.per==='each';
      const tgt=each?injPlaces(ws,g,sites).map(s=>sIx[s.id]).filter(x=>x!==undefined):null;
      const sm=each?sites.map((s,si)=>tgt.includes(si)?1:0):sites.map(s=>whatMatch(s,g.what)?1:0);
      const vs=out.vsets.length;out.vsets.push(sm);
      const one={};
      const who=mkWho(g);
      let rq=-1;
      if(!who.all){if(!who.n){warn.push({k:'goalnop',g:g.id});}else{
        const md=g.mode;const need=md==='together'?Math.min(g.k,who.n):(md==='all'||md==='exact')?who.n:md==='only'?1:1;
        rq=out.reqs.length;out.reqs.push({pm:who.pm,need,only:md==='only'||md==='exact'?1:0,hard:g.hard?1:0,wf,gid:g.id});
        if(md==='all'||md==='exact'){const vv=[];for(let v=0;v<V;v++)if(vInj[v]===g.id)vv.push(v);if(vv.length){const p0=people.filter((p,pi)=>who.pm[pi]);const busy=p0.filter((p,pi)=>{const ix=people.indexOf(p);return vv.some(v=>!X.pAvail[ix*D+X.vDay[v]])});if(busy.length)warn.push({k:'injbusy',g:g.id,n:busy.length})}}
      }}
      const grp=gi;let nv=0;
      for(let v=0;v<V;v++)if(vInj[v]===g.id){
        const fs=X.vInjS?X.vInjS[v]:-1;
        if(fs>=0){if(one[fs]==null){one[fs]=out.vsets.length;out.vsets.push(sites.map((s,si)=>si===fs?1:0))}out.vSet[v]=one[fs]}else out.vSet[v]=vs;
        out.vReq[v]=rq;out.vGrp[v]=grp;nv++}
      if(!sm.some(Boolean))warn.push({k:'goalnone',g:g.id});
      if(!nv)warn.push({k:'injout',g:g.id});
      if(ij.mode==='pick'&&nv){
        const ib=injBounds(ij);
        if(each)out.goals.push({gid:g.id,sm,dm:days.map(()=>1),per:0,nw:1,U:S,B:S,ex:sm.slice(),places:0,who:0,pm:who.pm,mode:0,k:1,lo:ib.lo,hi:ib.hi,hard:g.hard?1:0,wf:Math.max(wf,1),vg:grp});
        else out.goals.push({gid:g.id,sm,dm:days.map(()=>1),per:1,nw:1,U:1,B:1,ex:[1],places:0,who:0,pm:who.pm,mode:0,k:1,lo:ib.lo,hi:ib.hi,hard:g.hard?1:0,wf:Math.max(wf,1),vg:grp});
      }
      return;
    }
    const sm=sites.map(s=>whatMatch(s,g.what)?1:0);
    if(!sm.some(Boolean)){warn.push({k:'goalnone',g:g.id});return}
    const ds=g.when.k==='dates'?parseDates(g.when.v):null;
    const dm=days.map(d=>whenMatch(g.when,d.iso,ds)?1:0);
    if(!dm.some(Boolean)){warn.push({k:'goalnoday',g:g.id});return}
    const who=mkWho(g);
    if(!who.n){warn.push({k:'goalnop',g:g.id});return}
    const per=PER[g.per],nw=g.period==='week'?nWk:1;
    const U=per===0?S:per===1?1:N,B=U*nw,ex=new Array(B).fill(0);
    const wkOk=new Array(nw).fill(0);for(let d=0;d<D;d++)if(dm[d])wkOk[nw>1?dayWk[d]:0]=1;
    for(let u=0;u<U;u++){const okU=per===0?sm[u]:per===2?who.pm[u]:1;if(!okU)continue;for(let w=0;w<nw;w++)if(wkOk[w])ex[u*nw+w]=1}
    const k=g.mode==='together'?Math.max(1,Math.min(g.k,who.n)):1;
    out.goals.push({gid:g.id,sm,dm,per,nw,U,B,ex,places:g.measure==='places'?1:0,who:who.all?0:1,pm:who.pm,mode:g.mode==='together'?1:0,k,lo:b.lo,hi:b.hi,hard:g.hard?1:0,wf,vg:-1});
    if(per===2&&nw===1&&b.lo>0)people.forEach((p,pi)=>{if(who.pm[pi]&&capOf(pi)<b.lo)warn.push({k:'goalcap',g:g.id,p:p.id,need:b.lo,cap:capOf(pi)})});
    if(g.mode==='together'&&!who.all&&g.k>who.n)warn.push({k:'goalk',g:g.id,n:who.n,k:g.k});
    if(per===1&&g.measure==='places'&&b.lo>sm.filter(Boolean).length)warn.push({k:'goalplaces',g:g.id,need:b.lo,have:sm.filter(Boolean).length});
  });
  return out;
}
const SOFT_SITE=1.2,SOFT_WITH_AV=3,SOFT_WITH_PR=.8,SOFT_TEAM=2,SOFT_COUNT=2;
const OPN={min:0,max:1,exact:2,ifany:3};
function compileBook(ws,people,sites,days,cats,roles){
  const N=people.length,S=sites.length,D=days.length;
  const out={bkS:null,bkSH:null,bkSR:null,bkD:null,bkDH:null,bkDR:null,bkP:null,bkPH:null,bkPR:null,team:[],cnt:[],cntBy:people.map(()=>[]),ids:[],warn:[],on:false};
  const list=(ws.book||[]).filter(r=>r.on);
  if(!list.length||!N)return out;
  const bw=ws.useW&&ws.useW.book===false?0:((ws.weights&&ws.weights.book!=null?ws.weights.book:50)/50);
  const dows=days.map(d=>dowOf(d.iso));
  const mk=n=>new Array(n).fill(0),mkR=n=>new Array(n).fill(-1);
  list.forEach(r=>{
    const ri=out.ids.length;out.ids.push(r.id);
    const pm=people.map(p=>whoMatch(p,r.who));
    const nP=pm.filter(Boolean).length;
    const hard=isHard(r),soft=r.w*bw;
    if(!nP){out.warn.push({k:'rulenone',b:r.id});return}
    if(r.rel==='site'){
      const sm=sites.map(s=>whatMatch(s,r.what));
      if(!sm.some(Boolean)){out.warn.push({k:'rulenone',b:r.id});return}
      if(!out.bkS){out.bkS=mk(N*S);out.bkSH=mk(N*S);out.bkSR=mkR(N*S)}
      for(let p=0;p<N;p++){if(!pm[p])continue;for(let s=0;s<S;s++){
        const i=p*S+s,hit=sm[s];
        if(r.sense==='prefer'){if(hit&&soft)out.bkS[i]-=SOFT_SITE*soft}
        else if(r.sense==='avoid'){if(hit&&soft){out.bkS[i]+=SOFT_SITE*soft;if(out.bkSR[i]<0)out.bkSR[i]=ri}}
        else if((r.sense==='never'&&hit)||(r.sense==='only'&&!hit)){out.bkSH[i]++;out.bkSR[i]=ri}
      }}
      out.on=true;
    }else if(r.rel==='day'){
      let dm;if(r.what.k==='dates'){const ds=parseDates(r.what.v);dm=days.map(d=>ds.has(d.iso))}else dm=dows.map(w=>!!r.what.v[w]);
      if(!out.bkD){out.bkD=mk(N*D);out.bkDH=mk(N*D);out.bkDR=mkR(N*D)}
      for(let p=0;p<N;p++){if(!pm[p])continue;for(let d=0;d<D;d++){
        const i=p*D+d,hit=dm[d];
        if(r.sense==='prefer'){if(hit&&soft)out.bkD[i]-=SOFT_SITE*soft}
        else if(r.sense==='avoid'){if(hit&&soft){out.bkD[i]+=SOFT_SITE*soft;if(out.bkDR[i]<0)out.bkDR[i]=ri}}
        else if((r.sense==='never'&&hit)||(r.sense==='only'&&!hit)){out.bkDH[i]++;out.bkDR[i]=ri}
      }}
      out.on=true;
    }else if(r.rel==='with'){
      const qm=people.map(p=>whoMatch(p,r.what));
      if(!out.bkP){out.bkP=mk(N*N);out.bkPH=mk(N*N);out.bkPR=mkR(N*N)}
      const set=(a,b,fn)=>{fn(a*N+b);fn(b*N+a)};
      for(let a=0;a<N;a++){if(!pm[a])continue;for(let b=0;b<N;b++){
        if(a===b)continue;const hit=qm[b];
        if(r.sense==='prefer'){if(hit&&soft)set(a,b,i=>out.bkP[i]-=SOFT_WITH_PR*soft/2)}
        else if(r.sense==='avoid'){if(hit&&soft)set(a,b,i=>{out.bkP[i]+=SOFT_WITH_AV*soft/2;if(out.bkPR[i]<0)out.bkPR[i]=ri})}
        else if((r.sense==='never'&&hit)||(r.sense==='only'&&!hit))set(a,b,i=>{out.bkPH[i]=1;out.bkPR[i]=ri});
      }}
      out.on=true;
    }else if(r.rel==='team'){
      const sm=sites.map(s=>whatMatch(s,r.what));
      if(!sm.some(Boolean)){out.warn.push({k:'rulenone',b:r.id});return}
      out.team.push({ri,pm:pm.map(x=>x?1:0),sm:sm.map(x=>x?1:0),op:OPN[r.op]||0,n:r.n,hard:hard?1:0,w:SOFT_TEAM*soft});
      if(r.op!=='max'&&r.n>0){
        const seatsMax=sum(ws.categories.filter(c=>c.planned).map(c=>sum(Object.values(c.staff||{}))));
        if(r.n>Math.max(1,seatsMax))out.warn.push({k:'ruleteam',b:r.id,n:r.n,have:seatsMax});
      }
      out.on=true;
    }else if(r.rel==='count'){
      const sm=sites.map(s=>whatMatch(s,r.what));
      if(!sm.some(Boolean)&&r.op!=='max'){out.warn.push({k:'rulenone',b:r.id});return}
      const ci=out.cnt.length;
      out.cnt.push({ri,sm:sm.map(x=>x?1:0),op:OPN[r.op]||0,n:r.n,per:r.per==='week'?1:0,hard:hard?1:0,w:SOFT_COUNT*soft});
      pm.forEach((x,p)=>{if(x)out.cntBy[p].push(ci)});
      out.on=true;
    }
  });
  return out;
}

function csvParse(text){
  const rows=[];let row=[],f='',q=false;
  const t=String(text||'').replace(/^\uFEFF/,'');
  const first=t.split('\n')[0];
  const cnt=ch=>(first.match(new RegExp(ch,'g'))||[]).length;
  const delim=cnt('\t')>cnt(',')?'\t':cnt(';')>cnt(',')?';':',';
  for(let i=0;i<t.length;i++){
    const c=t[i];
    if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++}else q=false}else f+=c}
    else if(c==='"')q=true;
    else if(c===delim){row.push(f);f=''}
    else if(c==='\n'){row.push(f);rows.push(row);row=[];f=''}
    else if(c!=='\r')f+=c;
  }
  if(f!==''||row.length){row.push(f);rows.push(row)}
  return rows.filter(r=>r.some(x=>x.trim()!==''));
}
/* ======== Visit history (previous visits / earlier plans) ======== */
function rcWindow(ws,s,rc){
  rc=rc||normRecency(ws.recency);if(rc.mode==='off')return null;
  const c=(rc.cat||{})[s.cat]||{};
  const pick=(a,b,d)=>a!==''&&a!=null?+a:(b!==''&&b!=null?+b:d);
  let lo=pick(s.gapMin,c.min,rc.min),hi=pick(s.gapMax,c.max,rc.mode==='min'?0:rc.max);
  if(hi&&hi<lo)hi=lo;
  let target=null;const baseLo=lo,baseHi=hi;
  if(rc.mode==='random'){
    const b=hi||lo+Math.max(14,rc.jitter*2);
    const r=mulberry32((parseInt(fnv(String(s.id)+'#'+rc.salt),36)>>>0)||1)();
    target=Math.round(lo+r*(b-lo));lo=Math.max(0,target-rc.jitter);hi=Math.max(1,target+rc.jitter);
  }
  return {lo,hi,target,baseLo,baseHi};
}
const AR_DIG=s=>String(s).replace(/[\u0660-\u0669]/g,c=>String(c.charCodeAt(0)-0x0660)).replace(/[\u06F0-\u06F9]/g,c=>String(c.charCodeAt(0)-0x06F0));
function parseAnyDate(x){
  if(x==null||x==='')return '';
  if(x instanceof Date&&!isNaN(x))return fISO(x);
  if(typeof x==='number'&&isFinite(x)){if(x>20000&&x<80000){const d=new Date(Math.round((x-25569)*864e5));return fISO(new Date(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()))}return ''}
  let s=AR_DIG(x).trim();if(!s)return '';
  let m=s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if(m){const iso=m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');return validISO(iso)?iso:''}
  m=s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/);
  if(m){let d=+m[1],mo=+m[2],y=+m[3];if(y<100)y+=2000;if(mo>12&&d<=12){const q=d;d=mo;mo=q}const iso=y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0');return validISO(iso)?iso:''}
  if(/^\d{5}(\.\d+)?$/.test(s))return parseAnyDate(+s);
  const d=new Date(s);return isNaN(d)?'':fISO(d);
}
const H_DATE=['date','day','visit_date','visit date','visited','on','التاريخ','تاريخ','اليوم','تاريخ الزيارة'];
const H_SITE=['place','site','facility','name','store','client','location_name','المكان','المنشأة','المنشاة','الموقع','الجهة','المرفق','اسم المنشأة'];
const H_PEOPLE=['people','team','members','staff','persons','visitors','who','الفريق','الأعضاء','القائمون بالزيارة','الأفراد','المفتشون'];
const H_NOTE=['note','notes','comment','remarks','ملاحظات','ملاحظة'];
const hnorm=h=>String(h==null?'':h).replace(/^\uFEFF/,'').trim().toLowerCase().replace(/\s+/g,' ');
function historyAoa(list){
  if(!Array.isArray(list))return [];
  if(list.length&&Array.isArray(list[0]))return list;
  const rows=[['date','place','people','note']];
  list.forEach(o=>{if(!o||typeof o!=='object')return;const pl=o.people||o.team||o.members||[];rows.push([o.date||o.day||'',o.place||o.site||o.facility||o.name||'',Array.isArray(pl)?pl.join('|'):String(pl||''),o.note||''])});
  return rows;
}
function parseHistoryRows(ws,aoa){
  const out={recs:[],bad:0,noSite:0,noPerson:0,rows:0};
  if(!Array.isArray(aoa)||!aoa.length)return out;
  const hdr=aoa[0].map(hnorm);
  const terms=[].concat(Object.values((ws.terms&&ws.terms.en)||{}),Object.values((ws.terms&&ws.terms.ar)||{})).map(hnorm);
  const roleNames=(ws.roles||[]).map(r=>hnorm(r.name));
  const find=list=>hdr.findIndex(h=>list.includes(h));
  let di=find(H_DATE),si=find(H_SITE);
  if(si<0)si=hdr.findIndex(h=>terms.includes(h)&&!['visit','visits','زيارة','زيارات'].includes(h)&&!roleNames.includes(h));
  const ni=find(H_NOTE);
  const pc=[];hdr.forEach((h,i)=>{if(i===di||i===si||i===ni)return;if(H_PEOPLE.includes(h)||roleNames.includes(h)||/^(person|member|inspector|visitor|staff)\s*\d*$/.test(h)||/^(عضو|فرد|مفتش)\s*\d*$/.test(h))pc.push(i)});
  let body=aoa.slice(1);
  if(di<0&&si<0){di=0;si=1;pc.push(2);body=aoa}
  if(di<0)di=0;if(si<0)si=di===0?1:0;
  const sByName={};(ws.sites||[]).forEach(s=>{sByName[hnorm(s.name)]=s.id});
  const pByName={};(ws.people||[]).forEach(p=>{pByName[hnorm(p.name)]=p.id});
  body.forEach(r=>{
    if(!r||!r.some(x=>String(x==null?'':x).trim()!==''))return;out.rows++;
    const date=parseAnyDate(r[di]);const nm=String(r[si]==null?'':r[si]).trim();
    if(!date||!nm){out.bad++;return}
    const sid=sByName[hnorm(nm)]||'';if(!sid)out.noSite++;
    const ids=[],pn=[];
    pc.forEach(i=>String(r[i]==null?'':r[i]).split(/[|;،,·\/\n]+/).map(x=>x.replace(/^\(.*\)$/,'').trim()).filter(Boolean).forEach(x=>{const id=pByName[hnorm(x)];if(id){if(!ids.includes(id))ids.push(id)}else if(!pn.includes(x)){pn.push(x);out.noPerson++}}));
    out.recs.push({id:uid('h'),date,site:sid,sn:sid?'':nm,people:ids,pn,note:ni>=0?String(r[ni]==null?'':r[ni]).slice(0,200):'',src:'upload'});
  });
  return out;
}
function histKey(h){return h.date+'|'+(h.site||('#'+hnorm(h.sn)))}
function mergeHistory(old,recs){
  const list=(old||[]).map(h=>Object.assign({},h,{people:h.people.slice(),pn:(h.pn||[]).slice()}));
  const ix={};list.forEach((h,i)=>ix[histKey(h)]=i);let added=0,dup=0;
  recs.forEach(r=>{const k=histKey(r);if(ix[k]!=null){dup++;const h=list[ix[k]];r.people.forEach(p=>{if(!h.people.includes(p))h.people.push(p)});(r.pn||[]).forEach(p=>{if(!h.pn.includes(p))h.pn.push(p)});if(r.note&&!h.note)h.note=r.note;return}
    ix[k]=list.length;list.push(r);added++});
  list.sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:0);
  return {list,added,dup};
}
function relinkHistory(ws){
  const sBy={};ws.sites.forEach(s=>sBy[hnorm(s.name)]=s.id);const pBy={};ws.people.forEach(p=>pBy[hnorm(p.name)]=p.id);let n=0;
  (ws.history||[]).forEach(h=>{if(!h.site&&h.sn){const id=sBy[hnorm(h.sn)];if(id){h.site=id;h.sn='';n++}}
    if(h.pn&&h.pn.length){h.pn=h.pn.filter(x=>{const id=pBy[hnorm(x)];if(id){if(!h.people.includes(id))h.people.push(id);n++;return false}return true})}});
  return n;
}
function histFromPlan(ws){
  const pl=ws.plan;if(!pl||!pl.map||!pl.res)return [];
  const m=pl.map,r=pl.res,out=[];
  m.visits.forEach((v,vi)=>{const si=r.siteOf[vi];if(si<0||si==null)return;const sid=m.sites[si];const ppl=[];
    for(let z=v.z0;z<v.z0+v.zn;z++){if(!r.stats.active[z])continue;const p=r.seatP[z];if(p>=0&&!ppl.includes(m.people[p]))ppl.push(m.people[p])}
    out.push({id:uid('h'),date:m.days[v.d].iso,site:sid,sn:'',people:ppl,pn:[],note:'',src:'plan'})});
  return out;
}
/* per-site due board as of a date. Uses history (+ current plan when withPlan). */
function recencyBoard(ws,asOf,withPlan){
  const rc=normRecency(ws.recency);const aN=dayNum(asOf);
  const last={},cnt={};
  (ws.history||[]).forEach(h=>{if(!h.site||h.date>asOf)return;cnt[h.site]=(cnt[h.site]||0)+1;if(!last[h.site]||h.date>last[h.site])last[h.site]=h.date});
  if(withPlan){const hp=histFromPlan(ws);hp.forEach(h=>{if(h.date>asOf)return;if(!last[h.site]||h.date>last[h.site])last[h.site]=h.date})}
  return plannable(ws).map(s=>{
    const w=rcWindow(ws,s,rc);const l=last[s.id]||'';const ago=l?aN-dayNum(l):null;
    let st='never';
    if(l){if(!w)st='ok';else if(ago<w.lo)st='early';else if(w.hi&&ago>w.hi)st='late';else st='due'}
    return {s,last:l,ago,n:cnt[s.id]||0,w,st,from:l&&w?addISO(l,w.lo):'',by:l&&w&&w.hi?addISO(l,w.hi):''};
  });
}

const csvCell=v=>{const s=String(v==null?'':v);return /[",\n\r;]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
const csvRow=a=>a.map(csvCell).join(',');

G.MV={$,$$,esc,uid,clamp,sum,avg,num,intOr,byId,clone,fnv,gini,mulberry32,
  pISO,fISO,addISO,dowOf,dayNum,diffDays,todayISO,validISO,weekStartOf,daysIn,
  COLORS,LEVELS,WEIGHT_KEYS,defaultWeights,defaultUseW,defaultRules,defaultEngine,TERM_DEFAULT,
  TEMPLATES,TEMPLATE_ORDER,blankWS,mkRole,mkCat,mkLoc,mkSite,mkPerson,mkGoal,normalize,migrateLegacy,fromDataset,syncLoc,
  Store,rangeOf,dayCfg,planDays,planTotal,plannable,goalSites,goalNeed,fpOf,fpWithLocks,compile,csvParse,csvRow,
  SENSES,WHO_K,WHAT_K,RELS,TEAM_OPS,COUNT_OPS,FLIP,isHard,normRule,mkRule,whoMatch,whatMatch,resolveBook,resolveGoals,parseDates,overlayList,bookForExport,toDataset,mergeDataset,locDist,arr7,
  RC_MODES,defaultRecency,normRecency,rcWindow,parseAnyDate,parseHistoryRows,historyAoa,mergeHistory,relinkHistory,histFromPlan,recencyBoard,hnorm,
  normGoal,goalBounds,goalPeople,goalsForExport,injectCount,whenMatch,normWhen,MULTI_K,G_PER,G_OP,G_MODE,weeksIn};
})(window);
