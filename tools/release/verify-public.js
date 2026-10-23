"use strict";
const fs=require("fs"),path=require("path"),{chromium}=require("@playwright/test");
const {root}=require("./run"),{preflight}=require("./preflight");
async function main(){
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=="--url")throw new Error("Use --url <actual Pages deployment URL>.");
  const url=new URL(args[1]);if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash)throw new Error("Use an HTTPS site origin without credentials, query or fragment.");
  url.pathname="/";
  const check=preflight(root);if(check.status!=="PASS")throw new Error("Local dist preflight is not PASS.");
  const failed=[],results=[];
  // Read every public asset and compare exact bytes, including paths with
  // spaces. Request caching must not hide a stale production deployment.
  const queue=check.assets.filter(a=>a.path!=="_headers");
  let cursor=0;
  async function worker(){while(cursor<queue.length){const a=queue[cursor++];try{
    const res=await fetch(new URL(a.path.split("/").map(encodeURIComponent).join("/"),url),{cache:"no-store",signal:AbortSignal.timeout(30000)});
    const bytes=Buffer.from(await res.arrayBuffer()),hash=require("crypto").createHash("sha256").update(bytes).digest("hex");
    if(!res.ok||hash!==a.sha256)failed.push(a.path+": HTTP "+res.status+" or byte hash mismatch");
    if(!res.headers.get("content-type")?.includes(a.contentType))failed.push(a.path+": incorrect Content-Type");
    results.push({path:a.path,status:res.status,hashMatches:hash===a.sha256});
  }catch(e){failed.push(a.path+": request failed");}}}
  await Promise.all(Array.from({length:6},worker));
  for(const p of ["package.json","reports/quality-gate.json","audit/CONTENT_AUDIT.json","tools/integrity/protected-baseline.json","unknown-release-path"]){const res=await fetch(new URL(p,url));if(res.status!==404)failed.push("Internal/unknown path must be 404: "+p);}
  const browser=await chromium.launch();
  const runtime=[];
  try{
    for(const width of [320,390,768,1280,1920]){
      const page=await browser.newPage({viewport:{width,height:900}});
      page.on("pageerror",e=>runtime.push(String(e)));page.on("console",m=>{if(/Content Security Policy|Refused to/i.test(m.text()))runtime.push(m.text());});
      const res=await page.goto(url.href);if(!res.headers()["content-security-policy"])failed.push("Missing production CSP");
      await page.waitForSelector("#bankGrid .bank");
      await page.goto(new URL("practice/?quiz=ml",url).href);await page.waitForSelector(".practice-question");
      if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))failed.push("Practice overflow at "+width);
      await page.close();
    }
  }finally{await browser.close();}
  failed.push(...runtime);
  const report={url:url.href,status:failed.length?"FAIL":"PASS",verifiedAt:new Date().toISOString(),assetsChecked:results.length,failed,results};
  fs.writeFileSync(path.join(root,"reports/public-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(report.status+": verified "+results.length+" deployed assets and responsive page smoke tests.");if(failed.length)process.exitCode=1;
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
