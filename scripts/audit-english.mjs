import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const cyr=/[\u0400-\u04ff]/u;
const files=[];function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name).replaceAll('\\','/');if(e.isDirectory())walk(f);else if(/\.(tsx?|css)$/.test(f))files.push(f);}}walk('src');
const allowedText=new Set(['Optical kerning: bring Г, Т, У and punctuation closer','Use recorded letter pairs (ст, но…)','commands between ``` or ёёё','аа / АА','ёёё','Аа','АА','аа','а','перо','Проекции','Многоугольник','Окружность','Отрезок(A, B)']);
const aliases=new Set(['вправо','направо','влево','налево','е','Плоскость','Сфера','Призма','Пирамида','Куб','Конус','Цилиндр','чертёж','чертеж','черт']);
const generated=new Set(['НаБланке(','Скрыть(',')\nСкрыть(','IVXІХ','(`{3,}|~{3,}|[ёЁ]{3,})']);
const remaining=[],retained=[];
function ancestor(n,predicate){for(let p=n.parent;p;p=p.parent)if(predicate(p))return true;return false;}
for(const file of files){const source=fs.readFileSync(file,'utf8');
 if(file.endsWith('.css')){assert.ok(!cyr.test(source.replace(/\/\*[\s\S]*?\*\//g,'')),`${file}: untranslated generated CSS content`);continue;}
 const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 function visit(n){if((ts.isStringLiteralLike(n)||ts.isTemplateHead(n)||ts.isTemplateMiddle(n)||ts.isTemplateTail(n)||ts.isJsxText(n))&&cyr.test(n.text)){
 const text=n.text.trim().replace(/\s+/g,' ');let reason='';
 if(file==='src/model/alphabet.ts'&&!ancestor(n,p=>ts.isPropertyAssignment(p)&&p.name.getText(tree)==='title'))reason='Cyrillic alphabet, letter pairs and pangram data';
 else if(file==='src/studio/phrasePicker.ts'&&ancestor(n,p=>ts.isVariableDeclaration(p)&&p.name.getText(tree)==='PHRASE_WORDS'))reason='handwriting practice corpus';
 else if(file==='src/sketch/commands.ts'&&ancestor(n,p=>ts.isPropertyAssignment(p)&&p.name.getText(tree)==='names'))reason='backward-compatible command alias';
 else if(['src/sketch/commands.ts','src/sketch/evaluate.ts','src/sketch/detect.ts'].includes(file)&&aliases.has(text))reason='internal parser alias';
 else if(generated.has(n.text))reason='legacy emitted command syntax or parser character set';
 else if(allowedText.has(text))reason='glyph, command syntax or internal identifier';
 else if(file==='src/shell/HelpDialogs.tsx'&&(/Write lowercase letters between/.test(text)||/ending on the right at the baseline/.test(text)))reason='English help explaining Cyrillic glyphs';
 else if(file==='src/sketch/SketchHelp.tsx'&&text.includes('Cyrillic А and Latin A refer to the same point.'))reason='English help explaining a Cyrillic glyph';
 else if(file==='src/studio/LetterSettings.tsx'&&text==='Derive missing glyphs: й, ё, О, С, Latin letters and symbols')reason='English label listing supported glyphs';
 const row={file,line:tree.getLineAndCharacterOfPosition(n.getStart(tree)).line+1,text,reason};(reason?retained:remaining).push(row);
 }ts.forEachChild(n,visit);}visit(tree);
}
const rust=fs.readFileSync('src-tauri/src/lib.rs','utf8').split('#[cfg(test)]')[0].replace(/\/\/[^\n]*/g,'');assert.ok(!cyr.test(rust),'Untranslated native UI/error text');
fs.mkdirSync('test-results/stage02',{recursive:true});fs.writeFileSync('test-results/stage02/localization-audit.json',JSON.stringify({files:files.length,remaining,retained},null,2));
assert.deepEqual(remaining,[],'Unclassified Cyrillic UI strings; inspect localization-audit.json');
// Ensure optional alphabet/practice data and legacy parser aliases remain intact; English defaults may evolve.
for(const [file,names]of [['src/studio/phrasePicker.ts',['PHRASE_WORDS']],['src/model/alphabet.ts',['cyrLower','cyrUpper','X_HEIGHT_LETTERS']]]){
  const before=execFileSync('git',['show',`525a188:${file}`],{encoding:'utf8'}),after=fs.readFileSync(file,'utf8');
 const vars=s=>{const values={};const tree=ts.createSourceFile(file,s,ts.ScriptTarget.Latest,true);function v(n){if(ts.isVariableDeclaration(n)&&names.includes(n.name.getText(tree))){let init=n.initializer.getText(tree);if(file==='src/studio/phrasePicker.ts'&&n.name.getText(tree)==='PHRASE_WORDS'){const obj=ts.createSourceFile(file,`const x=${init}`,ts.ScriptTarget.Latest,true);init=obj.statements[0].declarationList.declarations[0].initializer.properties.filter(p=>p.name?.getText(obj)!=='en').map(p=>p.getText(obj)).join('\n');}values[n.name.getText(tree)]=init;}ts.forEachChild(n,v);}v(tree);return values;};assert.deepEqual(vars(after),vars(before),`${file}: optional handwriting data changed`);
}
console.log(`PASS: ${files.length} source files audited; zero unclassified Cyrillic strings; ${retained.length} intentional glyph/data/parser references classified`);
console.log('PASS: Cyrillic practice corpora, alphabets, letter pairs and pangram unchanged from 525a188');
