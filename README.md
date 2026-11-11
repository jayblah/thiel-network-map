# Thiel Network Map

An interactive map of the people, companies and projects connected to Peter Thiel, as described in *The Nerd Reich* by Gil Duran.

- `index.html`: the interactive page. Open it in a browser; no build or internet needed. It loads the three files below from the same folder, so keep them together.
- `data.js`: all map content (people, links, sources, Wikipedia names, summary facts). Edit content here.
- `app.js`: behaviour. Badges/detail blocks are one entry each in `FACETS`, filters one entry each in `FILTERS`.
- `styles.css`: look and feel. Light/dark colours are defined once each with `light-dark()`; category text colours are checked for WCAG 2.1 AA contrast.
- `thiel-network.md` / `thiel-network.mmd`: the same data as a Mermaid diagram, plus Wikipedia links

**Source and caveats.** Every relationship, funding figure and characterization comes from that one book and reflects its author's account and framing, not independent verification. Labels such as "anti-democracy views" are the book's description of a person, not necessarily their own. Wikipedia links were checked to point at the right person or organization, but not every card has one.
