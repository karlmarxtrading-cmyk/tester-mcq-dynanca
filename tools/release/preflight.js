"use strict";
const fs = require("fs"), path = require("path");
const {runtimeFiles,walk,sha256} = require("./runtime-files");
const {computeIndex} = require("../bank-index/build-bank-index");
const {parseHeadersFile} = require("../dev-server/serve");
const LIMITS = {files:20000,fileBytes:25*1024*1024,headerRules:100,headerLength:2000};
const MIME = {".html":"text/html",".css":"text/css",".js":"application/javascript",".json":"application/json",".png":"image/png",".woff":"font/woff",".woff2":"font/woff2",".svg":"image/svg+xml"};

function preflight(root, dist = path.join(root,"dist")) {
  const issues = [], references = [], assets = [];
  const fail = message => issues.push(message);
  let expected;
  try { expected = runtimeFiles(root); } catch (e) { return {status:"FAIL",issues:[e.message],limits:LIMITS}; }
  for (const missing of expected.pending) fail("Missing manifest bank: " + missing.id + " -> " + missing.path);
  const actual = walk(dist), actualSet = new Set(actual), expectedSet = new Set(expected.files);
  if (actual.length > LIMITS.files) fail("Cloudflare Pages Free file limit exceeded.");
  for (const rel of actual) if (!expectedSet.has(rel)) fail("Unexpected file in dist: " + rel);
  for (const rel of expected.files) if (!actualSet.has(rel)) fail("Missing runtime file: " + rel);
  const casePaths = new Map();
  for (const rel of actual) {
    const lower = rel.toLowerCase();
    if (casePaths.has(lower)) fail("Case-insensitive path collision: " + rel + " / " + casePaths.get(lower));
    casePaths.set(lower,rel);
    const full = path.join(dist,rel), size=fs.statSync(full).size, hash=sha256(full);
    if (size > LIMITS.fileBytes) fail("Cloudflare 25 MiB asset limit exceeded: " + rel);
    if (expectedSet.has(rel) && hash !== sha256(path.join(root,rel))) fail("Stale or changed build bytes: " + rel);
    if (rel !== "_headers" && !MIME[path.extname(rel)]) fail("Unknown content type: " + rel);
    assets.push({path:rel,bytes:size,sha256:hash,contentType:rel==="_headers"?"hosting-configuration":MIME[path.extname(rel)]});
    if (/\.(?:html|css|js|json)$/.test(rel)) {
      const text=fs.readFileSync(full,"utf8");
      if (/AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9]{40,}|-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(text)) fail("Credential pattern detected: " + rel);
      if (rel.endsWith(".json")) { try { JSON.parse(text); } catch(e) { fail("Invalid JSON: "+rel); } }
      // Local HTML and stylesheet URLs are resolved with browser URL rules,
      // then checked case-sensitively. Anchors/deep links retain their query.
      const urls=[];
      if (rel.endsWith(".html")) for (const m of text.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)) urls.push(m[1]);
      if (rel.endsWith(".css")) for (const m of text.matchAll(/url\(\s*["']?([^)'"\s]+)["']?\s*\)/g)) urls.push(m[1]);
      if (rel.endsWith(".js") && !rel.startsWith("assets/vendor/")) for (const m of text.matchAll(/\b(?:import\s*\(|require\s*\(|import[^\n]*?from\s*)["']([^"']+)["']/g)) urls.push(m[1]);
      for (const url of urls) {
        if (/^(?:#|data:|mailto:)/i.test(url)) continue;
        if (/^(?:https?:)?\/\//i.test(url)) { fail("Unexpected external runtime URL in "+rel); continue; }
        let target;
        try { target=decodeURIComponent(new URL(url,"https://local.test/"+rel).pathname).slice(1); } catch(e) { fail("Bad URL in "+rel); continue; }
        if (!target || target.endsWith("/")) target+="index.html";
        references.push({from:rel,url,target});
        if (!actualSet.has(target)) fail("Broken/case-mismatched asset reference: "+rel+" -> "+target);
      }
    }
  }
  if (actualSet.has("assets/data/bank-index.json")) {
    const fresh=computeIndex(root).index;
    const index=JSON.parse(fs.readFileSync(path.join(dist,"assets/data/bank-index.json"),"utf8"));
    if (JSON.stringify(index)!==JSON.stringify(fresh)) fail("Bank availability index is stale.");
  }
  const headers=parseHeadersFile(dist), policy=headers["Content-Security-Policy"]||"";
  for (const required of ["X-Content-Type-Options","Referrer-Policy","Permissions-Policy","Strict-Transport-Security","Content-Security-Policy"]) if(!headers[required]) fail("Missing security header: "+required);
  if (headers["X-Content-Type-Options"]!=="nosniff") fail("nosniff header is required.");
  for (const directive of ["default-src 'self'","object-src 'none'","form-action 'self'","connect-src 'self'","frame-ancestors 'self'"]) if(!policy.includes(directive)) fail("Missing CSP directive: "+directive);
  const script=(policy.match(/(?:^|;)\s*script-src\s+([^;]+)/)||[])[1]||"";
  if (/unsafe-inline|unsafe-eval|https?:|\*/.test(script)) fail("script-src must use self and exact hashes only.");
  const htmlHashes=new Set();
  const crypto=require("crypto");
  for(const rel of actual.filter(p=>p.endsWith(".html"))) {
    const html=fs.readFileSync(path.join(dist,rel),"utf8");
    for(const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) if(m[1].trim()) htmlHashes.add("'sha256-"+crypto.createHash("sha256").update(m[1]).digest("base64")+"'");
  }
  const policyHashes=new Set(script.match(/'sha256-[^']+'/g)||[]);
  if(htmlHashes.size!==policyHashes.size||[...htmlHashes].some(h=>!policyHashes.has(h))) fail("CSP inline hashes are missing or stale.");
  for(const [name,value] of Object.entries(headers)) if((name+": "+value).length>LIMITS.headerLength) fail("Header too long: "+name);
  if(actualSet.has("_headers")) {
    const rules=fs.readFileSync(path.join(dist,"_headers"),"utf8").split(/\r?\n/).filter(l=>l&&!/^\s|^#/.test(l));
    if(rules.length>LIMITS.headerRules) fail("Too many header rules.");
  }
  return {status:issues.length?"FAIL":"PASS",issues,limits:LIMITS,limitsVerifiedOn:"2026-10-09",
    sources:["https://developers.cloudflare.com/pages/get-started/direct-upload/","https://developers.cloudflare.com/pages/platform/limits/"],
    fileCount:assets.length,totalBytes:assets.reduce((a,b)=>a+b.bytes,0),largestAsset:assets.reduce((a,b)=>!a||b.bytes>a.bytes?b:a,null),
    pendingBanks:expected.pending.length,pendingRange:expected.pending.length?[expected.pending[0].id,expected.pending.at(-1).id]:[],referencesChecked:references.length,assets};
}
if(require.main===module) {
  const root=path.resolve(__dirname,"../.."), report=preflight(root);
  fs.mkdirSync(path.join(root,"reports"),{recursive:true});
  fs.writeFileSync(path.join(root,"reports/preflight.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({...report,assets:undefined},null,2));process.exitCode=report.status==="PASS"?0:1;
}
module.exports={preflight,LIMITS};
