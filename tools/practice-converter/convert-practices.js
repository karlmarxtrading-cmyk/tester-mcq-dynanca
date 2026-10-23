#!/usr/bin/env node
const fs=require("fs"), vm=require("vm"), path=require("path");
const [,,input,output]=process.argv;
if(!input||!output){console.error("Usage: node convert-practices.js <practices.js> <output.json>");process.exit(1);}
let s=fs.readFileSync(input,"utf8");
s=s.replace(/const\s+PRACTICES\s*=/,"result=");
s=s.replace(/if\s*\(typeof module[\s\S]*$/,"");
s=s.replace(/if\s*\(typeof window[\s\S]*$/,"");
s=s.replace(/export\s+default\s+PRACTICES\s*;?/g,"");
const ctx={result:null}; vm.runInNewContext(s,ctx,{timeout:10000});
if(!Array.isArray(ctx.result)) throw new Error("PRACTICES was not an array.");
const questions=ctx.result, seen=new Set();
for(const q of questions){ if(!q||q.id==null||!String(q.id).trim()) throw new Error("Question with missing id."); const id=String(q.id); if(seen.has(id)) throw new Error("Duplicate question id: "+id); seen.add(id); }
const id=path.basename(output).replace(/\.json$/i,"");
const data={schemaVersion:"1.0",type:"mcq",id,category:"",title:id,description:"",questionCount:questions.length,questions};
fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});
fs.writeFileSync(output,JSON.stringify(data,null,2)+"\n","utf8");
console.log(`Converted ${questions.length} questions -> ${output}`);
