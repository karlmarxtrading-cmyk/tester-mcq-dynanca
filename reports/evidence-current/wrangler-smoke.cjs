const path=require('path'),fs=require('fs'),{chromium}=require(path.resolve('node_modules/@playwright/test'));
(async()=>{
const child=require('child_process').spawn(process.execPath,[path.resolve('node_modules/wrangler/bin/wrangler.js'),'pages','dev','dist','--ip','127.0.0.1','--port','8790','--inspector-port','9237'],{detached:true,env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
const log=fs.createWriteStream(path.resolve('../../evidence/wrangler-local-final.log'));child.stdout.pipe(log);child.stderr.pipe(log);
process.on('exit',()=>{try{process.kill(-child.pid,'SIGTERM')}catch(e){}});
await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Wrangler preview startup timeout')),55000);child.stdout.on('data',d=>{if(d.toString().includes('Ready on')){clearTimeout(timer);resolve();}});child.on('exit',c=>{clearTimeout(timer);reject(new Error('Wrangler exited '+c));});});
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const errors=[],requests=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(/Refused to|Content Security Policy/i.test(m.text()))errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)requests.push({url:r.url(),status:r.status()});});
const base='http://127.0.0.1:8790';const landing=await page.goto(base+'/');await page.waitForSelector('#bankGrid .bank');
const landingHeaders=landing.headers();await page.goto(base+'/practice/index.html?quiz=ml');await page.waitForSelector('.practice-question');await page.evaluate(()=>MathJax.startup.promise);
const bankUrl=page.url();await page.locator('.practice-option[data-label="B"]').click();const scoring=await page.locator('.practice-verdict').innerText();await page.locator('.practice-next').click();await page.reload();await page.waitForSelector('.practice-question');const progress=await page.locator('#progressSummary').innerText();
const negatives=[];for(const p of ['/not-a-page','/package.json','/audit/CONTENT_AUDIT.json','/master-manifest.json','/questions/comprehensive%20math/dynanca%20-%20300.json']){const res=await page.request.get(base+p);negatives.push({path:p,status:res.status(),type:res.headers()['content-type']});}
const result={runtime:'Official Wrangler 4.149.0 Pages dev / workerd',landingStatus:landing.status(),headers:landingHeaders,canonicalPracticeURL:bankUrl,scoring,progressAfterReload:progress,checks:negatives,runtimeErrors:errors,httpErrors:requests};
fs.writeFileSync(path.resolve('../../evidence/wrangler-browser-smoke.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));await browser.close();process.kill(-child.pid,'SIGTERM');if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});
