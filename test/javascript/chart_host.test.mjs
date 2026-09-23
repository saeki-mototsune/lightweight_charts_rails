import { test } from "node:test"
import assert from "node:assert/strict"
import { LineSeries, HistogramSeries } from "lightweight-charts"
import { ChartHost } from "../../app/assets/javascripts/lightweight-charts-rails.js"
import { fakeCreateChart, fakeCreateSeriesMarkers } from "./support/fake_chart.mjs"

function build(options) {
  const calls = []
  const element = document.createElement("div")
  const host = new ChartHost(element, { options, createChart: fakeCreateChart(calls) })
  return { host, calls, element }
}

function buildWithMarkers(options) {
  const calls = []
  const element = document.createElement("div")
  const host = new ChartHost(element, {
    options,
    createChart: fakeCreateChart(calls),
    createSeriesMarkers: fakeCreateSeriesMarkers(calls)
  })
  return { host, calls, element }
}

test("creates the chart on the element with autoSize on by default", () => {
  const { host, calls, element } = build({ height: 240 })
  assert.deepEqual(calls[0], ["createChart", element, { autoSize: true, height: 240 }])
  assert.equal(host.chart.element, element)
})

test("caller can turn autoSize off", () => {
  const { calls } = build({ autoSize: false })
  assert.deepEqual(calls[0][2], { autoSize: false })
})

test("addSeries maps the type name to the lightweight-charts definition and stores it by name", () => {
  const { host, calls } = build()
  const series = host.addSeries("Line", { color: "red" }, { name: "price", data: [{ time: 1, value: 2 }] })
  assert.deepEqual(calls[1], ["addSeries", LineSeries, { color: "red" }])
  assert.equal(host.series.get("price"), series)
  assert.deepEqual(series.data, [{ time: 1, value: 2 }])
})

test("addSeries without data does not call setData", () => {
  const { host } = build()
  const series = host.addSeries("Histogram")
  assert.equal(series.definition, HistogramSeries)
  assert.equal(series.data, null)
})

test("unnamed series are numbered series0, series1, ... and numbering survives removal", () => {
  const { host } = build()
  host.addSeries("Line")
  host.addSeries("Area")
  assert.deepEqual([...host.series.keys()], ["series0", "series1"])
  host.removeSeries("series0")
  host.addSeries("Bar")
  assert.deepEqual([...host.series.keys()], ["series1", "series2"])
})

test("unknown series type throws", () => {
  const { host } = build()
  assert.throws(() => host.addSeries("Pie"), /unknown series type "Pie"/)
})

test("duplicate series name throws", () => {
  const { host } = build()
  host.addSeries("Line", {}, { name: "a" })
  assert.throws(() => host.addSeries("Line", {}, { name: "a" }), /series "a" already exists/)
})

test("setData and update delegate to the named series", () => {
  const { host } = build()
  host.addSeries("Candlestick", {}, { name: "ohlc" })
  host.setData("ohlc", [{ time: 1, open: 1, high: 2, low: 0, close: 1 }])
  host.update("ohlc", { time: 2, open: 1, high: 2, low: 0, close: 2 })
  assert.equal(host.series.get("ohlc").data.length, 1)
  assert.equal(host.series.get("ohlc").updates.length, 1)
})

test("setData, update and removeSeries on an unknown name throw", () => {
  const { host } = build()
  assert.throws(() => host.setData("nope", []), /no series named "nope"/)
  assert.throws(() => host.update("nope", {}), /no series named "nope"/)
  assert.throws(() => host.removeSeries("nope"), /no series named "nope"/)
})

test("removeSeries removes from the chart and the map", () => {
  const { host, calls } = build()
  const series = host.addSeries("Baseline", {}, { name: "b" })
  host.removeSeries("b")
  assert.deepEqual(calls.at(-1), ["removeSeries", series])
  assert.equal(host.series.size, 0)
})

test("removeAllSeries empties the map", () => {
  const { host, calls } = build()
  host.addSeries("Line")
  host.addSeries("Line")
  host.removeAllSeries()
  assert.equal(host.series.size, 0)
  assert.equal(calls.filter(([name]) => name === "removeSeries").length, 2)
})

test("fitContent delegates to the time scale", () => {
  const { host, calls } = build()
  host.fitContent()
  assert.deepEqual(calls.at(-1), ["fitContent"])
})

test("applyOptions delegates to the chart", () => {
  const { host, calls } = build()
  host.applyOptions({ height: 300 })
  assert.deepEqual(calls.at(-1), ["applyOptions", { height: 300 }])
})

test("addSeries passes pane as the 3rd addSeries argument only when given", () => {
  const { host, calls } = build()
  host.addSeries("Line", {}, { name: "default-pane" })
  host.addSeries("Line", {}, { name: "paned", pane: 1 })
  assert.deepEqual(calls[1], ["addSeries", LineSeries, {}])
  assert.deepEqual(calls[2], ["addSeries", LineSeries, {}, 1])
})

test("addSeries with pane 0 still passes it explicitly (not treated as absent)", () => {
  const { calls } = build()
  const host = new ChartHost(document.createElement("div"), { createChart: fakeCreateChart(calls) })
  host.addSeries("Line", {}, { name: "pane0", pane: 0 })
  assert.deepEqual(calls.at(-1), ["addSeries", LineSeries, {}, 0])
})

test("addSeries with markers creates a markers plugin for the series and keeps it", () => {
  const { host, calls } = buildWithMarkers()
  const markers = [{ time: 1, position: "aboveBar" }]
  const series = host.addSeries("Line", {}, { name: "price", markers })
  assert.deepEqual(calls.at(-1), ["createSeriesMarkers", series, markers, undefined])
  assert.equal(host.markerPlugins.get("price").series, series)
})

test("addSeries without markers does not create a markers plugin", () => {
  const { host } = buildWithMarkers()
  host.addSeries("Line", {}, { name: "price" })
  assert.equal(host.markerPlugins.has("price"), false)
})

test("addSeries with priceLines calls createPriceLine for each and keeps the returned lines", () => {
  const { host, calls } = build()
  const series = host.addSeries("Line", {}, {
    name: "price",
    priceLines: [{ price: 10 }, { price: 20 }]
  })
  assert.deepEqual(calls[1], ["addSeries", LineSeries, {}])
  assert.deepEqual(calls[2], ["createPriceLine", series, { price: 10 }])
  assert.deepEqual(calls[3], ["createPriceLine", series, { price: 20 }])
  assert.equal(host.priceLines.get("price").length, 2)
  assert.deepEqual(host.priceLines.get("price")[0], { options: { price: 10 } })
})

test("addSeries without priceLines does not touch priceLines", () => {
  const { host } = build()
  host.addSeries("Line", {}, { name: "price" })
  assert.equal(host.priceLines.has("price"), false)
})

test("setMarkers reuses the existing plugin", () => {
  const { host, calls } = buildWithMarkers()
  const series = host.addSeries("Line", {}, { name: "price", markers: [{ time: 1 }] })
  calls.length = 0
  host.setMarkers("price", [{ time: 2 }])
  assert.deepEqual(calls, [["setMarkers", series, [{ time: 2 }]]])
})

test("setMarkers creates a plugin when the series has none yet", () => {
  const { host, calls } = buildWithMarkers()
  const series = host.addSeries("Line", {}, { name: "price" })
  host.setMarkers("price", [{ time: 1 }])
  assert.deepEqual(calls.at(-1), ["createSeriesMarkers", series, [{ time: 1 }], undefined])
  assert.ok(host.markerPlugins.get("price"))
})

test("removeSeries detaches the markers plugin before removing from the chart and forgets state", () => {
  const { host, calls } = buildWithMarkers()
  const series = host.addSeries("Line", {}, {
    name: "price",
    markers: [{ time: 1 }],
    priceLines: [{ price: 10 }]
  })
  calls.length = 0
  host.removeSeries("price")
  assert.deepEqual(calls[0], ["detach", series])
  assert.deepEqual(calls[1], ["removeSeries", series])
  assert.equal(host.markerPlugins.has("price"), false)
  assert.equal(host.priceLines.has("price"), false)
})

test("removeSeries without a markers plugin does not try to detach anything", () => {
  const { host, calls } = build()
  host.addSeries("Line", {}, { name: "price" })
  host.removeSeries("price")
  assert.ok(!calls.some(([name]) => name === "detach"))
})

test("seriesInfo returns the type and pane last given to addSeries", () => {
  const { host } = build()
  host.addSeries("Line", {}, { name: "price" })
  assert.deepEqual(host.seriesInfo("price"), { type: "Line", pane: undefined })
  assert.equal(host.seriesInfo("missing"), undefined)
})

test("seriesInfo records the pane when given", () => {
  const { host } = build()
  host.addSeries("Line", {}, { name: "price", pane: 1 })
  assert.deepEqual(host.seriesInfo("price"), { type: "Line", pane: 1 })
})

test("updateSeries applies new options and data to the existing series", () => {
  const { host, calls } = build()
  const series = host.addSeries("Line", { color: "blue" }, { name: "price", data: [{ time: 1, value: 1 }] })
  calls.length = 0
  host.updateSeries("price", { options: { color: "red" }, data: [{ time: 2, value: 2 }] })
  assert.deepEqual(calls[0], ["series.applyOptions", series, { color: "red" }])
  assert.deepEqual(series.data, [{ time: 2, value: 2 }])
})

test("updateSeries with no data given clears the series", () => {
  const { host } = build()
  const series = host.addSeries("Line", {}, { name: "price", data: [{ time: 1, value: 1 }] })
  host.updateSeries("price", {})
  assert.deepEqual(series.data, [])
})

test("updateSeries sets markers via the existing plugin", () => {
  const { host, calls } = buildWithMarkers()
  const series = host.addSeries("Line", {}, { name: "price", markers: [{ time: 1 }] })
  calls.length = 0
  host.updateSeries("price", { markers: [{ time: 2 }] })
  assert.deepEqual(calls, [["series.applyOptions", series, {}], ["setMarkers", series, [{ time: 2 }]]])
})

test("updateSeries clears markers when the entry no longer has any but a plugin exists", () => {
  const { host, calls } = buildWithMarkers()
  const series = host.addSeries("Line", {}, { name: "price", markers: [{ time: 1 }] })
  calls.length = 0
  host.updateSeries("price", {})
  assert.deepEqual(calls, [["series.applyOptions", series, {}], ["setMarkers", series, []]])
})

test("updateSeries does not touch markers when there were and are none", () => {
  const { host, calls } = buildWithMarkers()
  const series = host.addSeries("Line", {}, { name: "price" })
  calls.length = 0
  host.updateSeries("price", {})
  assert.deepEqual(calls, [["series.applyOptions", series, {}]])
})

test("updateSeries removes old price lines and recreates the new ones", () => {
  const { host, calls } = build()
  host.addSeries("Line", {}, { name: "price", priceLines: [{ price: 10 }] })
  const series = host.series.get("price")
  const oldLine = host.priceLines.get("price")[0]
  calls.length = 0
  host.updateSeries("price", { priceLines: [{ price: 20 }] })
  assert.deepEqual(calls[0], ["series.applyOptions", series, {}])
  assert.deepEqual(calls[1], ["removePriceLine", series, oldLine])
  assert.deepEqual(calls[2], ["createPriceLine", series, { price: 20 }])
  assert.equal(host.priceLines.get("price").length, 1)
  assert.deepEqual(host.priceLines.get("price")[0], { options: { price: 20 } })
})

test("updateSeries removes old price lines and creates none when none are given", () => {
  const { host, calls } = build()
  host.addSeries("Line", {}, { name: "price", priceLines: [{ price: 10 }] })
  calls.length = 0
  host.updateSeries("price", {})
  assert.equal(calls.filter(([name]) => name === "removePriceLine").length, 1)
  assert.equal(host.priceLines.has("price"), false)
})

test("updateSeries on an unknown name throws", () => {
  const { host } = build()
  assert.throws(() => host.updateSeries("nope", {}), /no series named "nope"/)
})

test("destroy removes the chart once and clears series", () => {
  const { host, calls } = build()
  host.addSeries("Line")
  host.destroy()
  host.destroy()
  assert.equal(host.destroyed, true)
  assert.equal(host.series.size, 0)
  assert.equal(calls.filter(([name]) => name === "remove").length, 1)
})
