#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ITERATIONS = 600000;
const PLACEHOLDER = "REPLACE_WITH_A_LONG_PASSWORD";
const USER_PLACEHOLDER = "REPLACE_WITH_THE_SHARED_USERNAME";
const BANNED = new Set([PLACEHOLDER, "quote185", "password", "changeme", "change-me"]);
const LEAKS = [
  "Integrated Pest Management Service Agreement",
  "Either party may cancel it in writing",
  "THIS AGREEMENT COVERS ONLY THE PREMISES AND PESTS SPECIFIED BELOW",
  "office@family-termite.com",
  "Scheduled as two visits",
  "Second follow-up visit",
  "pretreatPerSqFt",
  "Pest service (outside only)"
];

function args() {
  const parsed = { loginOnly: false, dest: path.join(ROOT, "index.html") };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--login-only") parsed.loginOnly = true;
    else if (argv[i] === "--out") {
      parsed.dest = path.resolve(argv[++i] || "");
      if (!parsed.dest) {
        console.error("Missing a file path after --out.");
        process.exit(1);
      }
    } else {
      console.error("Unknown argument: " + argv[i]);
      process.exit(1);
    }
  }
  return parsed;
}

function configValue(name) {
  if (Object.prototype.hasOwnProperty.call(process.env, name)) return String(process.env[name]).trim();
  const file = path.join(ROOT, "password.config");
  if (!fs.existsSync(file)) return "";
  const line = fs.readFileSync(file, "utf8").split(/\r?\n/).find((item) => item.startsWith(name + "="));
  if (!line) return "";
  return line.slice(name.length + 1).trim();
}

function readLogin() {
  const username = configValue("QUOTEMASTER_USERNAME");
  const password = configValue("QUOTEMASTER_PASSWORD");
  if (!username || !password) {
    console.error("The shared tech username and password are not set.");
    console.error("Copy password.config.example to password.config and set QUOTEMASTER_USERNAME and QUOTEMASTER_PASSWORD.");
    console.error("Or set both QUOTEMASTER_USERNAME and QUOTEMASTER_PASSWORD in the environment.");
    process.exit(1);
  }
  return { username: username, password: password };
}

function loginMaterial(username, password) {
  return username + "\0" + password;
}

function checkLogin(login) {
  if (!login.username || login.username === USER_PLACEHOLDER || login.username.length < 2 || login.username.includes("\0")) {
    console.error("The shared username is still the placeholder, or it is too short.");
    console.error("Set QUOTEMASTER_USERNAME to one username for every tech.");
    process.exit(1);
  }
  if (!login.password || BANNED.has(login.password) || login.password.length < 8) {
    console.error("The tech password is still the placeholder, or it is shorter than 8 characters.");
    console.error("Set a password of at least 8 characters. Do not reuse a password already published in this repository.");
    process.exit(1);
  }
}

function readSeal(html) {
  const open = '<script id="sealed" type="application/json">';
  const start = html.indexOf(open);
  if (start < 0) return null;
  const from = start + open.length;
  const end = html.indexOf("</script>", from);
  if (end < 0) return null;
  try {
    return JSON.parse(html.slice(from, end));
  } catch (error) {
    return null;
  }
}

function passwordStillOpens(login, existing) {
  if (!existing || existing.configured !== true || existing.iter !== ITERATIONS) return false;
  if (!existing.salt || !existing.iv || !existing.ct) return false;
  try {
    const salt = Buffer.from(existing.salt, "base64");
    const key = crypto.pbkdf2Sync(loginMaterial(login.username, login.password), salt, ITERATIONS, 32, "sha256");
    const iv = Buffer.from(existing.iv, "base64");
    const ct = Buffer.from(existing.ct, "base64");
    const tag = ct.subarray(ct.length - 16);
    const data = ct.subarray(0, ct.length - 16);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    decipher.update(data);
    decipher.final();
    return salt;
  } catch (error) {
    return false;
  }
}

function encrypt(login, plaintext, salt) {
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(loginMaterial(login.username, login.password), salt, ITERATIONS, 32, "sha256");
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return {
    v: 1,
    configured: true,
    iter: ITERATIONS,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    ct: ct.toString("base64")
  };
}

function quotePlaintext() {
  const quote = fs.readFileSync(path.join(ROOT, "_src/quote.html"), "utf8");
  const prices = fs.readFileSync(path.join(ROOT, "_src/prices.config.js"), "utf8");
  const pricing = fs.readFileSync(path.join(ROOT, "_src/pricing.js"), "utf8");
  const app = fs.readFileSync(path.join(ROOT, "_src/app.js"), "utf8");
  try {
    const table = new Function(prices + "\nreturn ONE_TIME_PRICES;")();
    if (!table || typeof table.fleas === "undefined" || typeof table.fleasFollowUp === "undefined") {
      throw new Error("fleas and fleasFollowUp are both required.");
    }
  } catch (error) {
    console.error("Could not read _src/prices.config.js.");
    console.error(error.message);
    process.exit(1);
  }
  return JSON.stringify({ html: quote, js: [prices, pricing, app] });
}

function renderPage(sealed) {
  const template = fs.readFileSync(path.join(__dirname, "page.html"), "utf8");
  const gate = fs.readFileSync(path.join(__dirname, "gate.js"), "utf8");
  if (gate.includes("___SEALED_JSON___") || gate.includes("___GATE_SCRIPT___") || gate.includes("</script>")) {
    console.error("The sign-in script has a marker that would break the page.");
    process.exit(1);
  }
  const json = JSON.stringify(sealed).replace(/</g, "\\u003c");
  const html = template.split("___SEALED_JSON___").join(json).split("___GATE_SCRIPT___").join(gate);
  if (html.includes("___SEALED_JSON___") || html.includes("___GATE_SCRIPT___")) {
    console.error("The page template still has an unfilled marker.");
    process.exit(1);
  }
  const leaked = LEAKS.filter((marker) => html.includes(marker));
  if (leaked.length) {
    console.error("Refusing to write the page. Agreement text would be visible in the public file.");
    process.exit(1);
  }
  return html.endsWith("\n") ? html : html + "\n";
}

function main() {
  const options = args();
  let sealed = { v: 1, configured: false };
  if (!options.loginOnly) {
    const login = readLogin();
    checkLogin(login);
    const previous = fs.existsSync(options.dest) ? fs.readFileSync(options.dest, "utf8") : "";
    const reused = passwordStillOpens(login, readSeal(previous));
    const salt = reused || crypto.randomBytes(16);
    sealed = encrypt(login, quotePlaintext(), salt);
  }
  const html = renderPage(sealed);
  fs.mkdirSync(path.dirname(options.dest), { recursive: true });
  fs.writeFileSync(options.dest, html);
  if (options.loginOnly) console.log("Wrote the login page only. It is not sealed with a password yet.");
  else console.log("Sealed the quote page.");
}

main();
