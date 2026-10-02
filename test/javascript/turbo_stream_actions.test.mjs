import { test } from "node:test"
import assert from "node:assert/strict"
import { installTurboStreamActions } from "../../app/assets/javascripts/lightweight-charts-rails.js"

// A minimal stand-in for Turbo's turbo:before-stream-render event: `target` is the
// <turbo-stream> element (with an `action` attribute and a fake `querySelector`/`targetElements`),
// `detail.render` is the function Turbo would otherwise use to apply the stream.
function beforeStreamRenderEvent(streamElement) {
  const event = new Event("turbo:before-stream-render", { cancelable: true })
  Object.defineProperty(event, "target", { value: streamElement })
  event.detail = { render: () => { throw new Error("default render should have been replaced") } }
  return event
}

function fakeStreamElement(action, { json, targetElements }) {
  const template = { content: { textContent: JSON.stringify(json) } }
  return {
    getAttribute: (name) => (name === "action" ? action : null),
    querySelector: (selector) => (selector === "template" ? template : null),
    targetElements
  }
}

test("installTurboStreamActions replaces render for lightweight_chart_update and dispatches on every target element", () => {
  installTurboStreamActions()
  const targetA = new EventTarget()
  const targetB = new EventTarget()
  const events = []
  targetA.addEventListener("lightweight-chart:update", (event) => events.push(["a", event]))
  targetB.addEventListener("lightweight-chart:update", (event) => events.push(["b", event]))

  const streamElement = fakeStreamElement("lightweight_chart_update", {
    json: { name: "price", point: { time: 1, value: 2 } },
    targetElements: [targetA, targetB]
  })
  const event = beforeStreamRenderEvent(streamElement)
  document.dispatchEvent(event)

  event.detail.render(streamElement)

  assert.equal(events.length, 2)
  assert.deepEqual(events[0][1].detail, { name: "price", point: { time: 1, value: 2 } })
  assert.deepEqual(events[1][1].detail, { name: "price", point: { time: 1, value: 2 } })
})

test("installTurboStreamActions handles lightweight_chart_set_data", () => {
  installTurboStreamActions()
  const target = new EventTarget()
  const events = []
  target.addEventListener("lightweight-chart:set-data", (event) => events.push(event))

  const streamElement = fakeStreamElement("lightweight_chart_set_data", {
    json: { name: "price", data: [{ time: 1, value: 2 }] },
    targetElements: [target]
  })
  const event = beforeStreamRenderEvent(streamElement)
  document.dispatchEvent(event)
  event.detail.render(streamElement)

  assert.equal(events.length, 1)
  assert.deepEqual(events[0].detail, { name: "price", data: [{ time: 1, value: 2 }] })
})

test("installTurboStreamActions handles lightweight_chart_set_markers", () => {
  installTurboStreamActions()
  const target = new EventTarget()
  const events = []
  target.addEventListener("lightweight-chart:set-markers", (event) => events.push(event))

  const streamElement = fakeStreamElement("lightweight_chart_set_markers", {
    json: { name: "price", markers: [{ time: 1 }] },
    targetElements: [target]
  })
  const event = beforeStreamRenderEvent(streamElement)
  document.dispatchEvent(event)
  event.detail.render(streamElement)

  assert.equal(events.length, 1)
  assert.deepEqual(events[0].detail, { name: "price", markers: [{ time: 1 }] })
})

test("an unrelated turbo-stream action is left untouched", () => {
  installTurboStreamActions()
  const originalRender = () => "original"
  const streamElement = fakeStreamElement("replace", { json: {}, targetElements: [] })
  const event = beforeStreamRenderEvent(streamElement)
  event.detail.render = originalRender

  document.dispatchEvent(event)

  assert.equal(event.detail.render, originalRender)
})

test("installing twice does not double-dispatch", () => {
  installTurboStreamActions()
  installTurboStreamActions()

  const target = new EventTarget()
  const events = []
  target.addEventListener("lightweight-chart:update", (event) => events.push(event))

  const streamElement = fakeStreamElement("lightweight_chart_update", {
    json: { name: "price", point: { time: 1, value: 2 } },
    targetElements: [target]
  })
  const event = beforeStreamRenderEvent(streamElement)
  document.dispatchEvent(event)
  event.detail.render(streamElement)

  assert.equal(events.length, 1)
})
