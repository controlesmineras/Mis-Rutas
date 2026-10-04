import { z } from 'zod';
export const serviceSchema=z.object({id:z.string(),company:z.string().trim().min(1).max(100),times:z.string().max(3000),departures:z.array(z.string().trim().min(1).max(100)).max(30).optional(),days:z.string().max(200),phone:z.string().max(50),whatsapp:z.string().max(50),departure:z.string().max(200),duration:z.string().max(100),fare:z.string().max(100),fareHistory:z.array(z.object({id:z.string(),amount:z.string().trim().min(1).max(100),recordedAt:z.string().max(40)})).optional(),notes:z.string().max(1000),verified:z.string().max(20),companyRating:z.number().int().min(0).max(5).optional()});
export const dataSchema=z.object({cityContacts:z.array(z.object({id:z.string(),city:z.string().trim().min(1).max(100),name:z.string().max(200),phone:z.string().max(50),address:z.string().max(300)})).optional(),trips:z.array(z.object({id:z.string(),name:z.string().trim().min(1),options:z.record(z.enum(['0','1','2']).transform(value=>value==='0'?'1':value)).optional(),routes:z.array(z.object({id:z.string(),name:z.string().trim().min(1),legs:z.array(z.string())})).min(1)})),legs:z.array(z.object({id:z.string(),from:z.string().min(1),to:z.string().min(1),services:z.array(serviceSchema),description:z.string().max(1500).optional(),travelTime:z.string().max(100).optional(),roadRating:z.number().int().min(0).max(5).optional()}))}).refine(d=>d.trips.every(t=>t.routes.every(r=>r.legs.every(id=>d.legs.some(l=>l.id===id)))),'Tramo inexistente');
export type Data=z.infer<typeof dataSchema>;export type Service=z.infer<typeof serviceSchema>;
export type Trip=Data['trips'][number];
export function legOption(trip:Trip,id:string):'1'|'2'{
 const explicit=trip.options?.[id];if(explicit!==undefined)return explicit;
 if(trip.routes.length===1)return '1';
 const memberships=trip.routes.filter(r=>r.legs.includes(id));
 if(memberships.length>1)return '1';
 return trip.routes[0].legs.includes(id)?'1':'2';
}
export function tripLegs(trip:Trip){return [...new Set(trip.routes.flatMap(r=>r.legs))];}
export function visibleLegs(trip:Trip,legs:Data['legs'],selection:number){
 const ids=tripLegs(trip).filter(id=>selection===0||legOption(trip,id)===String(selection));
 if(selection===0||ids.length<2)return ids;
 const remaining=[...ids],result:string[]=[];
 const first=remaining.find(id=>{const l=legs.find(l=>l.id===id)!;return !remaining.some(other=>other!==id&&legs.find(x=>x.id===other)!.to.toLocaleLowerCase('es')===l.from.toLocaleLowerCase('es'));})||remaining[0];
 let cursor=first;
 while(remaining.length){remaining.splice(remaining.indexOf(cursor),1);result.push(cursor);const end=legs.find(l=>l.id===cursor)!.to.toLocaleLowerCase('es');cursor=remaining.find(id=>legs.find(l=>l.id===id)!.from.toLocaleLowerCase('es')===end)||remaining[0];}
 return result;
}
export const initial:Data={trips:[],legs:[]};

export function serviceHours(service:Service):string[]{return service.departures?.length?[...service.departures]:service.times.split(/[,;\n]+/).map(hour=>hour.trim()).filter(Boolean);}
export function normalizeHours(hours:string[]):string[]{return [...new Set(hours.map(hour=>hour.trim()).filter(Boolean))];}
