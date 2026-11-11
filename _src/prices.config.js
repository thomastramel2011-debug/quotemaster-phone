// Thomas sets the flea price in this file.
//
// fleas is the first visit, in dollars, before sales tax.
// fleasFollowUp is the second visit. 0 shows as $0.00 on the quote.
// The quote page adds 7% sales tax on its own. Do not type a dollar sign.
//
// Example, if the first visit changes later:
//   fleas: 275,
//
// Saving this file does not change the live site. Seal the page again afterward.
// The README section "Set or change the tech password" says how.
const ONE_TIME_PRICES = {
  fleas: 250,
  fleasFollowUp: 0
};

// Wildlife inspection and trapping show only when this is true.
// Leave it true so those lines show. Set it to false to hide them
// when the company does not hold the Mississippi nuisance-wildlife authority.
// Check with the office before quoting wildlife.
const OFFER_WILDLIFE = true;
