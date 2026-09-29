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
  taxRate: 0.07
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

function quote(input) {
  const renewal = yearlyRenewal(input.sqft, input.lnft, input.crawl, input.miles);
  const mosquitoPrice = input.mosquito ? mosquito(input.sqft) : 0;
  const stations = money(input.stations * RATES.rodentBox);
  const rat = input.rat ? RATES.ratCleanout : 0;
  const subtotal = money(renewal * (input.renewal ? 1 : 0) + mosquitoPrice + stations + rat);
  return {
    renewal,
    sixMonth: money(renewal / 2),
    mosquito: mosquitoPrice,
    stations,
    rat,
    subtotal,
    tax: money(subtotal * RATES.taxRate),
    total: money(subtotal * (1 + RATES.taxRate))
  };
}
