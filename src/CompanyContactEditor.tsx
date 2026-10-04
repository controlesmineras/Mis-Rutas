import {Data,Service} from './data';
import {cityKey,groupedCityContacts} from './cityContacts';
export type Office={id?:string,name:string,phone:string,address:string};
export const emptyOffice:Office={name:'',phone:'',address:''};
export function companyOffices(data:Data,city:string,company:string){return groupedCityContacts(data).find(g=>cityKey(g.city)===cityKey(city))?.contacts.filter(c=>cityKey(c.company||'')===cityKey(company))||[];}
export function serviceOffice(data:Data,service:Service,city:string,side:'origin'|'destination'):Office{
 const saved=side==='origin'?service.originContact:service.destinationContact;
 if(saved){const live=data.cityContacts?.find(c=>c.id===saved.id&&cityKey(c.city)===cityKey(city)&&cityKey(c.company||'')===cityKey(service.company));return live?{...saved,...live,name:live.name||saved.name,phone:live.phone||saved.phone,address:live.address||saved.address}:saved;}
 const offices=companyOffices(data,city,service.company);
 if(side==='origin'&&service.phone){return offices.find(c=>c.phone===service.phone)||{name:service.departure,phone:service.phone,address:''};}
 return offices.length===1?offices[0]:emptyOffice;
}
export default function CompanyContactEditor({data,city,company,value,onChange}:{data:Data,city:string,company:string,value:Office,onChange:(office:Office)=>void}){
 const offices=companyOffices(data,city,company);
 return <fieldset className="city-contact-fields"><legend>Contacto {city}</legend>{offices.length>0&&<label>Lugar de la empresa en {city}<select value={offices.some(c=>c.id===value.id)?value.id:''} onChange={e=>onChange(offices.find(c=>c.id===e.target.value)||{...emptyOffice})}><option value="">Agregar otro lugar</option>{offices.map(c=><option key={c.id} value={c.id}>{c.name||'Lugar sin nombre'}{c.address?' · '+c.address:''}{c.phone?' · '+c.phone:''}</option>)}</select></label>}<p className="muted">{offices.length?'Puedes reutilizar un lugar guardado o registrar otro de la misma empresa.':'Registra el lugar de esta empresa en '+city+'.'}</p><label>Lugar<input maxLength={200} value={value.name} placeholder="Ej. taquilla, terminal, paradero, local norte…" onChange={e=>onChange({...value,name:e.target.value})}/></label><label>Teléfono · {city}<input type="tel" maxLength={50} value={value.phone} placeholder="Teléfono de la empresa en esta ciudad" onChange={e=>onChange({...value,phone:e.target.value})}/></label><label>Dirección o ubicación<input maxLength={300} value={value.address} placeholder="Dirección del lugar" onChange={e=>onChange({...value,address:e.target.value})}/></label></fieldset>;
}
