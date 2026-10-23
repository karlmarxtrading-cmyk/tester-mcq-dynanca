"use strict";
const fs=require('fs'),path=require('path');
const workspace=path.resolve(__dirname,'..'),root=path.join(workspace,'project','REAL MCQ');
const {chromium}=require(path.join(root,'node_modules/@playwright/test'));
const {createServer}=require(path.join(root,'tools/dev-server/serve'));
const median=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
(async()=>{
 const servers={},bases={},browser=await chromium.launch(),runs={original:{landing:[],practice:[]},final:{landing:[],practice:[]}};
 try{
  for(const [name,folder] of [['original',path.join(workspace,'comparison-original','REAL MCQ')],['final',path.join(root,'dist')]]){
   const s=createServer({root:folder});await new Promise(r=>s.listen(0,'127.0.0.1',r));servers[name]=s;bases[name]='http://127.0.0.1:'+s.address().port;
  }
  for(let round=0;round<6;round++)for(const name of round%2?['final','original']:['original','final'])for(const [label,url] of [['landing','/'],['practice','/practice/?quiz=ml']]){
   const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'}),p=await context.newPage();
   await p.goto(bases[name]+url);
   if(label==='landing')await p.waitForSelector('#bankGrid .bank');
   else {await p.waitForSelector('.practice-question');await p.evaluate(()=>MathJax.startup.promise);}
   const m=await p.evaluate(()=>{
    const n=performance.getEntriesByType('navigation')[0],rs=performance.getEntriesByType('resource');
    return {readyMs:performance.now(),domContentLoadedMs:n.domContentLoadedEventEnd,requests:rs.length+1,transferBytes:n.transferSize+rs.reduce((a,b)=>a+b.transferSize,0),bankRequests:rs.filter(r=>new URL(r.name).pathname.startsWith('/questions/')).length};
   });if(round>0)runs[name][label].push(m);await context.close();
  }
  const summary={};for(const name of ['original','final']){summary[name]={};for(const label of ['landing','practice'])summary[name][label]=Object.fromEntries(Object.keys(runs[name][label][0]).map(k=>[k,median(runs[name][label].map(v=>v[k]))]));}
  const result={environment:'Isolated local gzip HTTP, Chromium, no network/CPU throttle; one discarded warm-up and five fresh-context samples per page/version, alternating version order. Same server implementation, no concurrent QA or build. Not public field performance.',browser:await browser.version(),readiness:'Rendered catalog or practice question plus resolved MathJax startup promise; timings include automation polling.',runs,median:summary};
  fs.writeFileSync(path.join(__dirname,'performance-controlled.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
 }finally{await browser.close();for(const s of Object.values(servers))await new Promise(r=>s.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
