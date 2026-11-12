# Thiel Network Map

An interactive map of the people, companies and projects connected to Peter Thiel, as described in *The Nerd Reich* by Gil Duran.

## Using it

- Hover a card to trace its connections; click it to pin it and read the details. Clicking any badge, filter chip or government count spotlights the matching cards; click it again to clear.
- With a card pinned, **How is it connected to…** finds the chain between two cards, with or without going through Thiel.
- The address bar mirrors the view, so any view can be shared, for example `#card=Yarvin&to=Vance`, `#filter=crypto` or `#q=greenland`.
- Shortcuts: `/` search, `L` legend, `D` details panel, `?` help, `Esc` clear.

## Files

- `index.html`: the interactive page. Open it in a browser; no build or internet needed. It loads the three files below from the same folder, so keep them together.
- `data.js`: all map content (people, connections, sources, Wikipedia names, summary facts). Edit content here.
- `app.js`: behaviour. Each kind of badge, detail block and filter chip is one entry in `FACETS`; kinds of government reach are in `GOV`.
- `styles.css`: look and feel. Light/dark colours are defined once each with `light-dark()`; category text colours are checked for WCAG 2.1 AA contrast.
- `bump-version.js`: `node bump-version.js 1.17` updates the version shown in the header and in the `?v=` cache-busting suffix on the three files above (do this on every release so browsers never mix new and cached old files).
- `build-static.js`: `node build-static.js` writes a plain-text copy of the whole map into `index.html` (inside `<noscript>`) for search engines, social-media crawlers and visitors with JavaScript off. Rerun it after changing `data.js`; `node check.js` fails if the copy is stale.
- `social.png`: the preview image shown when the site is shared.
- `robots.txt`: allows search engines to index the page.

## Checks

- `node check.js` validates `data.js` (every connection points at a real card, no duplicates, nothing orphaned, fields have the right shape).
- `tests/smoke.html` loads the real page in a frame and exercises filters, search, pinning, paths and the address bar. Open it in a browser; the title becomes PASS or FAIL.
- `node check-links.js` confirms every Wikipedia link still resolves.
- `npm install && node tests/a11y.js` loads the real page in light and dark mode (home, a card pinned, a filter on, the help open) and fails on any script error, Content-Security-Policy violation or axe accessibility violation. `package.json` lists development tooling only; the site itself has no dependencies.
- `node tests/lighthouse.js` audits the site with Lighthouse on a throttled mobile profile and fails if Performance falls below 90, Accessibility below 100, Best Practices below 95 or SEO below 90, or if the page grows past 100 KB over the wire. (SEO tops out near 91 because the page's strict policy blocks Lighthouse's own robots.txt fetch; the file exists and is fine.)
- `.github/workflows/checks.yml` runs all of the above on GitHub (pull requests, and weekly with the link check).
- `.github/workflows/pages.yml` publishes the site, but only after every check passes. In the repository settings, Pages must use the source **GitHub Actions**.
- `.github/dependabot.yml` proposes weekly, grouped updates to the pinned GitHub Actions and the development tooling (only releases at least 14 days old). The actions in the workflows are pinned to exact commits.

## Working on it

`main` is protected: change it through a pull request, which must pass the checks (data, browser test, accessibility, Lighthouse) before it can be merged. Merging publishes the site. After editing `data.js`, run `node build-static.js` and `node check.js`.

## Security

`index.html` carries a Content-Security-Policy: scripts and styles may come only from the site's own files plus the single inline script (allowed by its hash), and nothing may be fetched from elsewhere. `node check.js` verifies that hash, so changing that inline script means updating the hash in the meta tag. Inline `style="…"` attributes are not allowed; set properties from script instead.

The source book is not in this repository (it is copyrighted); `.gitignore` keeps any local copy out.
