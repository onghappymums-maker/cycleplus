// Cycle+ par Happy Mum's — Service Worker v3
const CACHE = 'cycleplus-v10';
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
];

// Installation — met en cache les assets de base
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting()) // force l'activation immédiate
  );
});

// Activation — supprime les vieux caches automatiquement
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim()) // prend le contrôle immédiatement
  );
});

// Fetch — réseau d'abord, cache en fallback
self.addEventListener('fetch', e => {
  // Toujours réseau pour les APIs externes
  if (
    e.request.url.includes('supabase.co') ||
    e.request.url.includes('anthropic.com') ||
    e.request.url.includes('netlify') ||
    e.request.url.includes('dicebear.com') ||
    e.request.url.includes('googleapis.com') ||
    e.request.url.includes('googletagmanager.com') ||
    e.request.url.includes('cdnjs.cloudflare.com')
  ) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

  // Pour index.html — réseau d'abord pour avoir toujours la dernière version
  if (e.request.url.endsWith('/') || e.request.url.includes('index.html')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Pour les autres assets — cache d'abord
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      });
    })
  );
});

// ━━━━━━━━━━ RAPPELS (sans serveur : tout est calculé sur le téléphone) ━━━━━━━━━━
// Lit la copie de secours écrite par l'app (IndexedDB 'cycleplus_backup'), calcule
// la prochaine date de règles et montre au plus un rappel de chaque type.
function idb(){return new Promise((res,rej)=>{const r=indexedDB.open('cycleplus_backup',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
function kvGet(db,k){return new Promise(res=>{const q=db.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>res(q.result||null);q.onerror=()=>res(null);});}
function kvSet(db,k,v){return new Promise(res=>{const tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(v,k);tx.oncomplete=res;tx.onerror=res;});}
const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const pd=s=>new Date(s+'T12:00:00');
const dd=(a,b)=>Math.round((pd(b)-pd(a))/86400000);
const add=(s,n)=>{const d=pd(s);d.setDate(d.getDate()+n);return ymd(d);};

function computeReminders(st,now){
  const today=ymd(now),hour=now.getHours(),out=[];
  if(!st||!st.notifEnabled)return out;
  const en=st.lang==='en',discreet=st.discreet!==false;
  const starts=[...new Set((st.periodDates||[]).filter(s=>/^\d{4}-\d{2}-\d{2}$/.test(s)))].sort();
  const ends=[...new Set((st.periodEnds||[]).filter(s=>/^\d{4}-\d{2}-\d{2}$/.test(s)))].sort();
  if(starts.length){
    const diffs=[];for(let i=1;i<starts.length;i++){const n=dd(starts[i-1],starts[i]);if(n>=15&&n<=60)diffs.push(n);}
    const rec=diffs.slice(-6);
    let len=rec.length?Math.round(rec.reduce((a,b)=>a+b,0)/rec.length):(st.cycleLenDefault||28);len=Math.max(21,Math.min(45,len));
    const lens=starts.map((s,i)=>{const e=ends.find(e=>e>=s&&dd(s,e)<=14&&(!starts[i+1]||e<starts[i+1]));return e?dd(s,e)+1:null;}).filter(Boolean).slice(-6);
    const avgP=lens.length?Math.round(lens.reduce((a,b)=>a+b,0)/lens.length):5;
    const last=starts[starts.length-1];
    const lastEnd=ends.find(e=>e>=last&&dd(last,e)<=14);
    const since=dd(last,today);
    const next=add(last,len);const toNext=dd(today,next);
    if(toNext===2)out.push({tag:'soon-'+next,title:'Cycle+ 🌸',body:discreet?(en?'A little reminder for you 🌸 Open Cycle+.':'Petit rappel pour toi 🌸 Ouvre Cycle+.'):(en?'Your period may start in 2 days. Keep a pad in your bag 🌙':'Tes règles devraient arriver dans 2 jours. Garde une protection dans ton sac 🌙')});
    if(toNext===0)out.push({tag:'due-'+next,title:'Cycle+ 🌸',body:discreet?(en?'A little reminder for you 🌸':'Petit rappel pour toi 🌸'):(en?'Your period may start today. When it does, log it in one tap 🩸':'Tes règles peuvent arriver aujourd\'hui. Quand elles arrivent, note-les en un clic 🩸')});
    if(!lastEnd&&since>=avgP+1&&since<=12)out.push({tag:'end-'+last,title:'Cycle+ 🌸',body:discreet?(en?'Cycle+: a quick question for you 🌸':'Cycle+ : une petite question pour toi 🌸'):(en?'Has your period ended? Log the last day to improve your forecasts 🏁':'Tes règles sont-elles terminées ? Note le dernier jour pour de meilleures prévisions 🏁')});
    if(lastEnd||since>=avgP+1){const late=-toNext;if(late===3)out.push({tag:'late-'+next,title:'Cycle+ 🌸',body:discreet?(en?'Cycle+: take a look when you can 🌸':'Cycle+ : jette un œil quand tu peux 🌸'):(en?'Your period is 3 days late. It happens (stress, fatigue…). Open Cycle+ to log it or learn more.':'Tes règles ont 3 jours de retard. Ça arrive (stress, fatigue…). Ouvre Cycle+ pour les noter ou en savoir plus.')});}
  }
  if(st.journalReminder!==false&&hour>=18&&!(st.journalLog||{})[today])out.push({tag:'journal-'+today,title:'Cycle+ 📓',body:en?'How was your day? Log it in 30 seconds 🌸':'Comment s\'est passée ta journée ? Note-la en 30 secondes 🌸'});
  return out;
}

async function checkReminders(){
  if(self.Notification&&Notification.permission!=='granted')return;
  const db=await idb();const bk=await kvGet(db,'state');if(!bk||!bk.d)return;
  let st;try{st=JSON.parse(bk.d);}catch(e){return;}
  const sent=(await kvGet(db,'sentTags'))||[];
  const list=computeReminders(st,new Date()).filter(r=>!sent.includes(r.tag));
  for(const r of list){
    await self.registration.showNotification(r.title,{body:r.body,tag:r.tag,icon:'icon-192.png',badge:'icon-192.png',data:{url:'./index.html'}});
    sent.push(r.tag);
  }
  await kvSet(db,'sentTags',sent.slice(-60));
}
self.addEventListener('periodicsync',e=>{if(e.tag==='cycle-check')e.waitUntil(checkReminders());});
self.addEventListener('message',e=>{if(e.data&&e.data.type==='check-reminders')e.waitUntil(checkReminders());});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{
    for(const c of cs){if('focus' in c)return c.focus();}
    return self.clients.openWindow('./index.html');
  }));
});
