
let places = [];
let votes = {};
let comments = {};
let currentFilter = "Wszystko";
let map, markers = {};
const cfg = window.APP_CONFIG || {};
const online = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
const db = online ? supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

const voterEl = document.getElementById("voter");
voterEl.value = localStorage.getItem("vietnam-voter") || "";
voterEl.addEventListener("input", () => localStorage.setItem("vietnam-voter", voterEl.value.trim()));

function who() {
  return voterEl.value.trim() || "Anonim";
}
function score(id) {
  return Object.values(votes[id] || {}).reduce((a,b)=>a+Number(b),0);
}
function voteCount(id) {
  return Object.keys(votes[id] || {}).length;
}
function myVote(id) {
  return votes[id]?.[who()];
}

async function loadData() {
  places = await fetch("places.json").then(r => r.json());
  if (online) {
    const [{data:v},{data:c}] = await Promise.all([
      db.from("votes").select("*"),
      db.from("comments").select("*").order("created_at",{ascending:true})
    ]);
    (v||[]).forEach(x => { votes[x.place_id] ||= {}; votes[x.place_id][x.voter] = x.score; });
    (c||[]).forEach(x => { comments[x.place_id] ||= []; comments[x.place_id].push(x); });
  } else {
    votes = JSON.parse(localStorage.getItem("vietnam-votes") || "{}");
    comments = JSON.parse(localStorage.getItem("vietnam-comments") || "{}");
    const warn = document.createElement("div");
    warn.className = "backend-warning";
    warn.innerHTML = "<b>Tryb demo:</b> głosy są zapisane tylko na tym urządzeniu. Podłącz Supabase w <code>config.js</code>, aby znajomi widzieli wspólne wyniki.";
    document.querySelector("main").prepend(warn);
  }
  initMap();
  render();
}

function initMap(){
  map = L.map("map",{scrollWheelZoom:false}).setView([16.2,106.3],5);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
    maxZoom:19, attribution:"© OpenStreetMap"
  }).addTo(map);
  places.forEach(p=>{
    const m=L.marker([p.lat,p.lng]).addTo(map).bindPopup(`<b>${p.name}</b><br>${p.region} • ok. ${p.days} dnia`);
    m.on("click",()=>setTimeout(()=>document.getElementById("place-"+p.id)?.scrollIntoView({behavior:"smooth",block:"center"}),100));
    markers[p.id]=m;
  });
}

async function castVote(id, value){
  const voter=who();
  votes[id] ||= {};
  votes[id][voter]=Number(value);
  if(online){
    await db.from("votes").upsert({place_id:id,voter,score:Number(value)},{onConflict:"place_id,voter"});
  }else{
    localStorage.setItem("vietnam-votes",JSON.stringify(votes));
  }
  render();
}

async function addComment(id, text){
  text=text.trim(); if(!text) return;
  const item={place_id:id,voter:who(),comment:text,created_at:new Date().toISOString()};
  comments[id] ||= []; comments[id].push(item);
  if(online) await db.from("comments").insert(item);
  else localStorage.setItem("vietnam-comments",JSON.stringify(comments));
  render();
}

function render(){
  const sort=document.getElementById("sort").value;
  let list=places.filter(p=>currentFilter==="Wszystko"||p.category===currentFilter);
  list=[...list].sort((a,b)=>{
    if(sort==="score") return score(b.id)-score(a.id);
    if(sort==="days") return a.days-b.days;
    const order={"Północ":0,"Centrum":1,"Południe":2};
    return order[a.region]-order[b.region];
  });
  const cards=document.getElementById("cards");
  cards.innerHTML="";
  list.forEach(p=>{
    const article=document.createElement("article");
    article.className="place-card"; article.id="place-"+p.id;
    const chosen=myVote(p.id);
    article.innerHTML=`
      <img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.style.display='none'">
      <div class="place-body">
        <div class="place-top">
          <div><h3>${p.name}</h3><div class="meta">${p.category} • ${p.region} • ok. ${p.days} dnia</div></div>
          <div class="score">${score(p.id)} pkt</div>
        </div>
        <div class="desc">${p.desc}</div>
        <div class="tags">${p.tags.map(t=>`<span class="tag">${t}</span>`).join("")}</div>
        <div class="vote-row" data-id="${p.id}">
          ${[[3,"🔥"],[2,"👍"],[1,"🤷"],[0,"❌"]].map(([v,e])=>`<button data-score="${v}" class="${chosen===v?"chosen":""}" title="${v} pkt">${e}</button>`).join("")}
        </div>
        <div class="meta">${voteCount(p.id)} os. zagłosowało</div>
        <div class="comment-add">
          <input placeholder="Komentarz o tym miejscu...">
          <button data-comment="${p.id}">Dodaj</button>
        </div>
        <div class="comments">${(comments[p.id]||[]).map(c=>`<div><b>${escapeHtml(c.voter)}:</b> ${escapeHtml(c.comment)}</div>`).join("")}</div>
      </div>`;
    cards.appendChild(article);
  });

  document.querySelectorAll(".vote-row button").forEach(btn=>{
    btn.addEventListener("click",()=>castVote(btn.parentElement.dataset.id,btn.dataset.score));
  });
  document.querySelectorAll("[data-comment]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const input=btn.previousElementSibling;
      addComment(btn.dataset.comment,input.value);
    });
  });
  summary();
}

function summary(){
  const ranked=[...places].sort((a,b)=>score(b.id)-score(a.id));
  const chosen=places.filter(p=>score(p.id)>0);
  const days=chosen.reduce((a,p)=>a+p.days,0);
  const allVotes=Object.values(votes).reduce((a,v)=>a+Object.keys(v).length,0);
  const must=Object.values(votes).reduce((a,v)=>a+Object.values(v).filter(x=>Number(x)===3).length,0);
  document.getElementById("mustCount").textContent=must;
  document.getElementById("selectedCount").textContent=chosen.length;
  document.getElementById("daysCount").textContent=days.toFixed(1);
  document.getElementById("voteCount").textContent=allVotes;
  document.getElementById("ranking").innerHTML=ranked.map((p,i)=>`
    <div class="rank-row"><b>${i+1}.</b><span>${p.name}<small class="meta"> • ${p.region}</small></span><b>${score(p.id)} pkt</b></div>`).join("");
  document.getElementById("routeNote").textContent =
    days>11 ? `Wybrane miejsca to już ok. ${days.toFixed(1)} dnia atrakcji. Przy transferach przekroczycie 14 dni — trzeba ciąć.` :
    `Wybrane miejsca zajmują ok. ${days.toFixed(1)} dnia. Zostaje przestrzeń na transfery i odpoczynek.`;
}

document.querySelectorAll("[data-filter]").forEach(btn=>{
  btn.addEventListener("click",()=>{
    currentFilter=btn.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active"); render();
  });
});
document.getElementById("sort").addEventListener("change",render);

document.getElementById("suggestRoute").addEventListener("click",()=>{
  const order={"Północ":0,"Centrum":1,"Południe":2};
  const ranked=places.filter(p=>score(p.id)>0).sort((a,b)=>score(b.id)-score(a.id));
  let used=0, selected=[];
  for(const p of ranked){
    const transferBuffer = selected.length ? 0.5 : 0;
    if(used+p.days+transferBuffer<=13.5){
      selected.push(p); used+=p.days+transferBuffer;
    }
  }
  selected.sort((a,b)=>order[a.region]-order[b.region]);
  const result = selected.length
    ? selected.map(p=>p.name).join(" → ") + ` • ok. ${used.toFixed(1)} dnia z buforem transferowym`
    : "Najpierw zagłosujcie na kilka miejsc.";
  document.getElementById("routeResult").innerHTML=`<div class="route-path"><b>Propozycja:</b><br>${result}</div>`;
});

function escapeHtml(s=""){return s.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
loadData();
