import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {indexedDB} from 'fake-indexeddb';

const temp=fs.mkdtempSync(path.resolve('node_modules/.drive-test-'));
const empty={trips:[],legs:[]};
const trip=(id,name=id)=>({trips:[{id,name,routes:[{id:'route-'+id,name:'Principal',legs:[]}]}],legs:[]});
const prefix='mis-rutas-snapshot-';
const deviceA='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',deviceB='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
let clock=Date.parse('2026-11-02T10:00:00Z'),nextOwner='A',oauthError='',scopeAllowed=true,failUrl='',intercept=null;
let configId='123-mis-viajes.apps.googleusercontent.com',oauthOptions,oauthRequest;
const remote=new Map(),uploads=[],downloads=[],local=new Map();
globalThis.indexedDB=indexedDB;
globalThis.localStorage={getItem:key=>local.get(key)??null,setItem:(key,value)=>local.set(key,String(value)),removeItem:key=>local.delete(key)};
globalThis.window=new EventTarget();
window.google={accounts:{oauth2:{hasGrantedAllScopes:()=>scopeAllowed,initTokenClient:options=>{
 oauthOptions=options;
 return{requestAccessToken:request=>{oauthRequest=request;queueMicrotask(()=>{
  if(oauthError==='popup')options.error_callback({type:'popup_failed_to_open'});
  else options.callback(oauthError?{error:'access_denied'}:{access_token:'token-'+nextOwner,expires_in:3600,scope:'https://www.googleapis.com/auth/drive.appdata'});
 });}};
}}}};
function seed(owner,id,device,data,seen){
 const snapshot={format:'mis-rutas',version:1,data,...(seen===undefined?{}:{seen})};
 const file={id,name:prefix+device+'-'+(++clock)+'.json',modifiedTime:new Date(clock).toISOString(),snapshot};
 if(!remote.has(owner))remote.set(owner,[]);remote.get(owner).push(file);return file;
}
const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
globalThis.fetch=async(url,init={})=>{
 url=String(url);if(intercept)await intercept(url);
 if(failUrl&&url.includes(failUrl))return response({error:'test failure'},401);
 if(url==='./config.json')return response({googleClientId:configId});
 const owner=new Headers(init.headers).get('Authorization')?.replace('Bearer token-','');
 assert(owner,'Drive calls must be authorized');
 if(url.includes('/about?'))return response({user:{permissionId:owner,emailAddress:owner.toLowerCase()+'@example.com'}});
 const files=remote.get(owner)||[];
 if(url.includes('/upload/')){
  const boundary=new Headers(init.headers).get('Content-Type').split('boundary=')[1];
  const parts=String(init.body).split('--'+boundary).filter(p=>p.includes('Content-Type: application/json'));
  const [metadata,snapshot]=parts.map(p=>JSON.parse(p.slice(p.indexOf('\r\n\r\n')+4).trim()));
  assert.deepEqual(metadata.parents,['appDataFolder']);
  const file=seed(owner,'uploaded-'+(uploads.length+1),local.get('mis-rutas-device'),snapshot.data,snapshot.seen);
  file.name=metadata.name;uploads.push({owner,snapshot});return response({id:file.id});
 }
 if(url.includes('/files?'))return response({files:[...files].sort((a,b)=>b.modifiedTime.localeCompare(a.modifiedTime)).map(({snapshot,...file})=>file)});
 const id=decodeURIComponent(new URL(url).pathname.split('/').at(-1)),file=files.find(f=>f.id===id);
 assert(file,'Never download a snapshot belonging to another account');downloads.push(id);return response(file.snapshot);
};
async function rawDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open('mis-rutas-independent',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function seedLocal(value){const db=await rawDb();await new Promise((resolve,reject)=>{const tx=db.transaction(['notebooks','history'],'readwrite');tx.objectStore('notebooks').clear();tx.objectStore('history').clear();if(value)tx.objectStore('notebooks').put(value,'main');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();local.clear();}
let count=0;
async function test(name,fn){await fn();count++;console.log('PASS '+name);}
try{
 for(const file of ['data.ts','cityContacts.tsx','storage.ts','drive.ts']){
  const code=ts.transpileModule(fs.readFileSync('src/'+file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './$1.mjs'");
  fs.writeFileSync(path.join(temp,file.replace(/\.tsx?$/,'.mjs')),code);
 }
 const store=await import(pathToFileURL(path.join(temp,'storage.mjs'))),drive=await import(pathToFileURL(path.join(temp,'drive.mjs')));
 await store.readNotebook();
 const login=async owner=>{nextOwner=owner;await drive.connectDrive();};
 const sync=async includeLocal=>drive.synchronize(includeLocal,true);
 await test('one published OAuth client works without configuring a new device',async()=>{
  assert(await drive.setupDrive());assert.equal(drive.getDriveClientId(),configId);assert(drive.hasSharedDriveConfiguration());
  await login('A');assert.equal(oauthOptions.client_id,configId);assert.equal(oauthOptions.scope,'https://www.googleapis.com/auth/drive.appdata');assert.equal(oauthRequest.prompt,'select_account');
  assert.equal(drive.getDriveAccount().email,'a@example.com');assert(drive.connected());
  assert(![...local.keys()].some(k=>/token|password/i.test(k)));
 });
 seed('A','old-A',deviceA,trip('A','Nombre anterior'));
 seed('A','new-A',deviceB,trip('A','Mi itinerario actualizado'),['old-A']);
 await test('fresh-device restore reads current itinerary and skips superseded snapshots',async()=>{
  const current=await sync(false);assert.equal(current.account,'A');assert.equal(current.accountEmail,'a@example.com');
  assert.deepEqual(current.data,trip('A','Mi itinerario actualizado'));assert(current.lastSync);assert(!downloads.includes('old-A'));
  const n=uploads.length;await drive.synchronize();assert.equal(uploads.length,n,'idle sync must not create another backup');
 });
 await test('switching accounts keeps each itinerary and pending local edits separate',async()=>{
  const a=await store.readNotebook();await store.writeNotebook(trip('A','Cambio pendiente de A'),a.revision,a.key);
  seed('B','new-B',deviceA,trip('B','Viaje privado de B'),[]);await login('B');const b=await sync(false);
  assert.deepEqual(b.data,trip('B','Viaje privado de B'));assert(uploads.filter(u=>u.owner==='B').every(u=>u.snapshot.data.trips.every(t=>t.id==='B')));
  await login('A');const restored=await sync(false);assert.deepEqual(restored.data,trip('A','Cambio pendiente de A'));
 });
 await test('unassigned local routes are preserved and never uploaded without choosing to add them',async()=>{
  drive.disconnectDrive();await store.useLocalNotebook();let current=await store.readNotebook();await store.writeNotebook(trip('local','Ruta sin cuenta'),current.revision,current.key);
  await login('B');let b=await sync(false);assert(!b.data.trips.some(t=>t.id==='local'));assert(uploads.filter(u=>u.owner==='B').every(u=>!u.snapshot.data.trips.some(t=>t.id==='local')));
  drive.disconnectDrive();current=await store.useLocalNotebook();assert.deepEqual(current.data,trip('local','Ruta sin cuenta'));
  await login('A');const a=await sync(true);assert(a.data.trips.some(t=>t.id==='local'));assert(a.data.trips.some(t=>t.id==='A'));
  drive.disconnectDrive();assert.deepEqual((await store.useLocalNotebook()).data,empty);
 });
 await test('a second device retrieves edits saved by the first device',async()=>{
  await seedLocal();await drive.setupDrive();await login('A');const a=await sync(false);
  assert(a.data.trips.some(t=>t.id==='local'));assert(a.data.trips.some(t=>t.name==='Cambio pendiente de A'));assert(!a.data.trips.some(t=>t.id==='B'));
 });
 await test('stale saves and background sync cannot overwrite a different active account',async()=>{
  const a=await store.readNotebook();await store.activateNotebook('B','b@example.com');const n=uploads.length;
  await assert.rejects(store.writeNotebook(a.data,a.revision,a.key),/otra pestaña/);
  await assert.rejects(drive.synchronize(),/cuenta de la libreta cambió/);assert.equal(uploads.length,n);assert.equal((await store.readNotebook()).account,'B');
  await assert.rejects(store.finishSync(a.revision,a.data,'A',[],a.key),/cambió la cuenta/);
 });
 await test('old linked notebooks migrate without mixing data when connecting another account',async()=>{
  drive.disconnectDrive();await seedLocal({data:trip('legacy','Viaje anterior'),base:empty,dirty:true,revision:4,lastSync:'',account:'A',seen:[]});
  await drive.setupDrive();await login('B');const b=await sync(false);assert(!b.data.trips.some(t=>t.id==='legacy'));
  await login('A');const a=await sync(false);assert(a.data.trips.some(t=>t.id==='legacy'));assert(!a.data.trips.some(t=>t.id==='B'));
  drive.disconnectDrive();assert.deepEqual((await store.useLocalNotebook()).data,empty);
 });
 await test('legacy cloud checkpoints restore the latest version once',async()=>{
  await seedLocal();seed('C','old-C',deviceA,trip('C','Antes'));seed('C','new-C',deviceB,trip('C','Después'));
  await drive.setupDrive();await login('C');assert.deepEqual((await sync(false)).data,trip('C','Después'));
 });
 await test('cancelled Google dialogs and refused permissions leave local data unchanged',async()=>{
  const current=await store.readNotebook();scopeAllowed=false;await assert.rejects(login('A'),/Autoriza/);assert(!drive.connected());scopeAllowed=true;
  oauthError='popup';await assert.rejects(login('A'),/Permite la ventana/);oauthError='access_denied';await assert.rejects(login('A'),/No se concedió/);oauthError='';
  assert.deepEqual((await store.readNotebook()).data,current.data);
 });
 await test('expired access keeps unsynchronized edits and does not mark them saved to Drive',async()=>{
  await login('C');let current=await sync(false);current=await store.writeNotebook(trip('C','Pendiente sin internet'),current.revision,current.key);
  failUrl='/files?';await assert.rejects(drive.synchronize(),/venció/);failUrl='';assert(!drive.connected());
  const after=await store.readNotebook();assert(after.dirty);assert.equal(after.lastSync,current.lastSync);assert.deepEqual(after.data,current.data);
 });
 await test('a disconnect during a download cancels synchronization before upload',async()=>{
  await login('C');seed('C','interrupted',deviceA,trip('C','Cambio remoto'),[]);const n=uploads.length;
  intercept=async url=>{if(url.includes('/files/interrupted?'))drive.disconnectDrive();};
  await assert.rejects(drive.synchronize(),/cuenta cambió/);intercept=null;assert.equal(uploads.length,n);assert((await store.readNotebook()).dirty);
 });
 await test('shared configuration takes priority over a legacy per-device client ID',async()=>{
  local.set('mis-rutas.google-client-id.v1','old.apps.googleusercontent.com');await drive.setupDrive();assert.equal(drive.getDriveClientId(),configId);
  configId='';assert(await drive.setupDrive());assert.equal(drive.getDriveClientId(),'old.apps.googleusercontent.com');
  local.delete('mis-rutas.google-client-id.v1');assert.equal(await drive.setupDrive(),false);await assert.rejects(login('A'),/aún no está activada/);
 });
 console.log(count+' Drive/account tests passed. Google sign-in and Drive responses were simulated.');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
