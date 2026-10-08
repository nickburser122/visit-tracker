(function(){
const M=window.MV,E=window.MauvineEngine;
const out=[];const log=s=>{out.push(s);console.log(s)};
const counts=r=>{const c={};r.issues.forEach(x=>c[x.k]=(c[x.k]||0)+1);return JSON.stringify(c)};
function run(name,ws){
  const C=M.compile(ws);C.P.iters=Math.min(C.P.iters,60000);C.P.runs=1;
  const t0=performance.now();const r=E.solve(C.P);
  log(name+': V='+C.P.V+' cost='+r.cost.toFixed(2)+' filled='+r.stats.filled+'/'+r.stats.seats+' issues='+counts(r)+' warn='+JSON.stringify(C.warn.map(w=>w.k))+' '+Math.round(performance.now()-t0)+'ms');
  return {C,r};
}
function month(ws,y,m){ws.scope={mode:'month',start:y+'-'+String(m).padStart(2,'0')+'-01',end:''};return ws}
fetch('../data/complete_data.json').then(r=>r.json()).then(o=>{
  const hw=M.fromDataset(o,'hist');month(hw,2026,10);hw.book=[];hw.goals=[];
  const pl=M.plannable(hw);const recent=pl.slice(0,40),old=pl.slice(40,80);
  const aoa=[['التاريخ','المكان','الفريق']].concat(recent.map((s,i)=>['2026-09-'+String(10+i%15).padStart(2,'0'),s.name,hw.people[0].name]))
    .concat(old.map((s,i)=>[String(1+i%27).padStart(2,'0')+'/06/2026',s.name,hw.people[1].name+'|'+hw.people[2].name+'|Unknown X']))
    .concat([['bad','x',''],['2026-05-01','No such place','']]);
  const pr=M.parseHistoryRows(hw,aoa);log('history parse (Arabic headers): rows='+pr.rows+' recs='+pr.recs.length+' bad='+pr.bad+' noSite='+pr.noSite+' noPerson='+pr.noPerson);
  hw.history=M.mergeHistory([],pr.recs).list;
  const dupe=M.mergeHistory(hw.history,pr.recs);log('history dedupe: added='+dupe.added+' dup='+dupe.dup+' (expect 0 / '+pr.recs.length+')');
  const rid=new Set(recent.map(s=>s.id)),oid=new Set(old.map(s=>s.id));
  const cntIn=(res,set)=>{let n=0;res.r.siteOf.forEach(si=>{if(si>=0&&set.has(res.C.map.sites[si]))n++});return n};
  const h0=run('history off',hw);
  hw.recency=M.normRecency({mode:'range',min:45,max:75,hard:true});
  const h1=run('range 45–75 (min is must)',hw);
  log('  recent(<45d) visits off='+cntIn(h0,rid)+' on='+cntIn(h1,rid)+' · overdue(>75d) visits off='+cntIn(h0,oid)+' on='+cntIn(h1,oid)+' · stats='+JSON.stringify(h1.r.stats.rc));
  log('recency honored: '+(cntIn(h1,rid)===0&&cntIn(h1,oid)>=cntIn(h0,oid)));
  log('  breakdown recency='+(h1.r.breakdown.recency||0).toFixed(1)+' recencyH='+(h1.r.breakdown.recencyH||0).toFixed(1));
  hw.recency=M.normRecency({mode:'random',min:30,max:90,jitter:5,salt:3});
  const w1=M.rcWindow(hw,pl[0],hw.recency),w2=M.rcWindow(hw,pl[0],hw.recency);const r2=Object.assign({},hw.recency,{salt:4});const w3=M.rcWindow(hw,pl[0],r2);
  log('random window stable: '+(w1.target===w2.target)+' target='+w1.target+' ['+w1.lo+'..'+w1.hi+'] reroll='+w3.target);
  const tg=pl.slice(0,60).map(s=>M.rcWindow(hw,s,hw.recency).target);log('random spread min='+Math.min(...tg)+' max='+Math.max(...tg));
  run('random 30–90',hw);
  hw.recency=M.normRecency({mode:'min',min:60,personDays:120});const h3=run('min 60 + same person 120',hw);
  hw.recency=M.normRecency({mode:'range',min:45,max:75,cat:{c_contracted:{min:20,max:30}}});
  const sc=pl.find(s=>s.cat==='c_contracted');const wc=M.rcWindow(hw,sc,hw.recency);log('per-category window: '+wc.lo+'–'+wc.hi+' (expect 20–30)');
  const s0=Object.assign({},pl[0],{gapMin:10,gapMax:12});const ws0=M.rcWindow(hw,s0,hw.recency);log('per-place override: '+ws0.lo+'–'+ws0.hi+' (expect 10–12)');
  hw.recency=M.normRecency({mode:'range',min:45,max:75});
  const b=M.recencyBoard(hw,'2026-10-01',false);const bc={};b.forEach(x=>bc[x.st]=(bc[x.st]||0)+1);log('due board: '+JSON.stringify(bc));
  log('date parse: '+['2026-08-14','14/08/2026','٢٠٢٦-٠٨-١٤','8/14/2026',46248].map(M.parseAnyDate).join(','));
  const rtH=M.fromDataset(JSON.parse(JSON.stringify(M.toDataset(hw))),'rtH');log('history roundtrip: '+rtH.history.length+'='+hw.history.length+' recency '+rtH.recency.mode+' '+rtH.recency.min+'-'+rtH.recency.max);
  const nz=M.normalize(JSON.parse(JSON.stringify(hw)));log('normalize keeps history: '+(nz.history.length===hw.history.length)+' unknown kept: '+nz.history.filter(h=>!h.site).length);
  log('ALL DONE');
  document.getElementById('out').textContent=out.join('\n');
}).catch(e=>{log('ERR '+e.message+' '+e.stack)});
})();
