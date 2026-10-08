(function(root){
'use strict';
const HARD=20000,BENT=300,STRICT=40000,NOSITE=6000,OPEN=1000,DUP=2500,MINP=60,GAPP=400;
const TERMS=['coverage','hard','rest','goals','goalsH','book','bookH','recency','recencyH','rank','distinct','fair','spacing','pref','home','route','likes','pairs','rotate','bounds','focus','cluster','mix'];
/* revisit timing constants: early base/slope, late slope, overdue miss, person repeat */
const RCB=20,RCE=80,RCL=25,RCO=120,RCP=30;
const PERMS=[[],[[0]],[[0,1],[1,0]]];
function perms(n){if(PERMS[n])return PERMS[n];const out=[];const rec=(a,rest)=>{if(!rest.length){out.push(a);return}rest.forEach((x,i)=>rec(a.concat([x]),rest.slice(0,i).concat(rest.slice(i+1))))};rec([],Array.from({length:n},(_,i)=>i));PERMS[n]=out;return out}
function tour(st,dd,d0){const n=st.length;if(!n)return {km:0,ord:[]};if(n===1)return {km:2*d0(st[0]),ord:[0]};
  if(n<=5){let best=1e18,bo=null;for(const o of perms(n)){let k=d0(st[o[0]])+d0(st[o[n-1]]);for(let i=1;i<n;i++)k+=dd(st[o[i-1]],st[o[i]]);if(k<best){best=k;bo=o}}return {km:best,ord:bo}}
  const left=st.map((_,i)=>i);let cur=-1,km=0;const ord=[];while(left.length){let bi=0,bk=1e18;left.forEach((j,i)=>{const k=cur<0?d0(st[j]):dd(st[cur],st[j]);if(k<bk){bk=k;bi=i}});km+=bk;cur=left.splice(bi,1)[0];ord.push(cur)}return {km:km+d0(st[cur]),ord}}
const GOALP=120,GOALX=250,RANKP=4;

function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296}}
function emptyBd(){const o={};for(const k of TERMS)o[k]=0;return o}

function Solver(P){
  const D=P.D,V=P.V,S=P.S,N=P.N,R=P.R,C=P.C,Z=P.Z;
  const vDay=P.vDay,vLock=P.vLock,vSeat0=P.vSeat0,vSeatN=P.vSeatN;
  const seatVisit=P.seatVisit,seatRole=P.seatRole,seatIdx=P.seatIdx,seatLock=P.seatLock;
  const sCat=P.sCat,sKm=P.sKm,sZone=P.sZone,sExp=P.sExp,sMin=P.sMin,sMax=P.sMax,sAvail=P.sAvail;
  const need=P.need,catTarget=P.catTarget;
  const pAvail=P.pAvail,pHome=P.pHome,pPref=P.pPref,pTarget=P.pTarget,pMaxLoad=P.pMaxLoad,pMaxWeek=P.pMaxWeek,pIdeal=P.pIdeal,rel=P.rel,aff=P.aff;
  const dayNum=P.dayNum,dayWeek=P.dayWeek,dayFocus=P.dayFocus;
  const W=P.w,rules=P.rules,Dn=P.Dn||10;
  const gMin=P.gMin||new Array(S).fill(0),gMax=P.gMax||new Array(S).fill(-1),sCrit=P.sCrit||new Array(S).fill(0),pRankC=P.pRankC||[];
  const GQ=P.goals||[],NQ=GQ.length;
  const vSet=P.vSet||new Array(V).fill(-1),vsets=P.vsets||[],vOpt=P.vOpt||new Array(V).fill(0),vReq=P.vReq||new Array(V).fill(-1),reqs=P.reqs||[],vGrp=P.vGrp||new Array(V).fill(-1);
  const goalsOn=NQ>0||gMin.some(x=>x>0)||gMax.some(x=>x>=0);
  const Wg=Math.max(W.goals||0,.25),rankOn=(W.rank||0)>0||rules.rankGate>0;
  const rankOf=(p,s)=>pRankC[p*C+sCat[s]];
  const restPen=rules.strict?STRICT:BENT;
  const bookPen=rules.strict?STRICT:HARD/4;
  const pRun=P.pRun||new Array(N).fill(rules.runMax),pOff=P.pOff||new Array(N).fill(rules.offMin);
  const sDist=P.sDist||null,pSiteD=P.pSiteD||null;
  const bkS=P.bkS,bkSH=P.bkSH,bkD=P.bkD,bkDH=P.bkDH,bkP=P.bkP,bkPH=P.bkPH,team=P.team||[];
  const cnt=P.cnt||[],cntBy=P.cntBy||[],dayWk=P.dayWk||new Array(D).fill(0),nWk=Math.max(1,P.nWk||1);
  const cwk=new Float64Array(nWk);
  const teamX=(tr,m)=>tr.op===0?tr.n-m:tr.op===1?m-tr.n:tr.op===2?Math.abs(m-tr.n):(m>0&&m<tr.n?tr.n-m:0);
  const cntX=(c,m)=>c.op===0?c.n-m:c.op===1?m-c.n:Math.abs(m-c.n);
  const rcOn=!!P.rcOn,rcMin=P.rcMin,rcMax=P.rcMax,rcFix=P.rcFix,pLast=P.pLast,rcPD=P.rcPD||0,rcHard=!!P.rcHard,rcInPlan=P.rcInPlan!==0,rcOver=P.rcOver!==0,rcFresh=!!P.rcFresh,rcEnd=P.rcEnd||0,rcStart=P.rcStart||0;
  const Wr=W.recency||0;
  let rcMaxFix=0;if(rcOn)for(let s=0;s<S;s++)if(rcFix[s].length>rcMaxFix)rcMaxFix=rcFix[s].length;
  const rcBufD=new Float64Array(rcMaxFix+V+2),rcBufF=new Uint8Array(rcMaxFix+V+2),rcBufV=new Int32Array(rcMaxFix+V+2);
  /* walks fixed history + plan visits of site s in time order; calls cb(kind,info) for each finding */
  function rcScan(s,cb){
    const fx=rcFix[s],arr=sUses[s],u=arr.length;let n=0;
    for(let i=0;i<fx.length;i++){rcBufD[n]=fx[i];rcBufF[n]=0;rcBufV[n]=-1;n++}
    for(let i=0;i<u;i++){rcBufD[n]=dayNum[vDay[arr[i]]];rcBufF[n]=1;rcBufV[n]=arr[i];n++}
    for(let i=1;i<n;i++){const d=rcBufD[i],f=rcBufF[i],v=rcBufV[i];let j=i-1;while(j>=0&&(rcBufD[j]>d||(rcBufD[j]===d&&rcBufF[j]>f))){rcBufD[j+1]=rcBufD[j];rcBufF[j+1]=rcBufF[j];rcBufV[j+1]=rcBufV[j];j--}rcBufD[j+1]=d;rcBufF[j+1]=f;rcBufV[j+1]=v}
    const lo=rcMin[s],hi=rcMax[s];let last=-1e9,any=false;
    for(let i=0;i<n;i++){
      const d=rcBufD[i],f=rcBufF[i];
      if(i>0&&(f||rcBufF[i-1])&&(rcInPlan||!(f&&rcBufF[i-1]))){
        const g=d-rcBufD[i-1];
        if(lo>0&&g<lo)cb(0,g,lo,rcBufV[i]>=0?rcBufV[i]:rcBufV[i-1]);
        else if(hi>0&&g>hi&&f)cb(1,g,hi,rcBufV[i]);
      }
      if(d<=rcEnd){last=d;any=true}
    }
    if(rcOver){
      if(any){if(hi>0&&last+hi<rcEnd)cb(2,rcEnd-last,hi,-1)}
      else if(rcFresh&&!u)cb(3,0,0,-1);
    }
  }
  let rcCost=0,rcBd=null;
  function rcCb(k,g,lim){
    let t;
    if(k===0){if(rcHard){t=bookPen*(1+(lim-g)/Math.max(1,lim));rcCost+=t;if(rcBd)rcBd.recencyH+=t;return}t=Wr*(RCB+RCE*(lim-g)/Math.max(1,lim))}
    else if(k===1)t=Wr*RCL*Math.min(3,(g-lim)/Math.max(1,lim));
    else if(k===2)t=Wr*RCO;
    else t=Wr*RCO*.6;
    rcCost+=t;if(rcBd)rcBd.recency+=t;
  }
  const teamBySite=new Array(S);for(let s=0;s<S;s++)teamBySite[s]=[];
  team.forEach((tr,ti)=>{for(let s=0;s<S;s++)if(tr.sm[s])teamBySite[s].push(ti)});
  let OPENW=OPEN;

  const cand=new Array(R*D);
  for(let r=0;r<R;r++)for(let d=0;d<D;d++){const a=[];for(const p of P.roleMembers[r])if(pAvail[p*D+d])a.push(p);cand[r*D+d]=a}
  const sitesByDay=new Array(D);
  for(let d=0;d<D;d++){const a=[];for(let s=0;s<S;s++)if(sAvail[s*D+d])a.push(s);sitesByDay[d]=a}
  const dayVisits=new Array(D);for(let d=0;d<D;d++)dayVisits[d]=[];
  for(let v=0;v<V;v++)dayVisits[vDay[v]].push(v);
  const seatsByRole=new Array(R);for(let r=0;r<R;r++)seatsByRole[r]=[];
  const freeSeats=[];
  for(let z=0;z<Z;z++)if(seatLock[z]===-2){freeSeats.push(z);seatsByRole[seatRole[z]].push(z)}
  const freeVisits=[];for(let v=0;v<V;v++)if(vLock[v]<0)freeVisits.push(v);
  const vSites=new Array(V);
  for(let v=0;v<V;v++){
    const base=sitesByDay[vDay[v]];
    if(vSet[v]<0){vSites[v]=base;continue}
    const sm=vsets[vSet[v]];let a=base.filter(s=>sm[s]);
    if(!a.length){a=[];for(let s=0;s<S;s++)if(sm[s])a.push(s)}
    vSites[v]=a;
  }
  const freeNorm=freeVisits.filter(v=>vSet[v]<0);
  /* ---- goal counters: bucket = unit × week; unit = place | all | person ---- */
  const gCnt=GQ.map(q=>new Float64Array(q.B)),gPc=GQ.map(q=>q.places?new Int32Array(q.B*S):null),gBc=GQ.map(q=>new Float64Array(q.B)),gSt=GQ.map(q=>new Int32Array(q.B));
  const vC=new Array(V).fill(null);let gtot=0,gEp=1;const gUndo=[],gDirty=[];const EMPTY=[];
  const goalPen=rules.strict?STRICT:HARD/4;
  const tbuf=new Int32Array(Math.max(8,R*4+8));
  function contrib(v){
    const s=siteOf[v];if(s<0||!NQ)return EMPTY;
    const d=vDay[v],z0=vSeat0[v],z1=z0+vSeatN[v];let k=0;
    for(let z=z0;z<z1;z++)if(seatAct[z]&&seatP[z]>=0)tbuf[k++]=seatP[z];
    let r=null;
    for(let qi=0;qi<NQ;qi++){
      const q=GQ[qi];if(!q.sm[s]||!q.dm[d])continue;if(q.vg>=0&&vGrp[v]!==q.vg)continue;
      const wk=q.nw>1?dayWk[d]:0;
      if(q.who||q.per===2){let m=0;for(let i=0;i<k;i++)if(q.pm[tbuf[i]])m++;if(m<q.k)continue}
      if(!r)r=[];
      if(q.per===2){for(let i=0;i<k;i++){const p=tbuf[i];if(q.pm[p])r.push(qi,p*q.nw+wk,s)}}
      else r.push(qi,(q.per===0?s:0)*q.nw+wk,s);
    }
    return r||EMPTY;
  }
  function gAdd(qi,b,s,sg){
    const q=GQ[qi];
    if(q.places){const i=b*S+s,o=gPc[qi][i];gPc[qi][i]=o+sg;if(sg>0&&o===0)gCnt[qi][b]++;else if(sg<0&&o===1)gCnt[qi][b]--}
    else gCnt[qi][b]+=sg;
    if(gSt[qi][b]!==gEp){gSt[qi][b]=gEp;gDirty.push(qi,b)}
  }
  function bCost(qi,b,bd){
    const q=GQ[qi];if(!q.ex[b])return 0;const x=gCnt[qi][b];
    const sh=x<q.lo?q.lo-x:0,ov=q.hi>=0&&x>q.hi?x-q.hi:0;if(!sh&&!ov)return 0;
    let t;if(q.hard){t=goalPen*(sh+ov);if(bd)bd.goalsH+=t}else{t=Wg*q.wf*(GOALP*sh+GOALX*ov);if(bd)bd.goals+=t}
    return t;
  }
  const sameC=(a,b)=>{if(a===b)return true;if(!a||!b||a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true};
  function gSync(){
    if(!NQ)return 0;gEp++;gDirty.length=0;let any=false;
    for(let i=0;i<dV.length;i++){
      const v=dV[i],o=vC[v]||EMPTY,n=contrib(v);if(sameC(o,n))continue;any=true;
      for(let j=0;j<o.length;j+=3)gAdd(o[j],o[j+1],o[j+2],-1);
      for(let j=0;j<n.length;j+=3)gAdd(n[j],n[j+1],n[j+2],1);
      gUndo.push(0,v,o);vC[v]=n;
    }
    if(!any)return 0;let dl=0;
    for(let i=0;i<gDirty.length;i+=2){const qi=gDirty[i],b=gDirty[i+1],o=gBc[qi][b],n=bCost(qi,b);if(n!==o){gUndo.push(1,qi*1048576+b,o);gBc[qi][b]=n;dl+=n-o}}
    gtot+=dl;if(dl)gUndo.push(2,0,dl);
    return dl;
  }
  function gRevert(){
    while(gUndo.length){const o=gUndo.pop(),a=gUndo.pop(),t=gUndo.pop();
      if(t===2)gtot-=o;
      else if(t===1){gBc[(a/1048576)|0][a%1048576]=o}
      else{const n=vC[a]||EMPTY;for(let j=0;j<n.length;j+=3)gAdd(n[j],n[j+1],n[j+2],-1);for(let j=0;j<o.length;j+=3)gAdd(o[j],o[j+1],o[j+2],1);vC[a]=o}}
  }
  function gInit(){
    gtot=0;for(let qi=0;qi<NQ;qi++){gCnt[qi].fill(0);gBc[qi].fill(0);if(gPc[qi])gPc[qi].fill(0)}
    gEp++;gDirty.length=0;
    for(let v=0;v<V;v++){const n=contrib(v);vC[v]=n;for(let j=0;j<n.length;j+=3)gAdd(n[j],n[j+1],n[j+2],1)}
    for(let qi=0;qi<NQ;qi++){const q=GQ[qi];for(let b=0;b<q.B;b++){const c=bCost(qi,b);gBc[qi][b]=c;gtot+=c}}
    gUndo.length=0;return gtot;
  }
  function goalFull(bd){
    if(!NQ)return 0;const cnt=GQ.map(q=>new Float64Array(q.B)),pcs=GQ.map(q=>q.places?new Int32Array(q.B*S):null);
    for(let v=0;v<V;v++){const n=contrib(v);for(let j=0;j<n.length;j+=3){const qi=n[j],b=n[j+1];if(pcs[qi]){const i=b*S+n[j+2];if(!pcs[qi][i]++)cnt[qi][b]++}else cnt[qi][b]++}}
    let c=0;const keep=gCnt;
    for(let qi=0;qi<NQ;qi++){const sv=keep[qi];gCnt[qi]=cnt[qi];for(let b=0;b<GQ[qi].B;b++)c+=bCost(qi,b,bd);gCnt[qi]=sv}
    return c;
  }

  const siteOf=new Int32Array(V).fill(-1),seatP=new Int32Array(Z).fill(-1),seatAct=new Uint8Array(Z);
  const pSeats=new Array(N),seatPos=new Int32Array(Z),sUses=new Array(S),usePos=new Int32Array(V);
  const pDay=new Int32Array(N*D),catCount=new Float64Array(C);
  const pc=new Float64Array(N),vc=new Float64Array(V),sc=new Float64Array(S),dc=new Float64Array(D);
  const npc=new Float64Array(N),nvc=new Float64Array(V),nsc=new Float64Array(S),ndc=new Float64Array(D);
  let mixc=0,nmix=0,total=0;
  const stP=new Int32Array(N),stV=new Int32Array(V),stS=new Int32Array(S),stD=new Int32Array(D);
  let ep=1;const dP=[],dV=[],dS=[],dD=[];let mixD=false;
  const sNeed=new Float64Array(S);for(let s=0;s<S;s++)sNeed[s]=Math.max(gMin[s],sExp[s]);
  const log=[];
  const buf=new Int32Array(Math.max(16,Z+V+4));
  let mxs=8;for(let v=0;v<V;v++)if(vSeatN[v]>mxs)mxs=vSeatN[v];
  const vbuf=new Int32Array(mxs);
  let rnd=mulberry32(1);

  function reset(){
    siteOf.fill(-1);seatP.fill(-1);seatAct.fill(0);pDay.fill(0);catCount.fill(0);
    for(let p=0;p<N;p++)pSeats[p]=[];
    for(let s=0;s<S;s++)sUses[s]=[];
    clear();
  }
  function markP(p){if(stP[p]!==ep){stP[p]=ep;dP.push(p)}}
  function markV(v){if(stV[v]!==ep){stV[v]=ep;dV.push(v)}}
  function markS(s){if(stS[s]!==ep){stS[s]=ep;dS.push(s)}}
  function markD(d){if(stD[d]!==ep){stD[d]=ep;dD.push(d)}}
  function clear(){ep++;dP.length=0;dV.length=0;dS.length=0;dD.length=0;mixD=false;log.length=0;gUndo.length=0}

  function rawSeat(z,p){
    const o=seatP[z];if(o===p)return;
    const v=seatVisit[z],d=vDay[v];
    if(o>=0){const arr=pSeats[o],pos=seatPos[z],last=arr.pop();if(last!==z){arr[pos]=last;seatPos[last]=pos}pDay[o*D+d]--;markP(o)}
    if(p>=0){seatPos[z]=pSeats[p].length;pSeats[p].push(z);pDay[p*D+d]++;markP(p)}
    seatP[z]=p;markV(v);
  }
  function rawSite(v,s){
    const o=siteOf[v];if(o===s)return;
    if(o>=0){const arr=sUses[o],pos=usePos[v],last=arr.pop();if(last!==v){arr[pos]=last;usePos[last]=pos}catCount[sCat[o]]--;markS(o)}
    if(s>=0){usePos[v]=sUses[s].length;sUses[s].push(v);catCount[sCat[s]]++;markS(s)}
    siteOf[v]=s;markV(v);markD(vDay[v]);mixD=true;
    const z0=vSeat0[v],z1=z0+vSeatN[v];
    for(let z=z0;z<z1;z++)if(seatP[z]>=0)markP(seatP[z]);
  }
  function rawAct(z,a){seatAct[z]=a;markV(seatVisit[z])}
  function opSeat(z,p){const o=seatP[z];if(o===p)return;log.push(0,z,o);rawSeat(z,p)}
  function opSite(v,s){
    const o=siteOf[v];if(o===s)return;
    log.push(1,v,o);rawSite(v,s);
    const c=s>=0?sCat[s]:-1,z0=vSeat0[v],z1=z0+vSeatN[v];
    for(let z=z0;z<z1;z++){
      const a=c>=0&&need[c*R+seatRole[z]]>seatIdx[z]?1:0;
      if(a===seatAct[z])continue;
      if(!a){opSeat(z,-1);log.push(2,z,1);rawAct(z,0)}
      else{log.push(2,z,0);rawAct(z,1);if(seatLock[z]>=0)opSeat(z,seatLock[z])}
    }
  }
  function undo(){
    if(gUndo.length)gRevert();
    while(log.length){const b=log.pop(),a=log.pop(),t=log.pop();if(t===0)rawSeat(a,b);else if(t===1)rawSite(a,b);else rawAct(a,b)}
  }

  function personCost(p,bd){
    const arr=pSeats[p],n=arr.length;let c=0,t;
    const dev=n-pTarget[p];t=1.5*W.fair*dev*dev;c+=t;if(bd)bd.fair+=t;
    if(pMaxLoad[p]>=0&&n>pMaxLoad[p]){t=HARD*(n-pMaxLoad[p]);c+=t;if(bd)bd.hard+=t}
    const cl=cntBy[p];
    if(cl&&cl.length)c+=countCost(p,arr,n,bd);
    if(!n)return c;
    const base=p*D,pref=pPref[p],home=pHome[p];
    for(let i=0;i<n;i++){
      const z=arr[i],v=seatVisit[z],d=vDay[v],s=siteOf[v];buf[i]=d;
      if(s<0)continue;
      const km=sKm[s];
      if(pref===1){t=2*W.pref*km/Dn;c+=t;if(bd)bd.pref+=t}
      else if(pref===2){t=2*W.pref*Math.max(0,1-km/Dn);c+=t;if(bd)bd.pref+=t}
      if(W.home){t=2*W.home*(pSiteD?pSiteD[p*S+s]:Math.abs(home-km))/Dn;c+=t;if(bd)bd.home+=t}
      if(bkS){const j=p*S+s;if(bkSH[j]){t=bookPen*bkSH[j];c+=t;if(bd)bd.bookH+=t}if(bkS[j]){c+=bkS[j];if(bd)bd.book+=bkS[j]}}
      if(pLast&&rcPD>0&&Wr){const g=dayNum[d]-pLast[p*S+s];if(g<rcPD){t=Wr*RCP*(rcPD-g)/rcPD;c+=t;if(bd)bd.recency+=t}}
      const a=aff[p*S+s];
      if(a===1){t=-1.5*W.likes;c+=t;if(bd)bd.likes+=t}
      else if(a===2){c+=HARD;if(bd)bd.hard+=HARD}
      if(!pAvail[base+d]){c+=HARD;if(bd)bd.hard+=HARD}
    }
    const days=buf.subarray(0,n);if(n>1)days.sort();
    const perDay=rules.perDay,rm=pRun[p],om=pOff[p],ideal=pIdeal[p],mw=pMaxWeek[p];
    let prev=-1,wk=-1,wc=0,run=0;
    for(let i=0;i<n;i++){
      const d=days[i];if(d===prev)continue;
      const cnt=pDay[base+d];
      if(perDay>0&&cnt>perDay){t=HARD*(cnt-perDay);c+=t;if(bd)bd.hard+=t}
      if(bkD){const j=base+d;if(bkDH[j]){t=bookPen*bkDH[j]*cnt;c+=t;if(bd)bd.bookH+=t}if(bkD[j]){t=bkD[j]*cnt;c+=t;if(bd)bd.book+=t}}
      if(prev>=0){
        const g=dayNum[d]-dayNum[prev];
        if(rm>0){
          if(g===1){run++;if(run>rm){c+=restPen;if(bd)bd.rest+=restPen}}
          else{run=1;if(g-1<om){c+=restPen;if(bd)bd.rest+=restPen}}
        }
        if(ideal>0&&g<ideal){const x=(ideal-g)/ideal;t=2*W.spacing*x*x;c+=t;if(bd)bd.spacing+=t}
      }else run=1;
      if(mw>=0){
        const w=dayWeek[d];
        if(w!==wk){if(wc>mw){t=HARD*(wc-mw);c+=t;if(bd)bd.hard+=t}wk=w;wc=0}
        wc+=cnt;
      }
      prev=d;
    }
    if(mw>=0&&wc>mw){t=HARD*(wc-mw);c+=t;if(bd)bd.hard+=t}
    if(W.route&&pSiteD&&n>1){
      let i=0;while(i<n){const d=days[i];let j=i;while(j<n&&days[j]===d)j++;
        if(j-i>1){const st=[];for(const z of arr){const v=seatVisit[z];if(vDay[v]===d&&siteOf[v]>=0)st.push(siteOf[v])}
          if(st.length>1){let sep=0;for(const s of st)sep+=2*pSiteD[p*S+s];const tr=tour(st,(a,b)=>sDist[a*S+b],s=>pSiteD[p*S+s]);t=2*W.route*Math.max(0,tr.km-sep/st.length)/Dn;c+=t;if(bd)bd.route+=t}}
        i=j}
    }
    return c;
  }
  function countCost(p,arr,n,bd){
    const cl=cntBy[p];let c=0,t;
    for(let q=0;q<cl.length;q++){
      const cr=cnt[cl[q]];
      if(cr.per){
        cwk.fill(0);for(let i=0;i<n;i++){const z=arr[i],v=seatVisit[z],s=siteOf[v];if(s>=0&&cr.sm[s])cwk[dayWk[vDay[v]]]++}
        for(let w=0;w<nWk;w++){const x=cntX(cr,cwk[w]);if(x>0){t=cr.hard?bookPen*x:cr.w*x;c+=t;if(bd){if(cr.hard)bd.bookH+=t;else bd.book+=t}}}
      }else{
        let m=0;for(let i=0;i<n;i++){const s=siteOf[seatVisit[arr[i]]];if(s>=0&&cr.sm[s])m++}
        const x=cntX(cr,m);if(x>0){t=cr.hard?bookPen*x:cr.w*x;c+=t;if(bd){if(cr.hard)bd.bookH+=t;else bd.book+=t}}
      }
    }
    return c;
  }
  function visitCost(v,bd){
    const s=siteOf[v];let c=0,t;
    if(s<0){if(vOpt[v])return 0;c+=NOSITE;if(bd)bd.coverage+=NOSITE;return c}
    if(!sAvail[s*D+vDay[v]]){c+=HARD;if(bd)bd.hard+=HARD}
    if(vSet[v]>=0&&!vsets[vSet[v]][s]){c+=HARD;if(bd)bd.goalsH+=HARD}
    const z0=vSeat0[v],z1=z0+vSeatN[v];let k=0;
    for(let z=z0;z<z1;z++){
      if(!seatAct[z])continue;
      const p=seatP[z];
      if(p<0){if(seatLock[z]!==-1&&!(vReq[v]>=0&&reqs[vReq[v]].only)){c+=OPENW;if(bd)bd.coverage+=OPENW}}
      else vbuf[k++]=p;
    }
    if(vReq[v]>=0){const rq=reqs[vReq[v]];let m=0;for(let i=0;i<k;i++)if(rq.pm[vbuf[i]])m++;
      const xo=rq.only?k-m:0;
      if(m<rq.need||xo>0){const x=Math.max(0,rq.need-m)+xo;if(rq.hard){t=goalPen*x;c+=t;if(bd)bd.goalsH+=t}else{t=GOALP*Wg*Math.max(rq.wf,.5)*x;c+=t;if(bd)bd.goals+=t}}}
    if(rankOn&&k>0){
      const cr=sCrit[s];let top=-1,lo=101;
      for(let i=0;i<k;i++){const rk=rankOf(vbuf[i],s);if(rk>top)top=rk;if(rk<lo)lo=rk;
        if(W.rank){const def=Math.max(0,cr-rk)/100,waste=Math.max(0,rk-cr-25)/100;t=RANKP*W.rank*(def*(1.5+def*4))+0.6*W.rank*waste;c+=t;if(bd)bd.rank+=t}}
      if(rules.rankGate&&cr>0){const tol=rules.rankTol,ref=rules.rankGate===2?lo:top;if(ref<cr-tol){t=restPen*(1+(cr-tol-ref)/50);c+=t;if(bd)bd.rank+=t}}
    }
    if(k>1){
      const av=150*Math.max(W.pairs,.2),pr=-3*W.pairs;
      for(let i=0;i<k;i++)for(let j=i+1;j<k;j++){
        const a=vbuf[i],b=vbuf[j];
        if(a===b){c+=HARD;if(bd)bd.hard+=HARD;continue}
        const r=rel[a*N+b];
        if(r===1){c+=av;if(bd)bd.pairs+=av}else if(r===2){c+=pr;if(bd)bd.pairs+=pr}
        if(bkP){const j=a*N+b;if(bkPH[j]){c+=bookPen;if(bd)bd.bookH+=bookPen}if(bkP[j]){c+=bkP[j];if(bd)bd.book+=bkP[j]}}
      }
    }
    const tl=teamBySite[s];
    if(tl.length&&k>0){
      for(let q=0;q<tl.length;q++){
        const tr=team[tl[q]];let m=0;for(let i=0;i<k;i++)if(tr.pm[vbuf[i]])m++;
        const x=teamX(tr,m);
        if(x>0){t=tr.hard?bookPen*x:tr.w*x;c+=t;if(bd){if(tr.hard)bd.bookH+=t;else bd.book+=t}}
      }
    }
    return c;
  }
  function siteCost(s,bd){
    const arr=sUses[s],u=arr.length;let c=0,t;
    const dev=u-sExp[s];t=1.2*W.rotate*dev*dev;c+=t;if(bd)bd.rotate+=t;
    if(sMin[s]>0&&u<sMin[s]){t=MINP*(sMin[s]-u);c+=t;if(bd)bd.bounds+=t}
    if(sMax[s]>=0&&u>sMax[s]){t=HARD*(u-sMax[s]);c+=t;if(bd)bd.hard+=t}
    const gap=rules.siteGap;
    if(gap>0&&u>1){
      for(let i=0;i<u;i++)buf[i]=dayNum[vDay[arr[i]]];
      const ds=buf.subarray(0,u);ds.sort();
      for(let i=1;i<u;i++){const g=ds[i]-ds[i-1];if(g>0&&g<gap){c+=GAPP;if(bd)bd.bounds+=GAPP}}
    }
    if(rcOn&&(u||rcFix[s].length)){rcCost=0;rcBd=bd||null;rcScan(s,rcCb);rcBd=null;c+=rcCost}
    return c;
  }
  function dayCost(d,bd){
    const vs=dayVisits[d],k=vs.length;if(!k)return 0;
    let c=0,t;const f=dayFocus[d],nk=rules.nearKm;
    let kmin=1e9,kmax=-1e9,cnt=0,zmask=0,zc=0;const zs=[];
    for(let i=0;i<k;i++){
      const s=siteOf[vs[i]];if(s<0)continue;cnt++;
      const km=sKm[s];if(km<kmin)kmin=km;if(km>kmax)kmax=km;
      const zn=sZone[s];if(zn>=0&&zs.indexOf(zn)<0)zs.push(zn);
      if(rules.distinct)for(let j=0;j<i;j++)if(siteOf[vs[j]]===s){c+=DUP;if(bd)bd.distinct+=DUP;break}
      if(f===-2){if(km>nk){t=4*W.focus*(km-nk)/Dn;c+=t;if(bd)bd.focus+=t}}
      else if(f===-3){if(km<nk){t=4*W.focus*(nk-km)/Dn;c+=t;if(bd)bd.focus+=t}}
      else if(f>=0&&sCat[s]!==f){t=6*W.focus;c+=t;if(bd)bd.focus+=t}
    }
    if(cnt>1&&W.route&&sDist){const st=[];for(let i=0;i<k;i++){const s=siteOf[vs[i]];if(s>=0&&st.indexOf(s)<0)st.push(s)}if(st.length>1){const tr=tour(st,(a,b)=>sDist[a*S+b],s=>sKm[s]);t=W.route*Math.max(0,tr.km-2*kmax)/Dn;c+=t;if(bd)bd.route+=t}}
    if(cnt>1&&W.cluster){
      const m=f===-2?2:1;let span=kmax-kmin;
      if(sDist){span=0;for(let i=0;i<k;i++){const a=siteOf[vs[i]];if(a<0)continue;for(let j=i+1;j<k;j++){const b=siteOf[vs[j]];if(b<0)continue;const x=sDist[a*S+b];if(x>span)span=x}}}
      t=m*(3*W.cluster*span/Dn+2*W.cluster*Math.max(0,zs.length-1));c+=t;if(bd)bd.cluster+=t;
    }
    return c;
  }
  function mixCost(bd){
    if(!P.mixOn||!W.mix)return 0;let c=0;
    for(let i=0;i<C;i++){const x=catCount[i]-catTarget[i];c+=W.mix*x*x}
    if(bd)bd.mix+=c;return c;
  }
  function fullCost(){
    total=0;
    for(let p=0;p<N;p++){pc[p]=personCost(p);total+=pc[p]}
    for(let v=0;v<V;v++){vc[v]=visitCost(v);total+=vc[v]}
    for(let s=0;s<S;s++){sc[s]=siteCost(s);total+=sc[s]}
    for(let d=0;d<D;d++){dc[d]=dayCost(d);total+=dc[d]}
    mixc=mixCost();total+=mixc;
    total+=gInit();
    return total;
  }
  function breakdown(){
    const bd=emptyBd();
    for(let p=0;p<N;p++)personCost(p,bd);
    for(let v=0;v<V;v++)visitCost(v,bd);
    for(let s=0;s<S;s++)siteCost(s,bd);
    for(let d=0;d<D;d++)dayCost(d,bd);
    mixCost(bd);goalFull(bd);return bd;
  }
  function evalDelta(){
    let dl=0;
    for(let i=0;i<dP.length;i++){const p=dP[i],x=personCost(p);npc[p]=x;dl+=x-pc[p]}
    for(let i=0;i<dV.length;i++){const v=dV[i],x=visitCost(v);nvc[v]=x;dl+=x-vc[v]}
    for(let i=0;i<dS.length;i++){const s=dS[i],x=siteCost(s);nsc[s]=x;dl+=x-sc[s]}
    for(let i=0;i<dD.length;i++){const d=dD[i],x=dayCost(d);ndc[d]=x;dl+=x-dc[d]}
    if(mixD){nmix=mixCost();dl+=nmix-mixc}
    dl+=gSync();
    return dl;
  }
  function commit(dl){
    for(let i=0;i<dP.length;i++)pc[dP[i]]=npc[dP[i]];
    for(let i=0;i<dV.length;i++)vc[dV[i]]=nvc[dV[i]];
    for(let i=0;i<dS.length;i++)sc[dS[i]]=nsc[dS[i]];
    for(let i=0;i<dD.length;i++)dc[dD[i]]=ndc[dD[i]];
    if(mixD)mixc=nmix;
    gUndo.length=0;
    total+=dl;
  }
  function probe(fn){fn();if(!log.length){clear();return 0}const dl=evalDelta();undo();clear();return dl}
  function apply(fn){fn();if(!log.length){clear();return 0}const dl=evalDelta();commit(dl);clear();return dl}
  function attempt(fn,T){
    fn();if(!log.length){clear();return false}
    const dl=evalDelta();
    if(dl<=0||(T>0&&dl<T*30&&rnd()<Math.exp(-dl/T))){commit(dl);clear();return true}
    undo();clear();return false;
  }
  function inVisit(v,q){const z0=vSeat0[v],z1=z0+vSeatN[v];for(let z=z0;z<z1;z++)if(seatP[z]===q)return true;return false}
  function fillNew(v){
    const d=vDay[v],z0=vSeat0[v],z1=z0+vSeatN[v];
    for(let z=z0;z<z1;z++){
      if(!seatAct[z]||seatP[z]>=0||seatLock[z]!==-2)continue;
      const cs=cand[seatRole[z]*D+d];if(!cs.length)continue;
      let pick=-1;
      for(let k=0;k<6;k++){const q=cs[(rnd()*cs.length)|0];if(inVisit(v,q))continue;pick=q;if(!pDay[q*D+d])break}
      if(pick>=0)opSeat(z,pick);
    }
  }
  function loadState(sa,za){
    reset();
    for(let v=0;v<V;v++)if(sa[v]>=0)rawSite(v,sa[v]);
    for(let z=0;z<Z;z++){
      const s=siteOf[seatVisit[z]],c=s>=0?sCat[s]:-1;
      const a=c>=0&&need[c*R+seatRole[z]]>seatIdx[z]?1:0;
      seatAct[z]=a;
      if(a){const p=za[z];if(p>=0)rawSeat(z,p)}
    }
    clear();fullCost();
  }

  let openHint=true;
  function hasOpen(){for(let i=0;i<freeSeats.length;i++){const z=freeSeats[i];if(seatAct[z]&&seatP[z]<0)return true}return false}
  function pickSeat(){
    if(openHint&&rnd()<.3){
      const n=freeSeats.length,st=(rnd()*n)|0;
      for(let i=0;i<n;i++){const z=freeSeats[(st+i)%n];if(seatAct[z]&&seatP[z]<0)return z}
    }
    return freeSeats[(rnd()*freeSeats.length)|0];
  }
  function mvReassign(){
    if(!freeSeats.length)return;
    const z=pickSeat();if(!seatAct[z])return;
    const v=seatVisit[z],d=vDay[v],cs=cand[seatRole[z]*D+d];if(!cs.length)return;
    let q;
    if(rnd()<.07)q=-1;
    else{
      q=cs[(rnd()*cs.length)|0];
      if(rnd()<.5&&pDay[q*D+d]){const q2=cs[(rnd()*cs.length)|0];if(!pDay[q2*D+d])q=q2}
    }
    if(q===seatP[z])return;
    if(q>=0&&inVisit(v,q))return;
    opSeat(z,q);
  }
  function mvSwap(){
    if(!freeSeats.length)return;
    const za=freeSeats[(rnd()*freeSeats.length)|0];if(!seatAct[za])return;
    const list=seatsByRole[seatRole[za]];const zb=list[(rnd()*list.length)|0];
    if(zb===za||!seatAct[zb])return;
    const va=seatVisit[za],vb=seatVisit[zb];if(va===vb)return;
    const pa=seatP[za],pb=seatP[zb];if(pa===pb)return;
    const da=vDay[va],db=vDay[vb];
    if(pb>=0&&(!pAvail[pb*D+da]||inVisit(va,pb)))return;
    if(pa>=0&&(!pAvail[pa*D+db]||inVisit(vb,pa)))return;
    opSeat(za,pb);opSeat(zb,pa);
  }
  function mvRelocate(){
    if(!freeVisits.length)return;
    const v=freeVisits[(rnd()*freeVisits.length)|0],list=vSites[v];
    if(!list.length)return;
    let s=list[(rnd()*list.length)|0];
    if(vOpt[v]&&rnd()<.3)s=-1;
    else if(goalsOn&&rnd()<.45){for(let k=0;k<8;k++){const q=list[(rnd()*list.length)|0];if(sUses[q].length<sNeed[q]-.5){s=q;break}}}
    if(s===siteOf[v])return;
    opSite(v,s);if(s>=0)fillNew(v);
  }
  const pRole0=new Uint8Array(N*R);for(let r=0;r<R;r++)for(const p of P.roleMembers[r])pRole0[p*R+r]=1;
  function seatFor(p,v){const z0=vSeat0[v],z1=z0+vSeatN[v];let best=-1;for(let z=z0;z<z1;z++){if(!seatAct[z]||seatLock[z]!==-2||!pRole0[p*R+seatRole[z]])continue;if(seatP[z]<0)return z;if(best<0||rnd()<.5)best=z}return best}
  function mvGoal(){
    if(!NQ)return;
    const qi=(rnd()*NQ)|0,q=GQ[qi],cn=gCnt[qi];
    let b=-1;const st=(rnd()*q.B)|0;
    for(let i=0;i<q.B;i++){const bb=(st+i)%q.B;if(!q.ex[bb])continue;const x=cn[bb];if(x<q.lo||(q.hi>=0&&x>q.hi)){b=bb;break}}
    if(b<0)return;
    const u=(b/q.nw)|0,wk=b%q.nw,short=cn[b]<q.lo;
    const dayOk=d=>q.dm[d]&&(q.nw<2||dayWk[d]===wk);
    const siteOk=(s,v)=>q.sm[s]&&(q.per!==0||s===u)&&(q.vg<0||vGrp[v]===q.vg)&&(!q.places||!short||!gPc[qi][b*S+s]);
    if(short){
      const needP=q.per===2||q.who;
      if(needP&&rnd()<.65){
        for(let t=0;t<12;t++){
          const v=(rnd()*V)|0,s=siteOf[v];if(s<0||!dayOk(vDay[v])||!siteOk(s,v))continue;
          let p=q.per===2?u:-1;
          if(p<0){const z0=vSeat0[v];let tries=0;while(tries++<8){const z=z0+((rnd()*vSeatN[v])|0);if(!seatAct[z])continue;const rr=seatRole[z],mem=P.roleMembers[rr];const c=mem[(rnd()*mem.length)|0];if(c!=null&&q.pm[c]&&!inVisit(v,c)){p=c;break}}}
          if(p<0||inVisit(v,p)||!pAvail[p*D+vDay[v]])continue;
          const z=seatFor(p,v);if(z<0)continue;opSeat(z,p);return;
        }
      }
      const spare=v=>{const s0=siteOf[v];if(s0<0||!q.sm[s0])return true;if(q.per===2)return true;const bb=(q.per===0?s0:0)*q.nw+(q.nw>1?dayWk[vDay[v]]:0);if(q.places)return gPc[qi][bb*S+s0]>1;return q.per===0?gCnt[qi][bb]>q.lo:false};
      for(let t=0;t<24;t++){
        const v=freeVisits[(rnd()*freeVisits.length)|0];if(v==null)return;if(!dayOk(vDay[v]))continue;
        if(t<16&&!spare(v))continue;
        const list=vSites[v];if(!list.length)continue;
        let s=-1;if(q.per===0){if(list.indexOf(u)>=0||vSet[v]<0&&sAvail[u*D+vDay[v]])s=u}else{for(let k=0;k<6;k++){const c=list[(rnd()*list.length)|0];if(siteOk(c,v)){s=c;break}}}
        if(s<0||s===siteOf[v]||!siteOk(s,v))continue;
        opSite(v,s);fillNew(v);
        if(q.per===2&&!inVisit(v,u)&&pAvail[u*D+vDay[v]]){const z=seatFor(u,v);if(z>=0)opSeat(z,u)}
        return;
      }
    }else{
      for(let t=0;t<14;t++){
        const v=freeVisits[(rnd()*freeVisits.length)|0];if(v==null)return;const s=siteOf[v];if(s<0||!dayOk(vDay[v])||!siteOk(s,v))continue;
        if(q.per===2){const z0=vSeat0[v],z1=z0+vSeatN[v];for(let z=z0;z<z1;z++)if(seatP[z]===u&&seatLock[z]===-2){const cs=cand[seatRole[z]*D+vDay[v]];const c=cs[(rnd()*cs.length)|0];if(c!=null&&c!==u&&!inVisit(v,c)){opSeat(z,c);return}}continue}
        if(vOpt[v]&&rnd()<.5){opSite(v,-1);return}
        const list=vSites[v];const c=list[(rnd()*list.length)|0];if(c==null||c===s||q.sm[c])continue;opSite(v,c);fillNew(v);return;
      }
    }
  }
  function mvSiteSwap(){
    if(freeNorm.length<2)return;
    const v1=freeNorm[(rnd()*freeNorm.length)|0],v2=freeNorm[(rnd()*freeNorm.length)|0];
    const d1=vDay[v1],d2=vDay[v2];if(d1===d2)return;
    const s1=siteOf[v1],s2=siteOf[v2];if(s1<0||s2<0||s1===s2)return;
    if(!sAvail[s2*D+d1]||!sAvail[s1*D+d2])return;
    opSite(v1,s2);opSite(v2,s1);fillNew(v1);fillNew(v2);
  }

  const pRole=new Uint8Array(N*R);for(let r=0;r<R;r++)for(const p of P.roleMembers[r])pRole[p*R+r]=1;
  function warmLoad(w){
    const sa=new Int32Array(V).fill(-1),za=new Int32Array(Z).fill(-1);
    for(let v=0;v<V;v++){const s=vLock[v]>=0?vLock[v]:w.siteOf[v];sa[v]=s>=0&&s<S&&sAvail[s*D+vDay[v]]?s:-1;if(vLock[v]>=0)sa[v]=vLock[v]}
    for(let v=0;v<V;v++){
      const z0=vSeat0[v],z1=z0+vSeatN[v],seen=[];
      for(let z=z0;z<z1;z++){if(seatLock[z]>=0){za[z]=seatLock[z];seen.push(seatLock[z])}}
      for(let z=z0;z<z1;z++){
        if(seatLock[z]!==-2)continue;
        const p=w.seatP[z];
        if(p>=0&&p<N&&pRole[p*R+seatRole[z]]&&pAvail[p*D+vDay[v]]&&seen.indexOf(p)<0){za[z]=p;seen.push(p)}
      }
    }
    loadState(sa,za);
  }
  function construct(warm){
    if(warm){warmLoad(warm);OPENW=0;fullCost()}
    else{reset();OPENW=0;fullCost();for(let v=0;v<V;v++)if(vLock[v]>=0)apply(()=>opSite(v,vLock[v]))}
    for(let v=0;v<V;v++){
      if(vLock[v]>=0||siteOf[v]>=0)continue;
      const list=vSites[v];let best=-1,bs=vOpt[v]?0:Infinity;
      for(const s of list){const dl=probe(()=>opSite(v,s))+rnd()*.05;if(dl<bs){bs=dl;best=s}}
      if(best>=0)apply(()=>opSite(v,best));
    }
    OPENW=OPEN;fullCost();
    const order=[];for(let z=0;z<Z;z++)if(seatAct[z]&&seatLock[z]===-2&&seatP[z]<0)order.push(z);
    order.sort((a,b)=>cand[seatRole[a]*D+vDay[seatVisit[a]]].length-cand[seatRole[b]*D+vDay[seatVisit[b]]].length||a-b);
    for(const z of order){
      if(!seatAct[z]||seatP[z]>=0)continue;
      const v=seatVisit[z],cs=cand[seatRole[z]*D+vDay[v]];let best=-1,bs=0;
      for(const q of cs){if(inVisit(v,q))continue;const dl=probe(()=>opSeat(z,q))+rnd()*.02;if(dl<bs){bs=dl;best=q}}
      if(best>=0)apply(()=>opSeat(z,best));
    }
  }
  function polish(maxPass){
    for(let pass=0;pass<maxPass;pass++){
      let imp=false;
      for(const z of freeSeats){
        if(!seatAct[z])continue;
        const v=seatVisit[z],cur=seatP[z],cs=cand[seatRole[z]*D+vDay[v]];
        let best=cur,bs=-1e-7;
        for(let i=-1;i<cs.length;i++){
          const q=i<0?-1:cs[i];if(q===cur)continue;if(q>=0&&inVisit(v,q))continue;
          const dl=probe(()=>opSeat(z,q));if(dl<bs){bs=dl;best=q}
        }
        if(best!==cur){apply(()=>opSeat(z,best));imp=true}
      }
      for(const v of freeVisits){
        const s0=siteOf[v];if(s0<0&&!vOpt[v])continue;
        const c0=s0>=0?sCat[s0]:-1;let best=s0,bs=-1e-7;
        for(const s of vSites[v]){if(s===s0||(!goalsOn&&c0>=0&&sCat[s]!==c0))continue;const dl=probe(()=>{opSite(v,s);if(s0<0)fillNew(v)});if(dl<bs){bs=dl;best=s}}
        if(vOpt[v]&&s0>=0){const dl=probe(()=>opSite(v,-1));if(dl<bs){bs=dl;best=-1}}
        if(best!==s0&&attempt(()=>{opSite(v,best);if(s0<0&&best>=0)fillNew(v)},0))imp=true;
      }
      if(!imp)break;
    }
  }
  function anneal(iters,onTick,warm){
    const T0=warm?1.2:(P.t0||8),T1=.02,half=warm?0:(iters*.5)|0;
    const bestS=new Int32Array(V),bestZ=new Int32Array(Z);let bestC=Infinity;
    if(warm){bestC=total;bestS.set(siteOf);bestZ.set(seatP)}
    const ratio=Math.log(T1/T0);
    for(let i=0;i<iters;i++){
      if((i&511)===0){openHint=hasOpen();if(onTick&&(i&4095)===0)onTick(i/iters)}
      const T=T0*Math.exp(ratio*i/iters);
      const r=rnd();
      if(NQ&&r<.1)attempt(mvGoal,T);
      else if(r<.44)attempt(mvReassign,T);
      else if(r<.72)attempt(mvSwap,T);
      else if(r<.9)attempt(mvRelocate,T);
      else attempt(mvSiteSwap,T);
      if(i>=half&&total<bestC-1e-9){bestC=total;bestS.set(siteOf);bestZ.set(seatP)}
    }
    if(bestC<total-1e-9)loadState(bestS,bestZ);
  }
  function run(seed,iters,onTick,warm){
    rnd=mulberry32(seed>>>0);
    construct(warm);
    anneal(iters,onTick,warm);
    polish(8);
    fullCost();
    return {siteOf:Int32Array.from(siteOf),seatP:Int32Array.from(seatP),cost:total};
  }

  function sortedDaysOf(p){const a=pSeats[p].map(z=>vDay[seatVisit[z]]);a.sort((x,y)=>x-y);return a}
  function issues(){
    const out=[];
    for(let v=0;v<V;v++){
      const s=siteOf[v];
      if(s<0){if(!vOpt[v])out.push({k:'nosite',sev:'error',v});continue}
      if(vSet[v]>=0&&!vsets[vSet[v]][s])out.push({k:'injset',sev:'warn',v,s});
      if(!sAvail[s*D+vDay[v]])out.push({k:'siteoff',sev:'warn',v,s});
      const z0=vSeat0[v],z1=z0+vSeatN[v],open=new Array(R).fill(0),ps=[];
      for(let z=z0;z<z1;z++){if(!seatAct[z])continue;const p=seatP[z];if(p<0){if(seatLock[z]!==-1&&!(vReq[v]>=0&&reqs[vReq[v]].only))open[seatRole[z]]++}else ps.push(p)}
      for(let r=0;r<R;r++)if(open[r])out.push({k:'open',sev:'error',v,r,n:open[r]});
      for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++)if(rel[ps[i]*N+ps[j]]===1)out.push({k:'avoid',sev:'info',v,p:ps[i],q:ps[j]});
    }
    for(let p=0;p<N;p++){
      const arr=pSeats[p],n=arr.length;if(!n)continue;
      if(pMaxLoad[p]>=0&&n>pMaxLoad[p])out.push({k:'maxload',sev:'warn',p,n,max:pMaxLoad[p]});
      for(const z of arr){
        const v=seatVisit[z],s=siteOf[v],d=vDay[v];
        if(s>=0&&aff[p*S+s]===2)out.push({k:'ban',sev:'warn',p,v,s});
        if(!pAvail[p*D+d])out.push({k:'unavail',sev:'warn',p,v,d});
        if(s>=0&&bkS&&bkSH[p*S+s])out.push({k:'rulesite',sev:'warn',p,v,s,b:P.bkSR[p*S+s]});
        else if(s>=0&&bkS&&bkS[p*S+s]>0)out.push({k:'rulesoft',sev:'info',p,v,s,b:P.bkSR[p*S+s]});
        if(bkD&&bkDH[p*D+d])out.push({k:'ruleday',sev:'warn',p,v,d,b:P.bkDR[p*D+d]});
      }
      const ds=sortedDaysOf(p);let prev=-1;const wk={};
      let run=0,rs=-1;
      for(const d of ds){
        if(d===prev)continue;
        const cnt=pDay[p*D+d];
        if(rules.perDay>0&&cnt>rules.perDay)out.push({k:'perday',sev:'warn',p,d,n:cnt});
        const rmP=pRun[p],omP=pOff[p];
        if(prev>=0&&rmP>0){
          const g=dayNum[d]-dayNum[prev];
          if(g===1){run++;if(run===rmP+1)out.push({k:'run',sev:'warn',p,d1:rs,d2:d,n:rmP})}
          else{run=1;rs=d;if(g-1<omP)out.push({k:'rest',sev:'warn',p,d1:prev,d2:d,n:omP})}
        }else{run=1;rs=d}
        wk[dayWeek[d]]=(wk[dayWeek[d]]||0)+cnt;
        prev=d;
      }
      if(pMaxWeek[p]>=0)for(const w in wk)if(wk[w]>pMaxWeek[p])out.push({k:'maxweek',sev:'warn',p,w:+w,n:wk[w],max:pMaxWeek[p]});
    }
    for(let v=0;v<V;v++){
      const s=siteOf[v];if(s<0||!sCrit[s]||!rules.rankGate)continue;
      const z0=vSeat0[v],z1=z0+vSeatN[v];let top=-1,lo=101,k=0;
      for(let z=z0;z<z1;z++){if(!seatAct[z]||seatP[z]<0)continue;const rk=rankOf(seatP[z],s);k++;if(rk>top)top=rk;if(rk<lo)lo=rk}
      const ref=rules.rankGate===2?lo:top;
      if(k&&ref<sCrit[s]-rules.rankTol)out.push({k:'rankgap',sev:'warn',v,s,n:ref,max:sCrit[s]});
    }
    if(bkP||team.length)for(let v=0;v<V;v++){
      const s=siteOf[v];if(s<0)continue;
      const z0=vSeat0[v],z1=z0+vSeatN[v],ps=[];
      for(let z=z0;z<z1;z++)if(seatAct[z]&&seatP[z]>=0)ps.push(seatP[z]);
      if(bkP)for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){const x=ps[i]*N+ps[j];if(bkPH[x])out.push({k:'rulewith',sev:'warn',v,p:ps[i],q:ps[j],b:P.bkPR[x]});else if(bkP[x]>0)out.push({k:'rulewithsoft',sev:'info',v,p:ps[i],q:ps[j],b:P.bkPR[x]})}
      for(const ti of teamBySite[s]){const tr=team[ti];if(!ps.length)continue;let m=0;for(const q of ps)if(tr.pm[q])m++;
        if(teamX(tr,m)>0)out.push({k:'ruleteam',sev:tr.hard?'warn':'info',v,s,n:m,max:tr.n,op:tr.op,b:tr.ri})}
    }
    if(cnt.length)for(let p=0;p<N;p++){
      const cl=cntBy[p];if(!cl||!cl.length)continue;const arr=pSeats[p];
      for(const ci of cl){const cr=cnt[ci];
        if(cr.per){cwk.fill(0);for(const z of arr){const v=seatVisit[z],s=siteOf[v];if(s>=0&&cr.sm[s])cwk[dayWk[vDay[v]]]++}
          let bad=0,worst=0,wx=0;for(let w=0;w<nWk;w++){const x=cntX(cr,cwk[w]);if(x>0){bad++;if(x>wx){wx=x;worst=cwk[w]}}}
          if(bad)out.push({k:'rulecount',sev:cr.hard?'warn':'info',p,n:worst,max:cr.n,w:bad,b:cr.ri});
        }else{let m=0;for(const z of arr){const s=siteOf[seatVisit[z]];if(s>=0&&cr.sm[s])m++}
          if(cntX(cr,m)>0)out.push({k:'rulecount',sev:cr.hard?'warn':'info',p,n:m,max:cr.n,b:cr.ri})}
      }
    }
    for(let v=0;v<V;v++){if(vReq[v]<0||siteOf[v]<0)continue;const rq=reqs[vReq[v]];let m=0;const z0=vSeat0[v],z1=z0+vSeatN[v];let all=0;for(let z=z0;z<z1;z++)if(seatAct[z]&&seatP[z]>=0){all++;if(rq.pm[seatP[z]])m++}if(m<rq.need||(rq.only&&all>m))out.push({k:'injwho',sev:rq.hard?'warn':'info',v,n:m,min:rq.need,gid:rq.gid})}
    for(let qi=0;qi<NQ;qi++){const q=GQ[qi];let n=0;for(let b=0;b<q.B&&n<40;b++){if(!q.ex[b])continue;const x=gCnt[qi][b];if(x<q.lo||(q.hi>=0&&x>q.hi)){n++;out.push({k:'goal',sev:q.hard?'warn':'info',q:qi,u:(b/q.nw)|0,w:b%q.nw,per:q.per,nw:q.nw,n:x,lo:q.lo,hi:q.hi})}}}
    for(let s=0;s<S;s++){
      const u=sUses[s].length;
      if(sMax[s]>=0&&u>sMax[s])out.push({k:'sitemax',sev:'warn',s,n:u,max:sMax[s]});
      if(sMin[s]>0&&u<sMin[s])out.push({k:'sitemin',sev:'info',s,n:u,min:sMin[s]});
      if(rules.siteGap>0&&u>1){
        const ds=sUses[s].map(v=>vDay[v]).sort((a,b)=>a-b);
        for(let i=1;i<ds.length;i++){const g=dayNum[ds[i]]-dayNum[ds[i-1]];if(g>0&&g<rules.siteGap)out.push({k:'sitegap',sev:'info',s,d1:ds[i-1],d2:ds[i]})}
      }
    }
    if(rcOn)for(let s=0;s<S;s++){
      rcScan(s,(k,g,lim,v)=>{
        if(k===0)out.push({k:'rcearly',sev:rcHard?'warn':'info',s,v,n:g,min:lim});
        else if(k===1)out.push({k:'rclate',sev:'info',s,v,n:g,max:lim});
        else if(k===2)out.push({k:'rcover',sev:'warn',s,n:g,max:lim});
        else out.push({k:'rcnever',sev:'info',s});
      });
    }
    if(rcOn&&pLast&&rcPD>0)for(let p=0;p<N;p++)for(const z of pSeats[p]){const v=seatVisit[z],s=siteOf[v];if(s<0)continue;const g=dayNum[vDay[v]]-pLast[p*S+s];if(g<rcPD)out.push({k:'rcperson',sev:'info',p,v,s,n:g,min:rcPD})}
    if(rules.distinct)for(let d=0;d<D;d++){
      const seen=[];
      for(const v of dayVisits[d]){const s=siteOf[v];if(s<0)continue;if(seen.indexOf(s)>=0)out.push({k:'dup',sev:'warn',d,s});else seen.push(s)}
    }
    return out;
  }
  function stats(){
    const loads=new Array(N);for(let p=0;p<N;p++)loads[p]=pSeats[p].length;
    const siteUse=new Array(S);for(let s=0;s<S;s++)siteUse[s]=sUses[s].length;
    let seats=0,filled=0,km=0;
    for(let z=0;z<Z;z++)if(seatAct[z]&&seatLock[z]!==-1){seats++;if(seatP[z]>=0)filled++}
    for(let v=0;v<V;v++)if(siteOf[v]>=0)km+=sKm[siteOf[v]];
    let rkSum=0,rkN=0,critHit=0,critN=0;
    for(let v=0;v<V;v++){const s=siteOf[v];if(s<0)continue;const z0=vSeat0[v],z1=z0+vSeatN[v];let top=-1;
      for(let z=z0;z<z1;z++){if(!seatAct[z]||seatP[z]<0)continue;const rk=rankOf(seatP[z],s);if(rk>top)top=rk;rkSum+=Math.abs(rk-sCrit[s]);rkN++}
      if(sCrit[s]>0&&top>=0){critN++;if(top>=sCrit[s]-(rules.rankTol||0))critHit++}}
    let covered=0,goalSites=0,goalMet=0;for(let s=0;s<S;s++){if(sUses[s].length)covered++;if(gMin[s]>0){goalSites++;if(sUses[s].length>=gMin[s])goalMet++}}
    let travel=0;
    for(let z=0;z<Z;z++){if(!seatAct[z]||seatP[z]<0)continue;const s=siteOf[seatVisit[z]];if(s<0)continue;travel+=pSiteD?pSiteD[seatP[z]*S+s]:Math.abs(pHome[seatP[z]]-sKm[s])}
    let rcEarly=0,rcLate=0,rcOverN=0,rcMet=0,rcDue=0;
    if(rcOn)for(let s=0;s<S;s++){let bad=false;rcScan(s,(k)=>{if(k===0){rcEarly++;bad=true}else if(k===1)rcLate++;else if(k===2){rcOverN++;bad=true}});
      const fx=rcFix[s];const lastF=fx.length?fx[fx.length-1]:null;const due=lastF!=null&&rcMax[s]>0?lastF+rcMax[s]<=rcEnd:(lastF==null?rcFresh:false);
      if(due||sUses[s].length){rcDue++;if(!bad)rcMet++}}
    const dayRoute=[];for(let d=0;d<D;d++){const st=[];for(const v of dayVisits[d]){const s=siteOf[v];if(s>=0&&st.indexOf(s)<0)st.push(s)}const tr=st.length?tour(st,(a,b)=>sDist?sDist[a*S+b]:Math.abs(sKm[a]-sKm[b]),s=>sKm[s]):{km:0,ord:[]};dayRoute.push({km:Math.round(tr.km*10)/10,sites:tr.ord.map(i=>st[i])})}
    const goalRes=GQ.map((q,qi)=>{let n=0,met=0,tot=0,sh=0,ov=0;for(let b=0;b<q.B;b++){if(!q.ex[b])continue;n++;const x=gCnt[qi][b];tot+=x;const a=x<q.lo?q.lo-x:0,o=q.hi>=0&&x>q.hi?x-q.hi:0;sh+=a;ov+=o;if(!a&&!o)met++}return {n,met,sum:tot,short:sh,over:ov}});
    return {goalRes,rc:rcOn?{early:rcEarly,late:rcLate,over:rcOverN,met:rcMet,due:rcDue}:null,dayRoute,loads,siteUse,catCount:Array.from(catCount),seats,filled,km,travel,active:Array.from(seatAct),rankGap:rkN?rkSum/rkN:0,critHit,critN,covered,goalSites,goalMet};
  }
  function detailed(fn){
    fn();
    if(!log.length){clear();return {delta:0,terms:emptyBd()}}
    const L={p:dP.slice(),v:dV.slice(),s:dS.slice(),d:dD.slice(),m:mixD,g:NQ>0&&dV.length>0};
    undo();clear();
    const before=emptyBd();bdOf(L,before);
    fn();const after=emptyBd();bdOf(L,after);undo();clear();
    const terms={};let delta=0;
    for(const k of TERMS){const x=after[k]-before[k];if(Math.abs(x)>1e-6){terms[k]=x;delta+=x}}
    return {delta,terms};
  }
  function bdOf(L,bd){
    for(const p of L.p)personCost(p,bd);
    for(const v of L.v)visitCost(v,bd);
    for(const s of L.s)siteCost(s,bd);
    for(const d of L.d)dayCost(d,bd);
    if(L.m)mixCost(bd);
    if(L.g)goalFull(bd);
  }
  function explainSeat(z){
    const v=seatVisit[z],d=vDay[v],r=seatRole[z],cur=seatP[z],out=[];
    for(const p of P.roleMembers[r]){
      if(p===cur){out.push({p,current:true,delta:0,terms:{}});continue}
      if(!pAvail[p*D+d]){out.push({p,blocked:'unavail'});continue}
      if(inVisit(v,p)){out.push({p,blocked:'invisit'});continue}
      const x=detailed(()=>opSeat(z,p));out.push({p,delta:x.delta,terms:x.terms});
    }
    if(cur>=0){const x=detailed(()=>opSeat(z,-1));out.push({p:-1,delta:x.delta,terms:x.terms})}
    out.sort((a,b)=>(a.blocked?1:0)-(b.blocked?1:0)||(a.current?-1:0)-(b.current?-1:0)||(a.delta||0)-(b.delta||0));
    return out;
  }
  function explainVisit(v){
    const d=vDay[v],cur=siteOf[v],out=[];OPENW=0;
    for(const s of vSites[v]){
      if(s===cur){out.push({s,current:true,delta:0,terms:{}});continue}
      const x=detailed(()=>opSite(v,s));out.push({s,delta:x.delta,terms:x.terms});
    }
    OPENW=OPEN;
    out.sort((a,b)=>(a.current?-1:0)-(b.current?-1:0)||a.delta-b.delta);
    return out;
  }
  return {run,loadState,issues,stats,breakdown,explainSeat,explainVisit,fullCost:()=>fullCost()};
}

function solve(P,onProgress){
  const t0=Date.now();
  if(!P.V){return {empty:true,siteOf:[],seatP:[],cost:0,issues:[],stats:{loads:new Array(P.N).fill(0),siteUse:new Array(P.S).fill(0),catCount:new Array(P.C).fill(0),seats:0,filled:0,km:0,active:[]},breakdown:emptyBd(),ms:0,runs:0,iters:0}}
  const sv=Solver(P);let best=null;const warm=P.warm&&P.warm.siteOf&&P.warm.siteOf.length===P.V&&P.warm.seatP.length===P.Z?P.warm:null;
  const runs=warm?1:Math.max(1,P.runs|0),iters=warm?Math.max(4000,(P.iters*.4)|0):P.iters;
  for(let k=0;k<runs;k++){
    const r=sv.run((P.seed+k*7919)>>>0,iters,f=>onProgress&&onProgress((k+f)/runs),warm);
    if(!best||r.cost<best.cost-1e-9)best=r;
    if(onProgress)onProgress((k+1)/runs);
  }
  sv.loadState(best.siteOf,best.seatP);
  const bd=sv.breakdown();
  return {siteOf:Array.from(best.siteOf),seatP:Array.from(best.seatP),cost:best.cost,issues:sv.issues(),stats:sv.stats(),breakdown:bd,ms:Date.now()-t0,runs,iters,warm:!!warm};
}
function explain(P,sol,q){
  const sv=Solver(P);
  sv.loadState(Int32Array.from(sol.siteOf),Int32Array.from(sol.seatP));
  if(q.seat!=null)return sv.explainSeat(q.seat);
  return sv.explainVisit(q.visit);
}
function evaluate(P,sol){
  const sv=Solver(P);
  sv.loadState(Int32Array.from(sol.siteOf),Int32Array.from(sol.seatP));
  return {cost:sv.fullCost(),issues:sv.issues(),stats:sv.stats(),breakdown:sv.breakdown()};
}
const API={solve,explain,evaluate,TERMS};
const isWorker=typeof window==='undefined'&&typeof self!=='undefined'&&typeof importScripts==='function';
if(isWorker){
  self.onmessage=function(e){
    const m=e.data;
    try{
      if(m.type==='solve'){
        let last=0;
        const res=solve(m.P,f=>{const now=Date.now();if(now-last>60){last=now;self.postMessage({type:'progress',id:m.id,f})}});
        self.postMessage({type:'done',id:m.id,res});
      }else if(m.type==='explain'){
        self.postMessage({type:'explained',id:m.id,res:explain(m.P,m.sol,m.q)});
      }
    }catch(err){self.postMessage({type:'error',id:m.id,msg:String(err&&err.message||err)})}
  };
}else root.MauvineEngine=API;
})(typeof self!=='undefined'?self:this);
