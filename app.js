const SHARED = { user: "familytermite", password: "quote185" };

document.getElementById("login").addEventListener("submit", (event) => {
  event.preventDefault();
  const ok = document.getElementById("user").value.trim() === SHARED.user
    && document.getElementById("password").value === SHARED.password;
  document.getElementById("err").textContent = ok ? "" : "That login does not match.";
  document.getElementById("quote").classList.toggle("hidden", !ok);
  document.getElementById("login").classList.toggle("hidden", ok);
});

function num(id) {
  const n = parseFloat(document.getElementById(id).value);
  return Number.isFinite(n) ? n : 0;
}

document.getElementById("calc").addEventListener("click", () => {
  const result = quote({
    sqft: num("sqft"),
    lnft: num("lnft"),
    crawl: document.getElementById("crawl").value === "1",
    miles: num("miles"),
    stations: num("stations"),
    rat: document.getElementById("rat").value === "1",
    mosquito: document.getElementById("mosquito").value === "1",
    renewal: true
  });
  const line = (label, amount) => "<div>" + label + " <b>$" + amount.toFixed(2) + "</b></div>";
  document.getElementById("out").innerHTML =
    line("Yearly renewal", result.renewal) +
    line("Six-month visit (half)", result.sixMonth) +
    line("Mosquito", result.mosquito) +
    line("Rodent stations", result.stations) +
    line("Rat cleanout", result.rat) +
    line("Before tax", result.subtotal) +
    line("Tax", result.tax) +
    line("Total", result.total);
});
