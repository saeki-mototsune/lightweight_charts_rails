import { test } from "node:test"
import assert from "node:assert/strict"
import { LineSeries, HistogramSeries } from "lightweight-charts"
import { ChartHost } from "../../app/assets/javascripts/lightweight-charts-rails.js"
import { fakeCreateChart } from "./support/fake_chart.mjs"

function build(options) {
  const calls = []
  const element = document.createElement("div")
  const host = new ChartHost(element, { options, createChart: fakeCreateChart(calls) })
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

test("destroy removes the chart once and clears series", () => {
  const { host, calls } = build()
  host.addSeries("Line")
  host.destroy()
  host.destroy()
  assert.equal(host.destroyed, true)
  assert.equal(host.series.size, 0)
  assert.equal(calls.filter(([name]) => name === "remove").length, 1)
})
