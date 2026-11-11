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
  "Pest service (inside only)",
  "Crawl-space encapsulation",
  "Driveway pressure washing",
  "Check with the office before quoting wildlife.",
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
    "inside: insidePest(2500)," +
    "insideStep: insidePest(2501)," +
    "insideBand: insidePest(3500)," +
    "insideNext: insidePest(3501)," +
    "insideLarge: insidePest(10000)," +
    "insideTop: insidePest(12500)," +
    "insideTax: money(insidePest(2500) * taxRateForZip('39042'))," +
    "insideTotal: money(insidePest(2500) + money(insidePest(2500) * taxRateForZip('39042')))," +
    "insideJacksonTax: money(insidePest(2500) * taxRateForZip('39201'))," +
    "insideJacksonTotal: money(insidePest(2500) + money(insidePest(2500) * taxRateForZip('39201')))," +
    "samePrice: [0, 1000, 2500, 2501, 3500, 3501, 4500, 5000, 7500, 10000, 12500].every(function (sqft) {" +
    "  return insidePest(sqft) === outsidePest(sqft);" +
    "})," +
    "sameTax: [2500, 2501, 3500, 3501, 10000, 12500].every(function (sqft) {" +
    "  return ['39042', '39201', '39204', '39272'].every(function (zip) {" +
    "    var price = insidePest(sqft);" +
    "    var rate = taxRateForZip(zip);" +
    "    return price === outsidePest(sqft) && money(price * rate) === money(outsidePest(sqft) * rate);" +
    "  });" +
    "})," +
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
  assert(got.inside === 79, "inside " + got.inside);
  assert(got.insideStep === 89, "inside step " + got.insideStep);
  assert(got.insideBand === 89, "inside band " + got.insideBand);
  assert(got.insideNext === 99, "inside next " + got.insideNext);
  assert(got.insideLarge === 159, "inside 10000 " + got.insideLarge);
  assert(got.insideTop === 179, "inside 12500 " + got.insideTop);
  assert(got.insideTax === 5.53, "inside tax " + got.insideTax);
  assert(got.insideTotal === 84.53, "inside total " + got.insideTotal);
  assert(got.insideJacksonTax === 6.32, "inside jackson tax " + got.insideJacksonTax);
  assert(got.insideJacksonTotal === 85.32, "inside jackson total " + got.insideJacksonTotal);
  assert(got.samePrice === true, "inside and outside prices differ");
  assert(got.sameTax === true, "inside and outside tax differ");
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

function checkWinterPricing() {
  const prices = fs.readFileSync(path.join(ROOT, "_src/prices.config.js"), "utf8");
  const pricing = fs.readFileSync(path.join(ROOT, "_src/pricing.js"), "utf8");
  const got = new Function(prices + "\n" + pricing + "\nreturn {" +
    "stations4: rodentStationService(4)," +
    "stations3: rodentStationService(3)," +
    "stations2: rodentStationService(2)," +
    "stations1: rodentStationService(1)," +
    "stations0: rodentStationService(0)," +
    "open10: exclusionPrice(10)," +
    "open16: exclusionPrice(16)," +
    "open9: exclusionPrice(9)," +
    "vapor1200: vaporBarrier(1200)," +
    "enc1200: encapsulationPrice(1200)," +
    "enc1500: encapsulationPrice(1500)," +
    "enc999: encapsulationPrice(999)," +
    "enc1000: encapsulationPrice(1000)," +
    "enc800: encapsulationPrice(800)," +
    "dehu: RATES.dehumidifierInstalled," +
    "attic2000: atticJobPrice(2000)," +
    "attic1200: atticJobPrice(1200)," +
    "attic1200Parts: atticParts(1200)," +
    "attic2000Parts: atticParts(2000)," +
    "animals1: wildlifeRemoval(1)," +
    "animals3: wildlifeRemoval(3)," +
    "animals0: wildlifeRemoval(0)," +
    "inspect: wildlifeInspectionPrice(false)," +
    "waived: wildlifeInspectionPrice(true)," +
    "bat1: batHousePrice(1)," +
    "bat2: batHousePrice(2)," +
    "bat0: batHousePrice(0)," +
    "drive800: drivewayWash(800)," +
    "drive400: drivewayWash(400)," +
    "drive516: drivewayWash(516)," +
    "gutter200: gutterCleaning(200)," +
    "gutter100: gutterCleaning(100)," +
    "gutter178: gutterCleaning(178)," +
    "gutter179: gutterCleaning(179)," +
    "leaf1: leafLimbRemoval(1)," +
    "leaf2: leafLimbRemoval(2)," +
    "leaf3: leafLimbRemoval(3)," +
    "leaf4: leafLimbRemoval(4)," +
    "leaf0: leafLimbRemoval(0)," +
    "leaf5: leafLimbRemoval(5)," +
    "winter765: winterDatePrice(765)," +
    "winter5400: winterDatePrice(5400)," +
    "winter4950: winterDatePrice(4950)," +
    "winter6000: winterDatePrice(6000)," +
    "winter4500: winterDatePrice(4500)," +
    "yearMonthly: pestYearTotal(2500, 'monthly')," +
    "yearQuarterly: pestYearTotal(2500, 'quarterly')," +
    "prepayYear: annualPrepayPrice(pestYearTotal(2500, 'monthly'))," +
    "prepayQuarter: annualPrepayPrice(pestYearTotal(2500, 'quarterly'))," +
    "box: RATES.rodentBox," +
    "rat: RATES.ratCleanout," +
    "pest: contractPest(2500)," +
    "outside: outsidePest(2500)," +
    "mosquito: mosquito(4999)," +
    "wildlifeOn: offerWildlife()," +
    "tax60: money(60 * taxRateForZip('39042'))," +
    "tax60Jackson: money(60 * taxRateForZip('39201'))," +
    "tax256: money(256 * taxRateForZip('39042'))," +
    "tax140Jackson: money(140 * taxRateForZip('39211'))," +
    "tax275: money(275 * taxRateForZip('39042'))," +
    "tax547: money(547 * taxRateForZip('39042'))," +
    "tax4950: money(4950 * taxRateForZip('39042'))," +
    "tax5400: money(5400 * taxRateForZip('39042'))," +
    "commercial: Object.prototype.hasOwnProperty.call(RATES, 'commercial')" +
    "};")();
  assert(got.stations4 === 60, "4 stations " + got.stations4);
  assert(got.stations3 === 45, "3 stations " + got.stations3);
  assert(got.stations2 === 45, "2 stations " + got.stations2);
  assert(got.stations1 === 45, "1 station " + got.stations1);
  assert(got.stations0 === 45, "0 stations minimum " + got.stations0);
  assert(got.open10 === 495, "10 openings " + got.open10);
  assert(got.open16 === 765, "16 openings " + got.open16);
  assert(got.open9 === 495, "9 openings " + got.open9);
  assert(got.vapor1200 === 1140, "vapor 1200 " + got.vapor1200);
  assert(got.enc1200 === 5400, "encap 1200 " + got.enc1200);
  assert(got.enc1500 === 6750, "encap 1500 " + got.enc1500);
  assert(got.enc999 === 4500, "encap 999 " + got.enc999);
  assert(got.enc1000 === 4500, "encap 1000 " + got.enc1000);
  assert(got.enc800 === 4500, "encap 800 " + got.enc800);
  assert(got.dehu === 995, "dehumidifier " + got.dehu);
  assert(got.attic2000 === 6000, "attic 2000 " + got.attic2000);
  assert(got.attic1200 === 4950, "attic 1200 " + got.attic1200);
  assert(got.attic1200Parts.removal === 1800 && got.attic1200Parts.insulation === 1800 && got.attic1200Parts.sum === 3600 && got.attic1200Parts.minimumApplies === true, "attic 1200 parts " + JSON.stringify(got.attic1200Parts));
  assert(got.attic2000Parts.removal === 3000 && got.attic2000Parts.insulation === 3000 && got.attic2000Parts.sum === 6000 && got.attic2000Parts.minimumApplies === false, "attic 2000 parts " + JSON.stringify(got.attic2000Parts));
  assert(got.animals1 === 349, "1 animal " + got.animals1);
  assert(got.animals3 === 547, "3 animals " + got.animals3);
  assert(got.animals0 === 0, "0 animals " + got.animals0);
  assert(got.inspect === 149, "inspection " + got.inspect);
  assert(got.waived === 0, "waived inspection " + got.waived);
  assert(got.bat1 === 40, "1 bat house " + got.bat1);
  assert(got.bat2 === 80, "2 bat houses " + got.bat2);
  assert(got.bat0 === 0, "0 bat houses " + got.bat0);
  assert(got.drive800 === 256, "driveway 800 " + got.drive800);
  assert(got.drive400 === 165, "driveway minimum " + got.drive400);
  assert(got.drive516 === 165.12, "driveway 516 " + got.drive516);
  assert(got.gutter200 === 140, "gutter 200 " + got.gutter200);
  assert(got.gutter100 === 125, "gutter minimum " + got.gutter100);
  assert(got.gutter178 === 125, "gutter 178 " + got.gutter178);
  assert(got.gutter179 === 125.3, "gutter 179 " + got.gutter179);
  assert(got.leaf1 === 275, "quarter load " + got.leaf1);
  assert(got.leaf2 === 450, "half load " + got.leaf2);
  assert(got.leaf3 === 600, "three-quarter load " + got.leaf3);
  assert(got.leaf4 === 725, "full load " + got.leaf4);
  assert(got.leaf0 === 0 && got.leaf5 === 0, "leaf load outside 1-4");
  assert(got.winter765 === 688.5, "winter exclusion " + got.winter765);
  assert(got.winter5400 === 4860, "winter encap " + got.winter5400);
  assert(got.winter4950 === 4455, "winter attic min " + got.winter4950);
  assert(got.winter6000 === 5400, "winter attic 2000 " + got.winter6000);
  assert(got.winter4500 === 4050, "winter encap min " + got.winter4500);
  assert(got.yearMonthly === 1308, "pest year " + got.yearMonthly);
  assert(got.yearQuarterly === 436, "pest quarterly year " + got.yearQuarterly);
  assert(got.prepayYear === 1268.76, "3% year " + got.prepayYear);
  assert(got.prepayQuarter === 422.92, "3% quarter " + got.prepayQuarter);
  assert(got.box === 25 && got.rat === 250 && got.pest === 109 && got.outside === 79 && got.mosquito === 69, "existing rates moved");
  assert(got.wildlifeOn === true, "wildlife flag ships on");
  assert(got.tax60 === 4.2, "station tax " + got.tax60);
  assert(got.tax60Jackson === 4.8, "station jackson tax " + got.tax60Jackson);
  assert(got.tax256 === 17.92, "driveway tax " + got.tax256);
  assert(got.tax140Jackson === 11.2, "gutter jackson tax " + got.tax140Jackson);
  assert(got.tax275 === 19.25, "leaf tax " + got.tax275);
  assert(got.tax547 === 38.29, "wildlife tax " + got.tax547);
  assert(got.tax4950 === 346.5, "attic tax " + got.tax4950);
  assert(got.tax5400 === 378, "encap tax " + got.tax5400);
  assert(got.commercial === false, "commercial rate was added");
  const offSrc = prices.replace("const OFFER_WILDLIFE = true;", "const OFFER_WILDLIFE = false;");
  const off = new Function(offSrc + "\n" + pricing + "\nreturn offerWildlife();")();
  assert(off === false, "wildlife flag can hide the lines");
  const bare = new Function(pricing + "\nreturn offerWildlife();")();
  assert(bare === true, "wildlife defaults on when the flag is missing");
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
  const prices = fs.readFileSync(path.join(ROOT, "_src/prices.config.js"), "utf8");
  assert(/const OFFER_WILDLIFE = true;/.test(prices), "wildlife lines should ship visible");
  assert(app.includes("Rodent station service, each visit"), "rodent service option missing");
  assert(app.includes("Driveway pressure washing"), "driveway option missing");
  assert(app.includes("Gutter cleaning"), "gutter option missing");
  assert(app.includes("Leaf and limb removal"), "leaf option missing");
  assert(app.includes("Check with the office before quoting wildlife."), "wildlife office note missing");
  assert(app.includes("selected>Off</option>"), "annual prepay does not ship off");
  assert(app.includes("Winter-date prepay, 10% off"), "winter prepay control missing");
  assert(!/commercial/i.test(app + fs.readFileSync(path.join(ROOT, "_src/pricing.js"), "utf8")), "commercial path was added");
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
    const prepayDefault = await page.evaluate(() => document.getElementById("prepay").value);
    assert(prepayDefault === "off", "annual prepay shipped on: " + prepayDefault);
    await page.select("#prepay", "year");
    await page.click("#calc");
    price = await page.evaluate(() => document.getElementById("out").innerText);
    assert(price.includes("Pest service, prepaid year") && price.includes("$1,308.00") && price.includes("-$39.24") && price.includes("$1,268.76"), "annual prepay\n" + price);
    assert(price.includes("Sales tax 7%") && price.includes("$88.81") && price.includes("$1,357.57"), "annual prepay tax\n" + price);
    await page.select("#prepay", "mosquito");
    await page.click("#calc");
    price = await page.evaluate(() => document.getElementById("out").innerText);
    assert(price.includes("Pest service, each visit") && price.includes("$109.00") && price.includes("Prepaid-year add-on") && price.includes("$0.00"), "free mosquito offer\n" + price);
    assert(price.includes("$7.63") && price.includes("$116.63"), "free mosquito total\n" + price);
    await page.select("#prepay", "off");
    await page.click("#calc");
    price = await page.evaluate(() => document.getElementById("out").innerText);
    assert(price.includes("Pest service, each visit") && price.includes("$109.00") && !price.includes("prepaid year"), "prepay did not turn back off\n" + price);
    assert(await page.evaluate(() => { document.getElementById("service").value = "inside"; document.getElementById("service").dispatchEvent(new Event("change")); return !document.getElementById("prepay"); }), "inside picked up annual prepay");

    const serviceLabels = await page.evaluate(() => Array.from(document.getElementById("service").options).map((option) => option.textContent));
    const pestAt = serviceLabels.indexOf("Pest service");
    assert(serviceLabels[pestAt + 1] === "Pest service, outside only", "outside option is not next to pest: " + serviceLabels.join(", "));
    assert(serviceLabels[pestAt + 2] === "Pest service, inside only", "inside option is not next to outside: " + serviceLabels.join(", "));
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

    await page.select("#service", "inside");
    const insideFreq = await page.evaluate(() => Array.from(document.getElementById("freq").options).map((option) => option.value));
    assert(insideFreq.join(",") === "monthly,quarterly", "inside frequencies " + insideFreq.join(","));
    const insideSamples = [
      ["2500", "39042", "monthly", "Pest service (inside only), monthly", "$79.00", "Sales tax 7%", "$5.53", "$84.53"],
      ["2501", "39042", "monthly", "Pest service (inside only), monthly", "$89.00", "Sales tax 7%", "$6.23", "$95.23"],
      ["3500", "39204", "quarterly", "Pest service (inside only), quarterly", "$89.00", "Sales tax 8%", "$7.12", "$96.12"],
      ["3501", "39201", "quarterly", "Pest service (inside only), quarterly", "$99.00", "Sales tax 8%", "$7.92", "$106.92"],
      ["10000", "39042", "monthly", "Pest service (inside only), monthly", "$159.00", "Sales tax 7%", "$11.13", "$170.13"],
      ["12500", "39206", "quarterly", "Pest service (inside only), quarterly", "$179.00", "Sales tax 8%", "$14.32", "$193.32"]
    ];
    for (const sample of insideSamples) {
      await page.select("#service", "inside");
      await page.select("#freq", sample[2]);
      await page.evaluate((sqft, zip) => {
        document.getElementById("sqft").value = sqft;
        document.getElementById("czip").value = zip;
      }, sample[0], sample[1]);
      await page.click("#calc");
      const insidePrice = await page.evaluate(() => document.getElementById("out").innerText);
      await page.select("#service", "outside");
      await page.select("#freq", sample[2]);
      await page.evaluate((sqft, zip) => {
        document.getElementById("sqft").value = sqft;
        document.getElementById("czip").value = zip;
      }, sample[0], sample[1]);
      await page.click("#calc");
      const outsidePrice = await page.evaluate(() => document.getElementById("out").innerText);
      const normalize = (text) => text.replace(/inside only/gi, "limited").replace(/outside only/gi, "limited");
      assert(normalize(insidePrice) === normalize(outsidePrice), "inside and outside differ at " + sample[0] + " " + sample[1] + "\n" + insidePrice + "\n" + outsidePrice);
      assert(insidePrice.includes(sample[3]) && insidePrice.includes(sample[4]) && insidePrice.includes(sample[5]) && insidePrice.includes(sample[6]) && insidePrice.includes(sample[7]), "inside sample " + sample.join(" ") + "\n" + insidePrice);
    }
    await page.select("#service", "inside");
    await page.select("#freq", "quarterly");
    await page.evaluate(() => {
      document.getElementById("sqft").value = "3501";
      document.getElementById("czip").value = "39201";
      document.getElementById("agree").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    });
    const insideMail = await page.evaluate(() => ({
      customer: decodeURIComponent(document.getElementById("agree").getAttribute("href")),
      office: decodeURIComponent(document.getElementById("officecopy").getAttribute("href"))
    }));
    assert(insideMail.customer.includes("subject=Pest service (inside only), quarterly"), "inside customer subject\n" + insideMail.customer);
    assert(insideMail.customer.includes("Pest service (inside only), quarterly"), "inside customer agreement\n" + insideMail.customer);
    assert(insideMail.customer.includes("$99.00") && insideMail.customer.includes("Sales tax 8%") && insideMail.customer.includes("$7.92") && insideMail.customer.includes("$106.92"), "inside agreement total\n" + insideMail.customer);
    assert(insideMail.office.includes("subject=Office copy: Pest service (inside only), quarterly"), "inside office subject\n" + insideMail.office);
    await page.evaluate(() => { document.getElementById("czip").value = "39042"; });
    await page.click("#calc");
    await page.screenshot({ path: "/tmp/qm-inside.png", fullPage: true });
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

    const otherLabels = await page.evaluate(() => Array.from(document.getElementById("other").options).map((option) => option.textContent));
    assert(otherLabels.join("|") === [
      "Mosquito",
      "Rodent stations",
      "Rodent station service, each visit",
      "Rat cleanout",
      "Rodent / foundation exclusion",
      "Vapor barrier",
      "Crawl-space encapsulation",
      "Attic insulation removal and replacement",
      "Bat house",
      "Driveway pressure washing",
      "Gutter cleaning",
      "Leaf and limb removal",
      "Wildlife inspection",
      "Wildlife trapping and removal",
      "One-time pest",
      "Fleas"
    ].join("|"), "other options " + otherLabels.join("|"));
    assert(!otherLabels.some((label) => /commercial/i.test(label)), "commercial option present");
    const groups = await page.evaluate(() => Array.from(document.querySelectorAll("#other optgroup")).map((group) => group.label));
    assert(groups.join("|") === "Winter / exclusion|Outdoor / winter|Wildlife (check with the office)|One-time service", "groups " + groups.join("|"));
    const officeNote = await page.evaluate(() => document.getElementById("panel").innerText);
    assert(officeNote.includes("Check with the office before quoting wildlife."), "wildlife office note\n" + officeNote);

    async function showQuote() {
      await page.click("#calc");
      return page.evaluate(() => document.getElementById("out").innerText);
    }
    async function setVals(values) {
      await page.evaluate((vals) => {
        Object.keys(vals).forEach((id) => { document.getElementById(id).value = vals[id]; });
      }, values);
    }

    await page.select("#service", "other");
    await page.select("#other", "rodent");
    await setVals({ stations: "4", czip: "39042" });
    price = await showQuote();
    assert(price.includes("Rodent stations") && price.includes("$100.00"), "station boxes stayed $25\n" + price);

    await page.select("#other", "rodentService");
    const rodentFreq = await page.evaluate(() => Array.from(document.getElementById("freq").options).map((option) => option.value));
    assert(rodentFreq.join(",") === "monthly,bimonthly,quarterly", "rodent frequencies " + rodentFreq.join(","));
    const rodentTerm = await page.evaluate(() => document.getElementById("term").textContent);
    assert(rodentTerm.includes("month to month"), "rodent service term\n" + rodentTerm);
    await setVals({ stations: "0" });
    price = await showQuote();
    assert(price.includes("Enter the number of stations."), "blank stations\n" + price);
    await setVals({ stations: "3" });
    price = await showQuote();
    assert(price.includes("Rodent station service, monthly") && price.includes("$45.00"), "3 station service\n" + price);
    await page.select("#freq", "quarterly");
    await setVals({ stations: "4", czip: "39042" });
    price = await showQuote();
    assert(price.includes("Rodent station service, quarterly") && price.includes("$60.00"), "4 station service\n" + price);
    assert(price.includes("Sales tax 7%") && price.includes("$4.20") && price.includes("$64.20"), "station service tax\n" + price);
    await setVals({ czip: "39201" });
    price = await showQuote();
    assert(price.includes("Sales tax 8%") && price.includes("$4.80") && price.includes("$64.80"), "jackson station service tax\n" + price);

    await page.select("#other", "exclusion");
    assert((await page.evaluate(() => document.getElementById("winter").value)) === "0", "winter prepay shipped on");
    const exclusionTerm = await page.evaluate(() => document.getElementById("term").textContent);
    assert(exclusionTerm.includes("for this visit only"), "exclusion term\n" + exclusionTerm);
    await setVals({ openings: "10", czip: "39042" });
    price = await showQuote();
    assert(price.includes("Rodent / foundation exclusion") && price.includes("$495.00") && !price.includes("Winter-date prepay discount (10%)"), "10 openings\n" + price);
    await setVals({ openings: "16" });
    price = await showQuote();
    assert(price.includes("$765.00") && price.includes("Sales tax 7%") && price.includes("$53.55") && price.includes("$818.55"), "16 openings\n" + price);
    await page.select("#winter", "1");
    price = await showQuote();
    assert(price.includes("$765.00") && price.includes("-$76.50") && price.includes("$688.50") && price.includes("Winter-date prepay discount"), "winter exclusion\n" + price);

    await page.select("#other", "vapor");
    await setVals({ crawlsqft: "1000", czip: "39042" });
    price = await showQuote();
    assert(price.includes("Vapor barrier") && price.includes("$950.00"), "vapor\n" + price);

    await page.select("#other", "encapsulation");
    const encPanel = await page.evaluate(() => document.getElementById("panel").innerText);
    assert(encPanel.includes("Give this quote free when a tech is already writing an exclusion."), "encap note\n" + encPanel);
    assert((await page.evaluate(() => document.getElementById("dehu").value)) === "0", "dehumidifier shipped on");
    assert((await page.evaluate(() => document.getElementById("winter").value)) === "0", "encap winter shipped on");
    await setVals({ crawlsqft: "800", czip: "39042" });
    price = await showQuote();
    assert(price.includes("Crawl-space encapsulation") && price.includes("$4,500.00"), "encap minimum\n" + price);
    await setVals({ crawlsqft: "1200" });
    price = await showQuote();
    assert(price.includes("$5,400.00") && price.includes("Sales tax 7%") && price.includes("$378.00") && price.includes("$5,778.00"), "encap 1200\n" + price);
    assert(!price.includes("Crawl-space dehumidifier, installed"), "dehumidifier was included\n" + price);
    await page.select("#dehu", "1");
    await page.select("#winter", "1");
    price = await showQuote();
    assert(price.includes("$5,400.00") && price.includes("-$540.00") && price.includes("$995.00") && price.includes("$5,855.00"), "encap discount and dehumidifier\n" + price);
    assert(price.includes("$409.85") && price.includes("$6,264.85"), "encap combo tax\n" + price);

    await page.select("#other", "attic");
    await setVals({ atticsqft: "2000", czip: "39042" });
    price = await showQuote();
    assert(price.includes("Attic insulation removal") && price.includes("New blown-in insulation") && price.includes("$3,000.00") && price.includes("$6,000.00"), "attic 2000\n" + price);
    assert(!price.includes("Minimum applies"), "attic 2000 used the minimum\n" + price);
    assert(price.includes("Sales tax 7%") && price.includes("$420.00") && price.includes("$6,420.00"), "attic 2000 tax\n" + price);
    await setVals({ atticsqft: "1200" });
    price = await showQuote();
    assert(price.includes("$1,800.00") && price.includes("Minimum applies") && price.includes("$1,350.00") && price.includes("$4,950.00"), "attic 1200\n" + price);
    assert(price.includes("The $4,950 minimum applies to the whole job."), "attic minimum note\n" + price);
    assert(price.includes("$346.50") && price.includes("$5,296.50"), "attic 1200 tax\n" + price);
    await page.select("#winter", "1");
    price = await showQuote();
    assert(price.includes("-$495.00") && price.includes("$4,455.00"), "winter attic\n" + price);

    await page.select("#other", "wildlifeInspect");
    assert((await page.evaluate(() => document.getElementById("waive").value)) === "0", "inspection waive shipped on");
    await setVals({ czip: "39042" });
    price = await showQuote();
    assert(price.includes("Wildlife inspection") && price.includes("$149.00") && price.includes("$10.43") && price.includes("$159.43"), "inspection\n" + price);
    await page.select("#waive", "1");
    price = await showQuote();
    assert(price.includes("$0.00") && price.includes("Inspection fee waived"), "waived inspection\n" + price);

    await page.select("#other", "wildlife");
    await setVals({ animals: "1", czip: "39042" });
    price = await showQuote();
    assert(price.includes("Wildlife trapping and removal") && price.includes("$349.00"), "1 animal\n" + price);
    await setVals({ animals: "3" });
    price = await showQuote();
    assert(price.includes("$547.00") && price.includes("Sales tax 7%") && price.includes("$38.29") && price.includes("$585.29"), "3 animals\n" + price);
    const wildlifeTerm = await page.evaluate(() => document.getElementById("term").textContent);
    assert(wildlifeTerm.includes("for this visit only"), "wildlife term\n" + wildlifeTerm);

    await page.select("#other", "bat");
    await setVals({ bathouses: "2", czip: "39042" });
    price = await showQuote();
    assert(price.includes("Bat house") && price.includes("$80.00"), "bat houses\n" + price);

    await page.select("#other", "driveway");
    await setVals({ drivewaysqft: "0", czip: "" });
    price = await showQuote();
    assert(price.includes("Enter the driveway square feet."), "blank driveway\n" + price);
    await setVals({ drivewaysqft: "400", czip: "39042" });
    price = await showQuote();
    assert(price.includes("Driveway pressure washing") && price.includes("$165.00"), "driveway minimum\n" + price);
    await setVals({ drivewaysqft: "800" });
    price = await showQuote();
    assert(price.includes("$256.00") && price.includes("Sales tax 7%") && price.includes("$17.92") && price.includes("$273.92"), "driveway 800\n" + price);
    assert(price.includes("Oil or rust stain treatment"), "driveway note\n" + price);
    await setVals({ czip: "39201" });
    price = await showQuote();
    assert(price.includes("Sales tax 8%") && price.includes("$20.48") && price.includes("$276.48"), "jackson driveway tax\n" + price);
    const drivewayTerm = await page.evaluate(() => document.getElementById("term").textContent);
    assert(drivewayTerm.includes("for this visit only"), "driveway term\n" + drivewayTerm);

    await page.select("#other", "gutter");
    await setVals({ gutterlnft: "100", czip: "39042" });
    price = await showQuote();
    assert(price.includes("Gutter cleaning") && price.includes("$125.00"), "gutter minimum\n" + price);
    await setVals({ gutterlnft: "200" });
    price = await showQuote();
    assert(price.includes("$140.00") && price.includes("Sales tax 7%") && price.includes("$9.80") && price.includes("$149.80"), "gutter 200\n" + price);
    assert(price.includes("flushing the downspouts"), "gutter note\n" + price);

    await page.select("#other", "leaves");
    assert((await page.evaluate(() => document.getElementById("quarters").value)) === "1", "leaf load did not start at a quarter");
    await setVals({ czip: "39042" });
    price = await showQuote();
    assert(price.includes("Leaf and limb removal, quarter truck") && price.includes("$275.00"), "quarter load\n" + price);
    assert(price.includes("Sales tax 7%") && price.includes("$19.25") && price.includes("$294.25"), "quarter tax\n" + price);
    assert(price.includes("Does not include taking down a standing tree"), "leaf note\n" + price);
    await page.select("#quarters", "2");
    price = await showQuote();
    assert(price.includes("Leaf and limb removal, half truck") && price.includes("$450.00"), "half load\n" + price);
    await page.select("#quarters", "4");
    price = await showQuote();
    assert(price.includes("Leaf and limb removal, full truck") && price.includes("$725.00"), "full load\n" + price);

    await page.evaluate(() => {
      document.getElementById("cname").value = "Ada Home";
      document.getElementById("cphone").value = "6015550100";
      document.getElementById("caddress").value = "1 Main St";
      document.getElementById("cemail").value = "ada@example.com";
      document.getElementById("czip").value = "39042";
      const canvas = document.getElementById("sign");
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#111111";
      ctx.fillRect(8, 8, 30, 4);
    });
    await page.select("#other", "rodentService");
    await page.select("#freq", "quarterly");
    await setVals({ stations: "4" });
    await page.evaluate(() => {
      document.getElementById("agree").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    });
    let winterMail = await page.evaluate(() => ({
      customer: decodeURIComponent(document.getElementById("agree").getAttribute("href")),
      office: decodeURIComponent(document.getElementById("officecopy").getAttribute("href"))
    }));
    assert(winterMail.customer.includes("subject=Rodent station service, quarterly"), "rodent subject\n" + winterMail.customer);
    assert(winterMail.office.includes("subject=Office copy: Rodent station service, quarterly"), "rodent office subject\n" + winterMail.office);

    await page.select("#other", "exclusion");
    await setVals({ openings: "16" });
    await page.select("#winter", "0");
    await page.evaluate(() => {
      document.getElementById("agree").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    });
    winterMail = await page.evaluate(() => ({
      customer: decodeURIComponent(document.getElementById("agree").getAttribute("href")),
      office: decodeURIComponent(document.getElementById("officecopy").getAttribute("href"))
    }));
    assert(winterMail.customer.includes("subject=Rodent / foundation exclusion"), "exclusion subject\n" + winterMail.customer);
    assert(winterMail.office.includes("subject=Office copy: Rodent / foundation exclusion"), "exclusion office subject\n" + winterMail.office);

    await page.select("#other", "encapsulation");
    await setVals({ crawlsqft: "1200" });
    await page.evaluate(() => {
      document.getElementById("agree").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    });
    winterMail = await page.evaluate(() => decodeURIComponent(document.getElementById("agree").getAttribute("href")));
    assert(winterMail.includes("subject=Crawl-space encapsulation"), "encap subject\n" + winterMail);

    await page.select("#other", "attic");
    await setVals({ atticsqft: "2000" });
    await page.evaluate(() => {
      document.getElementById("agree").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    });
    winterMail = await page.evaluate(() => decodeURIComponent(document.getElementById("agree").getAttribute("href")));
    assert(winterMail.includes("subject=Attic insulation removal and replacement"), "attic subject\n" + winterMail);

    await page.select("#other", "wildlife");
    await setVals({ animals: "3" });
    await page.evaluate(() => {
      document.getElementById("agree").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    });
    winterMail = await page.evaluate(() => decodeURIComponent(document.getElementById("agree").getAttribute("href")));
    assert(winterMail.includes("subject=Wildlife trapping and removal"), "wildlife subject\n" + winterMail);

    await page.select("#other", "driveway");
    await setVals({ drivewaysqft: "800" });
    await page.evaluate(() => {
      document.getElementById("agree").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    });
    winterMail = await page.evaluate(() => decodeURIComponent(document.getElementById("agree").getAttribute("href")));
    assert(winterMail.includes("subject=Driveway pressure washing"), "driveway subject\n" + winterMail);

    await page.select("#other", "leaves");
    await page.select("#quarters", "1");
    await page.evaluate(() => {
      document.getElementById("agree").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    });
    winterMail = await page.evaluate(() => decodeURIComponent(document.getElementById("agree").getAttribute("href")));
    assert(winterMail.includes("subject=Leaf and limb removal, quarter truck"), "leaf subject\n" + winterMail);

    await page.select("#other", "rat");
    await page.evaluate(() => {
      document.getElementById("agree").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    });
    winterMail = await page.evaluate(() => decodeURIComponent(document.getElementById("agree").getAttribute("href")));
    assert(winterMail.includes("subject=Family Termite service agreement"), "rat subject changed\n" + winterMail);
    assert(!winterMail.includes("subject=Rat cleanout"), "rat subject became the line name\n" + winterMail);

    await page.evaluate(() => {
      ["cname", "cphone", "caddress", "cemail"].forEach((id) => { document.getElementById(id).value = ""; });
      const canvas = document.getElementById("sign");
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
      document.getElementById("czip").value = "39042";
    });
    await page.select("#other", "encapsulation");
    await setVals({ crawlsqft: "1200" });
    const encWide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    assert(!encWide, "encapsulation scrolls sideways at 390px");
    await page.setViewport({ width: 320, height: 700, isMobile: true, hasTouch: true });
    const encNarrow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    assert(!encNarrow, "encapsulation scrolls sideways at 320px");
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

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
  checkWinterPricing();
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
