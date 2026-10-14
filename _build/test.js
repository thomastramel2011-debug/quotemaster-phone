"use strict";

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const USERNAME = "fieldtechs";
const PASSWORD = "fleet-termite-test-password";
const OTHER = "another-long-test-password";
const LEAKS = [
  "Integrated Pest Management Service Agreement",
  "Either party may cancel it in writing",
  "THIS AGREEMENT COVERS ONLY THE PREMISES AND PESTS SPECIFIED BELOW",
  "office@family-termite.com",
  "Scheduled as two visits",
  "Second follow-up visit",
  "pretreatPerSqFt",
  "Pest service (outside only)",
  "quote185",
  "familytermite"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runNode(args, env) {
  return spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: Object.assign({}, process.env, env || {})
  });
}

function withoutPassword(extra) {
  const env = Object.assign({}, process.env, extra || {});
  delete env.QUOTEMASTER_USERNAME;
  delete env.QUOTEMASTER_PASSWORD;
  return env;
}

function creds(password, username) {
  return {
    QUOTEMASTER_USERNAME: username === undefined ? USERNAME : username,
    QUOTEMASTER_PASSWORD: password
  };
}

function build(args, env) {
  const result = runNode(["_build/build.js"].concat(args), env);
  if (result.status !== 0) {
    throw new Error("build failed\n" + result.stdout + "\n" + result.stderr);
  }
  return result;
}

function readSeal(html) {
  const open = '<script id="sealed" type="application/json">';
  const start = html.indexOf(open);
  assert(start >= 0, "sealed block missing");
  const from = start + open.length;
  const end = html.indexOf("</script>", from);
  return JSON.parse(html.slice(from, end));
}

async function decryptSeal(username, password, seal) {
  const subtle = crypto.webcrypto.subtle;
  const salt = Buffer.from(seal.salt, "base64");
  const iv = Buffer.from(seal.iv, "base64");
  const ct = Buffer.from(seal.ct, "base64");
  const base = await subtle.importKey("raw", new TextEncoder().encode(username + "\0" + password), "PBKDF2", false, ["deriveKey"]);
  const key = await subtle.deriveKey(
    { name: "PBKDF2", salt: salt, iterations: seal.iter, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    true,
    ["decrypt"]
  );
  const plain = await subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ct);
  return { text: new TextDecoder().decode(plain), key: key };
}

function checkSyntax() {
  ["_build/build.js", "_build/gate.js", "_build/test.js", "_src/app.js", "_src/pricing.js", "_src/prices.config.js"].forEach((file) => {
    const result = runNode(["--check", file], withoutPassword());
    assert(result.status === 0, file + " failed node --check\n" + result.stderr);
  });
}

function checkPricing() {
  const prices = fs.readFileSync(path.join(ROOT, "_src/prices.config.js"), "utf8");
  const pricing = fs.readFileSync(path.join(ROOT, "_src/pricing.js"), "utf8");
  const got = new Function(prices + "\n" + pricing + "\nreturn {" +
    "fleas: configuredVisitPrice('fleas')," +
    "follow: configuredVisitPrice('fleasFollowUp')," +
    "renewal: yearlyRenewal(2500, 0, false, 0)," +
    "renewalStep: yearlyRenewal(2501, 0, false, 0)," +
    "crawl: yearlyRenewal(2500, 0, true, 0)," +
    "miles: yearlyRenewal(2500, 0, false, 51)," +
    "over: yearlyRenewal(2500, 301, false, 0)," +
    "mosquitoUnder: mosquito(4999)," +
    "mosquitoAt: mosquito(5000)," +
    "post: postTreat(411, 100)," +
    "pretreatMin: pretreatPrice(100)," +
    "pretreat: pretreatPrice(2500)," +
    "oneTime: oneTime(2500)," +
    "pest: contractPest(2500)," +
    "pestStep: contractPest(2501)," +
    "outside: outsidePest(2500)," +
    "outsideStep: outsidePest(2501)," +
    "outsideBand: outsidePest(3500)," +
    "outsideNext: outsidePest(3501)," +
    "outsideTax: money(79 * taxRateForZip('39042'))," +
    "outsideTotal: money(79 + money(79 * taxRateForZip('39042')))," +
    "jacksonRate: taxRateForZip('39204')," +
    "jacksonPlus4: taxRateForZip('39204-1234')," +
    "tougaloo: taxRateForZip('39174')," +
    "byram: taxRateForZip('39272')," +
    "west: taxRateForZip('39209')," +
    "pearl: taxRateForZip('39208')," +
    "blank: taxRateForZip('')," +
    "partial: taxRateForZip('3920')," +
    "jacksonTax: money(79 * taxRateForZip('39201'))," +
    "jacksonTotal: money(79 + money(79 * taxRateForZip('39201')))," +
    "zips: Object.keys(JACKSON_ZIPS).sort().join(',')," +
    "label7: salesTaxLabel(0.07)," +
    "label8: salesTaxLabel(0.08)," +
    "tax: money(250 * 0.07)," +
    "total: money(250 + money(250 * 0.07))" +
    "};")();
  assert(got.fleas.status === "ok" && got.fleas.amount === 250, "flea price " + JSON.stringify(got.fleas));
  assert(got.follow.status === "ok" && got.follow.amount === 0, "follow-up price " + JSON.stringify(got.follow));
  assert(got.renewal === 185, "renewal " + got.renewal);
  assert(got.renewalStep === 195, "renewal step " + got.renewalStep);
  assert(got.crawl === 235, "crawl " + got.crawl);
  assert(got.miles === 186, "miles " + got.miles);
  assert(got.over === 215.1, "over 300 " + got.over);
  assert(got.mosquitoUnder === 69, "mosquito under " + got.mosquitoUnder);
  assert(got.mosquitoAt === 81.25, "mosquito at " + got.mosquitoAt);
  assert(got.post === 2470.2, "post " + got.post);
  assert(got.pretreatMin === 189, "pretreat min " + got.pretreatMin);
  assert(got.pretreat === 500, "pretreat " + got.pretreat);
  assert(got.oneTime === 209, "one time " + got.oneTime);
  assert(got.pest === 109, "pest " + got.pest);
  assert(got.pestStep === 119, "pest step " + got.pestStep);
  assert(got.outside === 79, "outside " + got.outside);
  assert(got.outsideStep === 89, "outside step " + got.outsideStep);
  assert(got.outsideBand === 89, "outside band " + got.outsideBand);
  assert(got.outsideNext === 99, "outside next " + got.outsideNext);
  assert(got.outsideTax === 5.53, "outside tax " + got.outsideTax);
  assert(got.outsideTotal === 84.53, "outside total " + got.outsideTotal);
  assert(got.jacksonRate === 0.08, "jackson rate " + got.jacksonRate);
  assert(got.jacksonPlus4 === 0.08, "jackson zip+4 " + got.jacksonPlus4);
  assert(got.tougaloo === 0.08, "tougaloo rate " + got.tougaloo);
  assert(got.byram === 0.07, "byram rate " + got.byram);
  assert(got.west === 0.07, "39209 rate " + got.west);
  assert(got.pearl === 0.07, "39208 rate " + got.pearl);
  assert(got.blank === 0.07, "blank rate " + got.blank);
  assert(got.partial === 0.07, "partial rate " + got.partial);
  assert(got.jacksonTax === 6.32, "jackson tax " + got.jacksonTax);
  assert(got.jacksonTotal === 85.32, "jackson total " + got.jacksonTotal);
  assert(got.zips === "39174,39201,39202,39203,39204,39206,39210,39211,39212,39213,39216,39217,39269", "zip list " + got.zips);
  assert(got.label7 === "Sales tax 7%", "label 7 " + got.label7);
  assert(got.label8 === "Sales tax 8%", "label 8 " + got.label8);
  assert(got.tax === 17.5, "flea tax " + got.tax);
  assert(got.total === 267.5, "flea total " + got.total);

  const placeholder = prices.replace("fleas: 250", "fleas: \"PLACEHOLDER\"");
  const held = new Function(placeholder + "\n" + pricing + "\nreturn configuredVisitPrice('fleas');")();
  assert(held.status === "placeholder", "placeholder status " + held.status);
  const dollars = prices.replace("fleas: 250", "fleas: \"$1,200\"");
  const parsed = new Function(dollars + "\n" + pricing + "\nreturn configuredVisitPrice('fleas');")();
  assert(parsed.status === "ok" && parsed.amount === 1200, "parsed dollar text " + JSON.stringify(parsed));
}

function checkSourceShape() {
  const app = fs.readFileSync(path.join(ROOT, "_src/app.js"), "utf8");
  const quote = fs.readFileSync(path.join(ROOT, "_src/quote.html"), "utf8");
  assert(!fs.existsSync(path.join(ROOT, "app.js")), "app.js is still at the site root");
  assert(!fs.existsSync(path.join(ROOT, "pricing.js")), "pricing.js is still at the site root");
  assert(!fs.existsSync(path.join(ROOT, "techs.json")), "techs.json is still at the site root");
  assert(!/bed\s*bugs?/i.test(app + quote + fs.readFileSync(path.join(ROOT, "_src/prices.config.js"), "utf8")), "bed bugs are still present");
  assert(app.includes('value=\\"fleas\\"') || app.includes('value="fleas"'), "fleas option missing");
  assert(app.includes("Second follow-up visit"), "follow-up line missing");
  assert(app.includes("TERM_FLEAS"), "flea agreement term missing");
  assert(!app.includes("SHARED"), "old shared login is still in the quote script");
  assert(!quote.includes('id="login"'), "login form is still inside the quote");
}

function assertLoginShell(html, label) {
  const seal = readSeal(html);
  LEAKS.forEach((marker) => assert(!html.includes(marker), label + " contains " + marker));
  assert(html.includes("Family Termite"), label + " is missing the company name");
  assert(html.includes(">Sign in<"), label + " is missing Sign in");
  assert(html.includes(">Sign out<"), label + " is missing Sign out");
  assert(html.includes('type="password"'), label + " is missing the password field");
  assert(html.includes('id="username"'), label + " is missing the username field");
  assert(!html.includes(USERNAME), label + " contains the test username");
  return seal;
}

function checkLoginPage() {
  const out = path.join(os.tmpdir(), "qm-login-" + process.pid + ".html");
  const banned = build(["--login-only", "--out", out], creds(PASSWORD));
  assert(!/Sealed the quote page/.test(banned.stdout), "login-only sealed a page");
  const generated = fs.readFileSync(out, "utf8");
  const shell = assertLoginShell(generated, "login-only page");
  assert(shell.configured === false && !shell.ct, "login-only page is sealed");
  const committed = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const live = assertLoginShell(committed, "index.html");
  if (live.configured) {
    assert(live.iter === 600000 && live.salt && live.iv && live.ct, "sealed index.html is incomplete");
  }
}

function rejectBadPasswords() {
  ["quote185", "REPLACE_WITH_A_LONG_PASSWORD", "short", ""].forEach((password) => {
    const result = runNode(["_build/build.js", "--out", path.join(os.tmpdir(), "qm-bad.html")], creds(password));
    assert(result.status !== 0, "password was accepted: " + JSON.stringify(password));
  });
  ["", "REPLACE_WITH_THE_SHARED_USERNAME", "u"].forEach((username) => {
    const result = runNode(["_build/build.js", "--out", path.join(os.tmpdir(), "qm-bad.html")], creds(PASSWORD, username));
    assert(result.status !== 0, "username was accepted: " + JSON.stringify(username));
  });
}

async function checkSeal() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qm-seal-"));
  const dest = path.join(dir, "index.html");
  build(["--out", dest], creds(PASSWORD));
  const first = fs.readFileSync(dest, "utf8");
  LEAKS.forEach((marker) => assert(!first.includes(marker), "sealed page contains " + marker));
  const seal = readSeal(first);
  assert(seal.configured === true && seal.iter === 600000, "seal header " + JSON.stringify({ v: seal.v, iter: seal.iter, configured: seal.configured }));
  const opened = await decryptSeal(USERNAME, PASSWORD, seal);
  const payload = JSON.parse(opened.text);
  LEAKS.filter((marker) => marker !== "quote185" && marker !== "familytermite").forEach((marker) => {
    assert(opened.text.includes(marker), "decrypted quote is missing " + marker);
  });
  assert(payload.js.length === 3, "expected three scripts");
  assert(opened.text.includes("Fleas, first visit"), "flea line missing after decrypt");
  assert(!/bed\s*bugs?/i.test(opened.text), "bed bugs were encrypted into the quote");
  let rejected = false;
  try { await decryptSeal(USERNAME, OTHER, seal); } catch (error) { rejected = true; }
  assert(rejected, "a different password opened the seal");
  let wrongUser = false;
  try { await decryptSeal("othertechs", PASSWORD, seal); } catch (error) { wrongUser = true; }
  assert(wrongUser, "a different username opened the seal");

  build(["--out", dest], creds(PASSWORD));
  const second = readSeal(fs.readFileSync(dest, "utf8"));
  assert(second.salt === seal.salt, "rebuilding with the same sign-in changed the key");
  assert(second.iv !== seal.iv, "rebuild reused an IV");
  const again = await decryptSeal(USERNAME, PASSWORD, second);
  assert(again.text === opened.text, "rebuild changed the quote");

  build(["--out", dest], creds(PASSWORD, "othertechs"));
  const renamed = readSeal(fs.readFileSync(dest, "utf8"));
  assert(renamed.salt !== seal.salt, "a new username reused the old salt");

  build(["--out", dest], creds(OTHER));
  const changed = readSeal(fs.readFileSync(dest, "utf8"));
  assert(changed.salt !== seal.salt, "a new password reused the old salt");
  let oldKeyFailed = false;
  try {
    await crypto.webcrypto.subtle.decrypt(
      { name: "AES-GCM", iv: Buffer.from(changed.iv, "base64") },
      opened.key,
      Buffer.from(changed.ct, "base64")
    );
  } catch (error) { oldKeyFailed = true; }
  assert(oldKeyFailed, "the previous remembered key still opens a new password");
}

function publishedFiles() {
  const exclude = new Set(["README.md", "password.config", "password.config.example", "package.json", "package-lock.json", "node_modules", ".gitignore"]);
  const found = [];
  function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      if (entry.name.startsWith(".") || entry.name.startsWith("_")) return;
      if (exclude.has(entry.name)) return;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else found.push(full);
    });
  }
  walk(ROOT);
  return found;
}

function checkPublishedTree() {
  const files = publishedFiles();
  const rel = files.map((file) => path.relative(ROOT, file)).sort();
  assert(rel.length === 1 && rel[0] === "index.html", "unexpected public files: " + rel.join(", "));
  const html = fs.readFileSync(files[0], "utf8");
  LEAKS.forEach((marker) => assert(!html.includes(marker), "published file leaked " + marker));
}

function serve(file) {
  const html = fs.readFileSync(file);
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server: server, url: "http://127.0.0.1:" + address.port + "/" });
    });
  });
}

async function checkBrowser() {
  let puppeteer;
  try {
    puppeteer = require("puppeteer-core");
  } catch (error) {
    throw new Error("puppeteer-core is not installed");
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qm-browser-"));
  const dest = path.join(dir, "index.html");
  build(["--out", dest], creds(PASSWORD));
  const site = await serve(dest);
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    const response = await page.goto(site.url, { waitUntil: "networkidle0" });
    await page.screenshot({ path: "/tmp/qm-login.png", fullPage: true });
    const raw = await response.text();
    LEAKS.forEach((marker) => assert(!raw.includes(marker), "response leaked " + marker));
    const loginText = await page.evaluate(() => document.body.innerText);
    assert(loginText.includes("Family Termite & Environmental Services"), "login heading missing");
    assert(loginText.includes("Tech sign in"), "login label missing");
    assert(loginText.includes("Username"), "username label missing");
    assert(!loginText.includes("Integrated Pest Management"), "agreement visible before sign-in");
    assert(!loginText.includes("Purchaser"), "quote form visible before sign-in");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    assert(!overflow, "login page scrolls sideways at 390px");
    await page.setViewport({ width: 320, height: 700, isMobile: true, hasTouch: true });
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    assert(!narrow, "login page scrolls sideways at 320px");
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

    await page.type("#username", USERNAME);
    await page.type("#password", "wrong-password-value");
    await page.click("#signin");
    await page.waitForFunction(() => document.getElementById("err").textContent.includes("does not match"));
    assert(await page.evaluate(() => !localStorage.getItem("familyTermiteQuoteSession")), "a bad password was remembered");

    await page.evaluate(() => {
      document.getElementById("username").value = "someone-else";
      document.getElementById("password").value = "";
    });
    await page.type("#password", PASSWORD);
    await page.click("#signin");
    await page.waitForFunction(() => document.getElementById("err").textContent.includes("does not match"));

    await page.evaluate(() => {
      document.getElementById("username").value = "";
      document.getElementById("password").value = "";
    });
    await page.type("#username", USERNAME);
    await page.type("#password", PASSWORD);
    await page.click("#signin");
    await page.waitForSelector("#service");
    const signedIn = await page.evaluate(() => document.body.innerText);
    assert(signedIn.includes("Integrated Pest Management Service Agreement"), "agreement did not open");
    assert(signedIn.includes("Sign out"), "sign out missing");
    const italic = await page.evaluate(() => getComputedStyle(document.querySelector(".wordmark")).fontStyle);
    assert(italic === "italic", "quote styles did not apply");
    const session = await page.evaluate(() => JSON.parse(localStorage.getItem("familyTermiteQuoteSession")));
    const days = (session.exp - Date.now()) / (24 * 60 * 60 * 1000);
    assert(days > 29 && days < 31, "remember period is " + days + " days");
    assert(!JSON.stringify(session).includes(PASSWORD), "the password was stored");
    assert(!JSON.stringify(session).includes(USERNAME), "the username was stored");

    await page.evaluate(() => { document.getElementById("czip").value = ""; });
    await page.select("#service", "pretreat");
    await page.evaluate(() => { document.getElementById("sqft").value = "2500"; });
    await page.click("#calc");
    let blocked = await page.evaluate(() => document.getElementById("out").innerText);
    assert(blocked.includes("5-digit zip code") && !blocked.includes("$500.00"), "zip required\n" + blocked);
    await page.evaluate(() => { document.getElementById("czip").value = "39042"; });

    await page.select("#service", "pretreat");
    await page.evaluate(() => { document.getElementById("sqft").value = "2500"; });
    await page.click("#calc");
    let price = await page.evaluate(() => document.getElementById("out").innerText);
    assert(price.includes("Pre-treatment") && price.includes("$500.00"), "pretreat price\n" + price);
    assert(price.includes("Sales tax 7%") && price.includes("$35.00") && price.includes("$535.00"), "pretreat tax\n" + price);

    await page.select("#service", "post");
    await page.click("#calc");
    price = await page.evaluate(() => document.getElementById("out").innerText);
    assert(price.includes("Post-treatment") && price.includes("$690.00"), "post minimum\n" + price);

    await page.select("#service", "pest");
    await page.evaluate(() => { document.getElementById("sqft").value = "2500"; });
    await page.click("#calc");
    price = await page.evaluate(() => document.getElementById("out").innerText);
    assert(price.includes("Pest service, each visit") && price.includes("$109.00"), "pest price\n" + price);

    const serviceLabels = await page.evaluate(() => Array.from(document.getElementById("service").options).map((option) => option.textContent));
    const pestAt = serviceLabels.indexOf("Pest service");
    assert(serviceLabels[pestAt + 1] === "Pest service, outside only", "outside option is not next to pest: " + serviceLabels.join(", "));
    await page.select("#service", "outside");
    const outsideFreq = await page.evaluate(() => Array.from(document.getElementById("freq").options).map((option) => option.value));
    assert(outsideFreq.join(",") === "monthly,quarterly", "outside frequencies " + outsideFreq.join(","));
    await page.evaluate(() => { document.getElementById("sqft").value = "2500"; });
    await page.click("#calc");
    price = await page.evaluate(() => document.getElementById("out").innerText);
    assert(price.includes("Pest service (outside only), monthly") && price.includes("$79.00"), "outside monthly\n" + price);
    assert(price.includes("Sales tax 7%") && price.includes("$5.53") && price.includes("$84.53"), "outside tax\n" + price);
    await page.evaluate(() => { document.getElementById("czip").value = "39204"; });
    await page.click("#calc");
    price = await page.evaluate(() => document.getElementById("out").innerText);
    assert(price.includes("Sales tax 8%") && price.includes("$6.32") && price.includes("$85.32"), "jackson outside tax\n" + price);
    await page.evaluate(() => { document.getElementById("czip").value = "39042"; });
    await page.select("#freq", "quarterly");
    await page.evaluate(() => { document.getElementById("sqft").value = "3501"; });
    await page.click("#calc");
    price = await page.evaluate(() => document.getElementById("out").innerText);
    assert(price.includes("Pest service (outside only), quarterly") && price.includes("$99.00"), "outside quarterly\n" + price);
    await page.evaluate(() => {
      document.getElementById("cname").value = "Ada Home";
      document.getElementById("cphone").value = "6015550100";
      document.getElementById("caddress").value = "1 Main St";
      document.getElementById("cemail").value = "ada@example.com";
      document.getElementById("czip").value = "39201";
      const canvas = document.getElementById("sign");
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#111111";
      ctx.fillRect(8, 8, 30, 4);
    });
    await page.evaluate(() => {
      document.getElementById("agree").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    });
    const mail = await page.evaluate(() => ({
      customer: decodeURIComponent(document.getElementById("agree").getAttribute("href")),
      office: decodeURIComponent(document.getElementById("officecopy").getAttribute("href"))
    }));
    assert(mail.customer.includes("subject=Pest service (outside only), quarterly"), "customer subject\n" + mail.customer);
    assert(mail.customer.includes("Pest service (outside only), quarterly"), "customer agreement\n" + mail.customer);
    assert(mail.office.includes("subject=Office copy: Pest service (outside only), quarterly"), "office subject\n" + mail.office);
    assert(mail.customer.includes("Sales tax 8%"), "customer tax label\n" + mail.customer);
    assert(mail.customer.includes("39201"), "customer zip\n" + mail.customer);
    await page.evaluate(() => { document.getElementById("czip").value = "39042"; });
    await page.screenshot({ path: "/tmp/qm-outside.png", fullPage: true });
    await page.evaluate(() => {
      ["cname", "cphone", "caddress", "cemail"].forEach((id) => { document.getElementById(id).value = ""; });
      const canvas = document.getElementById("sign");
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    });

    await page.select("#service", "other");
    const labels = await page.evaluate(() => Array.from(document.getElementById("other").options).map((option) => option.textContent));
    assert(labels.includes("Fleas"), "fleas option missing: " + labels.join(", "));
    assert(!labels.some((label) => /bed bugs/i.test(label)), "bed bugs option present: " + labels.join(", "));
    await page.select("#other", "onetime");
    await page.evaluate(() => { document.getElementById("sqft").value = "2500"; });
    await page.click("#calc");
    price = await page.evaluate(() => document.getElementById("out").innerText);
    assert(price.includes("One-time pest") && price.includes("$209.00"), "one-time pest\n" + price);

    await page.select("#other", "fleas");
    const fleaIntro = await page.evaluate(() => document.getElementById("panel").innerText);
    assert(fleaIntro.includes("Scheduled as two visits"), "flea description missing\n" + fleaIntro);
    assert(fleaIntro.includes("$0.00"), "follow-up amount missing\n" + fleaIntro);
    const term = await page.evaluate(() => document.getElementById("term").textContent);
    assert(term.includes("two visits") && term.includes("follow-up"), "agreement term\n" + term);
    await page.evaluate(() => { document.getElementById("czip").value = "39206"; });
    await page.click("#calc");
    price = await page.evaluate(() => document.getElementById("out").innerText);
    assert(price.includes("Fleas, first visit") && price.includes("$250.00"), "flea visit\n" + price);
    assert(price.includes("Sales tax 8%") && price.includes("$20.00") && price.includes("$270.00"), "jackson flea tax\n" + price);
    await page.evaluate(() => { document.getElementById("czip").value = "39042"; });
    await page.click("#calc");
    price = await page.evaluate(() => document.getElementById("out").innerText);
    assert(price.includes("Second follow-up visit") && price.includes("$0.00"), "flea follow-up\n" + price);
    assert(price.includes("Sales tax 7%") && price.includes("$17.50"), "flea tax\n" + price);
    assert(price.includes("Total") && price.includes("$267.50"), "flea total\n" + price);
    assert(price.includes("Scheduled as two visits"), "flea quote note\n" + price);
    await page.screenshot({ path: "/tmp/qm-fleas.png", fullPage: true });

    await page.select("#other", "rat");
    await page.click("#calc");
    price = await page.evaluate(() => document.getElementById("out").innerText);
    assert(price.includes("Rat cleanout") && price.includes("$250.00"), "rat price\n" + price);

    await page.click("#agree");
    const send = await page.evaluate(() => document.getElementById("sendnote").textContent);
    assert(send.includes("customer name"), "send validation\n" + send);

    const quoteOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    assert(!quoteOverflow, "quote scrolls sideways at 390px");
    await page.setViewport({ width: 320, height: 700, isMobile: true, hasTouch: true });
    const quoteNarrow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    assert(!quoteNarrow, "quote scrolls sideways at 320px");
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

    await page.reload({ waitUntil: "networkidle0" });
    await page.waitForSelector("#service");
    assert(await page.evaluate(() => document.getElementById("gate").hidden), "reload showed the login page");

    await page.click("#signout");
    await page.waitForSelector("#password");
    const after = await page.evaluate(() => ({
      text: document.body.innerText,
      session: localStorage.getItem("familyTermiteQuoteSession"),
      quote: !!document.getElementById("cname")
    }));
    assert(!after.session, "sign-out left the session");
    assert(!after.quote, "sign-out left the quote form");
    assert(!after.text.includes("Integrated Pest Management"), "agreement still on screen after sign-out");
    assert(after.text.includes("Tech sign in"), "login did not return");
  } finally {
    await browser.close();
    site.server.close();
  }
}

async function main() {
  checkSyntax();
  checkSourceShape();
  checkPricing();
  checkLoginPage();
  rejectBadPasswords();
  checkPublishedTree();
  await checkSeal();
  await checkBrowser();
  console.log("All checks passed.");
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
