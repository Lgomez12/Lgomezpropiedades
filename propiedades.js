const SUPABASE_URL = 'https://outbxyxzsmeioujtifhx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_24aKuQhkqN8vew6frRUOrQ_DKxrN7Hb';
const WHATSAPP = '5492346636360';
const STORAGE_BUCKET = 'propiedades';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let properties = [];
let filteredProperties = [];
let currentPhotoIndex = 1;
let carteraMap = null;
let carteraMarkers = null;

function normalizeOp(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v.includes('temporar')) return 'temporario';
  if (v.includes('alquil')) return 'alquiler';
  if (v.includes('vent')) return 'venta';
  return v;
}
function commercialStatus(row) {
  const v = String(row.estado_comercial || row.estado || '').trim().toLowerCase();
  if (v.includes('alquilad')) return 'alquilada';
  if (v.includes('vendid')) return 'vendida';
  return 'disponible';
}
function statusLabel(p) {
  if (p.commercialStatus === 'alquilada') return 'ALQUILADA';
  if (p.commercialStatus === 'vendida') return 'VENDIDA';
  return p.operation === 'venta' ? 'EN VENTA' : p.operation === 'temporario' ? 'TEMPORARIO' : 'EN ALQUILER';
}
function statusColor(p) {
  return p.commercialStatus !== 'disponible' ? 'bg-slate-800 text-white' : 'bg-primary text-white';
}


function storagePublicUrl(path) {
  if (!path) return '';
  const { data } = db.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function normalizeProperty(row) {
  const fotos = Array.isArray(row.web_propiedad_fotos)
    ? row.web_propiedad_fotos.sort((a, b) => (a.orden || 0) - (b.orden || 0))
    : [];

  return {
    uuid: row.id,
    id: row.codigo,
    operation: normalizeOp(row.operacion),
    commercialStatus: commercialStatus(row),
    latitude: row.lat === null || row.lat === undefined ? null : Number(row.lat),
    longitude: row.lng === null || row.lng === undefined ? null : Number(row.lng),
    exactAddressAllowed: row.direccion_visible === true,
    type: row.tipo,
    zone: row.zona_slug,
    zoneLabel: row.zona,
    title: row.titulo,
    address: row.direccion || row.zona || '',
    price: row.precio_texto || 'Consultar valor',
    priceNumber: Number(row.precio_numero || 0),
    currency: row.moneda || '',
    summary: row.resumen || '',
    description: row.descripcion || [],
    amenities: row.caracteristicas || [],
    mapQuery: row.mapa_query || row.direccion || row.zona || 'Chivilcoy, Buenos Aires, Argentina',
    keywords: row.keywords || '',
    photos: fotos.map(f => ({
      url: f.url || storagePublicUrl(f.storage_path),
      alt: f.alt || `${row.titulo} - foto ${f.orden}`,
      orden: f.orden,
      principal: f.es_principal
    })).filter(f => f.url)
  };
}

async function loadProperties() {
  const grid = document.getElementById('propertyGrid');
  grid.innerHTML = `<div class="sm:col-span-2 lg:col-span-3 bg-white rounded-2xl p-8 text-center border border-slate-100 shadow-sm">Cargando propiedades...</div>`;

  try {
    const { data, error } = await db
      .from('web_propiedades')
      .select('*, web_propiedad_fotos(*)')
      .eq('estado', 'publicada')
      .order('orden', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;

    properties = (data || []).map(normalizeProperty);
    filteredProperties = [...properties];
    populateZones();
   filterProperties();

    const hash = location.hash.replace('#propiedad-', '').toUpperCase();
    if (hash) showDetail(hash);
  } catch (error) {
    console.error(error);
    grid.innerHTML = `<div class="sm:col-span-2 lg:col-span-3 bg-white rounded-2xl p-8 text-center border border-slate-100 shadow-sm"><h3 class="text-xl font-bold text-slate-900 mb-2">No pudimos cargar la cartera.</h3><p class="text-slate-600">Revisá la conexión con Supabase o intentá nuevamente.</p></div>`;
  }
}

function populateZones() {
  const zoneFilter = document.getElementById('zoneFilter');
  const zones = [...new Map(properties.map(p => [p.zone, p.zoneLabel])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'es'));
  zoneFilter.innerHTML = '<option value="todas">Todas</option>' + zones.map(([slug, label]) => `<option value="${slug}">${label}</option>`).join('');
}

function mainPhoto(p) {
  if (!p.photos.length) return '';
  const principal = p.photos.find(f => f.principal);
  return principal ? principal.url : p.photos[0].url;
}

function photoPath(id, num) {
  const p = properties.find(x => x.id === id);
  if (!p || !p.photos.length) return '';
  const index = Math.max(0, Math.min((num || 1) - 1, p.photos.length - 1));
  return p.photos[index].url;
}

function handleImageError(img) {
  const shell = img.closest('.photo-shell');
  if (shell) shell.classList.add('is-empty');
}

function renderCards() {
  const grid = document.getElementById('propertyGrid');
  const sort = document.getElementById('sortFilter') ? document.getElementById('sortFilter').value : 'recientes';
  let items = [...filteredProperties];

  if (sort === 'menor') items.sort((a,b) => (a.priceNumber || 999999999) - (b.priceNumber || 999999999));
  if (sort === 'mayor') items.sort((a,b) => (b.priceNumber || 0) - (a.priceNumber || 0));

  grid.innerHTML = items.map(p => cardTemplate(p)).join('');
  document.getElementById('resultCount').textContent = `${items.length} ${items.length === 1 ? 'propiedad' : 'propiedades'}`;
  document.getElementById('noResults').classList.toggle('hidden', items.length !== 0);
  
}

function cardTemplate(p) {
  const image = mainPhoto(p);
  const photoText = p.photos.length ? `${p.photos.length} fotos` : 'Fotos pendientes';
  return `
    <article class="bg-white rounded-2xl shadow-md overflow-hidden card-hover border border-slate-100">
      <button onclick="showDetail('${p.id}')" class="block w-full text-left">
        <div class="photo-shell relative h-60 overflow-hidden ${image ? '' : 'is-empty'}">
          <img src="${image}" alt="${escapeHtml(p.title)}" class="w-full h-full object-cover" onerror="handleImageError(this)">
          <div class="photo-error absolute inset-0 items-center justify-center text-center p-4 text-slate-500 text-sm">Espacio para foto principal<br>${p.id}</div>
          <span class="absolute top-3 left-3 bg-white text-primary text-xs font-bold px-3 py-1 rounded-full shadow">${photoText}</span><span class="absolute top-3 right-3 ${statusColor(p)} text-xs font-bold px-3 py-1 rounded-full shadow">${statusLabel(p)}</span>
        </div>
      </button>
      <div class="p-5">
        <div class="flex justify-between items-center mb-3"><span class="text-sm font-semibold text-primary">${statusLabel(p)}</span><span class="text-sm text-slate-500">Cód. ${p.id}</span></div>
        <h2 class="text-xl font-bold text-slate-900 mb-2">${escapeHtml(p.title)}</h2>
        <p class="text-slate-600 text-sm mb-3">${escapeHtml(p.address)}</p>
        <p class="text-slate-600 text-sm mb-4">${escapeHtml(p.summary)}</p>
        <div class="text-2xl font-bold text-slate-900 mb-4">${escapeHtml(p.price)}</div>
        <div class="grid grid-cols-2 gap-3 mb-3 no-print">
          <button onclick="toggleLike('${p.id}', this)" class="border border-primary text-primary hover:bg-primary hover:text-white font-semibold py-3 rounded-lg transition-all">${isLiked(p.id) ? '♥' : '♡'} Me gusta</button>
          <button onclick="shareProperty('${p.id}')" class="border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold py-3 rounded-lg transition-all">Compartir</button>
        </div>
        <button onclick="showDetail('${p.id}')" class="w-full border border-primary text-primary hover:bg-primary hover:text-white font-semibold py-3 rounded-lg transition-all mb-3">Ver publicación</button>
        <a href="${waLink(p.id)}" class="block text-center bg-secondary hover:bg-green-600 text-white font-semibold py-3 rounded-lg transition-all">${p.commercialStatus === 'disponible' ? 'Consultar por' : 'Consultar sobre'} ${p.id}</a>
      </div>
    </article>`;
}

function filterProperties() {
  const search = document.getElementById('searchInput').value.toLowerCase().trim();
  const op = document.getElementById('operationFilter').value;
  const type = document.getElementById('typeFilter').value;
  const zone = document.getElementById('zoneFilter').value;
  const currency = document.getElementById('currencyFilter').value;
  const minPrice = Number(document.getElementById('minPriceFilter').value || 0);
  const maxPrice = Number(document.getElementById('maxPriceFilter').value || 0);
  const amenity = document.getElementById('amenityFilter').value.toLowerCase().trim();

  filteredProperties = properties.filter(p => {
    const text = `${p.id} ${p.title} ${p.address} ${p.summary} ${p.keywords} ${p.amenities.join(' ')}`.toLowerCase();
    const priceOk = (!minPrice || p.priceNumber >= minPrice) && (!maxPrice || (p.priceNumber > 0 && p.priceNumber <= maxPrice));
    return (!search || text.includes(search)) && (!amenity || text.includes(amenity)) && priceOk && (currency === 'todas' || p.currency === currency) && (op === 'todas' || normalizeOp(p.operation) === op) && (type === 'todos' || p.type === type) && (zone === 'todas' || p.zone === zone);
  });
  renderCards();
}

function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('operationFilter').value = 'todas';
  document.getElementById('typeFilter').value = 'todos';
  document.getElementById('zoneFilter').value = 'todas';
  document.getElementById('currencyFilter').value = 'todas';
  document.getElementById('minPriceFilter').value = '';
  document.getElementById('maxPriceFilter').value = '';
  document.getElementById('amenityFilter').value = '';
  filteredProperties = [...properties];
  renderCards();
}

function showDetail(id) {
  const p = properties.find(x => x.id === id);
  if (!p) return;
  currentPhotoIndex = 1;
  document.getElementById('listView').classList.add('hidden');
  const detail = document.getElementById('detailView');
  detail.classList.remove('hidden');
  detail.innerHTML = detailTemplate(p);
  updateMainPhoto(p.id, 1);
  history.replaceState(null, '', `#propiedad-${p.id.toLowerCase()}`);
  document.getElementById('cartera').scrollIntoView({ behavior:'smooth' });
}

function backToList() {
  document.getElementById('detailView').classList.add('hidden');
  document.getElementById('listView').classList.remove('hidden');
  history.replaceState(null, '', '#cartera');
  document.getElementById('cartera').scrollIntoView({ behavior:'smooth' });
}

function detailTemplate(p) {
  const image = mainPhoto(p);
  const thumbs = p.photos.length
    ? p.photos.map((f, i) => `<button onclick="updateMainPhoto('${p.id}', ${i+1})" id="thumb-${i+1}" class="h-16 sm:h-20 rounded-lg border border-slate-200 bg-slate-100 text-xs text-slate-500 hover:border-primary overflow-hidden"><img src="${f.url}" alt="${escapeHtml(f.alt)}" class="w-full h-full object-cover"></button>`).join('')
    : `<div class="col-span-5 sm:col-span-10 text-sm text-slate-500 bg-slate-100 rounded-lg p-4">Fotos pendientes de cargar en Supabase Storage.</div>`;

  return `
  <div class="max-w-6xl mx-auto">
    <button onclick="backToList()" class="no-print mb-6 text-primary font-semibold hover:underline">← Volver a la cartera</button>
    <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-8 mb-8">
      <div class="mb-3 inline-flex rounded-full px-4 py-2 text-xs font-bold ${statusColor(p)}">${statusLabel(p)}</div>
      <div class="flex flex-col lg:flex-row lg:justify-between gap-4 mb-6">
        <div>
          <div class="flex items-center gap-3 mb-3"><span class="inline-flex bg-primary text-white text-sm font-bold px-4 py-2 rounded-full capitalize">${p.operation}</span><span class="text-slate-500 font-medium">Código ${p.id}</span></div>
          <h1 class="text-3xl sm:text-4xl font-bold text-slate-900 mb-2">${escapeHtml(p.title)}</h1>
          <p class="text-slate-600 text-base sm:text-lg">${escapeHtml(p.address)}</p>
        </div>
        <div class="lg:text-right">
          <div class="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">${escapeHtml(p.price)}</div>
          <div class="flex lg:justify-end gap-3 no-print"><button onclick="toggleLike('${p.id}', this)" class="border border-primary text-primary hover:bg-primary hover:text-white font-semibold px-4 py-2 rounded-lg transition-all">${isLiked(p.id) ? '♥' : '♡'} Me gusta</button><button onclick="shareProperty('${p.id}')" class="border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold px-4 py-2 rounded-lg transition-all">Compartir</button></div>
        </div>
      </div>

      <div class="photo-shell relative rounded-2xl overflow-hidden h-[320px] sm:h-[520px] mb-4 ${image ? '' : 'is-empty'}">
        <img id="mainDetailPhoto" src="${image}" alt="${escapeHtml(p.title)}" class="w-full h-full object-contain bg-slate-100" onerror="handleImageError(this)">
        <div class="photo-error absolute inset-0 items-center justify-center text-center p-4 text-slate-500 text-lg">Foto pendiente de cargar<br>${p.id}</div>
        <button onclick="prevPhoto('${p.id}')" class="no-print absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 rounded-full w-11 h-11 shadow text-2xl">‹</button>
        <button onclick="nextPhoto('${p.id}')" class="no-print absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 rounded-full w-11 h-11 shadow text-2xl">›</button>
      </div>
      <div class="no-print grid grid-cols-5 sm:grid-cols-10 gap-2 mb-8">${thumbs}</div>

      <div class="grid lg:grid-cols-3 gap-8">
        <div class="lg:col-span-2">
          <h2 class="text-xl font-bold text-slate-900 mb-4">Descripción</h2>
          <div class="space-y-3 text-slate-600 leading-relaxed mb-8">${p.description.map(x=>`<p>${escapeHtml(x)}</p>`).join('')}</div>
          <div class="grid sm:grid-cols-2 gap-4 mb-8">
            <div class="border-b border-slate-200 py-3 flex justify-between"><span class="text-slate-500">Tipo</span><strong class="text-slate-900 capitalize">${p.type}</strong></div>
            <div class="border-b border-slate-200 py-3 flex justify-between"><span class="text-slate-500">Operación</span><strong class="text-slate-900">${statusLabel(p)}</strong></div>
            <div class="border-b border-slate-200 py-3 flex justify-between"><span class="text-slate-500">Código</span><strong class="text-slate-900">${p.id}</strong></div>
            <div class="border-b border-slate-200 py-3 flex justify-between"><span class="text-slate-500">Valor</span><strong class="text-slate-900">${escapeHtml(p.price)}</strong></div>
          </div>
          <h2 class="text-xl font-bold text-slate-900 mb-4">Dónde está</h2>
          <div class="rounded-2xl overflow-hidden border border-slate-200 mb-3 bg-slate-100"><iframe title="Mapa ${p.id}" src="https://maps.google.com/maps?q=${encodeURIComponent(p.mapQuery)}&output=embed" class="w-full h-80 border-0" loading="lazy"></iframe></div>
          <p class="text-sm text-slate-600 mb-8">${escapeHtml(p.address)}</p>
          <h2 class="text-xl font-bold text-slate-900 mb-4">Características</h2>
          <div class="flex flex-wrap gap-2 mb-8">${p.amenities.map(a=>`<span class="bg-slate-100 text-slate-700 px-4 py-2 rounded-full text-sm">${escapeHtml(a)}</span>`).join('')}</div>
        </div>
        <aside class="lg:col-span-1">
          <div class="sticky top-28 bg-slate-50 rounded-2xl border border-slate-100 p-5 no-print">
            <h2 class="text-xl font-bold text-slate-900 mb-2">Consultá por esta propiedad</h2>
            <p class="text-slate-600 text-sm mb-5">Completá tus datos o escribinos directamente por WhatsApp.</p>
            <a href="${waLink(p.id)}" class="block text-center bg-secondary hover:bg-green-600 text-white font-semibold py-3 rounded-lg transition-all mb-4">Escribir por WhatsApp</a>
            <form onsubmit="sendFormToWhatsapp(event, '${p.id}')" class="space-y-3">
              <div><label class="block text-sm font-semibold mb-1">Nombre</label><input id="formName" class="w-full border border-slate-300 rounded-lg px-3 py-2" required></div>
              <div><label class="block text-sm font-semibold mb-1">Teléfono</label><input id="formPhone" class="w-full border border-slate-300 rounded-lg px-3 py-2" required></div>
              <div><label class="block text-sm font-semibold mb-1">Email <span class="font-normal">(opcional)</span></label><input id="formEmail" type="email" class="w-full border border-slate-300 rounded-lg px-3 py-2"></div>
              <div><label class="block text-sm font-semibold mb-1">Consulta <span class="font-normal">(opcional)</span></label><textarea id="formMsg" rows="4" class="w-full border border-slate-300 rounded-lg px-3 py-2" placeholder="Cuándo podrías visitarla, qué querés saber..."></textarea></div>
              <button class="w-full bg-primary hover:bg-purple-800 text-white font-semibold py-3 rounded-lg transition-all">Enviar mis datos</button>
            </form>
          </div>
        </aside>
      </div>
    </div>
  </div>`;
}

function updateMainPhoto(id, num) {
  currentPhotoIndex = num;
  const img = document.getElementById('mainDetailPhoto');
  if (!img) return;
  const p = properties.find(x => x.id === id);
  if (!p || !p.photos.length) return;
  const shell = img.closest('.photo-shell');
  if (shell) shell.classList.remove('is-empty');
  img.src = photoPath(id, num);
  for (let i=1;i<=p.photos.length;i++) {
    const thumb = document.getElementById(`thumb-${i}`);
    if (thumb) thumb.className = `h-16 sm:h-20 rounded-lg border ${i===num?'border-primary ring-2 ring-primary/20':'border-slate-200'} bg-slate-100 text-xs text-slate-500 hover:border-primary overflow-hidden`;
  }
}

function nextPhoto(id){ const p = properties.find(x => x.id === id); if (!p || !p.photos.length) return; updateMainPhoto(id, currentPhotoIndex === p.photos.length ? 1 : currentPhotoIndex + 1); }
function prevPhoto(id){ const p = properties.find(x => x.id === id); if (!p || !p.photos.length) return; updateMainPhoto(id, currentPhotoIndex === 1 ? p.photos.length : currentPhotoIndex - 1); }
function waLink(id) { return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Hola Leticia, quisiera consultar por la propiedad ' + id + '.')}`; }

async function sendFormToWhatsapp(event, id) {
  event.preventDefault();
  const p = properties.find(x => x.id === id);
  const name = document.getElementById('formName').value;
  const phone = document.getElementById('formPhone').value;
  const email = document.getElementById('formEmail').value;
  const msg = document.getElementById('formMsg').value;

  await db.from('web_consultas_propiedad').insert({ propiedad_id: p ? p.uuid : null, codigo_propiedad: id, nombre: name, telefono: phone, email: email || null, consulta: msg || null, origen: 'web' });

  const text = `Hola Leticia, quisiera consultar por la propiedad ${id}.\n\nNombre: ${name}\nTeléfono: ${phone}\nEmail: ${email || '-'}\nConsulta: ${msg || '-'}`;
  window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`, '_blank');
  event.target.reset();
}

async function savePropertySearch(event) {
  event.preventDefault();
  const form = event.target;
  const button = document.getElementById('searchSubmit');
  const feedback = document.getElementById('searchFeedback');
  const name = document.getElementById('searchName').value.trim();
  const phone = document.getElementById('searchPhone').value.trim();
  const need = document.getElementById('searchNeed').value.trim();
  if (!name || !phone || !need) return;
  button.disabled = true;
  button.textContent = 'Registrando...';
  feedback.textContent = '';
  try {
    const { error } = await db.from('web_busquedas_clientes').insert({
      nombre: name, telefono: phone, busqueda: need, origen: 'web', estado: 'nueva'
    });
    if (error) throw error;
    feedback.className = 'mt-3 text-sm font-semibold text-green-700';
    feedback.textContent = '¡Listo! Registramos tu búsqueda. Te contactaremos cuando tengamos una opción acorde.';
    form.reset();
  } catch (error) {
    console.error('Error al registrar la búsqueda:', error);
    feedback.className = 'mt-3 text-sm font-semibold text-red-700';
    feedback.textContent = 'No pudimos registrar la búsqueda. Volvé a intentar o escribinos desde Contacto.';
  } finally {
    button.disabled = false;
    button.textContent = 'Registrar mi búsqueda';
  }
}

function isLiked(id) { return localStorage.getItem('lgp_liked_' + id) === '1'; }
function toggleLike(id, btn) { const key = 'lgp_liked_' + id; const liked = localStorage.getItem(key) === '1'; localStorage.setItem(key, liked ? '0' : '1'); btn.textContent = liked ? '♡ Me gusta' : '♥ Me gusta'; }
async function shareProperty(id) { const url = `${location.origin}${location.pathname}#propiedad-${id.toLowerCase()}`; const p = properties.find(x => x.id === id); const data = { title: `${p.title} · ${p.id}`, text: `${p.title} - ${p.price} - ${p.address}`, url }; if (navigator.share) { try { await navigator.share(data); } catch(e) {} } else { await navigator.clipboard.writeText(url); alert('Copiamos el enlace de la publicación para compartir.'); } }
function escapeHtml(text) { return String(text || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }


function initMenu() {
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const menuIcon = document.getElementById('menu-icon');
  const closeIcon = document.getElementById('close-icon');
  const mobileLinks = mobileMenu.querySelectorAll('a');
  mobileMenuBtn.addEventListener('click', () => { mobileMenu.classList.toggle('active'); menuIcon.classList.toggle('hidden'); closeIcon.classList.toggle('hidden'); });
  mobileLinks.forEach(link => link.addEventListener('click', () => { mobileMenu.classList.remove('active'); menuIcon.classList.remove('hidden'); closeIcon.classList.add('hidden'); }));
  document.addEventListener('click', (e) => { if (!mobileMenu.contains(e.target) && !mobileMenuBtn.contains(e.target) && mobileMenu.classList.contains('active')) { mobileMenu.classList.remove('active'); menuIcon.classList.remove('hidden'); closeIcon.classList.add('hidden'); } });
}

document.addEventListener('DOMContentLoaded', () => {
  initMenu();
  document.getElementById('searchInput').addEventListener('keyup', (e) => { if (e.key === 'Enter') filterProperties(); });
  ['operationFilter','typeFilter','zoneFilter','currencyFilter','minPriceFilter','maxPriceFilter'].forEach(id => document.getElementById(id).addEventListener('change', filterProperties));
  loadProperties();
});
