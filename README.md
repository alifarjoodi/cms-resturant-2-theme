# Coffee Shop menu poster

A portrait **Menu & Price List** recreated from the reference using HTML, CSS and a small amount of vanilla JavaScript. The coffee cups—including the oversized, cropped hero cup—are drawn with CSS gradients and shapes; no image assets are required.

- `index.html` — accessible poster structure, eight drinks, brand copy, and the glass detail panel
- `style.css` — 4:5 responsive layout, typography, coffee-cup artwork, hover states, and the fold-out animation
- `app.js` — fills the glass panel from the selected menu item, handles open/close, focus, and the order button

## Interactions

**Hover a menu item** to lift it off the paper: the tile warms up, a hairline of light draws across the top, the cup floats, the price becomes an ink pill, and the other drinks recede. Keyboard focus produces the same state.

**Click a menu item** and a sheet of glass raises from a top-down view into a side-on panel docked to the right edge of the viewport. The item details sit on the left side of the glass (name, tasting notes, intensity, volume, serve temperature, price), while the drink's cup is presented on the right with a slow float. Close with the round button, `Esc`, or a click on the dimmed backdrop; the glass folds back down into a top view before the dialog closes. `Tab` stays inside the panel and focus returns to the menu item.

`prefers-reduced-motion` swaps the 3D fold for a plain fade.

## Run

Open `index.html` in a browser, or serve the folder locally:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

The poster keeps its original two-column composition at every size and scales proportionally to fit the viewport.
