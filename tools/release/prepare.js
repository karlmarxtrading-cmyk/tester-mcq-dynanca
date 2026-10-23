"use strict";
const fs=require("fs"),path=require("path"),{spawnSync}=require("child_process");
const {root,runNode}=require("./run"),{build}=require("./build");
function prepareUnlocked(){
  const reports=path.join(root,"reports");fs.mkdirSync(reports,{recursive:true});
  fs.rmSync(path.join(reports,"quality-gate.json"),{force:true});
  const steps=[
    ["index","tools/bank-index/build-bank-index.js",[]],
    ["protected","tools/integrity/verify-protected.js",[]],
    ["mathjax-integrity","tools/mathjax-integrity/verify-mathjax.js",[]],
    ["csp","tools/csp/verify-csp-hashes.js",[]],
    ["index-check","tools/bank-index/build-bank-index.js",["--check"]],
    ["dataset","tools/ecosystem-validator/validate-ecosystem.js",[]],
    ["node-regression","tools/tests/run-tests.js",[]],
    ["release-regression","tools/tests/release-tests.js",[]],
    ["curriculum-regression","tools/tests/curriculum-tests.js",[]]
  ];
  const results=[];
  for(const [name,script,args] of steps){
    console.log("Checking "+name+"…");
    const r=spawnSync(process.execPath,[path.join(root,script),...args],{cwd:root,encoding:"utf8",maxBuffer:64*1024*1024});
    fs.writeFileSync(path.join(reports,name+".log"),(r.stdout||"")+(r.stderr||""));
    results.push({name,status:r.status===0?"PASS":"FAIL"});
    if(r.status!==0||r.error)throw new Error(name+" failed; see reports/"+name+".log");
  }
  build(root);
  // Both the original browser suite and the release suite run against dist.
  const browserLog=fs.openSync(path.join(reports,"browser.log"),"w");
  let browser;
  try { browser=spawnSync(process.execPath,[require.resolve("@playwright/test/cli"),"test","--config=tests/browser/playwright.config.js"],{
    cwd:root,stdio:["ignore",browserLog,browserLog],env:{...process.env,DYNANCA_TEST_ROOT:path.join(root,"dist"),DYNANCA_BROWSER_OUTPUT:path.join(root,"reports/release-browser-artifacts"),DYNANCA_BROWSER_RESULTS:path.join(root,"reports/release-browser-results.json")},encoding:"utf8",maxBuffer:64*1024*1024});
  } finally {fs.closeSync(browserLog); }
  results.push({name:"browser",status:browser.status===0?"PASS":"FAIL"});
  if(browser.status!==0||browser.error)throw new Error("Browser tests failed; see reports/browser.log (first setup: npx playwright install chromium).");
  runNode("tools/qa/audit-mathjax.js");
  runNode("tools/release/preflight.js");
  // Hashes bind the quality gate to exactly the tested dist bytes.
  const manifest=JSON.parse(fs.readFileSync(path.join(root,"RELEASE_MANIFEST.json"),"utf8"));
  const gate={status:"PASS",checks:results,assets:manifest.deploymentAssets,passedAt:new Date().toISOString()};
  fs.writeFileSync(path.join(reports,"quality-gate.json"),JSON.stringify(gate,null,2)+"\n");
  console.log("Release preparation PASS. Ready for local preview or authenticated Pages Direct Upload.");
}
function prepare(){
 const lock=path.join(root,".release-preparation.lock");
 let fd;try{fd=fs.openSync(lock,"wx");}catch(e){throw new Error("Another release preparation is active. If a previous process crashed, check it has stopped before removing .release-preparation.lock.");}
 try{return prepareUnlocked();}finally{fs.closeSync(fd);fs.rmSync(lock,{force:true});}
}
if(require.main===module){try{prepare();}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={prepare};
