import { test, beforeEach, afterEach } from "node:test"
import assert from "node:assert/strict"
import { Application } from "@hotwired/stimulus"
import { LineSeries, AreaSeries } from "lightweight-charts"
import LightweightChartController, { ChartHost } from "../../app/assets/javascripts/lightweight-charts-rails.js"
import { fakeCreateChart, fakeCreateSeriesMarkers } from "./support/fake_chart.mjs"

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

let application
let calls

class TestController extends LightweightChartController {
  static chartHostOptions = {}
}

class SubclassController extends LightweightChartController {
  static values = { label: String }
  static chartHostOptions = {}

  connect() {
    super.connect()
    this.addSeries("Area", { color: "green" }, { name: this.labelValue, data: [{ time: 1, value: 1 }] })
  }
}

beforeEach(() => {
  calls = []
  TestController.chartHostOptions = { createChart: fakeCreateChart(calls), createSeriesMarkers: fakeCreateSeriesMarkers(calls) }
  SubclassController.chartHostOptions = { createChart: fakeCreateChart(calls), createSeriesMarkers: fakeCreateSeriesMarkers(calls) }
  application = Application.start(document.documentElement)
  application.register("lightweight-chart", TestController)
  application.register("sub-chart", SubclassController)
})

afterEach(async () => {
  document.body.replaceChildren()
  await tick()
  application.stop()
})

async function mount(html) {
  document.body.insertAdjacentHTML("beforeend", html)
  await tick()
  return document.body.lastElementChild
}

function controllerOf(element, identifier = "lightweight-chart") {
  return application.getControllerForElementAndIdentifier(element, identifier)
}

test("connect creates a ChartHost with the options value and the declared series", async () => {
  const element = await mount(`<div data-controller="lightweight-chart"
    data-lightweight-chart-options-value='{"height": 200}'
    data-lightweight-chart-series-value='[{"type":"Line","name":"price","options":{"color":"blue"},"data":[{"time":1,"value":2}]},{"type":"Area"}]'></div>`)
  const controller = controllerOf(element)

  assert.ok(controller.host instanceof ChartHost)
  assert.deepEqual(calls[0], ["createChart", element, { autoSize: true, height: 200 }])
  assert.deepEqual([...controller.series.keys()], ["price", "series1"])
  assert.equal(controller.series.get("price").definition, LineSeries)
  assert.deepEqual(controller.series.get("price").seriesOptions, { color: "blue" })
  assert.deepEqual(controller.series.get("price").data, [{ time: 1, value: 2 }])
  assert.equal(controller.series.get("series1").definition, AreaSeries)
  assert.equal(controller.chart, controller.host.chart)
})

test("connect works with no values at all", async () => {
  const element = await mount(`<div data-controller="lightweight-chart"></div>`)
  assert.deepEqual(calls[0][2], { autoSize: true })
  assert.equal(controllerOf(element).series.size, 0)
})

test("disconnect destroys the host", async () => {
  const element = await mount(`<div data-controller="lightweight-chart"></div>`)
  const host = controllerOf(element).host
  element.remove()
  await tick()

  assert.equal(host.destroyed, true)
  assert.deepEqual(calls.at(-1), ["remove"])
})

test("turbo:before-cache destroys the chart so the Turbo snapshot has no canvas, and disconnect stays safe", async () => {
  const element = await mount(`<div data-controller="lightweight-chart"></div>`)
  const host = controllerOf(element).host
  document.dispatchEvent(new Event("turbo:before-cache"))

  assert.equal(host.destroyed, true)
  element.remove()
  await tick()
  assert.equal(calls.filter(([name]) => name === "remove").length, 1)
})

test("turbo:before-cache listener is removed on disconnect", async () => {
  const element = await mount(`<div data-controller="lightweight-chart"></div>`)
  element.remove()
  await tick()
  const removes = calls.filter(([name]) => name === "remove").length
  document.dispatchEvent(new Event("turbo:before-cache"))
  assert.equal(calls.filter(([name]) => name === "remove").length, removes)
})

test("changing the series value after connect rebuilds all series", async () => {
  const element = await mount(`<div data-controller="lightweight-chart"
    data-lightweight-chart-series-value='[{"type":"Line","name":"a"}]'></div>`)
  const controller = controllerOf(element)
  const original = controller.series.get("a")

  element.setAttribute("data-lightweight-chart-series-value", '[{"type":"Area","name":"b"},{"type":"Line","name":"c"}]')
  await tick()

  assert.deepEqual([...controller.series.keys()], ["b", "c"])
  assert.ok(calls.some(([name, series]) => name === "removeSeries" && series === original))
})

test("an unchanged declared series (same type and pane) is updated in place, not removed and re-added", async () => {
  const element = await mount(`<div data-controller="lightweight-chart"
    data-lightweight-chart-series-value='[{"type":"Line","name":"price","options":{"color":"blue"},"data":[{"time":1,"value":1}]}]'></div>`)
  const controller = controllerOf(element)
  const series = controller.series.get("price")
  calls.length = 0

  element.setAttribute("data-lightweight-chart-series-value", '[{"type":"Line","name":"price","options":{"color":"red"},"data":[{"time":1,"value":2}]}]')
  await tick()

  assert.equal(controller.series.get("price"), series)
  assert.ok(!calls.some(([name]) => name === "removeSeries"))
  assert.ok(!calls.some(([name]) => name === "addSeries"))
  assert.ok(calls.some(([name, s, options]) => name === "series.applyOptions" && s === series && options.color === "red"))
  assert.deepEqual(series.data, [{ time: 1, value: 2 }])
})

test("a declared series whose type changes is removed and re-added", async () => {
  const element = await mount(`<div data-controller="lightweight-chart"
    data-lightweight-chart-series-value='[{"type":"Line","name":"price"}]'></div>`)
  const controller = controllerOf(element)
  const original = controller.series.get("price")

  element.setAttribute("data-lightweight-chart-series-value", '[{"type":"Area","name":"price"}]')
  await tick()

  assert.notEqual(controller.series.get("price"), original)
  assert.equal(controller.series.get("price").definition, AreaSeries)
  assert.ok(calls.some(([name, series]) => name === "removeSeries" && series === original))
})

test("a declared series whose pane changes is removed and re-added", async () => {
  const element = await mount(`<div data-controller="lightweight-chart"
    data-lightweight-chart-series-value='[{"type":"Line","name":"price","pane":0}]'></div>`)
  const controller = controllerOf(element)
  const original = controller.series.get("price")

  element.setAttribute("data-lightweight-chart-series-value", '[{"type":"Line","name":"price","pane":1}]')
  await tick()

  assert.notEqual(controller.series.get("price"), original)
  assert.equal(controller.series.get("price").paneIndex, 1)
  assert.ok(calls.some(([name, series]) => name === "removeSeries" && series === original))
})

test("a declared series no longer present in the series value is removed", async () => {
  const element = await mount(`<div data-controller="lightweight-chart"
    data-lightweight-chart-series-value='[{"type":"Line","name":"price"},{"type":"Area","name":"volume"}]'></div>`)
  const controller = controllerOf(element)
  const volume = controller.series.get("volume")

  element.setAttribute("data-lightweight-chart-series-value", '[{"type":"Line","name":"price"}]')
  await tick()

  assert.deepEqual([...controller.series.keys()], ["price"])
  assert.ok(calls.some(([name, series]) => name === "removeSeries" && series === volume))
})

test("a subclass's imperatively-added series survives a declared series value change", async () => {
  const element = await mount(`<div data-controller="sub-chart" data-sub-chart-label-value="mine"
    data-sub-chart-series-value='[{"type":"Line","name":"declared"}]'></div>`)
  const controller = controllerOf(element, "sub-chart")
  const mine = controller.series.get("mine")

  element.setAttribute("data-sub-chart-series-value", '[{"type":"Area","name":"declared2"}]')
  await tick()

  assert.equal(controller.series.get("mine"), mine)
  assert.ok(!calls.some(([name, series]) => name === "removeSeries" && series === mine))
  assert.deepEqual([...controller.series.keys()].sort(), ["declared2", "mine"])
})

test("unnamed declared entries keep stable series0/series1 names, updated in place across changes", async () => {
  const element = await mount(`<div data-controller="lightweight-chart"
    data-lightweight-chart-series-value='[{"type":"Line"},{"type":"Area"}]'></div>`)
  const controller = controllerOf(element)
  const first = controller.series.get("series0")
  const second = controller.series.get("series1")
  calls.length = 0

  element.setAttribute("data-lightweight-chart-series-value", '[{"type":"Line","options":{"color":"red"}},{"type":"Area"}]')
  await tick()

  assert.deepEqual([...controller.series.keys()], ["series0", "series1"])
  assert.equal(controller.series.get("series0"), first)
  assert.equal(controller.series.get("series1"), second)
  assert.ok(!calls.some(([name]) => name === "removeSeries" || name === "addSeries"))
})

test("changing the options value after connect applies the new options", async () => {
  const element = await mount(`<div data-controller="lightweight-chart"
    data-lightweight-chart-options-value='{"height": 200}'></div>`)
  assert.ok(!calls.some(([name]) => name === "applyOptions"))

  element.setAttribute("data-lightweight-chart-options-value", '{"height": 300}')
  await tick()

  assert.deepEqual(calls.at(-1), ["applyOptions", { height: 300 }])
})

test("turbo:before-cache destroy then an options value change does not crash", async () => {
  const element = await mount(`<div data-controller="lightweight-chart"
    data-lightweight-chart-options-value='{"height": 200}'></div>`)
  document.dispatchEvent(new Event("turbo:before-cache"))

  element.setAttribute("data-lightweight-chart-options-value", '{"height": 300}')
  await tick()

  assert.ok(!calls.some(([name]) => name === "applyOptions"))
})

test("delegated methods reach the host", async () => {
  const element = await mount(`<div data-controller="lightweight-chart"></div>`)
  const controller = controllerOf(element)
  controller.addSeries("Histogram", {}, { name: "vol" })
  controller.setData("vol", [{ time: 1, value: 5 }])
  controller.update("vol", { time: 2, value: 6 })
  controller.fitContent()
  assert.equal(controller.series.get("vol").data.length, 1)
  assert.equal(controller.series.get("vol").updates.length, 1)
  assert.deepEqual(calls.at(-1), ["fitContent"])
  controller.removeSeries("vol")
  assert.equal(controller.series.size, 0)
})

test("series value entries pass pane, markers and priceLines through to the host", async () => {
  const element = await mount(`<div data-controller="lightweight-chart"
    data-lightweight-chart-series-value='[{"type":"Line","name":"price","pane":1,"markers":[{"time":1}],"priceLines":[{"price":10}]}]'></div>`)
  const controller = controllerOf(element)
  const series = controller.series.get("price")

  assert.equal(series.paneIndex, 1)
  assert.ok(controller.host.markerPlugins.get("price"))
  assert.equal(controller.host.priceLines.get("price").length, 1)
})

test("fitContentValue calls fitContent after the declared series are added on connect", async () => {
  const element = await mount(`<div data-controller="lightweight-chart"
    data-lightweight-chart-fit-content-value="true"
    data-lightweight-chart-series-value='[{"type":"Line","name":"a"}]'></div>`)
  const addSeriesIndex = calls.findIndex(([name]) => name === "addSeries")
  const fitContentIndex = calls.findIndex(([name]) => name === "fitContent")
  assert.ok(addSeriesIndex >= 0 && fitContentIndex > addSeriesIndex)
})

test("without fitContentValue, connect does not call fitContent", async () => {
  await mount(`<div data-controller="lightweight-chart"
    data-lightweight-chart-series-value='[{"type":"Line","name":"a"}]'></div>`)
  assert.ok(!calls.some(([name]) => name === "fitContent"))
})

test("fitContentValue calls fitContent again after a seriesValueChanged rebuild", async () => {
  const element = await mount(`<div data-controller="lightweight-chart"
    data-lightweight-chart-fit-content-value="true"
    data-lightweight-chart-series-value='[{"type":"Line","name":"a"}]'></div>`)
  const fitContentCallsAfterConnect = calls.filter(([name]) => name === "fitContent").length

  element.setAttribute("data-lightweight-chart-series-value", '[{"type":"Area","name":"b"}]')
  await tick()

  const fitContentCallsAfterRebuild = calls.filter(([name]) => name === "fitContent").length
  assert.equal(fitContentCallsAfterRebuild, fitContentCallsAfterConnect + 1)
})

test("controller#setMarkers delegates to the host", async () => {
  const element = await mount(`<div data-controller="lightweight-chart"
    data-lightweight-chart-series-value='[{"type":"Line","name":"price"}]'></div>`)
  const controller = controllerOf(element)
  const series = controller.series.get("price")

  controller.setMarkers("price", [{ time: 1 }])
  assert.deepEqual(calls.at(-1), ["createSeriesMarkers", series, [{ time: 1 }], undefined])

  controller.setMarkers("price", [{ time: 2 }])
  assert.deepEqual(calls.at(-1), ["setMarkers", series, [{ time: 2 }]])
})

test("a subclass can add its own values and series after super.connect()", async () => {
  const element = await mount(`<div data-controller="sub-chart" data-sub-chart-label-value="mine"
    data-sub-chart-series-value='[{"type":"Line","name":"declared"}]'></div>`)
  const controller = controllerOf(element, "sub-chart")

  assert.deepEqual([...controller.series.keys()], ["declared", "mine"])
  assert.equal(controller.series.get("mine").definition, AreaSeries)
})

test("connected event fires once at the end of connect with the chart and controller in detail", async () => {
  const events = []
  document.addEventListener("lightweight-chart:connected", (event) => events.push(event))

  const element = await mount(`<div data-controller="lightweight-chart"
    data-lightweight-chart-series-value='[{"type":"Line","name":"price"}]'></div>`)
  const controller = controllerOf(element)

  assert.equal(events.length, 1)
  assert.equal(events[0].detail.chart, controller.host.chart)
  assert.equal(events[0].detail.controller, controller)
  assert.equal(events[0].bubbles, true)
})

test("connected event uses the subclass's own Stimulus identifier as the prefix", async () => {
  const events = []
  document.addEventListener("sub-chart:connected", (event) => events.push(event))

  await mount(`<div data-controller="sub-chart" data-sub-chart-label-value="mine"></div>`)

  assert.equal(events.length, 1)
})

test("crosshair-move subscribes on connect and translates seriesData Map to a name-keyed object", async () => {
  const element = await mount(`<div data-controller="lightweight-chart"
    data-lightweight-chart-series-value='[{"type":"Line","name":"price"},{"type":"Area","name":"volume"}]'></div>`)
  const controller = controllerOf(element)
  const price = controller.series.get("price")
  const volume = controller.series.get("volume")
  const unknownSeries = { definition: LineSeries }

  const events = []
  document.addEventListener("lightweight-chart:crosshair-move", (event) => events.push(event))

  controller.chart.crosshairMoveHandler({
    time: 123,
    logical: 4,
    point: { x: 10, y: 20 },
    seriesData: new Map([
      [price, { time: 123, value: 1 }],
      [unknownSeries, { time: 123, value: 99 }]
    ])
  })

  assert.equal(events.length, 1)
  assert.deepEqual(events[0].detail, {
    time: 123,
    logical: 4,
    point: { x: 10, y: 20 },
    seriesData: { price: { time: 123, value: 1 } }
  })
  assert.ok(!("volume" in events[0].detail.seriesData))
})

test("click subscribes on connect and translates seriesData the same way", async () => {
  const element = await mount(`<div data-controller="lightweight-chart"
    data-lightweight-chart-series-value='[{"type":"Line","name":"price"}]'></div>`)
  const controller = controllerOf(element)
  const price = controller.series.get("price")

  const events = []
  document.addEventListener("lightweight-chart:click", (event) => events.push(event))

  controller.chart.clickHandler({ time: 5, logical: 1, point: { x: 1, y: 2 }, seriesData: new Map([[price, { time: 5, value: 9 }]]) })

  assert.equal(events.length, 1)
  assert.deepEqual(events[0].detail.seriesData, { price: { time: 5, value: 9 } })
})

test("crosshair-move and click handlers are unsubscribed on disconnect", async () => {
  const element = await mount(`<div data-controller="lightweight-chart"></div>`)
  const controller = controllerOf(element)
  const chart = controller.chart
  const crosshairHandler = chart.crosshairMoveHandler
  const clickHandler = chart.clickHandler

  element.remove()
  await tick()

  assert.ok(calls.some(([name, handler]) => name === "unsubscribeCrosshairMove" && handler === crosshairHandler))
  assert.ok(calls.some(([name, handler]) => name === "unsubscribeClick" && handler === clickHandler))
  assert.equal(chart.crosshairMoveHandler, null)
  assert.equal(chart.clickHandler, null)
})

test("crosshair-move and click handlers are unsubscribed on turbo:before-cache, before the host is destroyed", async () => {
  const element = await mount(`<div data-controller="lightweight-chart"></div>`)
  const controller = controllerOf(element)
  const chart = controller.chart

  document.dispatchEvent(new Event("turbo:before-cache"))

  const unsubscribeIndex = calls.findIndex(([name]) => name === "unsubscribeCrosshairMove")
  const removeIndex = calls.findIndex(([name]) => name === "remove")
  assert.ok(unsubscribeIndex >= 0 && removeIndex >= 0 && unsubscribeIndex < removeIndex)
  assert.equal(chart.crosshairMoveHandler, null)

  // disconnect() must stay safe after the host is already destroyed.
  element.remove()
  await tick()
})
