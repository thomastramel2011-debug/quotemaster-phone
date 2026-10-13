(function () {
  var SESSION_KEY = "familyTermiteQuoteSession";
  var REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;
  var sealed = JSON.parse(document.getElementById("sealed").textContent);
  var form = document.getElementById("login");
  var passwordInput = document.getElementById("password");
  var err = document.getElementById("err");
  var button = document.getElementById("signin");
  var gate = document.getElementById("gate");
  var sessionBox = document.getElementById("session");
  var opening = document.getElementById("opening");
  var busy = false;

  function b64ToBytes(b64) {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function bytesToB64(bytes) {
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  function loadSession() {
    var raw;
    try { raw = localStorage.getItem(SESSION_KEY); } catch (e) { return null; }
    if (!raw) return null;
    try {
      var record = JSON.parse(raw);
      if (!record || typeof record.key !== "string" || typeof record.exp !== "number" || record.exp < Date.now()) {
        clearSession();
        return null;
      }
      return record;
    } catch (e) {
      clearSession();
      return null;
    }
  }

  function saveSession(key) {
    return crypto.subtle.exportKey("raw", key).then(function (raw) {
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify({
          exp: Date.now() + REMEMBER_MS,
          key: bytesToB64(new Uint8Array(raw))
        }));
      } catch (e) {}
    });
  }

  function deriveKey(password) {
    return crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    ).then(function (base) {
      return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: b64ToBytes(sealed.salt), iterations: sealed.iter, hash: "SHA-256" },
        base,
        { name: "AES-GCM", length: 256 },
        true,
        ["decrypt"]
      );
    });
  }

  function importSessionKey(b64) {
    return crypto.subtle.importKey("raw", b64ToBytes(b64), { name: "AES-GCM" }, false, ["decrypt"]);
  }

  function decryptWith(key) {
    return crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64ToBytes(sealed.iv) },
      key,
      b64ToBytes(sealed.ct)
    ).then(function (plain) {
      return new TextDecoder().decode(plain);
    });
  }

  function showGate(message) {
    busy = false;
    button.disabled = false;
    button.textContent = "Sign in";
    opening.hidden = true;
    sessionBox.hidden = true;
    gate.hidden = false;
    err.textContent = message || "";
    if (!message) passwordInput.focus();
  }

  function openQuote(text) {
    var payload = JSON.parse(text);
    var app = document.getElementById("app");
    app.innerHTML = payload.html || "";
    (payload.js || []).forEach(function (code) {
      var script = document.createElement("script");
      script.textContent = code;
      document.body.appendChild(script);
    });
    passwordInput.value = "";
    gate.hidden = true;
    opening.hidden = true;
    sessionBox.hidden = false;
    busy = false;
  }

  function fail(error) {
    var wrong = error && (error.name === "OperationError" || error.name === "InvalidAccessError");
    showGate(wrong ? "That password does not match." : "Could not open the quote tool on this phone.");
  }

  document.getElementById("signout").addEventListener("click", function () {
    clearSession();
    location.reload();
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (busy) return;
    if (!window.crypto || !crypto.subtle) {
      showGate("This phone cannot open the quote tool. Update the browser and try again.");
      return;
    }
    if (!sealed || sealed.configured !== true) {
      showGate("Sign-in is not set up yet. Call the office.");
      return;
    }
    var password = passwordInput.value;
    if (!password) {
      showGate("Enter the tech password.");
      return;
    }
    busy = true;
    button.disabled = true;
    button.textContent = "Checking…";
    err.textContent = "";
    window.requestAnimationFrame(function () {
      window.setTimeout(function () {
        deriveKey(password).then(function (key) {
          return decryptWith(key).then(function (text) {
            return saveSession(key).then(function () { return text; });
          });
        }).then(openQuote).catch(function (error) {
          clearSession();
          fail(error);
        });
      }, 30);
    });
  });

  if (!window.crypto || !crypto.subtle) {
    showGate("This phone cannot open the quote tool. Update the browser and try again.");
    return;
  }
  var saved = sealed && sealed.configured === true ? loadSession() : null;
  if (saved) {
    gate.hidden = true;
    opening.hidden = false;
    busy = true;
    importSessionKey(saved.key).then(decryptWith).then(openQuote).catch(function () {
      clearSession();
      showGate("");
    });
  } else {
    passwordInput.focus();
  }
})();
