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
    html += field("Inside Linear Footage", "inln", "0");
    html += field("Pier Linear Footage", "pierln", "0");
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
    const linear = num("lnft") + num("inln") + num("pierln");
    const post = postTreat(linear, num("drill"));
    lines.push(on("booster") ? ["Booster", money(post * 0.7)] : ["Post-treatment", post]);
    note = "Post-treatment is outside, inside, and pier linear feet at the sheet rate, plus drilled or foamed feet. Square feet is only for the renewal. Pre-treatment stays on square feet.";
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
  add("Inside Linear Footage", "inln");
  add("Pier Linear Footage", "pierln");
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

function pdfEscape(text) {
  return String(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapPdfLine(text, size) {
  const max = Math.max(24, Math.floor(504 / (size * 0.5)));
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = "";
  words.forEach((word) => {
    const next = cur ? cur + " " + word : word;
    if (next.length > max && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = next;
    }
  });
  if (cur || !lines.length) lines.push(cur);
  return lines;
}

function dataUrlToBytes(dataUrl) {
  const b64 = String(dataUrl).split(",")[1] || "";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) & 255;
  return bytes;
}

function jpegInfo(bytes) {
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) break;
    const marker = bytes[i + 1];
    if (marker === 0xd8 || marker === 0xd9) { i += 2; continue; }
    const len = (bytes[i + 2] << 8) + bytes[i + 3];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return {
        height: (bytes[i + 5] << 8) + bytes[i + 6],
        width: (bytes[i + 7] << 8) + bytes[i + 8],
        components: bytes[i + 9]
      };
    }
    if (!len) break;
    i += 2 + len;
  }
  throw new Error("The signature image could not be read.");
}

function pdfDocument(content, jpeg, info) {
  const chunks = [];
  let pos = 0;
  const offsets = [];
  const add = (part) => {
    chunks.push(part);
    pos += part.length;
  };
  const obj = (body) => {
    offsets.push(pos);
    add(offsets.length + " 0 obj\n" + body + "\nendobj\n");
  };
  add("%PDF-1.4\n");
  obj("<< /Type /Catalog /Pages 2 0 R >>");
  obj("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> /XObject << /Im1 7 0 R >> >> >>");
  obj("<< /Length " + (content.length + 1) + " >>\nstream\n" + content + "\nendstream");
  obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const color = info.components === 1 ? "/DeviceGray" : "/DeviceRGB";
  offsets.push(pos);
  add("7 0 obj\n<< /Type /XObject /Subtype /Image /Width " + info.width + " /Height " + info.height + " /ColorSpace " + color + " /BitsPerComponent 8 /Filter /DCTDecode /Length " + jpeg.length + " >>\nstream\n");
  add(jpeg);
  add("\nendstream\nendobj\n");
  const xrefAt = pos;
  let xref = "xref\n0 8\n0000000000 65535 f \n";
  offsets.forEach((off) => { xref += String(off).padStart(10, "0") + " 00000 n \n"; });
  add(xref);
  add("trailer << /Size 8 /Root 1 0 R >>\nstartxref\n" + xrefAt + "\n%%EOF");
  const out = new Uint8Array(pos);
  let at = 0;
  chunks.forEach((chunk) => {
    if (typeof chunk === "string") {
      for (let i = 0; i < chunk.length; i++) out[at++] = chunk.charCodeAt(i) & 255;
    } else {
      out.set(chunk, at);
      at += chunk.length;
    }
  });
  return new Blob([out], { type: "application/pdf" });
}

function buildAgreementPdf(quote) {
  const commands = [];
  let y = 728;
  const write = (text, size, bold) => {
    const font = bold ? "/F2" : "/F1";
    wrapPdfLine(text, size).forEach((part) => {
      if (y < 48) return;
      commands.push("BT " + font + " " + size + " Tf 54 " + y + " Td (" + pdfEscape(part) + ") Tj ET");
      y -= size + 5;
    });
    y -= 3;
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
  const jpeg = dataUrlToBytes(signaturePng());
  const info = jpegInfo(jpeg);
  const imgBottom = Math.max(48, y - 74);
  commands.push("q 280 0 0 74 54 " + imgBottom + " cm /Im1 Do Q");
  y = imgBottom - 16;
  const printed = document.getElementById("signname").value.trim() || document.getElementById("cname").value.trim();
  const date = document.getElementById("signdate").value || "";
  write("Printed name: " + printed, 12, false);
  write("Date: " + date, 12, false);
  write("The customer agrees to the service and the total price above at the address shown.", 11, false);
  write("A copy of this agreement goes to the office at office@family-termite.com.", 11, false);
  agreementBlob = pdfDocument(commands.join("\n"), jpeg, info);
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

function setSendNote(text, isError) {
  const note = document.getElementById("sendnote");
  note.textContent = text;
  note.classList.toggle("err", !!isError);
  document.getElementById("sendbox").classList.remove("hidden");
}

function sendReady() {
  const name = document.getElementById("cname").value.trim();
  const address = document.getElementById("caddress").value.trim();
  const phone = document.getElementById("cphone").value.trim();
  const email = document.getElementById("cemail").value.trim();
  if (!name || !address || !phone || !email) return "Fill in the customer name, address, phone, and email first.";
  if (signatureBlank()) return "The customer needs to sign before this can go out.";
  const quote = quoteLines();
  if (!quote.lines.length) return "Show a price before sending the agreement.";
  return "";
}

function armSendLinks() {
  const quote = quoteLines();
  const mail = mailtoOfficeAndCustomer(quote);
  const phone = document.getElementById("cphone").value.replace(/[^\d+]/g, "");
  const textBody = "Family Termite service agreement is in the PDF that just downloaded. Please attach it to this text.";
  document.getElementById("agree").setAttribute("href", mail);
  document.getElementById("emailpdf").setAttribute("href", mail);
  document.getElementById("textpdf").setAttribute("href", smsLink(phone, textBody));
  document.getElementById("officecopy").setAttribute("href", mailtoOfficeCopy(quote));
}

["agree", "emailpdf", "textpdf"].forEach((id) => {
  document.getElementById(id).addEventListener("pointerdown", () => {
    if (sendReady()) return;
    try { armSendLinks(); } catch (error) {}
  });
});

document.getElementById("agree").addEventListener("click", (event) => {
  try {
    const problem = sendReady();
    if (problem) {
      event.preventDefault();
      setSendNote(problem, true);
      return;
    }
    const quote = showPrice();
    buildAgreementPdf(quote);
    downloadAgreement();
    armSendLinks();
    setSendNote("The PDF downloaded. This tap opens the mail app to the customer, with office@family-termite.com copied. Attach the PDF, then send. The office copy cannot be left off.");
  } catch (error) {
    event.preventDefault();
    setSendNote("The agreement did not go out. " + (error && error.message ? error.message : "Try again."), true);
  }
});

document.getElementById("dlpdf").addEventListener("click", downloadAgreement);

const OFFICE = "office@family-termite.com";

function plainAddress(value) {
  const email = String(value || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("That email address cannot be opened in the mail app.");
  }
  return email;
}

function mailtoOfficeAndCustomer(quote) {
  const email = plainAddress(document.getElementById("cemail").value);
  const body = agreementText(quote) + "\n\nThe PDF downloaded on this phone. Attach that file before you send. The office is copied on this message.";
  return "mailto:" + email + "?cc=" + OFFICE + "&subject=" + encodeURIComponent("Family Termite service agreement") + "&body=" + encodeURIComponent(body);
}

function mailtoOfficeCopy(quote) {
  const name = document.getElementById("cname").value.trim();
  const body = "Office copy. This agreement was also sent to the customer.\n\n" + agreementText(quote) + "\n\nThe PDF downloaded on this phone. Attach " + agreementName + ".";
  return "mailto:" + OFFICE + "?subject=" + encodeURIComponent("Office copy: " + name) + "&body=" + encodeURIComponent(body);
}

function smsLink(phone, body) {
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  return ios
    ? "sms:" + phone + "&body=" + encodeURIComponent(body)
    : "sms:" + phone + "?body=" + encodeURIComponent(body);
}

document.getElementById("emailpdf").addEventListener("click", (event) => {
  if (!agreementBlob || sendReady()) {
    event.preventDefault();
    setSendNote("The agreement PDF is not ready yet. Tap Send as Agreement again.", true);
  }
});

document.getElementById("textpdf").addEventListener("click", (event) => {
  if (!agreementBlob || sendReady()) {
    event.preventDefault();
    setSendNote("The agreement PDF is not ready yet. Tap Send as Agreement again.", true);
    return;
  }
  window.open(document.getElementById("officecopy").getAttribute("href"));
  setSendNote("The text app is opening to the customer. The office copy opens to office@family-termite.com. Attach the PDF to both.");
});
