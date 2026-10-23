"use strict";
const assert=require("assert"),fs=require("fs"),path=require("path"),os=require("os");
const {root}=require("../release/run"),Engine=require("../../practice/practice-engine"),Traversal=require("../../assets/js/manifest");
const {runtimeFiles,walk,sha256}=require("../release/runtime-files"),{build}=require("../release/build"),{preflight}=require("../release/preflight");
const Deploy=require("../release/deploy");
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log("  ok - "+name);}catch(e){failed++;console.log("  FAIL - "+name+": "+e.message);}}
const q={id:"probe",question:"Choose",options:[{label:"A",text:"2"},{label:"B",text:"A"}],answer:"A"};
test("label keys identify exactly one correct option when distractor text equals the key",()=>{
  const opts=Engine.optionList(q);assert.strictEqual(Engine.optionIsCorrect(q,opts[0]),true);assert.strictEqual(Engine.optionIsCorrect(q,opts[1]),false);
});
test("numeric index keys have one winner despite numeric option text",()=>{
  const n={...q,options:[{label:"A",text:"1"},{label:"B",text:"2"}],answer:1};
  assert.deepStrictEqual(Engine.optionList(n).map(o=>Engine.optionIsCorrect(n,o)),[false,true]);
});
test("text answer compatibility remains available when no label matches",()=>{
  const n={...q,answer:"2"};assert.deepStrictEqual(Engine.optionList(n).map(o=>Engine.optionIsCorrect(n,o)),[true,false]);
});
for(const [name,data] of [
  ["null question",{questions:[null]}],
  ["duplicate ids",{questions:[q,q]}],
  ["empty text",{questions:[{...q,question:" "}]}],
  ["duplicate labels",{questions:[{...q,options:[{label:"A",text:"a"},{label:"A",text:"b"}]}]}],
  ["missing answer",{questions:[{...q,answer:undefined}]}],
  ["unknown answer",{questions:[{...q,answer:"Z"}]}],
  ["malformed option",{questions:[{...q,options:[q.options[0],null]}]}]
])test("runtime bank validation rejects "+name,()=>assert.ok(Engine.validateBank(data)));
test("runtime validation accepts all shipped banks and preserves all records",()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,"master-manifest.json"),"utf8"));let banks=0,questions=0;
  Traversal.eachPracticeFile(manifest.subjects,e=>{if(!fs.existsSync(path.join(root,e.path)))return;const b=JSON.parse(fs.readFileSync(path.join(root,e.path),"utf8"));assert.strictEqual(Engine.validateBank(b),null,e.path);banks++;questions+=b.questions.length;});
  const index=JSON.parse(fs.readFileSync(path.join(root,"assets/data/bank-index.json"),"utf8"));assert.strictEqual(banks,Object.keys(index.available).length);assert.strictEqual(questions,index.summary.verifiedQuestions);
});
for(const p of ["questions/%2e%2e/master-manifest.json","questions/x.json?redirect=../","questions/x.json#fragment","questions/./a.json","questions//a.json","questions/x\u0000.json"])
  test("manifest safety rejects browser-reinterpreted path "+JSON.stringify(p),()=>assert.strictEqual(Traversal.isSafeRelativePath(p),false));
test("spaces and uppercase names remain valid unencoded paths",()=>assert.strictEqual(Traversal.isSafeRelativePath("questions/comprehensive math/dynanca - 151.json"),true));
test("media scheme detection rejects embedded control characters",()=>assert.strictEqual(Engine.isSafeMediaUrl("java\nscript:alert(1)"),false));
test("preview routing cannot point at the actual production branch",()=>assert.throws(()=>Deploy.resolveTarget({production_branch:"live"},"preview","live"),/equals/));
test("production routing uses the API value instead of guessing main",()=>assert.strictEqual(Deploy.resolveTarget({production_branch:"live"},"production","qa"),"live"));
test("Git-integrated projects fail Direct Upload configuration without mutation",()=>assert.throws(()=>Deploy.resolveTarget({source:{type:"github"},production_branch:"main"},"preview","qa"),/Git integration/));
test("multiple authenticated accounts require explicit selection",()=>assert.throws(()=>Deploy.chooseAccount({accounts:[{id:"a"},{id:"b"}]}),/explicitly/));
test("unknown account and unknown CLI arguments fail closed",()=>{
  assert.throws(()=>Deploy.chooseAccount({accounts:[{id:"a"}]},"b"));assert.throws(()=>Deploy.parseArgs(["production","--skip-tests"]));
});
test("deployment gate rejects changed assets or failed preflight",()=>{
  assert.throws(()=>Deploy.verifyGate({status:"PASS",assets:[1]},{status:"PASS",assets:[2]}),/changed/);
  assert.throws(()=>Deploy.verifyGate({status:"FAIL",assets:[]},{status:"PASS",assets:[]}));
});
const temp=fs.mkdtempSync(path.join(os.tmpdir(),"dynanca-release-test-"));
try{
  const list=runtimeFiles(root).files;
  for(const rel of [...list,"tools/mathjax-integrity/mathjax-baseline.json","package.json"]){const dest=path.join(temp,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,rel),dest);}
  // Development files never become deployable just because they exist.
  fs.mkdirSync(path.join(temp,"audit"));fs.writeFileSync(path.join(temp,"audit/secret.log"),"test log");
  test("production build copies only the runtime allowlist and leaves pending banks pending",()=>{
    const a=build(temp);assert.ok(a.preflight.status==="PASS");assert.ok(a.preflight.fileCount>1000&&a.preflight.fileCount<20000);assert.ok(!fs.existsSync(path.join(temp,"dist/audit/secret.log")));assert.strictEqual(a.preflight.pendingBanks,runtimeFiles(root).pending.length);
  });
  test("two builds have identical bytes and deterministic release manifests",()=>{
    const a=fs.readFileSync(path.join(temp,"RELEASE_MANIFEST.json"),"utf8"),hashes=walk(path.join(temp,"dist")).map(p=>[p,sha256(path.join(temp,"dist",p))]);build(temp);
    assert.strictEqual(fs.readFileSync(path.join(temp,"RELEASE_MANIFEST.json"),"utf8"),a);assert.deepStrictEqual(walk(path.join(temp,"dist")).map(p=>[p,sha256(path.join(temp,"dist",p))]),hashes);
  });
  test("preflight detects internal files accidentally added to dist",()=>{
    const p=path.join(temp,"dist/package.json");fs.writeFileSync(p,"{}");assert.ok(preflight(temp).issues.some(i=>/Unexpected file/.test(i)));fs.unlinkSync(p);
  });
  test("preflight detects missing fonts and changed stylesheet bytes",()=>{
    const css=path.join(temp,"dist/assets/css/catalog.css"),before=fs.readFileSync(css);fs.appendFileSync(css,"\n/* changed */");assert.ok(preflight(temp).issues.some(i=>/Stale or changed/.test(i)));fs.writeFileSync(css,before);
    const rel=list.find(p=>p.endsWith(".woff")),font=path.join(temp,"dist",rel),bytes=fs.readFileSync(font);fs.unlinkSync(font);assert.ok(preflight(temp).issues.some(i=>i.includes(rel)));fs.writeFileSync(font,bytes);
  });
  test("preflight detects broken URLs and case-sensitive asset references",()=>{
    const p=path.join(temp,"dist/index.html"),before=fs.readFileSync(p);fs.appendFileSync(p,'<img src="assets/img/Logo-Dynanca.png">');assert.ok(preflight(temp).issues.some(i=>/case-mismatched/.test(i)));fs.writeFileSync(p,before);
  });
}finally{fs.rmSync(temp,{recursive:true,force:true});}
console.log("\n"+passed+" release tests passed, "+failed+" failed.");process.exitCode=failed?1:0;
