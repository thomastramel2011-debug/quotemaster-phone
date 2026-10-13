# Family Termite phone quote

Techs open this page on a phone and build a service agreement. GitHub Pages serves it from the `main` branch:

https://thomastramel2011-debug.github.io/quotemaster-phone/

Someone who only has that link sees a sign-in page: the company name, a password box, and Sign in. The quote form and the agreement are encrypted. They are not in the public page. After the shared tech password is entered, the quote tool opens in the browser. The phone stays signed in for 30 days. Sign out is the button at the top of the quote.

The password is not stored in this repository. There is no guessable default. Until you seal the page, the live site is only the login screen and the quote tool will not open.

## Set or change the tech password

Use one password for every tech. Make it at least 12 characters. Do not reuse a password that was already published in this repository, and do not leave the placeholder `REPLACE_WITH_A_LONG_PASSWORD`.

Changing the password signs every phone out. Techs enter the new password once. Changing a price, without changing the password, keeps phones signed in.

### On a computer

1. Install Node.js if it is not already installed: https://nodejs.org
2. Copy `password.config.example` to a file named `password.config` in this folder.
3. Open `password.config`. Replace `REPLACE_WITH_A_LONG_PASSWORD` with the real password. Save. Spaces at the ends are ignored.
4. Run `node _build/build.js`
5. Commit `index.html` and push it to `main`.

`password.config` stays on that computer. Git ignores it. Do not commit it. Committing it would publish the password.

### On GitHub, without installing Node

The seal action has to be on `main` before GitHub will list it. Merge first, then:

1. Open the repository on GitHub.
2. Go to Settings, then Secrets and variables, then Actions, then New repository secret.
3. Name the secret exactly `QUOTEMASTER_PASSWORD`. Paste the password as the value.
4. Open Actions, then Seal site, then Run workflow, then Run workflow.
5. When it finishes, it commits a sealed `index.html` on `main`. Pages publishes that commit.

To change the password later, update that secret, or edit `password.config`, and seal again the same way.

## Fleas

Fleas is under Other / one-time, in the One-time service group, next to One-time pest. It is a two-visit one-time service. The quote shows the first visit, the second follow-up visit at $0.00, then 7% sales tax on the total of those lines.

Set the amounts in `_src/prices.config.js`:

- `fleas` is the first visit, in dollars, before tax. It is `250` right now.
- `fleasFollowUp` is the second visit. It is `0`, which the quote shows as `$0.00`.

Do not type a dollar sign. After a change, seal the page again. Editing the file on GitHub does not change the live site until the seal runs, because the live page only contains the sealed copy.

Bed bugs are not on the quote.

## What someone with only the link can see

They can see the company name, the password box, and Sign in. They cannot see the agreement, the prices, the customer form, or the password by viewing the page source or by opening the old `app.js`, `pricing.js`, or `techs.json` addresses. Those files are no longer on the site. The quote is encrypted with AES-256-GCM. The key is derived from the tech password with PBKDF2-SHA-256 at 600,000 rounds. The password itself is not in the page.

This is not a server login. The site cannot lock a person out or see who tried a password. A short password can be guessed offline, only slowly. Use a long one.

This GitHub repository is public. The editable quote is in `_src`. GitHub Pages does not publish that folder, but anyone who opens the repository on GitHub can read it. The password is not in the repository. Hiding `_src` means making the repository private. On a free GitHub plan, Pages from a private repository may be unavailable, so leave the repository public unless the plan includes private Pages.

Do not add a file named `.nojekyll`. That turns Jekyll off and would publish `_src` on the live site.

## Deploy

Pages is set to the `main` branch, folder `/`. A merge or any other push to `main` is what updates the live site. GitHub usually finishes that within a minute or two.

Quote wording, the flea price, and the password change for techs only after `index.html` is sealed again. A merge that does not seal leaves the previous public page in place. The first merge of this gate publishes the login screen only, until the password steps above have been run.

## Quoting

Does not write to Fieldster and does not open Visio files. Three footage choices. Prices follow the Quote Master: renewal $185 up to 2,500 sq ft plus $10 per started 1,000 sq ft, crawl $50, $1 per mile over 50, $0.10 per outside foot over 300, mosquito $69 under 5,000 sq ft otherwise sq ft times 0.0125 times 1.3, stations $25 each, rat cleanout $250 flat, tax 7%.

Send as Agreement builds the one-page PDF in the page itself, with no outside library: customer name, address, phone, email, service, quoted price, 7% sales tax, total, signature, printed name, and date. Customer email is required. Email sends to the customer and always copies office@family-termite.com. A text to the customer also opens that office copy. There is no way to skip the office.

Fleas uses the same visit-style agreement, written for two visits. The first visit is the `fleas` amount in `_src/prices.config.js`. The follow-up visit is `fleasFollowUp`. Tax is still 7% of the two lines together.
