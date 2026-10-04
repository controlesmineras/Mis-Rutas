import{Data,dataSchema,initial}from'./data';
import{repairContactDirectory}from'./cityContacts';
export type Notebook={data:Data;base:Data;dirty:boolean;revision:number;lastSync:string;account?:string;seen?:string[]};
let dbPromise:Promise<IDBDatabase>|null=null;
function database(){return dbPromise??=new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('mis-rutas-independent',1);r.onupgradeneeded=()=>{r.result.createObjectStore('notebooks');r.result.createObjectStore('history',{autoIncrement:true});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('No se pudo abrir el almacenamiento del dispositivo.'));});}
function done(tx:IDBTransaction){return new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||Error('No se pudo guardar en el dispositivo.'));tx.onabort=()=>reject(tx.error||Error('No se pudo guardar en el dispositivo.'));});}
export async function readNotebook():Promise<Notebook>{
 const db=await database();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(['notebooks','history'],'readwrite'),store=tx.objectStore('notebooks'),r=store.get('main');let value:Notebook;
  r.onsuccess=()=>{try{
   if(!r.result){value={data:initial,base:initial,dirty:false,revision:0,lastSync:'',seen:[]};store.put(value,'main');return;}
   const previous:Notebook=r.result;
   value={...previous,data:repairContactDirectory(dataSchema.parse(previous.data)),base:repairContactDirectory(dataSchema.parse(previous.base))};
   const repaired=JSON.stringify(previous.data)!==JSON.stringify(value.data);
   if(repaired){tx.objectStore('history').add({savedAt:new Date().toISOString(),reason:'contacts-repair',data:previous.data});value.revision=previous.revision+1;value.dirty=true;}
   if(repaired||JSON.stringify(previous.base)!==JSON.stringify(value.base))store.put(value,'main');
  }catch(error){reject(error);tx.abort();}};
  tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('No se pudo cargar el almacenamiento.'));
 });
}
export async function writeNotebook(data:Data,revision:number){const db=await database();const tx=db.transaction(['notebooks','history'],'readwrite');const completion=done(tx);const store=tx.objectStore('notebooks');const r=store.get('main');r.onsuccess=()=>{const previous:Notebook=r.result||{data:initial,base:initial,dirty:false,revision:0,lastSync:''};if(previous.revision!==revision){tx.abort();return;}tx.objectStore('history').add({savedAt:new Date().toISOString(),data:previous.data});store.put({...previous,data:dataSchema.parse(data),dirty:true,revision:revision+1},'main');};await completion;const next=await readNotebook();window.dispatchEvent(new Event('routes-saved'));return next;}
export async function finishSync(expected:number,data:Data,account:string,seen:string[]){const db=await database();const tx=db.transaction(['notebooks','history'],'readwrite');const completion=done(tx);const store=tx.objectStore('notebooks');const r=store.get('main');let conflict=false;r.onsuccess=()=>{const previous:Notebook=r.result;if(!previous||previous.revision!==expected){conflict=true;tx.abort();return;}tx.objectStore('history').add({savedAt:new Date().toISOString(),data:previous.data});store.put({...previous,data,base:data,dirty:false,revision:expected+1,lastSync:new Date().toISOString(),account,seen},'main');};try{await completion;}catch(e){if(conflict)throw Error('Hay cambios nuevos en el dispositivo. Sincroniza de nuevo para incluirlos.');throw e;}return readNotebook();}
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
