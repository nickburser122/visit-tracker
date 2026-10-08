(function(){
const M=window.MV,E=window.MauvineEngine;
const out=[];const log=s=>{out.push(s);console.log(s)};let pass=0,fail=0;
const ok=(name,c,info)=>{if(c)pass++;else fail++;log((c?'PASS ':'FAIL ')+name+(info!=null?' — '+info:''))};
const counts=r=>{const c={};r.issues.forEach(x=>c[x.k]=(c[x.k]||0)+1);return JSON.stringify(c)};
function run(name,ws,iters){
  const C=M.compile(ws);if(iters)C.P.iters=iters;C.P.runs=1;
  const t0=performance.now();const r=E.solve(C.P);
  log('· '+name+': V='+C.P.V+' cost='+r.cost.toFixed(1)+' filled='+r.stats.filled+'/'+r.stats.seats+' goals='+JSON.stringify(r.stats.goalRes)+' issues='+counts(r)+' warn='+JSON.stringify(C.warn.map(w=>w.k))+' '+Math.round(performance.now()-t0)+'ms');
  return {C,r};
}
function month(ws,y,m){ws.scope={mode:'month',start:y+'-'+String(m).padStart(2,'0')+'-01',end:''};return ws}
function visitsOf(res,ws){
  const m=res.C.map,r=res.r;
  return m.visits.map((v,vi)=>{const si=r.siteOf[vi];const site=si>=0?ws.sites.find(s=>s.id===m.sites[si]):null;const ppl=[];
    for(let z=v.z0;z<v.z0+v.zn;z++){if(!r.stats.active[z])continue;const p=r.seatP[z];if(p>=0)ppl.push(m.people[p])}
    return {iso:m.days[v.d].iso,site,ppl,inj:v.inj,opt:v.opt}});
}
fetch('../data/complete_data.json').then(r=>r.json()).then(o=>{
  const base=()=>{const w=M.fromDataset(o,'g');month(w,2026,10);w.book=[];w.goals=[];w.recency=M.normRecency({mode:'off'});return w};
  const legacy=M.normGoal({per:'each',scope:'cat',ref:'c_basic',op:'min',n:2});
  ok('legacy goal converts',legacy.what.k==='cat'&&legacy.what.v[0]==='c_basic'&&legacy.n===2);

  let ws=base();const ab=ws.people.find(p=>p.name==='أباظة');const am=ws.people.find(p=>p.name==='أماني');
  ws.goals=[M.mkGoal({who:{k:'person',v:[ab.id]},what:{k:'cat',v:['c_contracted']},per:'total',op:'min',n:3})];
  let R=run('Abaza ≥3 contracted',ws);let V=visitsOf(R,ws);
  let n=V.filter(x=>x.site&&x.site.cat==='c_contracted'&&x.ppl.includes(ab.id)).length;ok('person goal ≥3',n>=3,n);

  ws=base();ws.goals=[M.mkGoal({who:{k:'person',v:[ab.id,am.id]},mode:'together',k:2,what:{k:'all',v:''},per:'total',op:'min',n:2})];
  R=run('Abaza+Amani together ≥2',ws);V=visitsOf(R,ws);
  n=V.filter(x=>x.ppl.includes(ab.id)&&x.ppl.includes(am.id)).length;ok('combination together ≥2',n>=2,n);

  ws=base();ws.goals=[M.mkGoal({who:{k:'person',v:[ab.id,am.id]},mode:'together',k:2,what:{k:'all',v:''},per:'total',op:'max',n:0,hard:true})];
  R=run('Abaza+Amani never together (must)',ws);V=visitsOf(R,ws);
  n=V.filter(x=>x.ppl.includes(ab.id)&&x.ppl.includes(am.id)).length;ok('combination never together',n===0,n);

  ws=base();const tags=Array.from(new Set(M.plannable(ws).map(s=>s.tag))).filter(Boolean);const two=tags.slice(4,6);
  ws.goals=[M.mkGoal({what:{k:'tag',v:two},per:'total',op:'exact',n:6})];
  R=run('types '+two.join('+')+' exactly 6',ws);V=visitsOf(R,ws);
  n=V.filter(x=>x.site&&two.includes(x.site.tag)).length;ok('multi-class line exact 6',n===6,n);

  ws=base();ws.goals=[M.mkGoal({what:{k:'cat',v:['c_contracted']},per:'total',period:'week',op:'between',n:1,n2:2})];
  R=run('contracted 1–2 per week',ws);V=visitsOf(R,ws);
  const wk={};V.forEach(x=>{if(!x.site||x.site.cat!=='c_contracted')return;const k=M.weekStartOf(x.iso,ws.rules.weekStart);wk[k]=(wk[k]||0)+1});
  const weeks=Array.from(new Set(R.C.map.days.map(d=>M.weekStartOf(d.iso,ws.rules.weekStart))));
  ok('per-week between',weeks.every(w=>(wk[w]||0)>=1&&(wk[w]||0)<=2),JSON.stringify(wk));

  ws=base();ws.goals=[M.mkGoal({who:{k:'role',v:['r_fin']},per:'person',op:'min',n:2,measure:'places',what:{k:'cat',v:['c_basic']}})];
  R=run('each financial ≥2 distinct basic places',ws);V=visitsOf(R,ws);
  const fin=ws.people.filter(p=>p.roles.includes('r_fin'));
  const dist=fin.map(p=>new Set(V.filter(x=>x.site&&x.site.cat==='c_basic'&&x.ppl.includes(p.id)).map(x=>x.site.id)).size);
  ok('per-person distinct places',dist.every(x=>x>=2),JSON.stringify(dist));

  ws=base();const target=M.plannable(ws).find(s=>s.cat==='c_contracted');const d1='2026-10-13',d2='2026-10-20';
  ws.goals=[M.mkGoal({kind:'inject',what:{k:'site',v:[target.id]},inject:{mode:'dates',dates:d1+', '+d2,n:1},who:{k:'person',v:[am.id]},mode:'any',hard:true})];
  R=run('inject '+target.name+' on 2 dates with Amani',ws);V=visitsOf(R,ws);
  const inj=V.filter(x=>x.inj);ok('inject fixed dates',inj.length===2&&inj.every(x=>x.site&&x.site.id===target.id)&&inj.map(x=>x.iso).sort().join()===[d1,d2].join(),inj.map(x=>x.iso+':'+(x.site&&x.site.name)).join(' '));
  ok('inject with person',inj.every(x=>x.ppl.includes(am.id)),inj.map(x=>x.ppl.length).join());

  ws=base();const near=M.plannable(ws).filter(s=>s.km<=20).map(s=>s.id);
  ws.goals=[M.mkGoal({kind:'inject',what:{k:'kmLe',v:'20'},when:{k:'dow',v:[false,false,true,false,false,false,false]},inject:{mode:'pick',n:2}})];
  R=run('inject 2 near visits on Tuesdays, solver picks',ws);V=visitsOf(R,ws);
  const used=V.filter(x=>x.inj&&x.site);ok('inject pick count',used.length===2,used.length);
  ok('inject pick tuesday + near',used.every(x=>M.dowOf(x.iso)===2&&x.site.km<=20),used.map(x=>x.iso+' '+x.site.km).join(' | '));
  ok('no empty-visit errors from unused optional slots',!R.r.issues.some(x=>x.k==='nosite'));

  ws=base();ws.goals=[M.mkGoal({what:{k:'all',v:''},per:'total',op:'min',n:4,when:{k:'dates',v:'2026-10-05..2026-10-08'},who:{k:'gender',v:['f']}})];
  R=run('≥4 visits with a woman in 5–8 Oct',ws);V=visitsOf(R,ws);
  const fem=new Set(ws.people.filter(p=>p.gender==='f').map(p=>p.id));
  n=V.filter(x=>x.iso>='2026-10-05'&&x.iso<='2026-10-08'&&x.ppl.some(p=>fem.has(p))).length;ok('when dates + who gender',n>=4,n);

  ws=base();ws.goals=[M.mkGoal({what:{k:'cat',v:['c_basic']},per:'each',op:'max',n:0})];
  R=run('basic each max 0 (excluded via goal)',ws);V=visitsOf(R,ws);
  n=V.filter(x=>x.site&&x.site.cat==='c_basic').length;ok('max 0 removes a class',n===0,n);

  ws=base();ws.goals=[M.mkGoal({what:{k:'cat',v:['c_contracted']},per:'each',op:'min',n:1})];ws.sizing.mode='goals';
  R=run('each contracted once (sized to goals)',ws);ok('each once coverage',R.r.stats.goalRes[0].met===R.r.stats.goalRes[0].n,R.r.stats.goalRes[0].met+'/'+R.r.stats.goalRes[0].n);

  ['field','retail','care'].forEach(k=>{const w=M.TEMPLATES[k]();if(k!=='care')month(w,2026,10);const p0=w.people[0];
    w.goals=[M.mkGoal({who:{k:'person',v:[p0.id]},per:'total',op:'min',n:3}),M.mkGoal({what:{k:'cat',v:[w.categories[0].id]},per:'total',period:'week',op:'min',n:2})];
    const RR=run(k+' template person+weekly',w);ok(k+' template goals met',RR.r.stats.goalRes.every(g=>g.met===g.n),JSON.stringify(RR.r.stats.goalRes))});

  const rt=M.fromDataset(JSON.parse(JSON.stringify(M.toDataset(Object.assign(base(),{goals:[M.mkGoal({who:{k:'person',v:[ab.id]},what:{k:'tag',v:two},per:'total',op:'min',n:2}),M.mkGoal({kind:'inject',what:{k:'site',v:[target.id]},inject:{mode:'dates',dates:d1}})]})))),'rt');
  ok('goals roundtrip',rt.goals.length===2&&rt.goals[0].who.v[0]===ab.id&&rt.goals[1].what.v[0]===target.id&&rt.goals[1].kind==='inject');
  const C1=M.compile(ws);const r1=E.solve(C1.P),r2=E.solve(C1.P);ok('deterministic',JSON.stringify(r1.siteOf)===JSON.stringify(r2.siteOf)&&JSON.stringify(r1.seatP)===JSON.stringify(r2.seatP));
  const ev=E.evaluate(C1.P,r1);ok('incremental cost == full cost',Math.abs(ev.cost-r1.cost)<1e-6*Math.max(1,Math.abs(r1.cost)),ev.cost.toFixed(3)+' vs '+r1.cost.toFixed(3));
  log('\n'+pass+' passed, '+fail+' failed');
  document.getElementById('out').textContent=out.join('\n');
}).catch(e=>{log('ERROR '+e.message+'\n'+e.stack);document.getElementById('out').textContent=out.join('\n')});
})();
