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
export function consolidateIncompleteContacts(data:Data):Data{
 const phoneKey=(value:string)=>value.replace(/[^+\d]/g,'');
 for(const incomplete of [...(data.cityContacts||[])]){
 if(incomplete.name.trim()||incomplete.address.trim()||!phoneKey(incomplete.phone))continue;
 const candidates=(data.cityContacts||[]).filter(c=>c.id!==incomplete.id&&cityKey(c.city)===cityKey(incomplete.city)&&cityKey(c.company||'')===cityKey(incomplete.company||'')&&phoneKey(c.phone)===phoneKey(incomplete.phone)&&(c.name.trim()||c.address.trim()));
 if(candidates.length!==1)continue;
 const target=candidates[0];
 for(const leg of data.legs)for(const service of leg.services)for(const side of ['origin','destination'] as const){
 const office=side==='origin'?service.originContact:service.destinationContact;
 const legacy=side==='origin'&&!office&&cityKey(leg.from)===cityKey(incomplete.city)&&cityKey(service.company)===cityKey(incomplete.company||'')&&!service.departure.trim()&&phoneKey(service.phone)===phoneKey(incomplete.phone);
 if(office?.id!==incomplete.id&&!legacy)continue;
 const snapshot={id:target.id,name:target.name,phone:target.phone,address:target.address};
 if(side==='origin'){service.originContact=snapshot;service.phone=target.phone;service.departure=target.name;}else service.destinationContact=snapshot;
 }
 data.cityContacts=data.cityContacts?.filter(c=>c.id!==incomplete.id);
 }
 return data;
}
export function repairContactDirectory(data:Data):Data{
 for(const leg of data.legs)for(const service of leg.services)for(const side of ['origin','destination'] as const){
  const city=side==='origin'?leg.from:leg.to,stored=side==='origin'?service.originContact:service.destinationContact;
  const fields={name:stored?.name||(side==='origin'?service.departure:''),phone:stored?.phone||(side==='origin'?service.phone:''),address:stored?.address||''};
  if(!fields.name&&!fields.phone&&!fields.address)continue;
  if(stored?.id&&data.cityContacts?.some(c=>c.id===stored.id&&(cityKey(c.city)!==cityKey(city)||cityKey(c.company||'')!==cityKey(service.company))))continue;
  const matches=(c:CityContact)=>cityKey(c.city)===cityKey(city)&&cityKey(c.company||'')===cityKey(service.company);
  const existing=data.cityContacts?.find(c=>c.id===stored?.id&&matches(c))||data.cityContacts?.find(c=>matches(c)&&cityKey(c.name)===cityKey(fields.name)&&cityKey(c.address)===cityKey(fields.address)&&((!!fields.name||!!fields.address)||c.phone===fields.phone));
  if(existing){existing.name||=fields.name;existing.phone||=fields.phone;existing.address||=fields.address;}
  else{data.cityContacts??=[];const preferred=stored?.id||'office-'+service.id+'-'+side;const id=data.cityContacts.some(c=>c.id===preferred)?'office-'+service.id+'-'+side:preferred;data.cityContacts.push({id,city:city.trim(),company:service.company.trim(),...fields});}
 }
 return consolidateIncompleteContacts(data);
}
export function groupedCityContacts(data:Data){const groups=new Map<string,{city:string,contacts:CityContact[]}>();const companyContacts=data.legs.flatMap(l=>l.services.flatMap(s=>{const origin=s.originContact||{name:s.departure,phone:s.phone||s.whatsapp,address:''};return [{...origin,id:origin.id||'service-origin-'+s.id,city:l.from,company:s.company},...(s.destinationContact?[{...s.destinationContact,id:s.destinationContact.id||'service-destination-'+s.id,city:l.to,company:s.company}]:[])].filter(c=>c.name||c.phone||c.address);}));for(const c of [...(data.cityContacts||[]),...companyContacts.filter(c=>!data.cityContacts?.some(x=>x.id===c.id)&&!data.cityContacts?.some(x=>cityKey(x.city)===cityKey(c.city)&&cityKey(x.company||'')===cityKey(c.company)&&((x.id===c.id)||(cityKey(x.name)===cityKey(c.name)&&cityKey(x.address)===cityKey(c.address)&&((!!c.name||!!c.address)||x.phone===c.phone)))))]){const key=cityKey(c.city),group=groups.get(key)||{city:c.city,contacts:[]};if(!group.contacts.some(x=>cityKey(x.company||'')===cityKey(c.company||'')&&x.name===c.name&&x.phone===c.phone&&x.address===c.address))group.contacts.push(c);groups.set(key,group);}return [...groups.values()].sort((a,b)=>a.city.localeCompare(b.city,'es'));}
export default function CityContactFields({city,value,onChange}:{city:string,value:typeof emptyCityContact,onChange:(value:typeof emptyCityContact)=>void}){return <fieldset className="city-contact-fields"><legend>Lugar · {city.trim()||'Ciudad por indicar'}</legend><p className="muted">Opcional. Se guarda por empresa en esta ciudad.</p><label>Empresa<input maxLength={100} value={value.company} placeholder="Empresa a la que pertenece este contacto" onChange={e=>onChange({...value,company:e.target.value})}/></label><label>Lugar<input maxLength={200} value={value.name} placeholder="Ej. taquilla, terminal, paradero, local norte…" onChange={e=>onChange({...value,name:e.target.value})}/></label><label>Teléfono del lugar<input type="tel" maxLength={50} value={value.phone} placeholder="Número de contacto de la ciudad" onChange={e=>onChange({...value,phone:e.target.value})}/></label><label>Dirección o ubicación<input maxLength={300} value={value.address} placeholder="Dónde queda este lugar" onChange={e=>onChange({...value,address:e.target.value})}/></label></fieldset>;}
