"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Traversal = require("../../assets/js/manifest.js");

const STATIC_FILES = [
  "index.html", "404.html", "_headers", "master-manifest.json",
  "assets/css/catalog.css", "assets/css/shell.css", "assets/css/practice-status.css",
  "assets/data/bank-index.json",
  ...["catalog-model", "catalog", "manifest", "reset-progress", "shell", "theme"].map(n => "assets/js/" + n + ".js"),
  ...["apple-touch-icon", "favicon-16x16", "favicon-32x32", "icon-192", "icon-512", "logo-dynanca"].map(n => "assets/img/" + n + ".png"),
  "practice/index.html", "practice/practices.css",
  ...["data-loader", "math-visuals", "practice-engine", "practice-state", "venn-renderer"].map(n => "practice/" + n + ".js")
];
function walk(root, dir = "") {
  if (!fs.existsSync(path.join(root, dir))) return [];
  return fs.readdirSync(path.join(root, dir), {withFileTypes:true}).flatMap(e => {
    const rel = (dir ? dir + "/" : "") + e.name;
    if (e.isSymbolicLink()) throw new Error("Symlink is forbidden: " + rel);
    return e.isDirectory() ? walk(root, rel) : [rel];
  }).sort();
}
function sha256(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function runtimeFiles(root) {
  const files = STATIC_FILES.slice();
  const vendor = JSON.parse(fs.readFileSync(path.join(root,"tools/mathjax-integrity/mathjax-baseline.json"),"utf8"));
  files.push(...Object.keys(vendor.files || vendor));
  const manifest = JSON.parse(fs.readFileSync(path.join(root,"master-manifest.json"),"utf8"));
  const pending = [];
  Traversal.eachPracticeFile(manifest.subjects, e => {
    if (!Traversal.isSafeRelativePath(e.path)) throw new Error("Unsafe manifest path: " + e.path);
    if (fs.existsSync(path.join(root,e.path))) files.push(e.path);
    else pending.push({id:e.id,path:e.path});
  });
  const unique = [...new Set(files)].sort();
  for (const rel of unique) {
    const full = path.join(root,rel);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) throw new Error("Required runtime file missing: " + rel);
    if (fs.realpathSync(full) !== path.resolve(full)) throw new Error("Runtime file resolves through a symlink: " + rel);
  }
  return {files:unique,pending};
}
module.exports = {STATIC_FILES,walk,sha256,runtimeFiles};
