"use strict";
const {test,expect}=require('@playwright/test'),S=require('./support');
const fs=require('fs'),path=require('path'),T=require('../../assets/js/manifest');
const m=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../master-manifest.json'))),entries=[];
for(const collection of m.subjects){const banks=[];T.eachPracticeFile([collection],b=>banks.push(b));if(banks.length)entries.push(banks[0],banks.at(-1));}
T.eachPracticeFile(m.subjects,b=>{if(['dynanca-301','data-analyst','java-script1','python-practices1'].includes(b.id))entries.push(b);});
let server,baseURL;test.beforeAll(async()=>({server,baseURL}=await S.startServer()));test.afterAll(async()=>S.stopServer(server));
for(const e of [...new Map(entries.map(e=>[e.id,e])).values()])test('current curriculum renders, scores and reloads '+e.id,async({page})=>{
 const b=S.readBank(e.id),q=b.questions[0];await page.goto(S.practiceUrl(baseURL,e.id));
 const article=page.locator('.practice-question').first();await expect(article).toHaveAttribute('data-question-id',q.id);
 await page.waitForFunction(()=>window.MathJax&&window.MathJax.typesetPromise);await page.evaluate(()=>MathJax.startup.promise);
 await expect(page.locator('mjx-merror,[data-mjx-error]')).toHaveCount(0);
 await article.locator(`.practice-option[data-label="${q.answer}"]`).click();await expect(article.locator('.practice-verdict')).toHaveText('Correct');
 await page.reload();await expect(page.locator('#progressSummary')).toContainText('1 / '+b.questions.length+' done');
});
for(const count of [1,2])test('expanded collection and '+count+' questions work through runtime',async({page})=>{
 const fixture=structuredClone(S.readBank('ml'));fixture.id='future-bank';fixture.title='Future Bank';fixture.questions=fixture.questions.slice(0,count);fixture.questionCount=count;fixture.questions.forEach((q,i)=>q.id='future-q'+i);
 const manifest=structuredClone(S.manifest);manifest.subjects.push({id:'future-collection',name:'Future Collection',practice_files:[{id:fixture.id,name:fixture.title,file:'future.json',path:'questions/future.json',questionCount:count}]});
 const index=structuredClone(S.bankIndex);index.available[fixture.id]=count;
 await page.route('**/master-manifest.json',route=>route.fulfill({json:manifest}));await page.route('**/assets/data/bank-index.json',route=>route.fulfill({json:index}));await page.route('**/questions/future.json',route=>route.fulfill({json:fixture}));
 await S.openLanding(page,baseURL,'?q=Future');const card=page.locator('#bankGrid [data-bank-id="future-bank"]');await expect(card).toHaveAttribute('data-available','true');await card.locator('a').click();
 const article=page.locator('.practice-question').first();await expect(article).toHaveAttribute('data-question-id','future-q0');await article.locator(`.practice-option[data-label="${fixture.questions[0].answer}"]`).click();await expect(article.locator('.practice-verdict')).toHaveText('Correct');
});
