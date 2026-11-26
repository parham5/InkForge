import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const policy=JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json','utf8')).app.security.csp;
const server=await createServer({server:{host:'127.0.0.1',port:4173,strictPort:true,headers:{'Content-Security-Policy':policy}},clearScreen:false});await server.listen();
const browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1400,height:900}});const page=await context.newPage();page.setDefaultTimeout(20000);
const remote=[];await context.route('**/*',r=>{if(/^https?:/.test(r.request().url())&&!r.request().url().startsWith('http://127.0.0.1:4173/')){remote.push(r.request().url());return r.abort();}return r.continue();});
try{
 await page.goto('http://127.0.0.1:4173');await page.getByRole('tab',{name:'Documents',exact:true}).waitFor();
 const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=800;c.height=1000;const g=c.getContext('2d');g.fillStyle='#807b70';g.fillRect(0,0,800,1000);g.fillStyle='#fffdf4';g.fillRect(90,60,620,880);return c.toDataURL('image/png').split(',')[1];});
 await page.locator('summary[aria-label="Export"]').click();await page.getByRole('button',{name:/On a desk/}).click();
 await page.getByRole('dialog',{name:'Handwriting on a photo of paper'}).waitFor();await page.screenshot({path:'test-results/stage02/desk-empty.png'});
 const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Choose photos…',exact:true}).click();await(await chooser).setFiles({name:'paper.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});
 await page.locator('canvas[aria-label="Page corners in photo"]').waitFor({timeout:60000});
 for(const step of ['Photo','Page','Occlusions','Ink']){await page.locator('.desk-steps button').filter({hasText:new RegExp(step)}).click();await page.screenshot({path:`test-results/stage02/desk-${step}.png`});}
 const download=page.waitForEvent('download');await page.getByRole('button',{name:/Save JPG/}).click();await(await download).saveAs('test-results/stage02/desk.jpg');
 assert.ok(fs.statSync('test-results/stage02/desk.jpg').size>1000);
 console.log('PASS: desk photo upload, all four steps, WASM photo analysis and JPG export under desktop CSP');
 const sandbox=await page.evaluate(async()=>{
  const {buildSrcdoc,loadVendor}=await import('/src/blocks/runtime.ts');
  return await new Promise(async(resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Sandbox probe timed out')),15000);const handler=e=>{if(e.data?.type==='stage02-probe'){clearTimeout(timeout);window.removeEventListener('message',handler);resolve(e.data);}};window.addEventListener('message',handler);
  const code='<script>(async()=>{let parentBlocked=false,evalBlocked=false,networkBlocked=false;try{parent.document.body.innerHTML}catch{parentBlocked=true}try{eval("1+1")}catch{evalBlocked=true}try{await fetch("https://example.invalid/stage02")}catch{networkBlocked=true}parent.postMessage({type:"stage02-probe",parentBlocked,evalBlocked,networkBlocked},"*")})()<\/script>';
  const frame=document.createElement('iframe');frame.sandbox='allow-scripts';frame.srcdoc=buildSrcdoc(code,await loadVendor());document.body.append(frame);
  });
 });
 assert.equal(sandbox.parentBlocked,true);assert.equal(sandbox.evalBlocked,true);assert.equal(sandbox.networkBlocked,true);
 console.log('PASS: real block sandbox executes inline content but blocks parent DOM access, JavaScript eval and network fetch');
 assert.deepEqual(remote,[]);console.log('PASS: desk and sandbox workflows made no remote HTTP requests');
}catch(error){await page.screenshot({path:'test-results/stage02/desk-failure.png'}).catch(()=>{});throw error;}finally{await context.close();await browser.close();await server.close();}
