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
  boosterOff: 0.3,
  taxRate: 0.07,
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

function oneTime(sqft) {
  if (sqft > RATES.oneTimeTopSqFt) {
    const steps = Math.ceil((sqft - RATES.oneTimeTopSqFt) / RATES.oneTimeStepSqFt);
    return money(RATES.oneTimeTop + RATES.oneTimeStep * steps);
  }
  const steps = Math.ceil(Math.max(0, sqft - RATES.oneTimeBaseSqFt) / RATES.oneTimeStepSqFt);
  return money(Math.max(RATES.oneTimeMin, RATES.oneTimeMin + RATES.oneTimeStep * steps));
}

function postTreat(ln, drillLn) {
  const raw = ln * RATES.postPerFt + drillLn * RATES.postDrillPerFt;
  return money(Math.max(RATES.postMin, raw));
}
function pretreatPrice(sqft) {
  return money(Math.max(RATES.pretreatMin, sqft * RATES.pretreatPerSqFt));
}

function quote(input) {
  const renewal = yearlyRenewal(input.sqft, input.lnft, input.crawl, input.miles);
  const mosquitoPrice = input.mosquito ? mosquito(input.sqft) : 0;
  const stations = money(input.stations * RATES.rodentBox);
  const rat = input.rat ? RATES.ratCleanout : 0;
  const oneTimePrice = input.oneTime ? oneTime(input.sqft) : 0;
  const pretreat = input.pretreat ? money(pretreatPrice(input.sqft)) : 0;
  const post = input.post ? postTreat(input.lnft + (input.extraLn || 0), input.drillLn || 0) : 0;
  const booster = input.booster ? money(post * (1 - RATES.boosterOff)) : 0;
  const subtotal = money(renewal * (input.renewal ? 1 : 0) + mosquitoPrice + stations + rat + oneTimePrice + (input.booster ? booster : post) + pretreat);
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
    tax: money(subtotal * RATES.taxRate),
    total: money(subtotal * (1 + RATES.taxRate))
  };
}
