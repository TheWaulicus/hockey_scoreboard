# Hockey Scoreboard

A modern, responsive hockey scoreboard web app. No dependencies—just open in your browser.

## Files

- `index.html`: Main HTML file. References external CSS and JS.
- `scoreboard.css`: All styles for layout, grid, modal, and responsive design.
- `scoreboard.js`: All logic for timer, period, scores, shots, team/league names and logos, settings modal, and penalties.

## Usage

1. Open `index.html` in any modern web browser.
2. Edit league and team names by clicking the settings button (top right).
3. Upload logos for league and teams in the settings modal.
4. Use + and - buttons to increment/decrement scores and shots for each team.
5. Add penalties for each team, set player number and minutes, and control timers.
6. All changes are in-memory (refreshing resets the scoreboard).

## Development

- All code is modular and split for maintainability.
- To change styles, edit `scoreboard.css`.
- To change logic, edit `scoreboard.js`.

---

**Principles:**

- Modular, maintainable, and scalable code.
- No hardcoded values; all UI text and state are dynamic.
- Follows best practices for HTML, CSS, and JS separation.

- Shots and timeouts controls for each team now have their label above, and the - number + controls in a horizontal row below, for improved vertical alignment and clarity.

- Team logo images are now larger for better visibility: 140x140px on desktop, 90x90px on mobile.

- The bottom team pods have been removed for a cleaner layout.
- The main team logos in the scoreboard are now much larger (220x220px desktop, 120x120px mobile).
