// Packaged WebView2 validation using Playwright's documented CDP test interface.
import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const exe=path.resolve(process.argv[2]??'target/release/InkForge.exe');assert.ok(fs.existsSync(exe));
const profile=path.resolve(`test-results/stage02/native-profile-${Date.now()}`);fs.mkdirSync(profile,{recursive:true});
const port=Number(process.env.INKFORGE_TEST_CDP_PORT??9231);
const child=spawn(exe,[],{windowsHide:true,env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-port=${port}`,WEBVIEW2_USER_DATA_FOLDER:profile},stdio:'ignore'});
let browser;try{
 for(let i=0;i<30;i++){try{browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);break;}catch{await new Promise(resolve=>setTimeout(resolve,500));}}
 assert.ok(browser,'WebView2 CDP unavailable');const context=browser.contexts()[0];const page=context.pages().find(p=>p.url().includes('tauri.localhost'))??context.pages()[0];assert.ok(page);page.setDefaultTimeout(20000);
 const errors=[],remote=[];page.on('pageerror',e=>errors.push(e.message));await context.route('**/*',r=>{const url=r.request().url();if(/^https?:/.test(url)&&!/^https?:\/\/(tauri|asset|ipc)\.localhost/.test(url)){remote.push(url);return r.abort();}return r.continue();});
 await context.setOffline(true);await page.reload();await page.getByRole('tab',{name:'Handwriting'}).click();await page.locator('.capture-canvas').waitFor();
 assert.equal(await page.locator('.current-char .big').innerText(),'a','packaged desktop defaults to English capture');
 const box=await page.locator('.capture-canvas').boundingBox();await page.mouse.move(box.x+box.width*.35,box.y+box.height*.35);await page.mouse.down();await page.mouse.move(box.x+box.width*.55,box.y+box.height*.55,{steps:15});await page.mouse.up();await page.getByRole('button',{name:/Save sample/}).click();
 await page.getByText(/Font built in/).waitFor();await page.screenshot({path:'test-results/stage02/native-offline.png'});
 await page.reload();await page.getByRole('tab',{name:'Handwriting'}).click();await page.getByText(/Font built in/).waitFor();
 const stored=await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('handbook');r.onsuccess=()=>{const db=r.result;const count=db.transaction('samples').objectStore('samples').count();count.onsuccess=()=>{resolve(count.result);db.close();};count.onerror=()=>reject(count.error);};r.onerror=()=>reject(r.error);}));assert.equal(stored,1);
 await page.getByRole('tab',{name:'Write a phrase',exact:true}).click();assert.equal(await page.getByRole('tab',{name:'English'}).getAttribute('aria-selected'),'true');assert.match(await page.locator('.phrase-head input').inputValue(),/^[a-z ]+$/i);
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('handbook:help',{detail:'about'})));await page.getByRole('dialog',{name:'About InkForge'}).waitFor();assert.ok(await page.getByText('Developed and published by Parham Fallah. © 2026 Parham Fallah.').count());
 assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
 console.log('PASS: packaged WebView2 cold reload offline, real capture, WASM font build, persisted sample after reload, English About and attribution');console.log('PASS: no JavaScript errors or remote HTTP requests during desktop test');console.log(`Executable tested: ${exe}`);console.log(`Disposable WebView2 profile: ${profile}`);
}finally{if(browser)await browser.close();child.kill();}
