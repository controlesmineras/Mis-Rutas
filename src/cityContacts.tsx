import {Data} from './data';
export const cityKey=(city:string)=>city.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').replace(/\s+/g,' ');
export type CityContact=NonNullable<Data['cityContacts']>[number];
export const emptyCityContact={company:'',name:'',phone:'',address:''};
export function contactForCity(data:Data,city:string,company=''){return data.cityContacts?.find(c=>cityKey(c.city)===cityKey(city)&&cityKey(c.company||'')===cityKey(company));}
export function saveCityContact(data:Data,city:string,fields:typeof emptyCityContact & {id?:string}){const company=fields.company.trim(),name=fields.name.trim(),phone=fields.phone.trim(),address=fields.address.trim();if(!name&&!phone&&!address)return undefined;const existing=data.cityContacts?.find(c=>c.id===fields.id&&cityKey(c.city)===cityKey(city)&&cityKey(c.company||'')===cityKey(company))||data.cityContacts?.find(c=>cityKey(c.city)===cityKey(city)&&cityKey(c.company||'')===cityKey(company)&&cityKey(c.name)===cityKey(name)&&cityKey(c.address)===cityKey(address)&&((!!name||!!address)||c.phone===phone));data.cityContacts??=[];if(existing){Object.assign(existing,{city:city.trim(),company,name,phone,address});return existing;}const entry={id:crypto.randomUUID(),city:city.trim(),company,name,phone,address};data.cityContacts.push(entry);return entry;}
export function updateCityContact(data:Data,original:CityContact|undefined,city:string,fields:typeof emptyCityContact & {id?:string}){
 if(!original)return saveCityContact(data,city,fields);
 const entry=data.cityContacts?.find(c=>c.id===original.id);
 const updated={id:original.id,city:city.trim(),company:fields.company.trim(),name:fields.name.trim(),phone:fields.phone.trim(),address:fields.address.trim()};
 if(entry)Object.assign(entry,updated);else{data.cityContacts??=[];data.cityContacts.push(updated);}
 for(const leg of data.legs)for(const service of leg.services)for(const side of ['origin','destination'] as const){
 const legCity=side==='origin'?leg.from:leg.to,office=side==='origin'?service.originContact:service.destinationContact;
 const linked=office?.id===original.id||cityKey(legCity)===cityKey(original.city)&&cityKey(service.company)===cityKey(original.company||'')&&(office?office.name===original.name&&office.phone===original.phone&&office.address===original.address:side==='origin'&&service.departure===original.name&&service.phone===original.phone&&!original.address);
 if(!linked)continue;
 const snapshot={id:updated.id,name:updated.name,phone:updated.phone,address:updated.address};
 if(side==='origin'){service.originContact=snapshot;service.phone=updated.phone;service.departure=updated.name;}else service.destinationContact=snapshot;
 }
 return entry||updated;
}
const phoneKey=(value:string)=>value.replace(/\D/g,'');
const sameContactScope=(a:CityContact,b:CityContact)=>cityKey(a.city)===cityKey(b.city)&&cityKey(a.company||'')===cityKey(b.company||'');
const sameOfficeFields=(a:{name:string,phone:string,address:string},b:{name:string,phone:string,address:string})=>cityKey(a.name)===cityKey(b.name)&&phoneKey(a.phone)===phoneKey(b.phone)&&cityKey(a.address)===cityKey(b.address);
function mergeContactInto(data:Data,source:CityContact,target:CityContact){
 for(const leg of data.legs)for(const service of leg.services)for(const side of ['origin','destination'] as const){
  const saved=side==='origin'?service.originContact:service.destinationContact;
  const values=saved||(side==='origin'?{name:service.departure,phone:service.phone||service.whatsapp||'',address:''}:undefined);
  const scoped=cityKey(side==='origin'?leg.from:leg.to)===cityKey(source.city)&&cityKey(service.company)===cityKey(source.company||'');
  const unlinked=(!saved?.id||!data.cityContacts?.some(c=>c.id===saved.id))&&scoped&&values&&sameOfficeFields(values,source);
  if(saved?.id!==source.id&&!unlinked)continue;
  const snapshot={id:target.id,name:target.name,phone:target.phone,address:target.address};
  if(side==='origin'){service.originContact=snapshot;service.phone=target.phone;service.departure=target.name;}else service.destinationContact=snapshot;
 }
 data.cityContacts=data.cityContacts?.filter(c=>c!==source);
}
export function consolidateIncompleteContacts(data:Data):Data{
 // Collapse identical offices before deciding whether an incomplete record is ambiguous.
 const unique:CityContact[]=[];
 for(const contact of [...(data.cityContacts||[])]){
  const target=unique.find(c=>sameContactScope(c,contact)&&sameOfficeFields(c,contact));
  if(target)mergeContactInto(data,contact,target);else unique.push(contact);
 }
 for(const incomplete of [...(data.cityContacts||[])]){
  if(incomplete.name.trim()||incomplete.address.trim()||!phoneKey(incomplete.phone))continue;
  const candidates=(data.cityContacts||[]).filter(c=>c.id!==incomplete.id&&sameContactScope(c,incomplete)&&phoneKey(c.phone)===phoneKey(incomplete.phone)&&(c.name.trim()||c.address.trim()));
  if(candidates.length===1)mergeContactInto(data,incomplete,candidates[0]);
 }
 return data;
}
export function repairContactDirectory(data:Data):Data{
 for(const leg of data.legs)for(const service of leg.services)for(const side of ['origin','destination'] as const){
  const city=side==='origin'?leg.from:leg.to,stored=side==='origin'?service.originContact:service.destinationContact;
  const fields={name:stored?.name||(side==='origin'?service.departure:''),phone:stored?.phone||(side==='origin'?(service.phone||service.whatsapp||''):''),address:stored?.address||''};
  if(!fields.name&&!fields.phone&&!fields.address)continue;
  if(stored?.id&&data.cityContacts?.some(c=>c.id===stored.id&&(cityKey(c.city)!==cityKey(city)||cityKey(c.company||'')!==cityKey(service.company))))continue;
  const matches=(c:CityContact)=>cityKey(c.city)===cityKey(city)&&cityKey(c.company||'')===cityKey(service.company);
  const existing=data.cityContacts?.find(c=>c.id===stored?.id&&matches(c))||data.cityContacts?.find(c=>matches(c)&&cityKey(c.name)===cityKey(fields.name)&&cityKey(c.address)===cityKey(fields.address)&&((!!fields.name||!!fields.address)||c.phone===fields.phone));
  if(existing){existing.name||=fields.name;existing.phone||=fields.phone;existing.address||=fields.address;const snapshot={id:existing.id,name:existing.name,phone:existing.phone,address:existing.address};if(side==='origin'){service.originContact=snapshot;service.phone=existing.phone;service.departure=existing.name;}else service.destinationContact=snapshot;}
  else{data.cityContacts??=[];const preferred=stored?.id||'office-'+service.id+'-'+side;const id=data.cityContacts.some(c=>c.id===preferred)?'office-'+service.id+'-'+side:preferred;data.cityContacts.push({id,city:city.trim(),company:service.company.trim(),...fields});}
 }
 return consolidateIncompleteContacts(data);
}
export function groupedCityContacts(data:Data){
 const canonical=repairContactDirectory(structuredClone(data));
 const groups=new Map<string,{city:string,contacts:CityContact[]}>();
 for(const c of canonical.cityContacts||[]){const key=cityKey(c.city),group=groups.get(key)||{city:c.city,contacts:[]};if(!group.contacts.some(x=>cityKey(x.company||'')===cityKey(c.company||'')&&cityKey(x.name)===cityKey(c.name)&&x.phone===c.phone&&cityKey(x.address)===cityKey(c.address)))group.contacts.push(c);groups.set(key,group);}
 return [...groups.values()].sort((a,b)=>a.city.localeCompare(b.city,'es'));
}
export default function CityContactFields({city,value,onChange}:{city:string,value:typeof emptyCityContact,onChange:(value:typeof emptyCityContact)=>void}){return <fieldset className="city-contact-fields"><legend>Lugar · {city.trim()||'Ciudad por indicar'}</legend><p className="muted">Opcional. Se guarda por empresa en esta ciudad.</p><label>Empresa<input maxLength={100} value={value.company} placeholder="Empresa a la que pertenece este contacto" onChange={e=>onChange({...value,company:e.target.value})}/></label><label>Lugar<input maxLength={200} value={value.name} placeholder="Ej. taquilla, terminal, paradero, local norte…" onChange={e=>onChange({...value,name:e.target.value})}/></label><label>Teléfono del lugar<input type="tel" maxLength={50} value={value.phone} placeholder="Número de contacto de la ciudad" onChange={e=>onChange({...value,phone:e.target.value})}/></label><label>Dirección o ubicación<input maxLength={300} value={value.address} placeholder="Dónde queda este lugar" onChange={e=>onChange({...value,address:e.target.value})}/></label></fieldset>;}
