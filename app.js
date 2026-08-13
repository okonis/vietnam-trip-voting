
let places = [];
let votes = {};
let comments = {};
let currentFilter = "Wszystko";
let map, markers = {};
const cfg = window.APP_CONFIG || {};
const supabaseKey = cfg.SUPABASE_PUBLISHABLE_KEY || cfg.SUPABASE_ANON_KEY || "";
const online = !!(cfg.SUPABASE_URL && supabaseKey);
const db = online ? supabase.createClient(cfg.SUPABASE_URL, supabaseKey) : null;
let realtimeChannel = null;

const voterEl = document.getElementById("voter");
voterEl.value = localStorage.getItem("vietnam-voter") || "";
voterEl.addEventListener("input", () => localStorage.setItem("vietnam-voter", voterEl.value.trim()));

function who() {
  return voterEl.value.trim();
}
function requireName(){
  const name = who();
  if(name) return name;
  voterEl.focus();
  alert("Najpierw wpisz swoje imię, żeby głos był przypisany do Ciebie.");
  return null;
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
    warn.innerHTML = "<b>Tryb lokalny:</b> głosy są zapisane tylko na tym urządzeniu. Po podłączeniu Supabase wszyscy znajomi będą widzieć wspólny ranking i komentarze w czasie rzeczywistym.";
    document.querySelector("main").prepend(warn);
  }
  initMap();
  render();
  if(online) subscribeRealtime();
}

function subscribeRealtime(){
  realtimeChannel = db.channel("trip-live")
    .on("postgres_changes", {event:"*", schema:"public", table:"votes"}, async () => {
      const {data} = await db.from("votes").select("*");
      votes = {};
      (data||[]).forEach(x => { votes[x.place_id] ||= {}; votes[x.place_id][x.voter] = x.score; });
      render();
    })
    .on("postgres_changes", {event:"INSERT", schema:"public", table:"comments"}, payload => {
      const x = payload.new;
      comments[x.place_id] ||= [];
      if(!(comments[x.place_id]||[]).some(c=>c.id===x.id)) comments[x.place_id].push(x);
      render();
    })
    .subscribe();
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
  const voter=requireName();
  if(!voter) return;
  votes[id] ||= {};
  votes[id][voter]=Number(value);
  if(online){
    const {error} = await db.from("votes").upsert({place_id:id,voter,score:Number(value),updated_at:new Date().toISOString()},{onConflict:"place_id,voter"});
    if(error){ alert("Nie udało się zapisać głosu: " + error.message); return; }
  }else{
    localStorage.setItem("vietnam-votes",JSON.stringify(votes));
  }
  render();
}

async function addComment(id, text){
  text=text.trim(); if(!text) return;
  const voter=requireName(); if(!voter) return;
  const item={place_id:id,voter,comment:text,created_at:new Date().toISOString()};
  comments[id] ||= [];
  if(!online) comments[id].push(item);
  if(online){
    const {error} = await db.from("comments").insert(item);
    if(error){ alert("Nie udało się dodać komentarza: " + error.message); return; }
  } else localStorage.setItem("vietnam-comments",JSON.stringify(comments));
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


const experiences={
special:[
["☕","Kultura kawy","Wypij cà phê sữa đá z mlekiem skondensowanym, egg coffee w Hanoi i kawę przygotowaną przez metalowy filtr phin. Wietnam jest jednym z wielkich krajów kawowych świata."],
["🧵","Ubranie szyte na miarę w Hoi An","Hoi An słynie z krawców. Możecie wybrać materiał, zrobić pomiary i odebrać koszulę, spodnie, sukienkę albo garnitur podczas pobytu."],
["🍳","Cooking class + targ","Najlepsza wersja zaczyna się na lokalnym targu: kupujecie zioła i produkty, a później wspólnie gotujecie kilka regionalnych dań."],
["🛵","Easy Rider","Zamiast prowadzić samemu, jedziesz jako pasażer z lokalnym kierowcą. Szczególnie dobry sposób na Ha Giang i górskie drogi."],
["💆","Wietnamski masaż / spa","Po trekkingu albo kilku dniach na motorze warto spróbować lokalnego masażu, często łączącego akupresurę i pracę na stopach."],
["🚂","Reunification Express","Choć część trasy warto przelecieć, jeden odcinek pociągiem daje widoki na wybrzeże, pola i małe miejscowości. Szczególnie ciekawy jest rejon przełęczy Hai Van."],
["🛶","Życie na wodzie","Kajak w Lan Ha, łódź w Trang An albo mała łódź w Delcie Mekongu — woda jest jednym z najlepszych sposobów poznawania krajobrazu Wietnamu."],
["🏠","Homestay na północy","Nocleg poza dużym miastem w Ha Giang, Pu Luong lub okolicach Sa Pa pozwala zobaczyć zupełnie inny rytm życia niż w Hanoi."]
],
food:[
["🍜","Phở","Zacznij od północnej wersji w Hanoi: klarowny, długo gotowany bulion, makaron ryżowy i wołowina lub kurczak. Najbardziej wietnamskie śniadanie."],
["🔥","Bún chả","Hanoi: grillowana wieprzowina, makaron bun, mnóstwo ziół i słodko-kwaśny sos. Jeden z obowiązkowych street-foodów północy."],
["🥖","Bánh mì","Chrupiąca bagietka z pâté, mięsem, piklami, kolendrą i chilli. Warto próbować różnych wersji w kilku regionach."],
["🌶️","Bún bò Huế","Pikantna, intensywna zupa z trawą cytrynową i wołowiną. Zupełnie inna od delikatniejszego phở."],
["🥢","Cao lầu","Specjalność Hoi An: sprężysty makaron, wieprzowina, zioła i chrupiące dodatki. Najlepiej jeść właśnie tutaj."],
["🥞","Bánh xèo","Chrupiący wietnamski naleśnik z krewetkami lub wieprzowiną, kiełkami i ziołami, zawijany w liście i maczany w sosie."],
["🍚","Cơm tấm","Klasyk południa: broken rice z grillowaną wieprzowiną, jajkiem i sosem rybnym. Idealny w Sajgonie."],
["🥟","Bánh bèo i pierożki z Hue","Małe, precyzyjne przekąski pokazujące bardziej „cesarską” stronę kuchni centralnego Wietnamu."],
["🍮","Chè / bánh flan","Wietnamskie słodkości są pełne kokosa, tapioki, fasoli, owoców i lodu. Bánh flan pokazuje też francuskie wpływy."],
["🥭","Owoce tropikalne","Mangostan, rambutan, dragon fruit, jackfruit, longan i świeże kokosy. Najlepiej próbować na targach i w Delcie Mekongu."],
["🍺","Bia hơi","Świeże, lekkie piwo lane w prostych ulicznych lokalach. Bardziej doświadczenie społeczne niż degustacja kraftu."],
["🐟","Seafood","Na wybrzeżu i wyspach zamawiajcie świeże ryby, kalmary, małże i krewetki — szczególnie Da Nang, Quy Nhon i Phu Quoc."]
],
unique:[
["🪑","Usiąść na plastikowym stołeczku","Zamiast szukać tylko restauracji z TripAdvisora, wybierzcie zatłoczony lokal uliczny z małymi stołkami i jednym daniem specjalności."],
["🌅","Wstać przed miastem","O 5–6 rano Wietnam już żyje: ćwiczenia nad jeziorem, targi, śniadaniowe phở i kawa. To zupełnie inna twarz Hanoi czy Sajgonu."],
["🏮","Hoi An po zmroku","Lampiony, rzeka i nocne uliczki są najbardziej klimatyczne po zachodzie słońca. Warto zostać, gdy jednodniowe wycieczki zaczynają wyjeżdżać."],
["🏍️","Road trip zamiast transferu","Hai Van Pass albo Ha Giang pokazują, że w Wietnamie sama droga może być atrakcją, nie tylko sposobem przemieszczania."],
["🦇","Wejść głęboko do jaskini","Phong Nha pozwala wybrać od turystycznej jaskini do całodniowej lub wielodniowej ekspedycji przez dżunglę i podziemne rzeki."],
["🤿","Zanurkować na południu","Styczeń jest dobrym momentem na Phu Quoc. Można zrobić Discover Scuba dla początkujących albo normalne nurkowania certyfikowane."],
["🛍️","Targ zamiast galerii","Targi to jednocześnie jedzenie, owoce, przyprawy, tekstylia i codzienne życie. Warto wejść bez konkretnej listy zakupów."],
["🛕","Wejść do lokalnej świątyni","Nie ograniczajcie się do największych zabytków. Małe pagody i świątynie pozwalają zobaczyć codzienną religijność i rytuały."],
["🧺","Kupić lokalne rzemiosło","Tekstylia z północy, ceramika, lakierowane wyroby, kawa, herbata lotosowa czy lampiony są ciekawszą pamiątką niż typowy magnes."]
],
january:[
["🧧","Przed-Tếtowy klimat","Tết 2027 przypada 6 lutego, więc przy wyjeździe w drugiej połowie stycznia możecie zobaczyć narastające przygotowania: dekoracje, kwiaty, kumkwaty, zakupy i porządki przed najważniejszym świętem roku."],
["🌸","Targi kwiatowe przed Tết","Im bliżej lutego, tym więcej kwiatów i ozdobnych drzewek pojawia się w miastach. Hanoi kojarzy Tết z kwitnącą brzoskwinią, południe z żółtym mai."],
["🥮","Sezonowe jedzenie","Przed Tết pojawiają się tradycyjne produkty, m.in. bánh chưng — kleisty ryż z fasolą mung i mięsem zawijany w liście."],
["🧥","Północ będzie zimowa","Hanoi może być chłodne i wilgotne, a Ha Giang/Sa Pa znacznie zimniejsze. To nie jest tropikalny styczeń w całym kraju — ciepłe warstwy są potrzebne."],
["🤿","Południe na finał","Południe jest ciepłe, a styczeń dobrze pasuje do Phu Quoc. Dlatego układ góry → centrum → plaża/nurkowanie ma klimatycznie dużo sensu."]
]};

let currentExp="special";
function renderExperiences(){
 const box=document.getElementById("experienceCards"); if(!box)return;
 box.innerHTML=experiences[currentExp].map(x=>`<article class="experience-card"><div class="exp-icon">${x[0]}</div><h3>${x[1]}</h3><p>${x[2]}</p></article>`).join("");
}
document.querySelectorAll(".exp-tab").forEach(b=>b.addEventListener("click",()=>{
 currentExp=b.dataset.exp; document.querySelectorAll(".exp-tab").forEach(x=>x.classList.remove("active")); b.classList.add("active"); renderExperiences();
}));
renderExperiences();
