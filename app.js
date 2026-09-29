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
    html += "<label>How often</label><select id=\"freq\">" +
      "<option value=\"monthly\">Monthly</option>" +
      "<option value=\"bimonthly\">Every other month</option>" +
      "<option value=\"quarterly\">Quarterly</option>" +
      "<option value=\"semiannual\">Every six months</option>" +
      "<option value=\"annual\">Once a year</option>" +
      "<option value=\"onetime\">One-time pest</option></select>" +
      "<p class=\"note\">The contract price on the sheet is per service: $109 up to 2,500 sq ft, then $10 per started 1,000. One-time pest is a separate price on the sheet, not a contract frequency.</p>";
  }
  if (service === "other") {
    html = "<label>Which one</label><select id=\"other\">" +
      "<option value=\"mosquito\">Mosquito</option>" +
      "<option value=\"rodent\">Rodent stations</option>" +
      "<option value=\"rat\">Rat cleanout</option>" +
      "<option value=\"onetime\">One-time pest</option></select>" +
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

function quoteLines() {
  const service = document.getElementById("service").value;
  const sqft = num("sqft");
  const lines = [];
  let note = "";
  if (service === "pretreat") lines.push(["Pre-treatment", pretreatPrice(sqft)]);
  if (service === "post") {
    const post = postTreat(num("lnft"), num("drill"));
    lines.push(on("booster") ? ["Booster", money(post * 0.7)] : ["Post-treatment", post]);
    note = "Post-treatment uses linear feet, not square feet. Square feet is only for the renewal offer.";
  }
  if (service === "pest") {
    const freq = document.getElementById("freq").value;
    if (freq === "onetime") lines.push(["One-time pest", oneTime(sqft)]);
    else lines.push(["Pest service, each visit", contractPest(sqft)]);
  }
  if (service === "other") {
    const kind = document.getElementById("other").value;
    if (kind === "mosquito") lines.push(["Mosquito", mosquito(sqft)]);
    if (kind === "rodent") lines.push(["Rodent stations", money(num("stations") * RATES.rodentBox)]);
    if (kind === "rat") lines.push(["Rat cleanout", RATES.ratCleanout]);
    if (kind === "onetime") lines.push(["One-time pest", oneTime(sqft)]);
  }
  if ((service === "pretreat" || service === "post") && on("renewal")) {
    lines.push(["Yearly renewal", yearlyRenewal(sqft, num("lnft"), on("crawl"), num("miles"))]);
  }
  return { lines, note };
}

function showPrice() {
  const quote = quoteLines();
  let html = quote.lines.map((row) => line(row[0], row[1])).join("");
  if (quote.note) html += "<p class=\"note\">" + quote.note + "</p>";
  document.getElementById("out").innerHTML = html || "Pick a service, then show the price.";
  return quote;
}

document.getElementById("calc").addEventListener("click", showPrice);

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

function dollars(amount) {
  const n = Number(amount) || 0;
  return "$" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function serviceTitle() {
  const service = document.getElementById("service").value;
  if (service === "pretreat") return "Pre-treatment";
  if (service === "post") return on("booster") ? "Post-treatment booster" : "Post-treatment";
  if (service === "pest") {
    const freq = document.getElementById("freq").value;
    const names = { monthly: "monthly", bimonthly: "every other month", quarterly: "quarterly", semiannual: "every six months", annual: "once a year" };
    return freq === "onetime" ? "One-time pest" : "Pest service, " + names[freq];
  }
  const names = { mosquito: "Mosquito", rodent: "Rodent stations", rat: "Rat cleanout", onetime: "One-time pest" };
  return names[document.getElementById("other").value];
}

function detailLines() {
  const rows = [];
  const add = (label, id, suffix) => {
    const el = document.getElementById(id);
    if (!el) return;
    rows.push(label + ": " + (el.value || "0") + (suffix || ""));
  };
  add("Square feet", "sqft");
  add("Outside linear feet", "lnft");
  add("Drilled or foamed feet", "drill");
  add("Travel miles, one way", "miles");
  add("Stations", "stations");
  const crawl = document.getElementById("crawl");
  if (crawl) rows.push("Crawl or raised foundation: " + (crawl.value === "1" ? "Yes" : "No"));
  const renewal = document.getElementById("renewal");
  if (renewal) rows.push("Yearly termite renewal: " + (renewal.value === "1" ? "Yes" : "No"));
  return rows;
}

function signatureBlank() {
  const c = document.getElementById("sign");
  const data = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return false;
  return true;
}

function signaturePng() {
  const src = document.getElementById("sign");
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, 0, 0);
  return c.toDataURL("image/jpeg", 0.72);
}

function agreementText(quote) {
  const name = document.getElementById("cname").value.trim();
  const lines = quote.lines.map((row) => row[0] + " " + dollars(row[1]));
  const subtotal = money(quote.lines.reduce((sum, row) => sum + row[1], 0));
  const tax = money(subtotal * RATES.taxRate);
  const total = money(subtotal + tax);
  return [
    "Family Termite service agreement",
    name,
    document.getElementById("caddress").value.trim(),
    document.getElementById("cphone").value.trim(),
    serviceTitle(),
    lines.join("; "),
    "Subtotal " + dollars(subtotal),
    "Sales tax 7% " + dollars(tax),
    "Total " + dollars(total)
  ].filter(Boolean).join("\n");
}

let agreementBlob = null;
let agreementName = "Family-Termite-Agreement.pdf";

function buildAgreementPdf(quote) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const left = 54;
  const width = 504;
  let y = 64;
  const write = (text, size, bold) => {
    doc.setFont("times", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const parts = doc.splitTextToSize(text, width);
    doc.text(parts, left, y);
    y += parts.length * (size + 3) + 4;
  };
  write("Family Termite", 20, true);
  write("Service agreement", 14, true);
  write("Customer: " + document.getElementById("cname").value.trim(), 12, false);
  write("Address: " + document.getElementById("caddress").value.trim(), 12, false);
  write("Telephone: " + document.getElementById("cphone").value.trim(), 12, false);
  const email = document.getElementById("cemail").value.trim();
  if (email) write("Email: " + email, 12, false);
  write("Service: " + serviceTitle(), 12, true);
  detailLines().forEach((row) => write(row, 11, false));
  y += 6;
  write("Quoted price", 13, true);
  const subtotal = money(quote.lines.reduce((sum, row) => sum + row[1], 0));
  const tax = money(subtotal * RATES.taxRate);
  const total = money(subtotal + tax);
  quote.lines.forEach((row) => write(row[0] + "  " + dollars(row[1]), 12, false));
  write("Subtotal  " + dollars(subtotal), 12, false);
  write("Sales tax 7%  " + dollars(tax), 12, false);
  write("Total  " + dollars(total), 14, true);
  if (quote.note) write(quote.note, 10, false);
  y += 8;
  write("Customer signature", 12, true);
  const png = signaturePng();
  doc.addImage(png, "JPEG", left, y, 280, 74);
  y += 86;
  const printed = document.getElementById("signname").value.trim() || document.getElementById("cname").value.trim();
  const date = document.getElementById("signdate").value || "";
  write("Printed name: " + printed, 12, false);
  write("Date: " + date, 12, false);
  write("The customer agrees to the service and the total price above at the address shown.", 11, false);
  write("A copy of this agreement goes to the office at office@family-termite.com.", 11, false);
  agreementBlob = doc.output("blob");
  const safe = document.getElementById("cname").value.trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "customer";
  agreementName = "Family-Termite-Agreement-" + safe + ".pdf";
}

function downloadAgreement() {
  if (!agreementBlob) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(agreementBlob);
  a.download = agreementName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function pdfFile() {
  return new File([agreementBlob], agreementName, { type: "application/pdf" });
}

async function shareAgreement() {
  const file = pdfFile();
  if (!navigator.canShare || !navigator.canShare({ files: [file] })) return false;
  try {
    await navigator.share({
      files: [file],
      title: "Family Termite service agreement",
      text: "Family Termite service agreement is attached."
    });
    return "shared";
  } catch (error) {
    if (error && error.name === "AbortError") return "cancelled";
    return false;
  }
}

function setSendNote(text) {
  document.getElementById("sendnote").textContent = text;
  document.getElementById("sendbox").classList.remove("hidden");
}

document.getElementById("agree").addEventListener("click", () => {
  const name = document.getElementById("cname").value.trim();
  const address = document.getElementById("caddress").value.trim();
  const phone = document.getElementById("cphone").value.trim();
  const email = document.getElementById("cemail").value.trim();
  if (!name || !address || !phone || !email) {
    setSendNote("Fill in the customer name, address, phone, and email first.");
    return;
  }
  if (signatureBlank()) {
    setSendNote("The customer needs to sign before this can go out.");
    return;
  }
  const quote = showPrice();
  if (!quote.lines.length) {
    setSendNote("Show a price before sending the agreement.");
    return;
  }
  buildAgreementPdf(quote);
  setSendNote("Agreement is ready. Email or text sends it to the customer and always copies office@family-termite.com.");
});

document.getElementById("dlpdf").addEventListener("click", downloadAgreement);

const OFFICE = "office@family-termite.com";

function mailtoOfficeAndCustomer(quote) {
  const email = document.getElementById("cemail").value.trim();
  const body = agreementText(quote) + "\n\nThe PDF downloaded on this phone. Attach that file. This message always copies the office.";
  return "mailto:" + encodeURIComponent(email) + "?cc=" + encodeURIComponent(OFFICE) + "&subject=" + encodeURIComponent("Family Termite service agreement") + "&body=" + encodeURIComponent(body);
}

function mailtoOfficeCopy(quote) {
  const name = document.getElementById("cname").value.trim();
  const body = "Office copy. This agreement was also sent to the customer.\n\n" + agreementText(quote) + "\n\nThe PDF downloaded on this phone. Attach " + agreementName + ".";
  return "mailto:" + encodeURIComponent(OFFICE) + "?subject=" + encodeURIComponent("Office copy: " + name) + "&body=" + encodeURIComponent(body);
}

document.getElementById("emailpdf").addEventListener("click", () => {
  if (!agreementBlob) return;
  downloadAgreement();
  const quote = quoteLines();
  window.location.href = mailtoOfficeAndCustomer(quote);
  setSendNote("The PDF downloaded. Email opens to the customer and always copies office@family-termite.com. Attach the PDF before you send.");
});

document.getElementById("textpdf").addEventListener("click", () => {
  if (!agreementBlob) return;
  downloadAgreement();
  const quote = quoteLines();
  const phone = document.getElementById("cphone").value.replace(/[^\d+]/g, "");
  const textBody = "Family Termite service agreement is in the PDF that just downloaded. Please attach it to this text.";
  window.open(mailtoOfficeCopy(quote));
  window.location.href = "sms:" + phone + "?&body=" + encodeURIComponent(textBody);
  setSendNote("The PDF downloaded. The office copy opens to office@family-termite.com, then the customer text. Attach the PDF to both.");
});
