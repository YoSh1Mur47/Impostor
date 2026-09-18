document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const screens = ["loading","menu","setup","reveal","vote","result"].reduce((o, k) => { o[k] = $(`${k}-screen`); return o; }, {});
  const state = { categoryKey:null, category:null, playerNames:[], players:[], revealIndex:0, selectedVote:null, discussionSeconds:120, timer:null, timerRunning:false, round:1, startedAt:null, noWordMode:false };
  let settings = JSON.parse(localStorage.getItem("impostor_settings") || '{"sound":true,"theme":"dark"}');
  let stats = JSON.parse(localStorage.getItem("impostor_stats") || "{}");
  let history = JSON.parse(localStorage.getItem("impostor_history") || "[]");

  function saveAll(){ localStorage.setItem("impostor_settings", JSON.stringify(settings)); localStorage.setItem("impostor_stats", JSON.stringify(stats)); localStorage.setItem("impostor_history", JSON.stringify(history)); }
  function showScreen(name){ Object.values(screens).forEach(s=>s.classList.add("hidden")); screens[name].classList.remove("hidden"); window.scrollTo({top:0,behavior:"smooth"}); }
  function escapeHTML(v){ return String(v).replace(/[&<>'"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[c])); }
  function toast(msg){ const t=$("toast"); t.textContent=msg; t.classList.remove("hidden"); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.add("hidden"),2200); }
  function beep(type="tap"){ if(!settings.sound) return; try { const C=window.AudioContext||window.webkitAudioContext; if(!C)return; const c=new C(),o=c.createOscillator(),g=c.createGain(); const f={tap:420,success:660,error:180,flip:520}[type]||420; o.frequency.value=f;o.type="sine";g.gain.setValueAtTime(.0001,c.currentTime);g.gain.exponentialRampToValueAtTime(.06,c.currentTime+.01);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.16);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.17); } catch{} }
  function vibrate(pattern=12){ if(navigator.vibrate) navigator.vibrate(pattern); }
  function feedback(type){ beep(type); vibrate(type==="success"?[20,30,50]:12); }
  function setTheme(){ document.body.dataset.theme=settings.theme; $("theme-btn").textContent=settings.theme==="dark"?"☀️":"🌙"; $("sound-btn").textContent=settings.sound?"🔊":"🔇"; }
  setTheme();

  setTimeout(()=>showScreen("menu"),2100);

  // Tabs
  document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>{ document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active")); btn.classList.add("active"); document.querySelectorAll(".tab-panel").forEach(p=>p.classList.add("hidden")); $(`${btn.dataset.tab}-panel`).classList.remove("hidden"); if(btn.dataset.tab==="stats")renderStats(); if(btn.dataset.tab==="history")renderHistory(); if(btn.dataset.tab==="categories")renderCustomCategories(); }));
  $("theme-btn").addEventListener("click",()=>{settings.theme=settings.theme==="dark"?"light":"dark";setTheme();saveAll();feedback("tap");});
  $("sound-btn").addEventListener("click",()=>{settings.sound=!settings.sound;setTheme();saveAll();if(settings.sound)beep();});

  function renderCategories(){
    const cats=getAllCategories(), grid=$("category-grid"); grid.innerHTML=""; $("category-count").textContent=`${Object.keys(cats).length} temas`;
    Object.entries(cats).forEach(([key,cat])=>{ const card=document.createElement("button"); card.className="category-card"; card.innerHTML=`<span class="category-icon">${escapeHTML(cat.icon)}</span><strong>${escapeHTML(cat.label)}</strong><small>${cat.words.length} palavras</small>`; card.onclick=()=>selectCategory(key); grid.appendChild(card); });
  }
  function selectCategory(key){ state.categoryKey=key; state.category=getAllCategories()[key]; $("setup-category-label").textContent=state.category.label; $("setup-category-icon").textContent=state.category.icon; showScreen("setup"); feedback("tap"); }
  renderCategories();
  $("quick-start-btn").onclick=()=>selectCategory("aleatorias");

  function renderCustomCategories(){ const box=$("custom-category-list"), custom=getStoredCustomCategories(); box.innerHTML=""; const entries=Object.entries(custom); if(!entries.length){box.innerHTML='<div class="empty">Ainda não criaste categorias personalizadas.</div>';return;} entries.forEach(([key,c])=>{ const row=document.createElement("div");row.className="custom-item";row.innerHTML=`<span>${escapeHTML(c.icon)} <strong>${escapeHTML(c.label)}</strong> <small>${c.words.length} palavras</small></span><button class="icon-btn danger" data-delete="${escapeHTML(key)}">🗑️</button>`;box.appendChild(row); }); }
  $("save-category-btn").onclick=()=>{ const name=$("custom-category-name").value.trim(),icon=$("custom-category-icon").value.trim()||"✨",words=$("custom-category-words").value.split("\n").map(x=>x.trim()).filter(Boolean); if(name.length<2||words.length<4){toast("Usa um nome e pelo menos 4 palavras.");return;} const key="custom_"+name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"_")+"_"+Date.now(); const custom=getStoredCustomCategories();custom[key]={label:name,icon,words:[...new Set(words)]};localStorage.setItem("impostor_custom_categories",JSON.stringify(custom));$("custom-category-name").value="";$("custom-category-icon").value="";$("custom-category-words").value="";renderCustomCategories();renderCategories();toast("Categoria criada! ✨");feedback("success");};
  $("clear-category-btn").onclick=()=>[$("custom-category-name"),$("custom-category-icon"),$("custom-category-words")].forEach(x=>x.value="");
  $("custom-category-list").onclick=e=>{const btn=e.target.closest("[data-delete]");if(!btn)return;const custom=getStoredCustomCategories();delete custom[btn.dataset.delete];localStorage.setItem("impostor_custom_categories",JSON.stringify(custom));renderCustomCategories();renderCategories();toast("Categoria eliminada.");};

  const nameInput=$("player-name-input"), playerListEl=$("player-list"), errorEl=$("setup-error");
  function renderPlayers(){ playerListEl.innerHTML=state.playerNames.map((n,i)=>`<li><span><b>${i+1}</b>${escapeHTML(n)}</span><button class="remove-player" data-i="${i}">✕</button></li>`).join(""); }
  function addPlayer(){const n=nameInput.value.trim();if(!n)return;if(state.playerNames.some(x=>x.toLowerCase()===n.toLowerCase())){toast("Esse nome já está na lista.");return;}state.playerNames.push(n);nameInput.value="";renderPlayers();nameInput.focus();feedback("tap");}
  $("add-player-btn").onclick=addPlayer;nameInput.onkeydown=e=>{if(e.key==="Enter")addPlayer();};playerListEl.onclick=e=>{const b=e.target.closest("[data-i]");if(b){state.playerNames.splice(+b.dataset.i,1);renderPlayers();}};
  $("setup-back-btn").onclick=()=>showScreen("menu");

  function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function assignRoles(){ const words=shuffle([...state.category.words]); const main=words[0], alt=words[1]||main; const roles=shuffle(Array(state.playerNames.length).fill("normal").map((x,i)=>i<+$("impostor-count").value?"impostor":x)); return state.playerNames.map((name,i)=>({name,role:roles[i],word:roles[i]==="impostor"?(state.noWordMode?null:alt):main,alive:true})); }
  $("start-reveal-btn").onclick=()=>{const count=+$("impostor-count").value,time=Math.max(0,+$("discussion-time").value||0);if(state.playerNames.length<3){errorEl.textContent="Adiciona pelo menos 3 jogadores.";errorEl.classList.remove("hidden");return;}if(count<1||count>=state.playerNames.length){errorEl.textContent="O número de impostores tem de ser menor que o número de jogadores.";errorEl.classList.remove("hidden");return;}if(state.category.words.length<2){errorEl.textContent="Esta categoria precisa de pelo menos 2 palavras.";errorEl.classList.remove("hidden");return;}errorEl.classList.add("hidden");state.discussionSeconds=time;state.noWordMode=$("no-word-mode").checked;state.players=assignRoles();state.revealIndex=0;state.round=1;state.startedAt=Date.now();showRevealFor(0);showScreen("reveal");feedback("success");};

  function renderRevealProgress(){ $("reveal-progress").innerHTML=state.players.map((_,i)=>`<i class="${i<state.revealIndex?"done":""} ${i===state.revealIndex?"active":""}"></i>`).join(""); }
  function showRevealFor(i) {

  state.revealIndex = i;

  $("current-player-name").textContent =
    state.players[i].name;

  // Garantir que a carta começa sempre fechada
  $("game-card").classList.remove("flipped");

  // Limpar informação anterior
  $("reveal-role").textContent = "";
  $("reveal-word").textContent = "";
  $("reveal-secret").textContent = "";

  // Mostrar botão de revelar
  $("reveal-btn").classList.remove("hidden");

  // Esconder botão de passar
  $("next-player-btn").classList.add("hidden");

  renderRevealProgress();
}
  function revealCurrentCard() {
  const p = state.players[state.revealIndex];

  $("reveal-role").textContent =
    p.role === "impostor"
      ? "🎭 ÉS O IMPOSTOR"
      : "✅ A TUA PALAVRA";

  $("reveal-word").textContent =
    p.word || "SEM PALAVRA";

  $("reveal-secret").textContent =
    p.role === "impostor"
      ? (
          p.word
            ? "Tenta descobrir a palavra sem seres apanhado."
            : "Não tens palavra. Blefa!"
        )
      : "Não mostres esta carta a ninguém.";

  $("game-card").classList.add("flipped");

  $("reveal-btn").classList.add("hidden");
  $("next-player-btn").classList.remove("hidden");

  feedback("flip");
}


// Só a carta / botão de revelar pode revelar.
// O resto do ecrã não faz nada.
$("reveal-btn").onclick = revealCurrentCard;

$("card-front").onclick = revealCurrentCard;


// Passar para o jogador seguinte
$("next-player-btn").onclick = () => {

  // Primeiro fecha a carta
  $("game-card").classList.remove("flipped");

  $("next-player-btn").classList.add("hidden");
  $("reveal-btn").classList.remove("hidden");

  // Espera a animação terminar antes de trocar o jogador
  setTimeout(() => {

    if (state.revealIndex + 1 < state.players.length) {

      showRevealFor(state.revealIndex + 1);

    } else {

      setupVoteScreen();
      showScreen("vote");
      startTimer();

      feedback("tap");
    }

  }, 350);
};
  function formatTime(s){return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;}
  function updateTimer(){ $("timer-display").textContent=formatTime(state.discussionSeconds);$("timer-display").classList.toggle("danger",state.discussionSeconds<=10); }
  function stopTimer(){clearInterval(state.timer);state.timerRunning=false;$("timer-btn").textContent="▶";}
  function startTimer(){stopTimer();state.discussionSeconds=Math.max(0,+$("discussion-time").value||0);updateTimer();if(!state.discussionSeconds)return;state.timerRunning=true;$("timer-btn").textContent="Ⅱ";state.timer=setInterval(()=>{state.discussionSeconds--;updateTimer();if(state.discussionSeconds<=0){stopTimer();feedback("error");toast("Tempo terminado! Votem agora ⏰");}},1000);}
  $("timer-btn").onclick=()=>{if(state.timerRunning)stopTimer();else if(state.discussionSeconds>0){state.timerRunning=true;$("timer-btn").textContent="Ⅱ";state.timer=setInterval(()=>{state.discussionSeconds--;updateTimer();if(state.discussionSeconds<=0){stopTimer();feedback("error");}},1000);}};

  function setupVoteScreen(){const grid=$("vote-grid");grid.innerHTML="";state.selectedVote=null;$("reveal-result-btn").classList.add("hidden");state.players.forEach((p,i)=>{if(!p.alive)return;const c=document.createElement("button");c.className="vote-card";c.innerHTML=`<span class="avatar">${escapeHTML(p.name[0].toUpperCase())}</span><strong>${escapeHTML(p.name)}</strong>`;c.onclick=()=>{document.querySelectorAll(".vote-card").forEach(x=>x.classList.remove("selected"));c.classList.add("selected");state.selectedVote=i;$("reveal-result-btn").classList.remove("hidden");feedback("tap");};grid.appendChild(c);});}
  $("reveal-result-btn").onclick=()=>{if(state.selectedVote===null)return;stopTimer();const voted=state.players[state.selectedVote];voted.alive=false;const aliveImp=state.players.filter(p=>p.alive&&p.role==="impostor").length,aliveNorm=state.players.filter(p=>p.alive&&p.role==="normal").length;const gameOver=aliveImp===0||aliveImp>=aliveNorm;const normals=state.players.filter(p=>p.role==="normal");const word=normals[0]?.word||"—";if(gameOver)finishGame(aliveImp===0,"vote",voted,word);else showIntermediate(voted,word);};

  function ensureStat(name){if(!stats[name])stats[name]={games:0,wins:0,impostorGames:0,impostorWins:0,eliminated:0,points:0};return stats[name];}
  function showIntermediate(voted,word){$("result-icon").textContent=voted.role==="impostor"?"🎯":"😬";$("result-title").textContent=voted.role==="impostor"?"Impostor eliminado!":"Era inocente...";$("result-detail").textContent=`${voted.name} ${voted.role==="impostor"?"era":"não era"} o impostor.`;$("result-word").textContent="";$("points-breakdown").innerHTML="<span>O jogo continua.</span>";$("continue-btn").classList.remove("hidden");$("play-again-btn").classList.add("hidden");$("home-btn").classList.add("hidden");showScreen("result");feedback(voted.role==="impostor"?"success":"error");}
  $("continue-btn").onclick=()=>{state.round++;setupVoteScreen();showScreen("vote");startTimer();};

  function finishGame(normalsWin,reason,voted,word){
    const winner=normalsWin?"Equipa dos jogadores":"Impostores";const now=new Date();const points=[];
    state.players.forEach(p=>{const s=ensureStat(p.name);s.games++;if(p.role==="impostor")s.impostorGames++;let delta=0;if(normalsWin){if(p.role==="normal")delta=p.alive?4:1;else delta=1;}else{if(p.role==="impostor")delta=p.alive?5:2;else delta=p.alive?1:0;}if(voted&&voted.name===p.name){s.eliminated++;if(p.role==="normal")delta=Math.max(0,delta-1);}if((normalsWin&&p.role==="normal")||(!normalsWin&&p.role==="impostor")){s.wins++;if(p.role==="impostor")s.impostorWins++;}s.points+=delta;points.push({name:p.name,delta});});
    history.unshift({date:now.toISOString(),winner,players:state.players.map(p=>p.name),round:state.round,word,reason});history=history.slice(0,30);saveAll();
    $("result-icon").textContent=normalsWin?"🏆":"😈";$("result-title").textContent=normalsWin?"A equipa venceu!":"Os impostores venceram!";$("result-detail").textContent=voted?`${voted.name} foi eliminado. ${voted.role==="impostor"?"Era impostor.":"Era inocente."}`:"Fim da partida.";$("result-word").textContent=`Palavra: ${word}`;$("points-breakdown").innerHTML=`<strong>🔥 Pontos desta partida</strong>${points.sort((a,b)=>b.delta-a.delta).map(x=>`<div><span>${escapeHTML(x.name)}</span><b>+${x.delta}</b></div>`).join("")}`;$("continue-btn").classList.add("hidden");$("play-again-btn").classList.remove("hidden");$("home-btn").classList.remove("hidden");showScreen("result");feedback("success");}
  $("play-again-btn").onclick=()=>{state.players=[];state.round=1;showScreen("setup");};
  $("home-btn").onclick=()=>{stopTimer();renderCategories();renderStats();renderHistory();showScreen("menu");};

  function renderStats(){const box=$("stats-list"), entries=Object.entries(stats).sort((a,b)=>b[1].points-a[1].points);if(!entries.length){box.innerHTML='<div class="empty">Ainda não há estatísticas. Joga a primeira partida! 🎮</div>';return;}box.innerHTML=entries.map(([name,s],i)=>{const winrate=s.games?Math.round(s.wins/s.games*100):0;return `<div class="stat-card"><div class="rank">#${i+1}</div><div class="stat-main"><strong>${escapeHTML(name)}</strong><div class="stat-bar"><span style="width:${winrate}%"></span></div><small>${s.wins}/${s.games} vitórias · ${winrate}% · ${s.impostorWins}/${s.impostorGames} vitórias como impostor</small></div><div class="stat-points"><b>${s.points}</b><small>pontos</small></div></div>`;}).join("");}
  $("reset-stats-btn").onclick=()=>{if(confirm("Repor todas as estatísticas?")){stats={};saveAll();renderStats();toast("Estatísticas repostas.");}};
  function renderHistory(){const box=$("history-list");if(!history.length){box.innerHTML='<div class="empty">Ainda não existem partidas no histórico. 🏆</div>';return;}box.innerHTML=history.map(h=>{const d=new Date(h.date);return `<div class="history-card"><span class="history-icon">${h.winner==="Impostores"?"😈":"🏆"}</span><div><strong>${escapeHTML(h.winner)}</strong><p>${d.toLocaleDateString("pt-PT")} · ${d.toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"})} · ${h.round} ronda${h.round===1?"":"s"}</p><small>${h.players.length} jogadores · Palavra: ${escapeHTML(h.word)}</small></div></div>`;}).join("");}
  $("clear-history-btn").onclick=()=>{if(confirm("Limpar o histórico?")){history=[];saveAll();renderHistory();toast("Histórico limpo.");}};
});
