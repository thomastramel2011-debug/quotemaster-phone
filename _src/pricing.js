// Rates from Family Termite Quote Master, confirmed 2026-09-29.
const RATES = {
  renewalBase: 185,
  renewalBaseSqFt: 2500,
  renewalStepSqFt: 1000,
  renewalStep: 10,
  crawlSurcharge: 50,
  travelFreeMiles: 50,
  travelPerMile: 1,
  over300PerFt: 0.1,
  mosquitoUnderSqFt: 5000,
  mosquitoUnder: 69,
  mosquitoRate: 0.0125,
  mosquitoMultiplier: 1.3,
  rodentBox: 25,
  ratCleanout: 250,
  pretreatPerSqFt: 0.20,
  pretreatMin: 189,
  boosterOff: 0.6, // booster = 40% of post-treat (Thomas 2026-10-09)
  taxRate: 0.07, // Mississippi state sales tax, everywhere outside the City of Jackson
  jacksonTaxRate: 0.08, // 7% state + 1% Jackson Special Infrastructure Tax, inside the city only
  oneTimeMin: 209,
  oneTimeBaseSqFt: 2500,
  oneTimeStepSqFt: 500,
  oneTimeStep: 10,
  oneTimeTopSqFt: 9500,
  oneTimeTop: 349,
  postMin: 690,
  postPerFt: 4.745,
  postDrillPerFt: 5.20
};

function money(n) {
  return Math.round(n * 100) / 100;
}

// City of Jackson, Mississippi delivery ZIPs. A ZIP is listed only when Jackson city
// (Census GEOID 2836000) is a majority of that 2020 ZCTA's land area in the Census
// Bureau ZCTA-to-Place relationship file:
// https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_place20_natl.txt
// 8% is the 7% state rate plus the 1% Jackson Special Infrastructure Tax on sales
// inside the municipality (Mississippi DOR; House Bill 787, 2014; in force until July 1, 2035):
// https://www.dor.ms.gov/business/sales-and-use-tax/tourism-and-economic-development-taxes
// Nearby USPS "Jackson" ZIPs that are mostly outside the city, including 39208, 39209,
// 39232, and 39272, stay at 7%.
const JACKSON_ZIPS = {
  "39174": true,
  "39201": true,
  "39202": true,
  "39203": true,
  "39204": true,
  "39206": true,
  "39210": true,
  "39211": true,
  "39212": true,
  "39213": true,
  "39216": true,
  "39217": true,
  "39269": true
};

function normalizeZip(value) {
  const match = String(value || "").trim().match(/^(\d{5})(?:-\d{4})?$/);
  return match ? match[1] : "";
}

function taxRateForZip(zip) {
  const digits = normalizeZip(zip);
  if (digits && JACKSON_ZIPS[digits]) return RATES.jacksonTaxRate;
  return RATES.taxRate;
}

function salesTaxLabel(rate) {
  return "Sales tax " + Math.round(rate * 100) + "%";
}

function yearlyRenewal(sqft, lnft, crawl, miles) {
  const steps = Math.ceil(Math.max(0, sqft - RATES.renewalBaseSqFt) / RATES.renewalStepSqFt);
  let price = RATES.renewalBase + RATES.renewalStep * (Number.isFinite(steps) ? steps : 0);
  if (crawl) price += RATES.crawlSurcharge;
  price += Math.max(0, miles - RATES.travelFreeMiles) * RATES.travelPerMile;
  if (lnft > 300) price += RATES.over300PerFt * lnft;
  return money(price);
}

function mosquito(sqft) {
  if (!sqft) return 0;
  if (sqft < RATES.mosquitoUnderSqFt) return RATES.mosquitoUnder;
  return money(sqft * RATES.mosquitoRate * RATES.mosquitoMultiplier);
}

function contractPest(sqft) {
  const steps = Math.ceil(Math.max(0, sqft - 2500) / 1000);
  return money(109 + 10 * (Number.isFinite(steps) ? steps : 0));
}

// Outside-only pest uses the same 2,500 sq ft tier and started-1,000 rounding, from $79.
function outsidePest(sqft) {
  const steps = Math.ceil(Math.max(0, sqft - 2500) / 1000);
  return money(79 + 10 * (Number.isFinite(steps) ? steps : 0));
}

// Inside-only pest is priced exactly like outside-only: $79, then $10 per started 1,000.
function insidePest(sqft) {
  const steps = Math.ceil(Math.max(0, sqft - 2500) / 1000);
  return money(79 + 10 * (Number.isFinite(steps) ? steps : 0));
}

function oneTime(sqft) {
  if (sqft > RATES.oneTimeTopSqFt) {
    const steps = Math.ceil((sqft - RATES.oneTimeTopSqFt) / RATES.oneTimeStepSqFt);
    return money(RATES.oneTimeTop + RATES.oneTimeStep * steps);
  }
  const steps = Math.ceil(Math.max(0, sqft - RATES.oneTimeBaseSqFt) / RATES.oneTimeStepSqFt);
  return money(Math.max(RATES.oneTimeMin, RATES.oneTimeMin + RATES.oneTimeStep * steps));
}

function postTreat(ln, drillLn) {
  // Thousandths of a dollar keep $4.745 and $5.20 on the cent.
  // 411 ft at $4.745 plus 100 drilled ft is $2,470.20, not $2,470.19.
  const regularThou = ln * Math.round(RATES.postPerFt * 1000);
  const drillThou = drillLn * Math.round(RATES.postDrillPerFt * 1000);
  const raw = Math.round((regularThou + drillThou) / 10) / 100;
  return money(Math.max(RATES.postMin, raw));
}
function pretreatPrice(sqft) {
  return money(Math.max(RATES.pretreatMin, sqft * RATES.pretreatPerSqFt));
}

// Dollar amount from _src/prices.config.js. PLACEHOLDER and blank values are not quotes.
function configuredVisitPrice(kind) {
  if (typeof ONE_TIME_PRICES === "undefined" || !Object.prototype.hasOwnProperty.call(ONE_TIME_PRICES, kind)) {
    return { status: "missing" };
  }
  const raw = ONE_TIME_PRICES[kind];
  if (typeof raw === "string" && raw.trim().toUpperCase() === "PLACEHOLDER") return { status: "placeholder" };
  if (typeof raw === "string" && raw.trim() === "") return { status: "placeholder" };
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) return { status: "invalid" };
  return { status: "ok", amount: money(n) };
}

function quote(input) {
  const renewal = yearlyRenewal(input.sqft, input.lnft, input.crawl, input.miles);
  const mosquitoPrice = input.mosquito ? mosquito(input.sqft) : 0;
  const stations = money(input.stations * RATES.rodentBox);
  const rat = input.rat ? RATES.ratCleanout : 0;
  const oneTimePrice = input.oneTime ? oneTime(input.sqft) : 0;
  const pretreat = input.pretreat ? money(pretreatPrice(input.sqft)) : 0;
  const drillTotal = (input.drillLn || 0) + (input.ejLn || 0) + (input.bvLn || 0);
  const post = input.post ? postTreat(input.lnft + (input.extraLn || 0), drillTotal) : 0;
  const booster = input.booster ? money(post * (1 - RATES.boosterOff)) : 0;
  const subtotal = money(renewal * (input.renewal ? 1 : 0) + mosquitoPrice + stations + rat + oneTimePrice + (input.booster ? booster : post) + pretreat);
  const rate = taxRateForZip(input.zip);
  const tax = money(subtotal * rate);
  return {
    renewal,
    sixMonth: money(renewal / 2),
    mosquito: mosquitoPrice,
    stations,
    rat,
    oneTime: oneTimePrice,
    post,
    booster,
    pretreat,
    subtotal,
    taxRate: rate,
    tax,
    total: money(subtotal + tax)
  };
}
