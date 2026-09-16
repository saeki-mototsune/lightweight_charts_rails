// Installs a jsdom window as the global environment so that @hotwired/stimulus and the
// wrapper module can run under `node --test`. Loaded via `node --import`.
import { JSDOM } from "jsdom"

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" })

globalThis.window = dom.window
for (const key of ["document", "MutationObserver", "HTMLElement", "Element", "Node", "Event", "CustomEvent"]) {
  globalThis[key] = dom.window[key]
}
