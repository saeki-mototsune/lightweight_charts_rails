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
    this.seriesMeta = new Map()
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
    this.seriesMeta.set(key, { type, pane })
    if (data) series.setData(data)
    if (markers) this.markerPlugins.set(key, this.createSeriesMarkers(series, markers))
    if (priceLines) this.priceLines.set(key, priceLines.map((lineOptions) => series.createPriceLine(lineOptions)))
    return series
  }

  // { type, pane } as last given to addSeries for this name, or undefined if there is no such series.
  seriesInfo(name) {
    return this.seriesMeta.get(name)
  }

  // Updates an existing series in place: options, data, markers and price lines are all replaced.
  // Markers are cleared (not left stale) when the plugin exists but the update carries none.
  updateSeries(name, { options, data, markers, priceLines } = {}) {
    const series = this.seriesNamed(name)
    series.applyOptions(options ?? {})
    series.setData(data ?? [])

    if (markers) {
      this.setMarkers(name, markers)
    } else if (this.markerPlugins.has(name)) {
      this.setMarkers(name, [])
    }

    const existingLines = this.priceLines.get(name)
    if (existingLines) {
      for (const line of existingLines) series.removePriceLine(line)
    }
    if (priceLines) {
      this.priceLines.set(name, priceLines.map((lineOptions) => series.createPriceLine(lineOptions)))
    } else {
      this.priceLines.delete(name)
    }
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

  // Translates a MouseEventParams-style seriesData Map<ISeriesApi, data> into a plain object
  // keyed by this host's series names. A series the Map carries but this host doesn't know
  // (e.g. one added to another host, or already removed) is skipped.
  seriesDataByName(seriesDataMap) {
    const result = {}
    for (const [name, series] of this.series) {
      if (seriesDataMap.has(series)) result[name] = seriesDataMap.get(series)
    }
    return result
  }

  removeSeries(name) {
    const series = this.seriesNamed(name)
    const plugin = this.markerPlugins.get(name)
    if (plugin) plugin.detach()
    this.markerPlugins.delete(name)
    this.priceLines.delete(name)
    this.seriesMeta.delete(name)
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
    this.seriesMeta.clear()
    this.markerPlugins.clear()
    this.priceLines.clear()
    this.chart.remove()
  }
}

// Fixed DOM CustomEvent names LightweightChartController listens for on its own element (see
// below), independent of the controller's identifier -- unlike the "connected" / "crosshair-move"
// / "click" events it dispatches (Stimulus prefixes those with the identifier, e.g.
// "lightweight-chart:connected" or "sub-chart:connected" for a subclass). Turbo Stream actions
// below dispatch these same events, so server-driven updates and hand-dispatched ones look alike.
const INCOMING_EVENTS = {
  "lightweight-chart:update": (host, { name, point }) => host.update(name, point),
  "lightweight-chart:set-data": (host, { name, data }) => host.setData(name, data),
  "lightweight-chart:set-markers": (host, { name, markers }) => host.setMarkers(name, markers)
}

// Maps a turbo-stream action attribute to the incoming event name it should re-dispatch as.
const TURBO_STREAM_ACTIONS = {
  lightweight_chart_update: "lightweight-chart:update",
  lightweight_chart_set_data: "lightweight-chart:set-data",
  lightweight_chart_set_markers: "lightweight-chart:set-markers"
}

let turboStreamActionsInstalled = false

// Installs custom turbo-stream actions (lightweight_chart_update / _set_data / _set_markers)
// without importing @hotwired/turbo: it listens for Turbo's own "turbo:before-stream-render"
// event and, only for those three actions, replaces the default render with one that parses the
// stream element's <template> JSON and dispatches it as the matching INCOMING_EVENTS CustomEvent
// on every target element (see Turbo::Streams::TagBuilder#lightweight_chart_* on the Ruby side).
// Called once at module load below; idempotent so tests (and callers) can call it again safely.
export function installTurboStreamActions() {
  if (turboStreamActionsInstalled) return
  turboStreamActionsInstalled = true

  document.addEventListener("turbo:before-stream-render", (event) => {
    const eventName = TURBO_STREAM_ACTIONS[event.target.getAttribute("action")]
    if (!eventName) return

    event.detail.render = (streamElement) => {
      const payload = JSON.parse(streamElement.querySelector("template").content.textContent)
      for (const target of streamElement.targetElements) {
        target.dispatchEvent(new CustomEvent(eventName, { detail: payload }))
      }
    }
  })
}

installTurboStreamActions()

// Stimulus controller: `data-controller="lightweight-chart"` with optional
// `data-lightweight-chart-options-value` (chart options JSON),
// `data-lightweight-chart-series-value` ([{ type, name, options, data, pane, markers, priceLines }] JSON)
// and `data-lightweight-chart-fit-content-value` (Boolean; fitContent() after series are (re)built).
// Subclass it and call super.connect() before touching this.chart / this.addSeries().
//
// Dispatches Stimulus events for other controllers to react to (bubbling, named after this
// controller's own identifier, e.g. "lightweight-chart:connected" or, for a subclass registered
// as "sub-chart", "sub-chart:connected"):
//   "connected" — fired at the end of connect(), after the declared series are added (and
//     fitContent, if requested). detail: { chart, controller }. A subclass that calls
//     super.connect() first and then adds its own series adds them AFTER this fires, so those
//     series are not yet in detail.chart / controller.series when listeners see the event.
//   "crosshair-move" / "click" — fired from chart.subscribeCrosshairMove / subscribeClick,
//     subscribed on connect and unsubscribed on disconnect and before the host is destroyed on
//     turbo:before-cache. detail: { time, logical, point, seriesData }, where seriesData is a
//     plain object mapping series name -> data item (translated from the MouseEventParams
//     seriesData Map via ChartHost#seriesDataByName; series unknown to this host are skipped).
//
// Listens on its own element (added in connect(), removed in disconnect()) for incoming DOM
// CustomEvents with the fixed names in INCOMING_EVENTS above, so other code (or a Turbo Stream via
// installTurboStreamActions()) can drive the chart without subclassing this controller:
//   "lightweight-chart:update"      detail { name, point }   -> host.update(name, point)
//   "lightweight-chart:set-data"    detail { name, data }    -> host.setData(name, data)
//   "lightweight-chart:set-markers" detail { name, markers } -> host.setMarkers(name, markers)
export class LightweightChartController extends Controller {
  static values = { options: Object, series: Array, fitContent: Boolean }
  // Extra options passed to ChartHost (e.g. { createChart } in tests). Read from the concrete class.
  static chartHostOptions = {}

  connect() {
    this.host = new ChartHost(this.element, { options: this.optionsValue, ...this.constructor.chartHostOptions })
    // Keys of the series this controller created from seriesValue, so a later value change can
    // tell those apart from series a subclass added imperatively (which are left untouched).
    this.declaredSeriesKeys = new Set()
    this.applyDeclaredSeries()
    if (this.fitContentValue) this.host.fitContent()

    this.handleCrosshairMove = (params) => this.dispatch("crosshair-move", { detail: this.mouseEventDetail(params) })
    this.handleClick = (params) => this.dispatch("click", { detail: this.mouseEventDetail(params) })
    this.host.chart.subscribeCrosshairMove(this.handleCrosshairMove)
    this.host.chart.subscribeClick(this.handleClick)

    this.destroyBeforeCache = () => {
      this.unsubscribeChartEvents()
      this.host?.destroy()
    }
    document.addEventListener("turbo:before-cache", this.destroyBeforeCache)

    this.incomingEventHandlers = Object.entries(INCOMING_EVENTS).map(([eventName, handler]) => {
      // Guard against the gap between turbo:before-cache (which destroys the host while this
      // element is still live in the DOM) and disconnect() (which removes these listeners):
      // an event arriving in that gap -- e.g. a Turbo Stream broadcast -- is a harmless no-op.
      const listener = (event) => {
        if (!this.host || this.host.destroyed) return
        handler(this.host, event.detail)
      }
      this.element.addEventListener(eventName, listener)
      return [eventName, listener]
    })

    this.dispatch("connected", { detail: { chart: this.host.chart, controller: this } })
  }

  disconnect() {
    document.removeEventListener("turbo:before-cache", this.destroyBeforeCache)
    for (const [eventName, listener] of this.incomingEventHandlers ?? []) {
      this.element.removeEventListener(eventName, listener)
    }
    this.unsubscribeChartEvents()
    this.host?.destroy()
    this.host = null
  }

  unsubscribeChartEvents() {
    if (!this.host || this.host.destroyed) return
    this.host.chart.unsubscribeCrosshairMove(this.handleCrosshairMove)
    this.host.chart.unsubscribeClick(this.handleClick)
  }

  mouseEventDetail({ time, logical, point, seriesData }) {
    return { time, logical, point, seriesData: this.host.seriesDataByName(seriesData) }
  }

  // Stimulus also calls this once before connect(); there is no host yet, so ignore that call.
  seriesValueChanged() {
    if (!this.host || this.host.destroyed) return
    this.applyDeclaredSeries()
    if (this.fitContentValue) this.host.fitContent()
  }

  // Stimulus also calls this once before connect(); there is no host yet, so ignore that call.
  optionsValueChanged() {
    if (!this.host || this.host.destroyed) return
    this.host.applyOptions(this.optionsValue)
  }

  // Reconciles the host's series with seriesValue instead of rebuilding everything: a declared
  // series whose type and pane are unchanged is updated in place (applyOptions/setData/markers/
  // priceLines); one that is new, retyped or moved to another pane is removed and re-added; one
  // no longer declared is removed. Series added imperatively (not through this method) are untouched.
  applyDeclaredSeries() {
    const entries = this.seriesValue.map((entry, index) => ({ ...entry, key: entry.name ?? `series${index}` }))
    const nextKeys = new Set(entries.map(({ key }) => key))

    for (const key of this.declaredSeriesKeys) {
      if (!nextKeys.has(key)) this.host.removeSeries(key)
    }

    for (const { type, key, options, data, pane, markers, priceLines } of entries) {
      const info = this.declaredSeriesKeys.has(key) ? this.host.seriesInfo(key) : null
      if (info && info.type === type && info.pane === pane) {
        this.host.updateSeries(key, { options, data, markers, priceLines })
      } else {
        if (info) this.host.removeSeries(key)
        this.host.addSeries(type, options ?? {}, { name: key, data, pane, markers, priceLines })
      }
    }

    this.declaredSeriesKeys = nextKeys
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
