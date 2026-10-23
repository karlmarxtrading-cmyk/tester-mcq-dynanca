"use strict";
const {root,runWrangler}=require("./run"),{preflight}=require("./preflight");
try {
  const check=preflight(root);
  if(check.status!=="PASS")throw new Error("Build is missing or stale. Run npm run build first. "+check.issues.join("; "));
  runWrangler(["pages","dev","dist","--ip","127.0.0.1","--port","8788","--inspector-port","9235",...process.argv.slice(2)]);
}catch(e){console.error(e.message);process.exitCode=1;}
