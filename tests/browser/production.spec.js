"use strict";
const {test,expect}=require("@playwright/test"),S=require("./support");
let server,baseURL;
test.describe.configure({mode:"parallel"});
test.beforeAll(async()=>{({server,baseURL}=await S.startServer());});test.afterAll(async()=>S.stopServer(server));
const probe={id:"probe",title:"Regression bank",questions:[
  {id:"probe-q1",question:"Compute \\(1+1\\).",options:[{label:"A",text:"2"},{label:"B",text:"A"}],answer:"A",explanation:"\\(1+1=2\\)."},
  {id:"probe-q2",question:"Compute \\(2+2\\).",options:[{label:"A",text:"4"},{label:"B",text:"3"}],answer:"A"}
]};
async function fixture(page,bank=probe){await page.route("**/questions/computer%20science/ml.json",r=>r.fulfill({json:bank}));await page.goto(S.practiceUrl(baseURL,"ml"));}
test("a distractor whose text equals the correct label is marked Incorrect",async({page})=>{
  await fixture(page);await page.locator('.practice-option[data-label="B"]').click();await expect(page.locator(".practice-verdict")).toHaveText("Incorrect");await expect(page.locator("#progressSummary")).toContainText("0 correct");
});
for(const [name,record] of [["object label",{status:"answered_correct",selectedLabel:{bad:1}}],["missing option",{status:"answered_correct",selectedLabel:"Z"}],["array record",["answered_correct","A"]]])
  test("corrupt saved "+name+" cannot skip an unanswered question",async({page})=>{
    await page.addInitScript(record=>localStorage.setItem("dynanca-mcq-ml-v2",JSON.stringify({"probe-q1":record})),record);await fixture(page);await expect(page.locator('.practice-question')).toHaveAttribute("data-question-id","probe-q1");await expect(page.locator("#progressSummary")).toContainText("0 / 2");
  });
test("a stale correctness flag is reconciled with the loaded answer key",async({page})=>{
  await page.addInitScript(()=>localStorage.setItem("dynanca-mcq-ml-v2",JSON.stringify({"probe-q1":{status:"answered_correct",selectedLabel:"B"}})));await fixture(page);await expect(page.locator("#progressSummary")).toHaveText("1 / 2 done · 0 correct");await expect(page.locator("#reviewControl")).toContainText("Review 1 mistake");
});
test("changing current question and answering through the public API does not record an offscreen attempt",async({page})=>{
  await fixture(page);await page.waitForSelector(".practice-question");await page.evaluate(()=>{PracticeEngine.handleAnswer("probe-q2","A");PracticeEngine.handleAnswer("probe-q1","Z");});await expect(page.locator("#progressSummary")).toContainText("0 / 2");
});
test("MathJax clears detached MathItems during rapid navigation and reset rendering",async({page})=>{
  const problems=await S.watch(page);await fixture(page);await page.waitForFunction(()=>MathJax.typesetPromise&&document.querySelector("mjx-container"));
  const counts=await page.evaluate(async()=>{
    await MathJax.startup.promise;
    for(let i=0;i<60;i++){PracticeEngine.render(i%2?"probe-q1":"probe-q2");await MathJax.typesetPromise([document.querySelector("#practiceContainer")]);}
    await new Promise(r=>setTimeout(r,100));
    return {registered:Array.from(MathJax.startup.document.math).length,connected:Array.from(MathJax.startup.document.math).filter(m=>m.typesetRoot&&m.typesetRoot.isConnected).length,visible:document.querySelectorAll("mjx-container").length};
  });expect(counts.registered).toBe(counts.connected);expect(counts.registered).toBeLessThanOrEqual(4);expect(counts.visible).toBeGreaterThan(0);expect((await problems.collect()).pageErrors).toEqual([]);
});
for(const [name,questions] of [["null",[null]],["duplicate ids",[probe.questions[0],probe.questions[0]]],["missing key",[{...probe.questions[0],answer:"Z"}]],["invalid option",[{...probe.questions[0],options:[null]}]]])
  test("malformed bank "+name+" displays a recoverable damaged-bank error",async({page})=>{
    await fixture(page,{questions});await expect(page.locator("#practiceContainer")).toHaveAttribute("data-error-kind","bank-damaged");await expect(page.getByRole("button",{name:"Try again"})).toBeVisible();expect(await page.locator(".practice-question").count()).toBe(0);
  });
test("all 150 newly shipped banks are visible and the last opens from its exact encoded path",async({page})=>{
  await S.openLanding(page,baseURL,"?q=dynanca-300&collection=comprehensive+math");await expect(page.locator('#bankGrid [data-bank-id="dynanca-300"] a')).toBeVisible();await page.locator('#bankGrid [data-bank-id="dynanca-300"] a').click();await expect(page.locator(".practice-question")).toBeVisible();
});
test("unknown and internal paths are real 404s in the production output",async({request})=>{
  test.skip(!process.env.DYNANCA_TEST_ROOT,"This deployment-isolation check requires dist, as used by prepare:release.");
  for(const p of ["/package.json","/audit/CONTENT_AUDIT.json","/tools/integrity/protected-baseline.json","/tests/browser/support.js","/deployment.local.json","/not-a-page"]){const res=await request.get(baseURL+p);expect(res.status(),p).toBe(404);expect(res.headers()["content-security-policy"]).toBeTruthy();}
});
test("same-origin CSP remains enforced without blanket inline scripts",async({page})=>{
  const issues=await S.watch(page),res=await page.goto(S.practiceUrl(baseURL,"ml"));await page.waitForSelector(".practice-question");await page.evaluate(()=>MathJax.startup.promise);
  const policy=res.headers()["content-security-policy"];expect(policy.split("script-src")[1].split(";")[0]).not.toContain("unsafe-inline");expect(res.headers()["cache-control"]).toContain("must-revalidate");expect(await issues.collect()).toEqual(S.CLEAN);
});

test.describe("Every manifest bank",()=>{
 test.describe.configure({mode:"parallel"});
const banksPerPartition=30;
const partitionCount=Math.ceil(S.availableEntries.length/banksPerPartition);
for(let chunk=0;chunk<partitionCount;chunk++) {
  test(`every available bank opens its real first question, partition ${chunk+1}/${partitionCount}`,async({page})=>{
    test.setTimeout(180000);
    const problems=await S.watch(page);
    const entries=S.availableEntries.slice(chunk*banksPerPartition,(chunk+1)*banksPerPartition);
    for(const entry of entries){
      await page.goto(S.practiceUrl(baseURL,entry.id));
      await expect(page.locator('.practice-question')).toHaveAttribute('data-question-id',String(S.readBank(entry.id).questions[0].id));
      await page.evaluate(()=>MathJax.startup.promise);
      const winner=await page.evaluate(()=>{const q=PracticeEngine.getAllQuestions()[0];return PracticeEngine.optionList(q).filter(o=>PracticeEngine.optionIsCorrect(q,o)).map(o=>o.label);});
      expect(winner,entry.id).toHaveLength(1);
    }
    expect(await problems.collect()).toEqual(S.CLEAN);
  });
}

});

for(const width of [320,390,768,1280,1920])for(const theme of ['light','dark']) {
  test(`optional chart, coordinate, number line and geometry render at ${width}px ${theme}`,async({page})=>{
    await page.setViewportSize({width,height:900});
    await page.addInitScript(theme=>localStorage.setItem('dynanca-mfc-theme-mode',theme),theme);
    await fixture(page);await page.waitForSelector('.practice-question');
    const screenshots=[];
    for(const visual of [
      {type:'line-chart',title:'Function sample',data:[[-2,-2],[0,0],[2,4]]},
      {type:'scatter',title:'Scatter sample',data:[[-2,3],[0,1],[2,4]]},
      {type:'coordinate-plane',title:'Coordinate plane',points:[{x:-3,y:-1},{x:3,y:1}],segments:[{a:{x:-3,y:-1},b:{x:3,y:1}}]},
      {type:'number-line',title:'Number line',min:-5,max:5,ticks:10,points:[-4,0,4]},
      {type:'geometry',title:'Geometry',shapes:[{type:'circle',cx:260,cy:150,r:60},{type:'triangle',points:[[70,220],[120,80],[170,220]]}]}
    ]){
      await page.evaluate(visual=>{window.PRACTICES=[{...PRACTICES[0],visual}];PracticeEngine.render(PRACTICES[0].id);},visual);
      const svg=page.locator('.practice-math-visual svg');await expect(svg).toBeVisible();
      const bad=await svg.evaluate(svg=>{const vb=svg.viewBox.baseVal;return [...svg.querySelectorAll('text,circle,rect,polygon,polyline,line')].filter(el=>{const b=el.getBBox();return b.x<vb.x-1||b.y<vb.y-1||b.x+b.width>vb.x+vb.width+1||b.y+b.height>vb.y+vb.height+1;}).map(el=>el.tagName);});
      expect(bad,visual.type).toEqual([]);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
  });
}
for(const width of [320,390])test(`touchscreen mobile ${width}px preserves answer, next and theme interactions`,async({browser})=>{
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();await fixture(page);await page.locator('.practice-option[data-label="A"]').tap();await expect(page.locator('.practice-verdict')).toHaveText('Correct');await page.locator('.practice-next').tap();await expect(page.locator('.practice-question')).toHaveAttribute('data-question-id','probe-q2');await page.locator('[data-theme-option="dark"]').tap();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await context.close();
});
