// lightweight-charts-rails: a thin Stimulus wrapper around TradingView lightweight-charts.
// ChartHost is framework-free and owns one chart plus its named series; LightweightChartController (Task 5) wraps it.
import { Controller } from "@hotwired/stimulus"
import {
  createChart as defaultCreateChart,
  createSeriesMarkers as defaultCreateSeriesMarkers,
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
  constructor(element, { options = {}, createChart = defaultCreateChart, createSeriesMarkers = defaultCreateSeriesMarkers } = {}) {
    this.element = element
    this.chart = createChart(element, { autoSize: true, ...options })
    this.createSeriesMarkers = createSeriesMarkers
    this.series = new Map()
    this.markerPlugins = new Map()
    this.priceLines = new Map()
    this.destroyed = false
    this.nextIndex = 0
  }

  addSeries(type, seriesOptions = {}, { name, data, pane, markers, priceLines } = {}) {
    const definition = SERIES_DEFINITIONS[type]
    if (!definition) {
      throw new Error(`lightweight-charts-rails: unknown series type "${type}" (expected one of ${Object.keys(SERIES_DEFINITIONS).join(", ")})`)
    }
    const key = name ?? `series${this.nextIndex}`
    if (this.series.has(key)) {
      throw new Error(`lightweight-charts-rails: series "${key}" already exists`)
    }
    this.nextIndex += 1

    const series = pane != null
      ? this.chart.addSeries(definition, seriesOptions, pane)
      : this.chart.addSeries(definition, seriesOptions)
    this.series.set(key, series)
    if (data) series.setData(data)
    if (markers) this.markerPlugins.set(key, this.createSeriesMarkers(series, markers))
    if (priceLines) this.priceLines.set(key, priceLines.map((lineOptions) => series.createPriceLine(lineOptions)))
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

  setMarkers(name, markers) {
    const plugin = this.markerPlugins.get(name)
    if (plugin) {
      plugin.setMarkers(markers)
    } else {
      this.markerPlugins.set(name, this.createSeriesMarkers(this.seriesNamed(name), markers))
    }
  }

  removeSeries(name) {
    const series = this.seriesNamed(name)
    const plugin = this.markerPlugins.get(name)
    if (plugin) plugin.detach()
    this.markerPlugins.delete(name)
    this.priceLines.delete(name)
    this.chart.removeSeries(series)
    this.series.delete(name)
  }

  removeAllSeries() {
    for (const name of [...this.series.keys()]) this.removeSeries(name)
  }

  fitContent() {
    this.chart.timeScale().fitContent()
  }

  applyOptions(options) {
    this.chart.applyOptions(options)
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.series.clear()
    this.markerPlugins.clear()
    this.priceLines.clear()
    this.chart.remove()
  }
}

// Stimulus controller: `data-controller="lightweight-chart"` with optional
// `data-lightweight-chart-options-value` (chart options JSON),
// `data-lightweight-chart-series-value` ([{ type, name, options, data, pane, markers, priceLines }] JSON)
// and `data-lightweight-chart-fit-content-value` (Boolean; fitContent() after series are (re)built).
// Subclass it and call super.connect() before touching this.chart / this.addSeries().
export class LightweightChartController extends Controller {
  static values = { options: Object, series: Array, fitContent: Boolean }
  // Extra options passed to ChartHost (e.g. { createChart } in tests). Read from the concrete class.
  static chartHostOptions = {}

  connect() {
    this.host = new ChartHost(this.element, { options: this.optionsValue, ...this.constructor.chartHostOptions })
    this.addDeclaredSeries()
    if (this.fitContentValue) this.host.fitContent()
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
    if (this.fitContentValue) this.host.fitContent()
  }

  // Stimulus also calls this once before connect(); there is no host yet, so ignore that call.
  optionsValueChanged() {
    if (!this.host || this.host.destroyed) return
    this.host.applyOptions(this.optionsValue)
  }

  addDeclaredSeries() {
    for (const { type, name, options, data, pane, markers, priceLines } of this.seriesValue) {
      this.host.addSeries(type, options ?? {}, { name, data, pane, markers, priceLines })
    }
  }

  get chart() { return this.host.chart }
  get series() { return this.host.series }
  addSeries(type, seriesOptions, extra) { return this.host.addSeries(type, seriesOptions, extra) }
  setMarkers(name, markers) { this.host.setMarkers(name, markers) }
  setData(name, data) { this.host.setData(name, data) }
  update(name, point) { this.host.update(name, point) }
  removeSeries(name) { this.host.removeSeries(name) }
  fitContent() { this.host.fitContent() }
}

export default LightweightChartController
