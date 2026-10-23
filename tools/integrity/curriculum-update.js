"use strict";
const fs=require("fs"),path=require("path"),crypto=require("crypto"),{spawnSync}=require("child_process");
const {walk,sha256}=require("../release/runtime-files");
const root=path.resolve(__dirname,"../.."),baselinePath=path.join(root,"tools/integrity/protected-baseline.json");
const digest=o=>crypto.createHash("sha256").update(JSON.stringify(o)).digest("hex");
function validate(){
 const v=spawnSync(process.execPath,[path.join(root,"tools/ecosystem-validator/validate-ecosystem.js")],{cwd:root,encoding:"utf8",maxBuffer:64*1024*1024});
 if(v.status!==0)throw new Error("Curriculum validation failed:\n"+v.stdout+v.stderr);
}
function proposal(){
 const b=JSON.parse(fs.readFileSync(baselinePath));
 const paths=[...new Set([...Object.keys(b.files),...walk(root,"questions").filter(p=>p.endsWith(".json"))])].sort();
 const changes=paths.flatMap(p=>{const old=b.files[p]||null,full=path.join(root,p),now=fs.existsSync(full)?sha256(full):null;
 return old===now?[]:[{path:p,kind:old===null?"added":now===null?"removed":"changed",before:old,after:now}];});
 const body={schemaVersion:1,baselineSha256:sha256(baselinePath),changes};
 return {...body,proposalId:digest(body)};
}
function review(){validate();const p=proposal();fs.mkdirSync(path.join(root,"reports"),{recursive:true});
 fs.writeFileSync(path.join(root,"reports/curriculum-proposal.json"),JSON.stringify(p,null,2)+"\n");
 console.log(JSON.stringify(p,null,2));return p;}
function approve(id,reason){
 if(!id||!reason)throw new Error("Explicit approval requires --proposal <reviewed proposalId> --reason <owner decision>.");
 validate();const stored=JSON.parse(fs.readFileSync(path.join(root,"reports/curriculum-proposal.json"))),current=proposal();
 if(stored.proposalId!==id||current.proposalId!==id||JSON.stringify(stored)!==JSON.stringify(current))throw new Error("Stale or modified proposal. Run review again.");
 const b=JSON.parse(fs.readFileSync(baselinePath));
 for(const c of current.changes){if(c.after===null)delete b.files[c.path];else b.files[c.path]=c.after;}
 b.files=Object.fromEntries(Object.entries(b.files).sort(([a],[z])=>a.localeCompare(z)));
 b.history=b.history||[];b.history.push({approvedAt:new Date().toISOString(),reason,proposalId:id,previousBaselineSha256:current.baselineSha256,changes:current.changes});
 fs.writeFileSync(baselinePath,JSON.stringify(b,null,2)+"\n");
 const v=spawnSync(process.execPath,[path.join(root,"tools/integrity/verify-protected.js")],{cwd:root,stdio:"inherit"});
 if(v.status!==0)throw new Error("Post-approval verification failed.");
}
if(require.main===module){try{const a=process.argv.slice(2),value=k=>a[a.indexOf(k)+1];
 if(a[0]==="review")review();else if(a[0]==="approve")approve(a.includes("--proposal")?value("--proposal"):null,a.includes("--reason")?value("--reason"):null);else throw new Error("Usage: curriculum-update.js review | approve --proposal HASH --reason REASON");
}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={proposal,review,approve};
