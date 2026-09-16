// lightweight-charts-rails: a thin Stimulus wrapper around TradingView lightweight-charts.
// ChartHost is framework-free and owns one chart plus its named series; LightweightChartController (Task 5) wraps it.
import { Controller } from "@hotwired/stimulus"
import {
  createChart as defaultCreateChart,
  LineSeries,
  AreaSeries,
  BarSeries,
  CandlestickSeries,
  HistogramSeries,
  BaselineSeries
} from "lightweight-charts"

const SERIES_DEFINITIONS = {
  Line: LineSeries,
  Area: AreaSeries,
  Bar: BarSeries,
  Candlestick: CandlestickSeries,
  Histogram: HistogramSeries,
  Baseline: BaselineSeries
}

export class ChartHost {
  constructor(element, { options = {}, createChart = defaultCreateChart } = {}) {
    this.element = element
    this.chart = createChart(element, { autoSize: true, ...options })
    this.series = new Map()
    this.destroyed = false
    this.nextIndex = 0
  }

  addSeries(type, seriesOptions = {}, { name, data } = {}) {
    const definition = SERIES_DEFINITIONS[type]
    if (!definition) {
      throw new Error(`lightweight-charts-rails: unknown series type "${type}" (expected one of ${Object.keys(SERIES_DEFINITIONS).join(", ")})`)
    }
    const key = name ?? `series${this.nextIndex}`
    if (this.series.has(key)) {
      throw new Error(`lightweight-charts-rails: series "${key}" already exists`)
    }
    this.nextIndex += 1

    const series = this.chart.addSeries(definition, seriesOptions)
    this.series.set(key, series)
    if (data) series.setData(data)
    return series
  }

  seriesNamed(name) {
    const series = this.series.get(name)
    if (!series) throw new Error(`lightweight-charts-rails: no series named "${name}"`)
    return series
  }

  setData(name, data) {
    this.seriesNamed(name).setData(data)
  }

  update(name, point) {
    this.seriesNamed(name).update(point)
  }

  removeSeries(name) {
    const series = this.seriesNamed(name)
    this.chart.removeSeries(series)
    this.series.delete(name)
  }

  removeAllSeries() {
    for (const name of [...this.series.keys()]) this.removeSeries(name)
  }

  fitContent() {
    this.chart.timeScale().fitContent()
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.series.clear()
    this.chart.remove()
  }
}

// Stimulus controller: `data-controller="lightweight-chart"` with optional
// `data-lightweight-chart-options-value` (chart options JSON) and
// `data-lightweight-chart-series-value` ([{ type, name, options, data }] JSON).
// Subclass it and call super.connect() before touching this.chart / this.addSeries().
export class LightweightChartController extends Controller {
  static values = { options: Object, series: Array }
  // Extra options passed to ChartHost (e.g. { createChart } in tests). Read from the concrete class.
  static chartHostOptions = {}

  connect() {
    this.host = new ChartHost(this.element, { options: this.optionsValue, ...this.constructor.chartHostOptions })
    this.addDeclaredSeries()
    this.destroyBeforeCache = () => this.host?.destroy()
    document.addEventListener("turbo:before-cache", this.destroyBeforeCache)
  }

  disconnect() {
    document.removeEventListener("turbo:before-cache", this.destroyBeforeCache)
    this.host?.destroy()
    this.host = null
  }

  // Stimulus also calls this once before connect(); there is no host yet, so ignore that call.
  seriesValueChanged() {
    if (!this.host || this.host.destroyed) return
    this.host.removeAllSeries()
    this.addDeclaredSeries()
  }

  addDeclaredSeries() {
    for (const { type, name, options, data } of this.seriesValue) {
      this.host.addSeries(type, options ?? {}, { name, data })
    }
  }

  get chart() { return this.host.chart }
  get series() { return this.host.series }
  addSeries(type, seriesOptions, extra) { return this.host.addSeries(type, seriesOptions, extra) }
  setData(name, data) { this.host.setData(name, data) }
  update(name, point) { this.host.update(name, point) }
  removeSeries(name) { this.host.removeSeries(name) }
  fitContent() { this.host.fitContent() }
}

export default LightweightChartController
