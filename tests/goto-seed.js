/* Opens the app in an iframe, seeds a demo visit history + revisit timing, and shows a tab.
   Options: window.GOTO = {v:'history'|'workspace'|..., lang:'en'|'ar', mode:'range'|'min'|'random'} or #v=..&lang=.. */
(function(){
var q=new URLSearchParams(location.hash.slice(1));var G=window.GOTO||{};
var opt=k=>G[k]||q.get(k);
var fr=document.getElementById('fr');
fr.onload=function(){
  var tries=0;
  (function wait(){
    var w=fr.contentWindow,A=w.APP;
    if(!A||!A.ws||!A.ws.sites.length||A.ws.template!=='dataset'){if(tries++<80)return setTimeout(wait,250);return}
    var M=w.MV,ws=A.ws;
    if(opt('lang')==='ar')A.prefs.lang='ar';
    var today=M.rangeOf(ws).start,rows=[['date','place','people']];
    M.plannable(ws).slice(0,36).forEach(function(s,i){rows.push([M.addISO(today,-(8+i*3)),s.name,ws.people.slice(i%6,i%6+2).map(function(p){return p.name}).join('|')])});
    rows.push([M.addISO(today,-20),'Old annex (renamed)','Someone new']);
    ws.history=M.mergeHistory([],M.parseHistoryRows(ws,rows).recs).list;ws.histRev=1;
    ws.recency=M.normRecency({mode:opt('mode')||'range',min:45,max:75,jitter:6});
    ws.updated=Date.now();
    var v=opt('v')||'history';
    w.document.documentElement.lang=A.prefs.lang;w.document.documentElement.dir=A.prefs.lang==='ar'?'rtl':'ltr';w.I18N.setLang(A.prefs.lang);
    var b=w.document.querySelector('[data-act="tab"][data-view="'+v+'"]');if(b)b.click();
    setTimeout(function(){var d=w.document,vw=d.documentElement.clientWidth,bad=[];d.querySelectorAll('#main *').forEach(function(el){var r=el.getBoundingClientRect();if((r.right>vw+1||r.left<-1)&&r.width>0&&!el.closest('.tblwrap')&&!el.closest('.tabs'))bad.push(el.tagName+'.'+String(el.className).slice(0,30)+' '+Math.round(r.left)+'..'+Math.round(r.right))});console.log('vw',vw,'scrollW',d.documentElement.scrollWidth,'overflow',bad.slice(0,12).join(' | '))},600);
    console.log('seeded',ws.history.length,'view',A.view,'cards',w.document.querySelectorAll('#view-'+A.view+' .card').length,'tpl',!!w.document.getElementById('templates-card'));
  })();
};
})();
