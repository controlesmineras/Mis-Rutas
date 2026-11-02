import{Data,dataSchema,initial}from'./data';
import{repairContactDirectory}from'./cityContacts';
export type Notebook={key:string;data:Data;base:Data;dirty:boolean;revision:number;lastSync:string;account?:string;accountEmail?:string;seen?:string[]};
let dbPromise:Promise<IDBDatabase>|null=null;
function database(){return dbPromise??=new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('mis-rutas-independent',1);r.onupgradeneeded=()=>{r.result.createObjectStore('notebooks');r.result.createObjectStore('history',{autoIncrement:true});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('No se pudo abrir el almacenamiento del dispositivo.'));});}
function done(tx:IDBTransaction){return new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||Error('No se pudo guardar en el dispositivo.'));tx.onabort=()=>reject(tx.error||Error('No se pudo guardar en el dispositivo.'));});}
const activeKey='active-notebook';
function emptyNotebook(key='main'):Notebook{return{key,data:structuredClone(initial),base:structuredClone(initial),dirty:false,revision:0,lastSync:'',seen:[]};}
export function hasRoutes(data:Data){return!!(data.trips.length||data.legs.length||data.cityContacts?.length);}
function activeNotebook(store:IDBObjectStore,callback:(key:string)=>void){const r=store.get(activeKey);r.onsuccess=()=>callback(r.result?.key||'main');}
export async function readNotebook():Promise<Notebook>{
 const db=await database();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(['notebooks','history'],'readwrite'),store=tx.objectStore('notebooks');let value:Notebook;
  activeNotebook(store,key=>{const r=store.get(key);
  r.onsuccess=()=>{try{
   if(!r.result){value=emptyNotebook(key);store.put(value,key);return;}
   const previous:Notebook=r.result;
   value={...previous,key,data:repairContactDirectory(dataSchema.parse(previous.data)),base:repairContactDirectory(dataSchema.parse(previous.base))};
   const repaired=JSON.stringify(previous.data)!==JSON.stringify(value.data);
   if(repaired){tx.objectStore('history').add({savedAt:new Date().toISOString(),reason:'contacts-repair',data:previous.data});value.revision=previous.revision+1;value.dirty=true;}
   if(repaired||JSON.stringify(previous.base)!==JSON.stringify(value.base))store.put(value,key);
  }catch(error){reject(error);tx.abort();}};});
  tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('No se pudo cargar el almacenamiento.'));
 });
}
export async function activateNotebook(account:string,accountEmail:string,includeLocal=false){
 const db=await database(),tx=db.transaction(['notebooks','history'],'readwrite'),completion=done(tx),store=tx.objectStore('notebooks'),key='account:'+account;
 activeNotebook(store,currentKey=>{const request=store.get(currentKey);request.onsuccess=()=>{const current:Notebook=request.result||emptyNotebook(currentKey);const select=()=>{const target=store.get(key);target.onsuccess=()=>{
  let value:Notebook=target.result||emptyNotebook(key);
  if(includeLocal&&!current.account&&hasRoutes(current.data))value={...value,data:mergeData(value.data,current.data,initial),dirty:true,revision:value.revision+1};
  if(includeLocal&&!current.account&&hasRoutes(current.data)){tx.objectStore('history').add({...current,savedAt:new Date().toISOString(),reason:'account-link',key:currentKey});store.put(emptyNotebook('main'),'main');}
  store.put({...value,key,account,accountEmail},key);store.put({key},activeKey);
 };};
  // Move an older linked main notebook into its own account slot before any account switch.
  if(currentKey==='main'&&current.account){const legacyKey='account:'+current.account,legacy=store.get(legacyKey);legacy.onsuccess=()=>{if(!legacy.result)store.put({...current,key:legacyKey},legacyKey);tx.objectStore('history').add({...current,savedAt:new Date().toISOString(),reason:'account-migration'});store.put(emptyNotebook('main'),'main');select();};}else select();
 };});
 await completion;return readNotebook();
}
export async function useLocalNotebook(){const current=await readNotebook();if(current.key==='main'&&current.account)await activateNotebook(current.account,current.accountEmail||'');const db=await database(),tx=db.transaction('notebooks','readwrite'),completion=done(tx);tx.objectStore('notebooks').put({key:'main'},activeKey);await completion;return readNotebook();}
export async function writeNotebook(data:Data,revision:number,expectedKey='main'){
 const parsed=dataSchema.parse(data),db=await database(),tx=db.transaction(['notebooks','history'],'readwrite'),completion=done(tx),store=tx.objectStore('notebooks');let conflict=false;
 activeNotebook(store,key=>{if(key!==expectedKey){conflict=true;tx.abort();return;}const r=store.get(key);r.onsuccess=()=>{const previous:Notebook=r.result||emptyNotebook(key);if(previous.revision!==revision){conflict=true;tx.abort();return;}tx.objectStore('history').add({savedAt:new Date().toISOString(),key,data:previous.data});store.put({...previous,data:parsed,dirty:true,revision:revision+1},key);};});
 try{await completion;}catch(e){if(conflict)throw Error('La libreta cambió en otra pestaña. Vuelve a cargar antes de guardar.');throw e;}const next=await readNotebook();window.dispatchEvent(new Event('routes-saved'));return next;
}
export async function finishSync(expected:number,data:Data,account:string,seen:string[],expectedKey:string){
 const db=await database(),tx=db.transaction(['notebooks','history'],'readwrite'),completion=done(tx),store=tx.objectStore('notebooks');let conflict=false;
 activeNotebook(store,key=>{if(key!==expectedKey){conflict=true;tx.abort();return;}const r=store.get(key);r.onsuccess=()=>{const previous:Notebook=r.result;if(!previous||previous.revision!==expected||previous.account!==account){conflict=true;tx.abort();return;}tx.objectStore('history').add({savedAt:new Date().toISOString(),key,data:previous.data});store.put({...previous,data,base:data,dirty:false,revision:expected+1,lastSync:new Date().toISOString(),account,seen},key);};});
 try{await completion;}catch(e){if(conflict)throw Error('Hay cambios nuevos o cambió la cuenta. Sincroniza de nuevo para incluirlos.');throw e;}return readNotebook();
}
function fingerprint(value:unknown){let h=2166136261;for(const c of JSON.stringify(value)){h=Math.imul(h^c.charCodeAt(0),16777619);}return(h>>>0).toString(16);}
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export function mergeData(local:Data,remote:Data,base:Data):Data{
 const result=structuredClone(local);
 for(const incoming of remote.cityContacts||[]){result.cityContacts??=[];const existing=result.cityContacts.find(c=>c.id===incoming.id),old=base.cityContacts?.find(c=>c.id===incoming.id);if(!existing){result.cityContacts.push(structuredClone(incoming));continue;}if(same(existing,incoming)||same(incoming,old))continue;if(same(existing,old)){Object.assign(existing,structuredClone(incoming));continue;}const clone={...incoming,id:incoming.id+'-copy-'+fingerprint(incoming)};if(!result.cityContacts.some(c=>c.id===clone.id))result.cityContacts.push(clone);}
const legMap=new Map<string,string>();
 for(const incoming of remote.legs){const existing=result.legs.find(l=>l.id===incoming.id),old=base.legs.find(l=>l.id===incoming.id);
 if(!existing){result.legs.push(structuredClone(incoming));continue;}if(same(existing,incoming)||same(incoming,old))continue;
 if(same(existing,old)){Object.assign(existing,structuredClone(incoming));continue;}
 const clone={...structuredClone(incoming),id:incoming.id+'-copy-'+fingerprint(incoming)};if(!result.legs.some(l=>l.id===clone.id))result.legs.push(clone);legMap.set(incoming.id,clone.id);
 }
 for(const incoming of remote.trips){const mapped=structuredClone(incoming);let remapped=false;for(const route of mapped.routes)route.legs=route.legs.map(id=>{if(legMap.has(id)){remapped=true;return legMap.get(id)!;}return id;});if(mapped.options)for(const [oldId,newId]of legMap){if(mapped.options[oldId]){mapped.options[newId]=mapped.options[oldId];delete mapped.options[oldId];}}
 const existing=result.trips.find(t=>t.id===incoming.id),old=base.trips.find(t=>t.id===incoming.id);
 if(!existing){result.trips.push(mapped);continue;}
 if(!remapped&&(same(existing,incoming)||same(incoming,old)))continue;
 if(!remapped&&same(existing,old)){Object.assign(existing,mapped);continue;}
 mapped.id=incoming.id+'-copy-'+fingerprint(mapped);mapped.name+=' (otra copia)';if(!result.trips.some(t=>t.id===mapped.id))result.trips.push(mapped);
 }
 return dataSchema.parse(result);
}

