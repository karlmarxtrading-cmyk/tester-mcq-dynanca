"use strict";
const path=require("path"),fs=require("fs"),{spawnSync}=require("child_process");
const root=path.resolve(__dirname,"../..");
function runNode(script,args=[],options={}) {
  const r=spawnSync(process.execPath,[path.resolve(root,script),...args],{cwd:root,env:process.env,stdio:"inherit",...options});
  if(r.error||r.status!==0)throw new Error("Command failed: "+script+(r.error?" ("+r.error.message+")":""));return r;
}
function runWrangler(args,options={}) {return runNode("node_modules/wrangler/bin/wrangler.js",args,options);}
module.exports={root,runNode,runWrangler};
if(require.main===module){try{runWrangler(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}}
