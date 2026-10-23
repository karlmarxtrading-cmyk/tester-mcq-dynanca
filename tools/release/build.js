"use strict";
const fs=require("fs"),path=require("path");
const {runtimeFiles}=require("./runtime-files"),{preflight}=require("./preflight");
function build(root) {
  const {files}=runtimeFiles(root), dist=path.join(root,"dist");
  const stage=fs.mkdtempSync(path.join(root,".dist-stage-"));
  try {
    for(const rel of files){const target=path.join(stage,rel);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,rel),target);}
    const check=preflight(root,stage);
    if(check.status!=="PASS") throw new Error(check.issues.join("\n"));
    fs.rmSync(dist,{recursive:true,force:true});fs.renameSync(stage,dist);
    const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
    const epoch=process.env.SOURCE_DATE_EPOCH;
    if(epoch&&!/^\d+$/.test(epoch)) throw new Error("SOURCE_DATE_EPOCH must be a nonnegative integer.");
    const timestamp=epoch?new Date(Number(epoch)*1000).toISOString():pkg.releaseTimestamp;
    const manifest={releaseVersion:pkg.version,buildTimestamp:timestamp,timestampPolicy:"Fixed release timestamp, or SOURCE_DATE_EPOCH; build assets contain no generated timestamp.",
      deploymentStatus:"Not deployed",wranglerVersion:pkg.devDependencies.wrangler,
      preflight:{...check,assets:undefined},deploymentAssets:check.assets};
    fs.writeFileSync(path.join(root,"RELEASE_MANIFEST.json"),JSON.stringify(manifest,null,2)+"\n");
    console.log("Production build PASS: "+check.fileCount+" files in dist; "+check.pendingBanks+" declared pending banks.");
    return manifest;
  } finally {fs.rmSync(stage,{recursive:true,force:true});}
}
if(require.main===module){try{build(path.resolve(__dirname,"../.."));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={build};
