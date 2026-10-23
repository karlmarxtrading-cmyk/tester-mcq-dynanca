"use strict";
const fs=require('fs'),path=require('path'),{chromium}=require('@playwright/test');
const {createServer}=require('../dev-server/serve'),S=require('../../tests/browser/support');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'reports/visual');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const server=createServer({root:path.join(root,'dist')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch(),base='http://127.0.0.1:'+server.address().port,images=[],matrix=[],errors=[];
 try{
 for(const width of [320,390,768,1280,1920])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',isMobile:width<500,hasTouch:width<500});
  const p=await context.newPage();await p.addInitScript(theme=>localStorage.setItem('dynanca-mfc-theme-mode',theme),theme);
  p.on('pageerror',e=>errors.push(String(e)));p.on('requestfailed',r=>errors.push(r.url()));p.on('console',m=>{if(/Refused to|Content Security Policy/i.test(m.text()))errors.push(m.text());});
  for(const [name,url] of [['landing','/'],['practice','/practice/?quiz=ml']]){
   await p.goto(base+url);if(name==='landing')await p.waitForSelector('#bankGrid .bank');else{await p.waitForSelector('.practice-question');await p.evaluate(()=>MathJax.startup.promise);}
   const layout=await p.evaluate(S.layoutAudit),contrast=await p.evaluate(S.contrastAudit);
   matrix.push({page:name,width,theme,layout,contrast});
   const file=`${name}-${width}-${theme}.png`;await p.screenshot({path:path.join(out,file),fullPage:true});images.push(file);
  }
  await context.close();
 }
 // All shipped Venn diagrams are geometry-audited by the browser suite;
 // these screens supply representative human-readable visual evidence.
 const p=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});const venn=S.findQuestion(q=>q.visual&&q.visual.type==='venn'&&q.visual.sets.length===3,{maxBankSize:800});
 if(venn){await p.goto(base+'/practice/?quiz='+encodeURIComponent(venn.bankId));await p.waitForSelector('.practice-question');await p.evaluate(id=>PracticeEngine.render(id),venn.question.id);await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:path.join(out,'venn-three-390.png'),fullPage:true});images.push('venn-three-390.png');}
 // Score/explanation with actual typeset equations.
 await p.goto(base+'/practice/?quiz=ml');await p.waitForSelector('.practice-question');await p.evaluate(()=>{const q=PracticeEngine.getAllQuestions().find(q=>/\\\(/.test(q.explanation||''));PracticeEngine.render(q.id);PracticeEngine.handleAnswer(q.id,q.answer);});await p.evaluate(()=>MathJax.startup.promise);await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:path.join(out,'math-explanation-390.png'),fullPage:true});images.push('math-explanation-390.png');
 fs.writeFileSync(path.join(out,'visual-audit.json'),JSON.stringify({browser:await browser.version(),matrix,images,errors,scope:'Actual Chromium layout and contrast measurements. Mobile contexts emulate touch; no claim of testing a physical phone.'},null,2)+'\n');
 const contrastFailures=matrix.map(v=>({page:v.page,width:v.width,theme:v.theme,failures:v.contrast.text.filter(t=>t.ratio<t.need)})).filter(v=>v.failures.length);
 const layoutFailures=matrix.map(v=>({page:v.page,width:v.width,theme:v.theme,offscreen:v.layout.offscreen,clipped:v.layout.clipped,small:v.layout.small})).filter(v=>v.offscreen.length||v.clipped.length||v.small.length);
 console.log(JSON.stringify({screenshots:images.length,views:matrix.length,runtimeErrors:errors.length,contrastFailures,layoutFailures},null,2));
 if(errors.length||contrastFailures.length||layoutFailures.length)process.exitCode=1;
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
