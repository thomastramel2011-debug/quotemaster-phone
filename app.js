const SHARED = { user: "familytermite", password: "quote185" };

document.getElementById("login").addEventListener("submit", (event) => {
  event.preventDefault();
  const ok = document.getElementById("user").value.trim() === SHARED.user
    && document.getElementById("password").value === SHARED.password;
  document.getElementById("err").textContent = ok ? "" : "That login does not match.";
  document.getElementById("quote").classList.toggle("hidden", !ok);
  document.getElementById("login").classList.toggle("hidden", ok);
  if (ok) render();
});

function field(label, id, value) {
  return "<label>" + label + "</label><input id=\"" + id + "\" inputmode=\"decimal\" value=\"" + value + "\">";
}
function yesno(label, id) {
  return "<label>" + label + "</label><select id=\"" + id + "\"><option value=\"0\">No</option><option value=\"1\">Yes</option></select>";
}

function render() {
  const service = document.getElementById("service").value;
  let html = field("Square feet", "sqft", "0");
  if (service === "pretreat" || service === "post") {
    html += yesno("Also quote the yearly termite renewal", "renewal");
    html += yesno("Crawl or raised foundation", "crawl");
    html += field("Outside linear feet", "lnft", "0");
    html += field("Travel miles, one way", "miles", "0");
  }
  if (service === "post") {
    html += field("Drilled or foamed feet", "drill", "0");
    html += yesno("Booster instead (30% off)", "booster");
  }
  if (service === "pest") {
    html += "<label>How often</label><select id=\"freq\"><option value=\"monthly\">Monthly</option><option value=\"bimonthly\">Every other month</option><option value=\"quarterly\">Quarterly</option><option value=\"semiannual\">Every six months</option><option value=\"annual\">Once a year</option><option value=\"onetime\">One-time pest</option></select>" +
      "<p class=\"note\">The contract price on the sheet is per service: $109 up to 2,500 sq ft, then $10 per started 1,000. One-time pest is a separate price on the sheet, not a contract frequency.</p>";
  }
  if (service === "other") {
    html = "<label>Which one</label><select id=\"other\"><option value=\"mosquito\">Mosquito</option><option value=\"rodent\">Rodent stations</option><option value=\"rat\">Rat cleanout</option><option value=\"onetime\">One-time pest</option></select>" +
      "<div id=\"otherfields\"></div>";
  }
  document.getElementById("panel").innerHTML = html;
  const other = document.getElementById("other");
  if (other) {
    const fill = () => {
      const kind = other.value;
      let extra = "";
      if (kind === "mosquito" || kind === "onetime") extra = field("Square feet", "sqft", "0");
      if (kind === "rodent") extra = field("Number of stations", "stations", "0");
      document.getElementById("otherfields").innerHTML = extra;
    };
    other.addEventListener("change", fill);
    fill();
  }
  document.getElementById("out").textContent = "Pick a service, then show the price.";
}

document.getElementById("service").addEventListener("change", render);

function num(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  const n = parseFloat(el.value);
  return Number.isFinite(n) ? n : 0;
}
function on(id) {
  const el = document.getElementById(id);
  return !!(el && el.value === "1");
}
function line(label, amount) {
  return "<div>" + label + " <b>$" + amount.toFixed(2) + "</b></div>";
}

document.getElementById("calc").addEventListener("click", () => {
  const service = document.getElementById("service").value;
  const sqft = num("sqft");
  let html = "";
  if (service === "pretreat") {
    html += line("Pre-treatment", pretreatPrice(sqft));
  }
  if (service === "post") {
    const post = postTreat(num("lnft"), num("drill"));
    html += on("booster") ? line("Booster", money(post * 0.7)) : line("Post-treatment", post);
    html += "<p class=\"note\">Post-treatment uses linear feet, not square feet. Square feet is only for the renewal offer.</p>";
  }
  if (service === "pest") {
    const freq = document.getElementById("freq").value;
    if (freq === "onetime") html += line("One-time pest", oneTime(sqft));
    else html += line("Pest service, each visit", contractPest(sqft));
  }
  if (service === "other") {
    const kind = document.getElementById("other").value;
    if (kind === "mosquito") html += line("Mosquito", mosquito(sqft));
    if (kind === "rodent") html += line("Rodent stations", money(num("stations") * RATES.rodentBox));
    if (kind === "rat") html += line("Rat cleanout", RATES.ratCleanout);
    if (kind === "onetime") html += line("One-time pest", oneTime(sqft));
  }
  if ((service === "pretreat" || service === "post") && on("renewal")) {
    html += line("Yearly renewal", yearlyRenewal(sqft, num("lnft"), on("crawl"), num("miles")));
  }
  document.getElementById("out").innerHTML = html;
});

function setupSign(){
  const c=document.getElementById("sign");
  const ctx=c.getContext("2d");
  ctx.strokeStyle="#1c1915"; ctx.lineWidth=2;
  let draw=false;
  const pos=(e)=>{const r=c.getBoundingClientRect(); const t=e.touches?e.touches[0]:e; return {x:(t.clientX-r.left)*c.width/r.width, y:(t.clientY-r.top)*c.height/r.height};};
  const start=(e)=>{draw=true; const p=pos(e); ctx.beginPath(); ctx.moveTo(p.x,p.y); e.preventDefault();};
  const move=(e)=>{if(!draw)return; const p=pos(e); ctx.lineTo(p.x,p.y); ctx.stroke(); e.preventDefault();};
  c.addEventListener("mousedown", start); c.addEventListener("mousemove", move);
  c.addEventListener("touchstart", start); c.addEventListener("touchmove", move);
  window.addEventListener("mouseup", ()=>draw=false); window.addEventListener("touchend", ()=>draw=false);
  document.getElementById("clearsign").addEventListener("click", ()=>ctx.clearRect(0,0,c.width,c.height));
  const d=document.getElementById("signdate"); if(d && !d.value) d.value=new Date().toISOString().slice(0,10);
}
setupSign();
