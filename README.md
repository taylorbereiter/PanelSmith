# Panelsmith

A comic book creator for people who write but do not draw. It runs entirely in the browser.

You write a script, the app lays out the pages and letters them, you block out each panel
with posable figures and props, and an image model turns that set up into finished art.

## How it works

1. **Script.** Type the script as plain text on the left. `PAGE`, `PANEL`, a description, then
   lines such as `MARA: Hello`. The page updates as you type. Captions, thought clouds,
   shouts, whispers and sound effects each get their own lettering.
2. **Set up.** Open a panel and stage it. The 2D stage has jointed figures you pose by dragging,
   props, backgrounds, a pencil, shapes and a light. The 3D stage has posable mannequins,
   props and a free camera. You can switch between them per panel.
3. **Stylize.** The app sends the set up picture, each character's reference sheet, the panel
   description and the comic's style to the OpenAI Images API. You pick the option you like.
   You can also generate from the script alone, upload your own art, or keep the set up as is.
4. **Export.** PNG per page, a print-ready PDF, a vertical scroll strip, or a project file.

## Running it

Open `dist/index.html` in a browser. That single file is the whole app.

To build from source:

```
npm install
npm run build     # writes dist/index.html
npm start         # builds, then serves dist/ at http://localhost:5173
```

## Image generation

Stylize needs an OpenAI API key. Add it under Settings (the gear icon). The key is stored in
your browser's local storage, is sent only to the API host, and is never written into
project files or exports. Requests go straight from your browser to OpenAI and are billed to
your account. ChatGPT Pro and Business subscribers can use their monthly API credits.

The default model is `gpt-image-2.5-sunburst`. You can change the model and the API base URL
in Settings.

## Where your work is kept

Comics are saved automatically in the browser's IndexedDB storage, on your machine. Use
Export, Save project file to back up a comic or move it to another browser.

## Project layout

```
src/
  main.jsx        app shell and shortcuts
  store.js        state, undo history, autosave
  script.js       script parser and merge into the document
  layout.js       page geometry
  render.js       lettering and page drawing primitives
  pageview.jsx    interactive page
  editor.jsx      script pane, page, inspector
  workspace.jsx   panel workspace and stylize panel
  stage2d.jsx     2D stage        figure2d.jsx, library2d.jsx
  stage3d.jsx     3D stage (three.js)
  ai.js           OpenAI Images API calls and prompt building
  characters.jsx  character sheets
  exporter.js     PNG, PDF, strip and project file export
scripts/build.mjs bundles everything into one HTML file with esbuild
```

Built with Preact, three.js, jsPDF and esbuild. Lettering uses Comic Neue and Bangers, both
under the SIL Open Font License.

## License

MIT
