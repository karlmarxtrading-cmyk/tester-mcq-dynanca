"use strict";
const fs=require("fs"),path=require("path"),os=require("os"),{spawnSync}=require("child_process");
const {root}=require("./run"),{prepare}=require("./prepare"),{preflight}=require("./preflight");
const CONFIG=path.join(root,"deployment.local.json");
const CLI=path.join(root,"node_modules/wrangler/bin/wrangler.js");
function parseArgs(args) {
  const out={mode:args[0]};
  if(!["configure","preview","production"].includes(out.mode))throw new Error("Use configure, preview or production.");
  for(let i=1;i<args.length;i++){
    const flag=args[i];if(!["--project","--account","--preview-branch"].includes(flag)||!args[i+1]||args[i+1].startsWith("--"))throw new Error("Unexpected or incomplete deployment argument: "+flag);
    out[flag.slice(2).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())]=args[++i];
  }
  return out;
}
function wranglerJson(args,cwd=root) {
  const r=spawnSync(process.execPath,[CLI,...args,"--json"],{cwd,env:{...process.env,WRANGLER_SEND_METRICS:"false"},encoding:"utf8",maxBuffer:8*1024*1024,timeout:60000});
  // Never include stdout/stderr in errors: the auth command's output can
  // contain a secret. Credentials exist only in memory and request headers.
  if(r.error||r.status!==0)throw new Error("Cloudflare authentication/read failed. Run npm run wrangler -- login, then retry; also check account permissions and connectivity.");
  try{return JSON.parse(r.stdout.trim());}catch(e){throw new Error("Wrangler did not return valid JSON for "+args.slice(0,2).join(" "));}
}
function chooseAccount(info,requested) {
  const accounts=info.accounts||[];
  if(requested){if(!accounts.some(a=>a.id===requested))throw new Error("Selected Cloudflare account is not in the authenticated account list.");return requested;}
  if(accounts.length!==1)throw new Error("Select an account explicitly with --account <ACCOUNT_ID>; no account is guessed.");
  return accounts[0].id;
}
async function fetchProject(project,account,credentials,fetcher=fetch) {
  if(!/^[a-z0-9][a-z0-9-]{0,62}$/.test(project||""))throw new Error("Specify the actual Pages project name with --project.");
  if(!/^[a-f0-9]{32}$/i.test(account||""))throw new Error("Invalid Cloudflare account id.");
  const headers=credentials.type==="api_key"?{"X-Auth-Key":credentials.key,"X-Auth-Email":credentials.email}:{Authorization:"Bearer "+credentials.token};
  const response=await fetcher("https://api.cloudflare.com/client/v4/accounts/"+account+"/pages/projects/"+encodeURIComponent(project),{headers,signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error("Cannot verify Cloudflare Pages project (HTTP "+response.status+"). No upload attempted.");
  const body=await response.json();if(!body.success||!body.result)throw new Error("Cloudflare project lookup was unsuccessful.");return body.result;
}
function resolveTarget(project,mode,previewBranch) {
  if(project.source)throw new Error("This project uses Git integration. Select a compatible Direct Upload project; existing configuration was not changed.");
  const production=project.production_branch;
  if(typeof production!=="string"||!production.trim())throw new Error("Actual production branch could not be verified.");
  const branch=mode==="production"?production:previewBranch;
  if(typeof branch!=="string"||!branch.trim()||branch.startsWith("-")||/[\u0000-\u001f\u007f]/.test(branch))throw new Error("A valid --preview-branch is required.");
  if(mode!=="production"&&branch===production)throw new Error("Preview branch equals the actual production branch. Choose a different preview branch.");
  return branch;
}
function verifyGate(check,gate) {
  if(check.status!=="PASS"||!gate||gate.status!=="PASS")throw new Error("Release quality gate is not PASS.");
  const a=JSON.stringify(check.assets),b=JSON.stringify(gate.assets);
  if(a!==b)throw new Error("dist changed after its tests; rerun npm run prepare:release.");
}
async function main(args=process.argv.slice(2)) {
  const opts=parseArgs(args),saved=fs.existsSync(CONFIG)?JSON.parse(fs.readFileSync(CONFIG,"utf8")):{};
  const projectName=opts.project||saved.projectName,previewBranch=opts.previewBranch||saved.previewBranch;
  if(!projectName)throw new Error("Select the actual project: npm run configure:deployment -- --project <PROJECT_NAME> --preview-branch <PREVIEW_BRANCH>");
  if(opts.mode!=="configure")prepare();
  const identity=wranglerJson(["whoami"]);
  const account=chooseAccount(identity,opts.account||saved.accountId);
  const credentials=wranglerJson(["auth","token"]);
  const project=await fetchProject(projectName,account,credentials);
  const branch=resolveTarget(project,opts.mode==="configure"?"preview":opts.mode,previewBranch);
  if(opts.mode==="configure") {
    fs.writeFileSync(CONFIG,JSON.stringify({projectName,accountId:account,productionBranch:project.production_branch,previewBranch,verifiedAt:new Date().toISOString()},null,2)+"\n");
    console.log("Direct Upload project verified: "+projectName+"; production branch: "+project.production_branch+"; preview branch: "+previewBranch+". No deployment performed.");return;
  }
  const check=preflight(root),gate=JSON.parse(fs.readFileSync(path.join(root,"reports/quality-gate.json"),"utf8"));verifyGate(check,gate);
  // No functions/, git checkout, Wrangler root config or unrelated files
  // can be picked up from this empty deployment cwd.
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),"dynanca-pages-upload-"));
  try {
    console.log("Uploading validated dist to "+projectName+" ("+opts.mode+", branch "+branch+")…");
    const run=spawnSync(process.execPath,[CLI,"pages","deploy",path.join(root,"dist"),"--project-name",projectName,"--branch",branch],{
      cwd,env:{...process.env,CLOUDFLARE_ACCOUNT_ID:account,WRANGLER_SEND_METRICS:"false"},stdio:"inherit"});
    if(run.error||run.status!==0)throw new Error("Wrangler upload failed. No successful deployment is claimed.");
    console.log("Upload command succeeded. Run npm run verify:deployment -- --url <ACTUAL_DEPLOYMENT_URL> before recording the site as verified.");
  }finally{fs.rmSync(cwd,{recursive:true,force:true});}
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={parseArgs,chooseAccount,fetchProject,resolveTarget,verifyGate};
