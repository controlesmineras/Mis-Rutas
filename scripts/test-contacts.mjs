import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {pathToFileURL} from 'node:url';
const temp=fs.mkdtempSync(path.resolve('node_modules/.contacts-test-'));
const failures=[];
try {
 for(const file of ['data.ts','cityContacts.tsx','CompanyContactEditor.tsx']){
  const code=ts.transpileModule(fs.readFileSync('src/'+file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './$1.mjs'");
  fs.writeFileSync(path.join(temp,file.replace(/\.tsx?$/,'.mjs')),code);
 }
 const {repairContactDirectory,groupedCityContacts,updateCityContact}=await import(pathToFileURL(path.join(temp,'cityContacts.mjs')));
 const {serviceOffice}=await import(pathToFileURL(path.join(temp,'CompanyContactEditor.mjs')));
 const named={id:'full',city:'Honda',company:'Flota Huila',name:'Taquilla terminal',phone:'3212152929',address:''};
 const office=c=>({id:c.id,name:c.name,phone:c.phone,address:c.address});
 const service=(id,c)=>({id,company:c.company,phone:c.phone,departure:c.name,whatsapp:'',originContact:office(c)});
 const notebook=(contacts,services=[])=>({trips:[],cityContacts:structuredClone(contacts),legs:[{id:'leg',from:'Honda',to:'Remedios',services:structuredClone(services)}]});
 const count=d=>groupedCityContacts(d).flatMap(g=>g.contacts).length;
 function test(name,fn){try{fn();console.log('PASS '+name);}catch(e){failures.push(name);console.error('FAIL '+name+': '+e.message);}}
 test('two identical complete records plus incomplete record display one contact',()=>{
  const copy={...named,id:'full-copy'},blank={...named,id:'blank',name:''};
  const d=notebook([named,copy,blank],[service('a',copy),service('b',blank)]);const before=JSON.stringify(d);
  assert.equal(count(d),1);assert.equal(JSON.stringify(d),before);
  repairContactDirectory(d);assert.equal(d.cityContacts.length,1);assert(d.legs[0].services.every(s=>s.originContact.id==='full'));
  const saved=JSON.stringify(d);repairContactDirectory(d);assert.equal(JSON.stringify(d),saved);
 });
 test('editing consolidated record updates every linked service after reload',()=>{
  const blank={...named,id:'blank',name:''};const d=notebook([named,{...named,id:'copy'},blank],[service('a',blank),service('b',{...named,id:'copy'})]);
  repairContactDirectory(d);updateCityContact(d,{...d.cityContacts[0]},'Honda',{company:named.company,name:'Taquilla 5',phone:'3210000000',address:'Local 5'});repairContactDirectory(d);
  assert.equal(count(d),1);assert(d.legs[0].services.every(s=>s.originContact.phone==='3210000000'&&s.originContact.name==='Taquilla 5'));
 });
 test('distinct north and south offices sharing a phone remain separate',()=>{
  const d=notebook([{...named,name:'Local norte'},{...named,id:'south',name:'Local sur'},{...named,id:'unknown',name:''}]);repairContactDirectory(d);assert.equal(count(d),3);
 });
 test('different company, city or phone are not merged',()=>{
  const d=notebook([named,{...named,id:'company',company:'Otra empresa'},{...named,id:'city',city:'Ibagué'},{...named,id:'phone',phone:'1234567890'}]);repairContactDirectory(d);assert.equal(count(d),4);
 });
 test('ID-less legacy contact merges into one complete record',()=>{
  const s=service('s',{...named,name:''});delete s.originContact.id;const d=notebook([named],[s]);repairContactDirectory(d);assert.equal(count(d),1);assert.equal(d.legs[0].services[0].originContact.id,'full');
 });
 test('destination links update without changing origin city or trip',()=>{
  const d=notebook([{...named,city:'Remedios'},{...named,id:'copy',city:'Remedios'}],[{...service('s',{...named,name:'',phone:''}),originContact:{name:'',phone:'',address:''},destinationContact:office({...named,id:'copy'})}]);repairContactDirectory(d);assert.equal(d.legs[0].services[0].destinationContact.id,'full');assert.equal(d.legs[0].from,'Honda');
 });
 test('existing prices and schedules survive contact repair',()=>{
  const s={...service('s',named),departures:['6:00 pm','11:00 pm a 12:00 am'],fare:'150000',notes:'Llegar dos horas antes',fareHistory:[{id:'p',amount:'150000',recordedAt:'2026-10-03'}]};const d=notebook([named],[s]);repairContactDirectory(d);for(const key of ['departures','fare','notes','fareHistory'])assert.deepEqual(d.legs[0].services[0][key],s[key]);assert.equal(serviceOffice(d,d.legs[0].services[0],'Honda','origin').name,named.name);
 });
} finally {fs.rmSync(temp,{recursive:true,force:true});}
if(failures.length)process.exitCode=1;
