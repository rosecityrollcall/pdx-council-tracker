# Deploying Rose City Roll Call (pseudonymously)

This site is published under a project identity, not a personal one. The steps below keep
the public record — commits, account, domain — unlinkable to the maintainer at the
public level. (Platform operators and registrars always know more than the public does;
see the threat-model note at the end.)

## 1. Project identity

1. In a private browser window, create a fresh email address for the project (Proton
   Mail or similar). Use it for nothing else.
2. Still in the private window, create a new GitHub account with that email. Pick a
   username that names the project, not a person (e.g. `rosecityrollcall`). Free tier —
   no payment method, so no billing identity. Enable 2FA.
3. Leave the GitHub profile empty: no name, no location, no links.
4. GitHub → Settings → Emails: check **Keep my email addresses private** and **Block
   command line pushes that expose my email**.

## 2. Push

The repo's git history is a single commit authored by a neutral project identity
(`.git/config` sets it repo-locally, so other work on this machine is unaffected).
Create the repository on github.com (public), then:

```bash
git remote add origin https://<username>@github.com/<username>/pdx-council-tracker.git
git push -u origin main
```

Embedding `<username>@` in the URL keys Windows Credential Manager to this account
specifically, so it never collides with any other GitHub credential on the machine.
Authenticate with a fine-grained personal access token (repo scope), not a password.

## 3. Turn on the automation

1. Repo → Settings → Pages → Source: **GitHub Actions**.
2. Actions tab → "Update vote data and deploy" → Run workflow. Watch the scrape logs —
   this is the Python parser's first-ever run; diff its output against the current
   `data/items.json` (independently extracted from the same official pages) and
   investigate any disagreement.
3. Site appears at `https://<username>.github.io/pdx-council-tracker/`. The weekly cron
   (Fridays) keeps it current with no further involvement.

Scheduled workflow commits are authored by the bot identity in the workflow file —
nothing personal enters the history.

## 4. Domain (optional)

- The `github.io` address is pseudonymous by default and costs nothing.
- A custom domain: register it with WHOIS privacy (default on most TLDs now) and it is
  unlinkable at the public level. Do NOT reuse a registrar account tied to other
  personal or business domains if account-level separation matters to you — the
  registrar always knows who paid.
- Do not point any personal or business domain, site, or social account at the project.

## 5. Ongoing hygiene

- Announce/share the site only from project-identity accounts.
- Public contact = the project email or GitHub Issues, never a personal address.
- Before any push, a quick leak check:
  `git log --format="%an <%ae>" | sort -u` (authors) and
  `git grep -il <your-name-fragments>` (contents).

## Threat-model note

These steps achieve **public-level unlinkability**: readers, reporters, and the people
the site covers cannot connect it to the maintainer. GitHub, the email provider, and a
registrar could — under legal process — connect the account to sign-up metadata. If that
stronger separation matters, create and always access the project accounts behind a VPN
and keep payment out of the loop entirely (github.io, free email tier). For a civic
vote tracker built entirely on public records, public-level separation is usually the
appropriate bar.

## Before public launch — editorial checklist

- [ ] The Moda annotation is marked `"draft": true`: re-verify the press quotes verbatim
      against the linked OPB/Willamette Week articles (they passed through automated
      summarization), then remove the draft flag.
- [ ] Watch the [Aug 6 PM session video](https://www.youtube.com/watch?v=qM1xO2aDjHc) to
      settle whether Zimmerman spoke during the amendment debate before publishing any
      claim about silence — the roll calls alone are what's verified today.
- [ ] Aug 12: the Moda final vote lands. Re-run the Actions workflow that evening — the
      resolution page will carry the final roll call.
- [ ] The vote data is scraped from official pages, but this is an independent site:
      keep the About-page disclaimer and correction path visible.
