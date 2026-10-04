import {Service} from './data';
export function fareHistory(service:Service){return service.fareHistory?.length?service.fareHistory:service.fare.trim()?[{id:'legacy-'+service.id,amount:service.fare.trim(),recordedAt:''}]:[];}
export function latestFare(service:Service){return fareHistory(service).at(-1)?.amount||'';}
export function showFare(amount:string){return amount.trim().startsWith('$')?amount.trim():'$ '+amount.trim();}
export function recordFare(previous:Service|undefined,edited:Service,recordedAt:string,id:string):Service{
 const history=previous?fareHistory(previous):[];const amount=edited.fare.trim();
 const next=amount&&amount!==history.at(-1)?.amount?[...history,{id,amount,recordedAt}]:history;
 return {...edited,fare:next.at(-1)?.amount||'',fareHistory:next};
}
