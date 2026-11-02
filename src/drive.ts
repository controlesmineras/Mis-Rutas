import{dataSchema,Data}from'./data';
import{activateNotebook,readNotebook,finishSync,mergeData}from'./storage';

const scope='https://www.googleapis.com/auth/drive.appdata';
const prefix='mis-rutas-snapshot-';
const CLIENT_KEY='mis-rutas.google-client-id.v1';
type Account={id:string;email:string};
type Backup={id:string;name:string;modifiedTime:string};
type Snapshot={data:Data;seen?:string[]};
let token='',expires=0,clientId='',running=false,session=0,sharedConfiguration=false;
let account:Account|null=null;

function validClientId(id:string){return /^[a-zA-Z0-9._-]+\.apps\.googleusercontent\.com$/.test(id);}
export function getDriveClientId(){return clientId||localStorage.getItem(CLIENT_KEY)||'';}
export function hasSharedDriveConfiguration(){return sharedConfiguration;}
export function getDriveAccount(){return account;}
export function configureDrive(value:string){
 const id=value.trim();
 if(id&&!validClientId(id))throw Error('Ingresa un ID de cliente válido de Google.');
 disconnectDrive();localStorage.setItem(CLIENT_KEY,id);clientId=id;
}
export async function setupDrive(){
 // The deployed client ID is shared by every device. Keep a legacy local ID as a fallback.
 try{
  const r=await fetch('./config.json',{cache:'no-store'});
  if(!r.ok)throw Error('No se pudo cargar la configuración de Google.');
  const config=await r.json(),id=String(config.googleClientId||'').trim();
  if(id&&!validClientId(id))throw Error('La configuración de Google de Mis viajes no es válida.');
  sharedConfiguration=!!id;clientId=id||localStorage.getItem(CLIENT_KEY)||'';
 }catch(error){clientId=localStorage.getItem(CLIENT_KEY)||'';if(!clientId)throw error;}
 return!!clientId;
}
export function connected(){return!!token&&!!account&&Date.now()<expires;}
export function disconnectDrive(){session++;token='';expires=0;account=null;}
export function connectDrive():Promise<Account>{return new Promise((resolve,reject)=>{
 if(running){reject(Error('Espera a que termine la sincronización antes de cambiar de cuenta.'));return;}
 if(!clientId){reject(Error('La conexión con Google aún no está activada para Mis viajes. Tus rutas siguen guardadas en este dispositivo.'));return;}
 const google=(window as any).google;
 if(!google?.accounts?.oauth2){reject(Error('No se pudo cargar Google. Revisa internet y vuelve a abrir la app para conectar tu cuenta.'));return;}
 disconnectDrive();const attempt=session;
 const client=google.accounts.oauth2.initTokenClient({client_id:clientId,scope,include_granted_scopes:false,callback:async(response:any)=>{
  if(attempt!==session){reject(Error('La conexión cambió. Vuelve a conectar Google.'));return;}
  if(response.error||!response.access_token){reject(Error('No se concedió acceso a Google Drive. Puedes volver a conectar tu cuenta.'));return;}
  if(google.accounts.oauth2.hasGrantedAllScopes&&!google.accounts.oauth2.hasGrantedAllScopes(response,scope)){reject(Error('Autoriza el respaldo de Mis viajes en Drive para recuperar tus itinerarios.'));return;}
  token=response.access_token;expires=Date.now()+Number(response.expires_in)*1000-60000;
  try{
   const r=await api('https://www.googleapis.com/drive/v3/about?fields=user(permissionId,emailAddress)');const j=await r.json();
   if(attempt!==session)throw Error('La conexión cambió. Vuelve a conectar Google.');
   if(!j.user?.permissionId)throw Error('No se pudo identificar tu cuenta de Google.');
   account={id:j.user.permissionId,email:j.user.emailAddress||''};resolve(account);
  }catch(error){if(attempt===session)disconnectDrive();reject(error);}
 },error_callback:(error:any)=>reject(Error(error.type==='popup_failed_to_open'?'Permite la ventana de Google en el navegador y vuelve a tocar Conectar con Google.':'Se cerró la ventana de Google. Tus rutas siguen guardadas; puedes volver a conectar.'))});
 // Keep the request in the button's user gesture so Safari can open the Google dialog.
 client.requestAccessToken({prompt:'select_account'});
});}
async function api(url:string,init:RequestInit={}){
 if(!token||Date.now()>=expires)throw Error('Toca Conectar con Google para renovar el acceso. Tus rutas siguen guardadas.');
 const attempt=session;
 const r=await fetch(url,{...init,headers:{...Object.fromEntries(new Headers(init.headers).entries()),Authorization:'Bearer '+token}});
 if(attempt!==session)throw Error('La cuenta cambió durante la operación. Vuelve a sincronizar.');
 if(!r.ok){
  if(r.status===401){disconnectDrive();throw Error('El acceso a Google venció. Conecta de nuevo; tus cambios siguen guardados.');}
  throw Error('Google Drive no pudo completar la operación ('+r.status+'). Tus cambios siguen guardados en el dispositivo.');
 }
 return r;
}
export async function listBackups(){
 let page='';const files:Backup[]=[];
 do{
  const params=new URLSearchParams({spaces:'appDataFolder',q:"trashed = false and name contains '"+prefix+"'",fields:'nextPageToken,files(id,name,modifiedTime)',orderBy:'modifiedTime desc',pageSize:'100',...(page?{pageToken:page}:{})});
  const r=await api('https://www.googleapis.com/drive/v3/files?'+params),j=await r.json();
  files.push(...(j.files||[]));page=j.nextPageToken||'';
 }while(page);
 return files.filter(f=>f.name.startsWith(prefix)).sort((a,b)=>b.modifiedTime.localeCompare(a.modifiedTime));
}
async function readSnapshot(id:string):Promise<Snapshot>{
 const r=await api('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?alt=media'),j=await r.json();
 if(j.format!=='mis-rutas'||j.version!==1)throw Error('La copia de Drive no es compatible.');
 if(j.seen!==undefined&&(!Array.isArray(j.seen)||!j.seen.every((id:unknown)=>typeof id==='string')))throw Error('La copia de Drive está incompleta. Conservamos tus datos locales.');
 return{data:dataSchema.parse(j.data),seen:j.seen};
}
export async function readBackup(id:string):Promise<Data>{return(await readSnapshot(id)).data;}
function deviceId(){let id=localStorage.getItem('mis-rutas-device');if(!id){id=crypto.randomUUID();localStorage.setItem('mis-rutas-device',id);}return id;}
async function upload(data:Data,seen:string[]){
 const boundary='routes_'+crypto.randomUUID(),content=JSON.stringify({format:'mis-rutas',version:1,savedAt:new Date().toISOString(),data,seen});
 const body='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify({name:prefix+deviceId()+'-'+Date.now()+'.json',parents:['appDataFolder']})+'\r\n--'+boundary+'\r\nContent-Type: application/json\r\n\r\n'+content+'\r\n--'+boundary+'--';
 const response=await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body});
 const id=(await response.json()).id;if(typeof id!=='string'||!id)throw Error('Google no confirmó el respaldo. Vuelve a sincronizar.');return id;
}
export async function synchronize(includeLocal=false,switchAccount=false){
 if(running)throw Error('La sincronización ya está en curso.');
 if(!connected())throw Error('Conecta con Google para recuperar y guardar tu itinerario.');
 running=true;const attempt=session,owner=account!;
 const unchanged=()=>{if(attempt!==session)throw Error('La cuenta cambió. Vuelve a conectar Google.');};
 try{
  const current=switchAccount?await activateNotebook(owner.id,owner.email,includeLocal):await readNotebook();unchanged();
  if(current.account!==owner.id)throw Error('La cuenta de la libreta cambió. Conecta Google para volver a elegir tu cuenta.');
  const files=await listBackups(),latest=new Map<string,Backup>();
  for(const file of files){const device=file.name.slice(prefix.length,prefix.length+36);if(!latest.has(device))latest.set(device,file);}
  const covered=new Set(current.seen||[]);let merged=current.data;
  // New snapshots record their ancestors. A new device restores current data instead of merging
  // older versions back into the itinerary. Legacy snapshots are cumulative checkpoints too.
  for(const file of latest.values()){
   if(covered.has(file.id))continue;
   const remote=await readSnapshot(file.id);unchanged();
   merged=mergeData(merged,remote.data,current.base);covered.add(file.id);
   if(remote.seen)for(const id of remote.seen)covered.add(id);
   else for(const older of files)if(older.modifiedTime<=file.modifiedTime)covered.add(older.id);
  }
  const seen=[...new Set([...(current.seen||[]),...files.map(f=>f.id)])];
  // Check the active notebook before uploading, including switches or edits from another tab.
  const latestLocal=await readNotebook();unchanged();
  if(latestLocal.key!==current.key||latestLocal.revision!==current.revision)throw Error('La libreta cambió en otra pestaña. Vuelve a sincronizar.');
  if(current.dirty||!files.length||JSON.stringify(merged)!==JSON.stringify(current.base)){seen.push(await upload(merged,seen));unchanged();}
  return await finishSync(current.revision,merged,owner.id,seen,current.key);
 }finally{running=false;}
}

