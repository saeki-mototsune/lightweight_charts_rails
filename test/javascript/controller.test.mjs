import { test, beforeEach, afterEach } from "node:test"
import assert from "node:assert/strict"
import { Application } from "@hotwired/stimulus"
import { LineSeries, AreaSeries } from "lightweight-charts"
import LightweightChartController, { ChartHost } from "../../app/assets/javascripts/lightweight-charts-rails.js"
import { fakeCreateChart } from "./support/fake_chart.mjs"

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
  TestController.chartHostOptions = { createChart: fakeCreateChart(calls) }
  SubclassController.chartHostOptions = { createChart: fakeCreateChart(calls) }
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

test("a subclass can add its own values and series after super.connect()", async () => {
  const element = await mount(`<div data-controller="sub-chart" data-sub-chart-label-value="mine"
    data-sub-chart-series-value='[{"type":"Line","name":"declared"}]'></div>`)
  const controller = controllerOf(element, "sub-chart")

  assert.deepEqual([...controller.series.keys()], ["declared", "mine"])
  assert.equal(controller.series.get("mine").definition, AreaSeries)
})
