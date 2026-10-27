/* Buscador conversacional - Leticia Gomez Propiedades. Sin IA, usa la cartera publica. */
(() => {
'use strict';
const root=document.createElement('div');root.id='lg-chat';
const localPreview=location.protocol==='file:' || new URLSearchParams(location.search).has('chatbot_prueba');
const state={step:'type',type:'',op:''};let opened=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const types=[['Casa','casa'],['Departamento','departamento'],['Local comercial','local'],['Terreno o lote','terreno'],['Quinta','quinta'],['Cualquier tipo','cualquiera']];
const ops=[['Comprar','venta'],['Alquilar','alquiler'],['Alquiler temporario','temporario']];
const typeName=t=>types.find(x=>x[1]===t)?.[0]||t;
const opName=o=>ops.find(x=>x[1]===o)?.[0]||o;
function options(title,list,key){return `<div class="lgc-question">${esc(title)}</div><div class="lgc-actions">${list.map(([name,value])=>`<button class="lgc-option" type="button" data-${key}="${esc(value)}">${esc(name)}</button>`).join('')}</div>`}
function match(p){
 if (!p || p.commercialStatus!=='disponible' || p.operation!==state.op) return false;
 if (state.type==='cualquiera')return true;
 const t=String(p.type||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 switch(state.type){case 'terreno':return t.includes('terreno')||t.includes('lote');case 'local':return t.includes('local');case 'departamento':return t.includes('depart');case 'quinta':return t.includes('quinta');case 'casa':return t.includes('casa');default:return t.includes(state.type)}
}
function loadState(){
 const grid=document.getElementById('propertyGrid');
 if(grid?.textContent.includes('No pudimos cargar la cartera'))return 'error';
 if(grid?.textContent.includes('Cargando propiedades'))return 'loading';
 if(typeof properties==='undefined'||!Array.isArray(properties))return 'loading';
 return 'ready';
}
function results(){
 const summary=`${typeName(state.type)} · ${opName(state.op)}`;
 const stateNow=loadState();
 if(stateNow==='loading')return `<div class="lgc-question">Tu búsqueda: ${esc(summary)}</div><p class="lgc-bubble">Estamos cargando la cartera. Volvé a consultar en unos segundos.</p><button class="lgc-primary" data-action="results">Actualizar resultados</button><button class="lgc-secondary" data-action="restart">Otra búsqueda</button>`;
 if(stateNow==='error')return `<div class="lgc-question">Tu búsqueda: ${esc(summary)}</div><p class="lgc-bubble">No pudimos conectarnos a la cartera. Eso no significa que no haya propiedades. Podés probar nuevamente o escribirnos por WhatsApp.</p><button class="lgc-primary" data-action="results">Reintentar</button>`;
 const found=properties.filter(match);
 const items=found.slice(0,12);
 const cards=items.map(p=>{
   const photo=p.photos?.find(f=>f.principal)?.url || p.photos?.[0]?.url || '';
   return `<div class="lgc-mini">${photo?`<img src="${esc(photo)}" alt="Fotografía de la propiedad" loading="lazy" onerror="this.style.display='none'">`:''}<div><strong>${esc(p.title)}</strong><br>${esc(p.zoneLabel||p.address||'')}<br>${esc(p.price)}<br><a href="#propiedad-${encodeURIComponent(String(p.id).toLowerCase())}" data-property="${esc(p.id)}">Ver publicación</a></div></div>`;
 }).join('');
 return `<div class="lgc-question">${esc(summary)}</div><p class="lgc-bubble">${found.length?`Encontré ${found.length} ${found.length===1?'propiedad publicada':'propiedades publicadas'} que ${found.length===1?'coincide':'coinciden'} con tu búsqueda.`:'Por ahora no hay propiedades disponibles publicadas que coincidan con tu búsqueda.'}</p>${cards}${found.length>12?'<p class="lgc-small">Mostramos las primeras 12 opciones.</p>':''}<p class="lgc-small">Disponibilidad, condiciones y valores sujetos a confirmación con Leticia.</p><div class="lgc-actions"><button class="lgc-primary" data-action="lead">${found.length?'Dejar mi búsqueda':'Avisarme si aparece una opción'}</button><button class="lgc-secondary" data-action="restart">Buscar otra propiedad</button></div>`;
}
function lead(){
 const isDemo=localPreview;
 const demoText=isDemo?'<p class="lgc-small" style="padding:8px;border:1px solid #dbbdec;border-radius:8px">MODO PRUEBA: podés completar el formulario, pero NO se enviará ni guardará información.</p>':'';
 return `<div class="lgc-question">Registrá tu búsqueda</div><p class="lgc-bubble">${esc(typeName(state.type))} · ${esc(opName(state.op))}<br>Si ingresa una opción acorde, Leticia podrá contactarte personalmente.</p>${demoText}<form id="lgc-form"><label for="lgc-name">Nombre</label><input class="lgc-field" id="lgc-name" required maxlength="90" autocomplete="name" placeholder="Tu nombre"><label for="lgc-phone">WhatsApp</label><input class="lgc-field" id="lgc-phone" type="tel" required minlength="6" maxlength="35" autocomplete="tel" placeholder="Ej.: 2346 123456"><label for="lgc-more">Detalles adicionales (opcional)</label><textarea class="lgc-field" id="lgc-more" rows="2" maxlength="500" placeholder="Dormitorios, localidad, otras preferencias..."></textarea><label style="display:flex;align-items:start;gap:8px;font-weight:400"><input id="lgc-consent" type="checkbox" required style="margin-top:3px"> Autorizo a Leticia Gómez Propiedades a registrar mi búsqueda y contactarme por este motivo.</label><button class="lgc-primary" type="submit" style="margin-top:12px">${isDemo?'Probar formulario (sin enviar)':'Registrar búsqueda'}</button><p id="lgc-feedback" role="status" aria-live="polite"></p></form><button class="lgc-secondary" type="button" data-action="results">Volver a resultados</button>`;
}

function current(){switch(state.step){case 'type':return options('¿Qué tipo de propiedad buscás?',types,'type');case 'operation':return `<p class="lgc-bubble">${esc(typeName(state.type))}</p>`+options('¿Querés comprar o alquilar?',ops,'op')+'<button class="lgc-secondary" data-action="restart" style="margin-top:10px">Volver</button>';case 'results':return results();case 'lead':return lead();case 'saved':return `<div class="lgc-question">✓ ¡Recibimos tu búsqueda!</div><p class="lgc-bubble">Gracias por confiar en Leticia Gómez Propiedades.<br><br>Registramos tu solicitud. Cuando encontremos una propiedad acorde a lo que buscás, podremos contactarte por WhatsApp.</p><p class="lgc-small">Mientras tanto, podés seguir explorando nuestras propiedades disponibles.</p><button class="lgc-primary" data-action="restart">Buscar otra propiedad</button>`;case 'demoSaved':return `<div class="lgc-question">✓ ¡Prueba completada!</div><p class="lgc-bubble">Así verá el visitante la confirmación de su búsqueda una vez que se haya registrado correctamente.</p><p class="lgc-small">Esta es una simulación: no se enviaron ni guardaron datos.</p><button class="lgc-primary" data-action="restart">Buscar otra propiedad</button>`;default:return ''}}
function render(){
 root.innerHTML=opened?`<section class="lgc-window" role="dialog" aria-label="Asistente inmobiliario"><header class="lgc-header"><div class="lgc-brand"><img src="favicon.png" alt=""><span>Leticia Gómez Propiedades<br><small>Asistente inmobiliario</small></span></div><button class="lgc-close" aria-label="Cerrar chat" type="button">×</button></header><div class="lgc-body"><p class="lgc-bubble">¡Hola! 👋 Te ayudo a encontrar propiedades en nuestra cartera.</p>${current()}</div><footer class="lgc-foot"><a href="https://wa.me/5492346636360?text=${encodeURIComponent('Hola Leticia, quiero hacer una consulta por una propiedad.')}" target="_blank" rel="noopener">¿Preferís hablar con Leticia? Abrir WhatsApp</a></footer></section>`:'<button class="lgc-launch" type="button" aria-label="Abrir asistente inmobiliario">⌂ &nbsp; Buscá tu propiedad ✦</button>';
 root.querySelector('.lgc-launch')?.addEventListener('click',()=>{opened=true;render()});
 root.querySelector('.lgc-close')?.addEventListener('click',()=>{opened=false;render()});
 root.querySelectorAll('[data-type]').forEach(b=>b.addEventListener('click',()=>{state.type=b.dataset.type;state.step='operation';render()}));
 root.querySelectorAll('[data-op]').forEach(b=>b.addEventListener('click',()=>{state.op=b.dataset.op;state.step='results';render()}));
 root.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>{state.step=b.dataset.action==='restart'?'type':b.dataset.action;render()}));
 root.querySelectorAll('[data-property]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();if(typeof showDetail==='function'){showDetail(a.dataset.property);opened=false;render()}}));
 root.querySelector('#lgc-form')?.addEventListener('submit',submit);
}
async function submit(e){e.preventDefault();const f=e.currentTarget;if(!f.reportValidity())return;if(localPreview){const feedback=f.querySelector('#lgc-feedback');feedback.className='lgc-small';feedback.textContent='';state.step='demoSaved';render();return;}const name=f.querySelector('#lgc-name').value.trim(),phone=f.querySelector('#lgc-phone').value.trim(),extra=f.querySelector('#lgc-more').value.trim();if(!name||!phone)return;
 const btn=f.querySelector('button[type=submit]'),feedback=f.querySelector('#lgc-feedback');btn.disabled=true;btn.textContent='Registrando...';
 try{if(typeof db==='undefined')throw Error('Sin conexión a la base de datos');const search=`${opName(state.op)} | Tipo: ${typeName(state.type)} | Detalles: ${extra||'Sin especificar'}`;const {error}=await db.from('web_busquedas_clientes').insert({nombre:name,telefono:phone,busqueda:search,origen:'web',estado:'nueva'});if(error)throw error;state.step='saved';render()}
 catch(err){console.error(err);feedback.className='lgc-error';feedback.textContent='No pudimos guardar tus datos. No se registró la búsqueda: intentá nuevamente o escribinos por WhatsApp.';btn.disabled=false;btn.textContent='Reintentar'}
}
document.addEventListener('DOMContentLoaded',()=>{document.body.appendChild(root);render()});
})();
