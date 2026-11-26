import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const csp=JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json','utf8')).app.security.csp;
const server=await createServer({server:{host:'127.0.0.1',port:4173,strictPort:true,headers:{'Content-Security-Policy':csp}},clearScreen:false});
await server.listen();
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1400,height:900},locale:'en-US'});
const remote=[];const errors=[];
await context.route('**/*',route=>{const u=new URL(route.request().url());if(!['127.0.0.1','localhost'].includes(u.hostname)&&u.protocol.startsWith('http')){remote.push(u.href);return route.abort();}return route.continue();});
await context.addInitScript(()=>{window.__csp=[];window.addEventListener('securitypolicyviolation',e=>window.__csp.push({directive:e.effectiveDirective,blocked:e.blockedURI}));});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
fs.mkdirSync('test-results/stage02',{recursive:true});
try {
 await page.goto('http://127.0.0.1:4173');
 await page.getByRole('tab',{name:'Documents',exact:true}).waitFor();
 await page.getByRole('tab',{name:'Handwriting'}).click();
 await page.locator('.capture-canvas').waitFor();
 assert.equal(await page.locator('.current-char .big').innerText(),'a','English lowercase is the default handwriting character');
 assert.equal(await page.locator('.english-progress .group-progress-track').getAttribute('role'),'progressbar');
 assert.equal(await page.locator('.english-progress [role="progressbar"]').getAttribute('aria-valuenow'),'0');
 await page.locator('.alphabet-pills button[title="Cyrillic"]').click();
 assert.equal(await page.locator('.current-char .big').innerText(),'а','optional Cyrillic capture remains available');
 await page.locator('.alphabet-pills button[title="Latin"]').click();
 assert.equal(await page.locator('.current-char .big').innerText(),'a','return to English capture works');
 await page.locator('.alphabet-groups button.char-cell').filter({hasText:'th'}).waitFor();
 assert.match(await page.locator('.alphabet-groups').innerText(),/LETTER PAIRS/i,'English pair capture group available');
 const canvas=await page.locator('.capture-canvas').boundingBox();
 await page.mouse.move(canvas.x+canvas.width*.4,canvas.y+canvas.height*.4);await page.mouse.down();
 await page.mouse.move(canvas.x+canvas.width*.6,canvas.y+canvas.height*.65,{steps:15});await page.mouse.up();
 await page.getByRole('button',{name:/Save sample/}).click();
 await page.waitForFunction(async()=>{const {db}=await import('/src/storage/db.ts');return await db.samples.count()>0;});
 await page.waitForFunction(async()=>{const {getHandwriting}=await import('/src/engine/handwriting.ts');const s=getHandwriting();if(s.error)throw Error(s.error);return !!s.fontBytes;},{},{timeout:30000});
 await page.screenshot({path:'test-results/stage02/handwriting.png',fullPage:true});
 console.log('PASS: English default, optional Cyrillic capture, English pair group, real pointer capture, IndexedDB save and WASM font build under desktop CSP');
 await page.reload();await page.getByRole('tab',{name:'Handwriting'}).click();
 assert.ok(await page.evaluate(async()=>{const {db}=await import('/src/storage/db.ts');return await db.samples.count();}));
 assert.equal(await page.evaluate(async()=>{const {db}=await import('/src/storage/db.ts');return (await db.samples.toArray())[0]?.char;}),'a');
 console.log('PASS: captured English sample persists after reload');
 const englishRender=await page.evaluate(async()=>{const {engine}=await import('/src/engine/client.ts');const {db}=await import('/src/storage/db.ts');const samples=await db.samples.toArray();await engine.setSamples(samples);return engine.renderParagraph('The quick brown fox jumps over the lazy dog.',12000,1200,1,{skeleton:false,breaks:[]});});
 assert.ok(englishRender.lineD.flat().some(path=>path.d.length>0),'English document text renders to vector ink');
 await page.screenshot({path:'test-results/stage02/english-document-render.png',fullPage:true});
 console.log('PASS: English pangram document text renders as handwritten vector paths');
 await context.setOffline(true);
 await page.getByRole('tab',{name:'Write a phrase',exact:true}).click();
 assert.equal(await page.getByRole('tab',{name:'English'}).getAttribute('aria-selected'),'true','English is the default connected practice language');
 assert.match(await page.locator('.phrase-head input').inputValue(),/^[a-z ]+$/i,'English words are used for cursive practice');
 await page.screenshot({path:'test-results/stage02/phrase-offline.png',fullPage:true});
 assert.ok(await page.getByRole('button',{name:'Mark letter boundaries →'}).count());
 await context.setOffline(false);
 console.log('PASS: loaded handwriting and phrase workflows operate offline');
 await page.getByRole('tab',{name:'Documents',exact:true}).click();
 for(const title of ['Page','Formulas','Drawings','Render settings','Insert block']){
  const summary=page.locator('summary').filter({has:page.locator(`[aria-label="${title}"]`)});
  const exact=page.locator(`summary[aria-label="${title}"]`);
  await exact.click();await page.screenshot({path:`test-results/stage02/menu-${title.replaceAll(' ','-')}.png`});await page.keyboard.press('Escape');
 }
 for(const kind of ['letters','keys','about','sketch']){
  await page.evaluate(async kind=>{const {openHelp}=await import('/src/shell/HelpDialogs.tsx');openHelp(kind);},kind);
  await page.getByRole('dialog').waitFor();await page.screenshot({path:`test-results/stage02/help-${kind}.png`});await page.getByRole('button',{name:'Close',exact:true}).click();
 }
 await page.locator('summary[aria-label="Export"]').click();
 const fontDownload=page.waitForEvent('download');await page.getByRole('button',{name:/My font .ttf/}).click();
 await (await fontDownload).saveAs('test-results/stage02/InkForgeHandwriting.ttf');
 for(const [label,file]of [['SVG vector','document.svg'],['PNG image','document.png'],['Document .json','document.inkforge.json']]){
  await page.locator('summary[aria-label="Export"]').click();const download=page.waitForEvent('download');await page.getByRole('button',{name:label,exact:true}).click();await(await download).saveAs(`test-results/stage02/${file}`);
 }
 console.log('PASS: TTF, SVG, PNG and InkForge JSON exports downloaded');
 const commandResults=await page.evaluate(async()=>{
  const {COMMANDS,localizeCode}=await import('/src/sketch/commands.ts');const {compileSketch}=await import('/src/sketch/evaluate.ts');
  const {EXAMPLES}=await import('/src/sketch/prompt.ts');const {parseAnswer}=await import('/src/blank/answer.ts');const {ANSWER_EXAMPLE}=await import('/src/blank/prompt.ts');
  const failures=[...COMMANDS.map(c=>({name:c.names[1],errors:compileSketch(c.example).errors})),...EXAMPLES.map(c=>({name:c.title,errors:compileSketch(c.code).errors}))].filter(c=>c.errors.length);
  return {count:COMMANDS.length+EXAMPLES.length,failures,answer:parseAnswer(ANSWER_EXAMPLE),unfold:localizeCode('Развертка(S, A, B, C, P)','en'),legacy:compileSketch('А = (0, 0)\nВ = (2, 0)\nОтрезок(А, В)').errors};
 });
 assert.deepEqual(commandResults.failures,[]);assert.equal(commandResults.unfold,'Unfold(S, A, B, C, P)');assert.deepEqual(commandResults.legacy,[]);assert.equal(commandResults.answer.tasks.length,2);assert.deepEqual(commandResults.answer.problems,[]);
 console.log(`PASS: ${commandResults.count} command/help examples compile, English prompt parses and Cyrillic aliases still work`);
 const legacyContext=await browser.newContext();const legacy=await legacyContext.newPage();
 await legacy.route('**/seed',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Disposable migration fixture</title>'}));
 await legacy.goto('http://127.0.0.1:4173/seed');
 await legacy.evaluate(async()=>{
  localStorage.setItem('handbook.theme','dark');
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('handbook',20);r.onupgradeneeded=()=>{const d=r.result;const s=d.createObjectStore('samples',{keyPath:'id'});s.createIndex('char','char');s.createIndex('createdAt','createdAt');const docs=d.createObjectStore('documents',{keyPath:'id'});docs.createIndex('updatedAt','updatedAt');d.createObjectStore('settings',{keyPath:'key'});const desks=d.createObjectStore('desks',{keyPath:'id'});desks.createIndex('updatedAt','updatedAt');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const tx=db.transaction(['samples','documents','settings','desks'],'readwrite');
  tx.objectStore('samples').put({id:'legacy-sample',char:'я',strokes:[[{x:0,y:0,t:0,p:.5},{x:100,y:400,t:100,p:.5}]],entry:null,exit:null,pointerType:'pen',createdAt:1});
  tx.objectStore('documents').put({id:'legacy-document',title:'Мой документ',content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Сохранённый текст'}]}]},createdAt:1,updatedAt:1});
  tx.objectStore('settings').put({key:'legacy.setting',value:{kept:true}});
  tx.objectStore('desks').put({id:'legacy-desk',name:'Мой стол',photo:new Blob(['legacy-photo-bytes']),thumb:new Blob(['legacy-thumb']),corners:[[0,0],[100,0],[100,100],[0,100]],snapped:[true,true,true,true],kind:'a4',paper:'plain',mask:null,calib:null,createdAt:1,updatedAt:1});
  await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
 });
 await legacy.goto('http://127.0.0.1:4173');await legacy.getByRole('tab',{name:'Documents',exact:true}).waitFor();
 const migrated=await legacy.evaluate(async()=>{const m=await import('/src/storage/db.ts');await m.db.open();const doc=await m.db.documents.get('legacy-document'),sample=await m.db.samples.get('legacy-sample'),desk=await m.db.desks.get('legacy-desk');const photos=await m.db.deskPhotos.toArray();
  const backup=await m.exportEverything();const restored=[];
  for(const format of ['handbook-backup','inkforge-backup'])restored.push(await m.importEverything({...backup,format}));
  for(const format of ['handbook-handwriting','inkforge-handwriting'])await m.importHandwriting({format,version:1,samples:[{...sample,id:format}]},false);
  let invalid=false;try{await m.importEverything({format:'bad',samples:[],documents:[]});}catch{invalid=true;}
  return {version:m.db.verno,doc,sample,desk,photo:await photos[0].photo.text(),setting:await m.getSetting('legacy.setting',null),theme:document.documentElement.dataset.theme,backupFormat:backup.format,restored,invalid,samples:await m.db.samples.count()};});
 assert.equal(migrated.version,4);assert.equal(migrated.doc.title,'Мой документ');assert.equal(migrated.doc.content.content[0].content[0].text,'Сохранённый текст');assert.equal(migrated.sample.char,'я');assert.equal(migrated.desk.photos.length,1);assert.equal(migrated.photo,'legacy-photo-bytes');assert.deepEqual(migrated.setting,{kept:true});assert.equal(migrated.theme,'dark');assert.equal(migrated.backupFormat,'inkforge-backup');assert.equal(migrated.samples,3);assert.equal(migrated.invalid,true);
 console.log('PASS: real IndexedDB v2→v4 upgrade preserves Cyrillic documents/samples, settings, desk photos and legacy theme; old/new backup and handwriting imports pass');
 await legacyContext.close();
 assert.deepEqual(await page.evaluate(()=>window.__csp),[]);assert.deepEqual(errors,[]);
 console.log('PASS: zero desktop-policy violations and browser runtime errors');
 assert.equal(remote.length,0,'unexpected runtime remote requests');
 console.log('PASS: all runtime HTTP requests stayed local');
} catch(error) {await page.screenshot({path:'test-results/stage02/failure.png',fullPage:true}).catch(()=>{});throw error;} finally {await context.close();await browser.close();await server.close();}
