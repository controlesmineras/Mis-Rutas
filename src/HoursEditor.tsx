import {useRef,useState} from 'react';
import {Grip,ChevronUp,ChevronDown,Plus,Trash2} from 'lucide-react';
export function moveHour(hours:string[],from:number,to:number){if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=hours.length||to>=hours.length||from===to)return hours;const next=[...hours];const [hour]=next.splice(from,1);next.splice(to,0,hour);return next;}
export default function HoursEditor({hours,onChange}:{hours:string[],onChange:(hours:string[])=>void}){
 const container=useRef<HTMLDivElement>(null),drag=useRef<{index:number,original:string[]}|null>(null),latest=useRef(hours);latest.current=hours;
 const [dragging,setDragging]=useState<number|null>(null);
 function move(from:number,to:number){onChange(moveHour(latest.current,from,to));}
 return <div className="hours-editor" ref={container}>
 <p className="card-label">HORARIOS</p>{!hours.length&&<p className="muted">Sin horarios. Puedes agregar uno cuando lo necesites.</p>}<p className="hours-help">Arrastra los cuadritos o usa los botones para ordenar.</p>
 {hours.map((hour,index)=><div className={'hour-row'+(dragging===index?' hour-dragging':'')} key={index} data-hour-index={index}>
 <label>{index===0?'Hora':'Hora '+(index+1)}<input type="text" maxLength={100} value={hour} placeholder="Ej. 3:30–4:00 p. m." onChange={e=>onChange(latest.current.map((value,i)=>i===index?e.target.value:value))}/></label>
 <div className="hour-controls">
 <button type="button" className="hour-grip" aria-label={'Mover horario '+(index+1)} title="Arrastrar para ordenar" disabled={hours.length<2}
 onKeyDown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();move(index,index+(e.key==='ArrowUp'?-1:1));}}}
 onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);drag.current={index,original:[...latest.current]};setDragging(index);}}
 onPointerMove={e=>{if(!drag.current)return;const hit=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-hour-index]');if(hit&&container.current?.contains(hit)){const target=Number(hit.dataset.hourIndex);if(target!==drag.current.index){const next=moveHour(latest.current,drag.current.index,target);latest.current=next;onChange(next);drag.current.index=target;setDragging(target);}}const panel=container.current?.closest<HTMLElement>('.modal');if(panel){const bounds=panel.getBoundingClientRect();if(e.clientY<bounds.top+65)panel.scrollTop-=18;else if(e.clientY>bounds.bottom-65)panel.scrollTop+=18;}}}
 onPointerUp={()=>{drag.current=null;setDragging(null);}}
 onPointerCancel={()=>{if(drag.current)onChange(drag.current.original);drag.current=null;setDragging(null);}}
 onLostPointerCapture={()=>{drag.current=null;setDragging(null);}}><Grip size={22}/></button>
 <div className="hour-arrows"><button type="button" className="icon" disabled={index===0} aria-label={'Subir horario '+(index+1)} onClick={()=>move(index,index-1)}><ChevronUp size={19}/></button><button type="button" className="icon" disabled={index===hours.length-1} aria-label={'Bajar horario '+(index+1)} onClick={()=>move(index,index+1)}><ChevronDown size={19}/></button></div>
 <button type="button" className="delete-hour" aria-label={'Eliminar horario '+(index+1)} onClick={()=>onChange(latest.current.filter((_,i)=>i!==index))}><Trash2 size={18}/></button>
 </div></div>)}
 <button type="button" className="secondary" disabled={hours.length>=30} onClick={()=>onChange([...latest.current,''])}><Plus size={17}/>Agregar horario</button>
 </div>;
}
