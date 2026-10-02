# lightweight_charts_rails

[TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts) for Rails apps that use
importmap-rails and Stimulus. The gem vendors the library (plus its only dependency, fancy-canvas), pins both in the
importmap, and ships a small Stimulus controller you subclass.

## Requirements

- Rails >= 7.1 with `importmap-rails` and `stimulus-rails`.
- `turbo-rails` is optional; add it for the realtime `turbo_stream.lightweight_chart_*` actions below.
- No jsbundling support: the JavaScript is served straight from the gem.
- The test suite exercises propshaft. sprockets is expected to work too, since the engine adds the
  vendored files to `config.assets.precompile`, but that path is untested.

## Installation

```ruby
gem "lightweight_charts_rails"
```

Then register the controller with the generator:

```bash
bin/rails generate lightweight_charts_rails:install
```

This appends to `app/javascript/controllers/index.js`:

```js
import { LightweightChartController } from "lightweight-charts-rails"
application.register("lightweight-chart", LightweightChartController)
```

If that file doesn't exist yet, the generator prints the two lines instead of creating anything; if it
already registers `lightweight-charts-rails`, running the generator again is a no-op.

## Usage

The `lightweight_chart_tag` view helper renders the div `LightweightChartController` hooks onto, translating
Ruby option/series hashes into the JSON Stimulus values it reads:

```erb
<%= lightweight_chart_tag(
      style: "height: 300px",
      options: { layout: { background: { color: "#fff" } } },
      series: [
        { type: "Line", name: "price", options: { color: "#2563eb" }, data: @prices }
      ],
      fit_content: true
    ) %>
```

- Any key named `time`, anywhere inside `options` or `series` (including nested in `data`, `markers`, etc.),
  is normalized for you: `Time` / `DateTime` / `ActiveSupport::TimeWithZone` become UNIX seconds and `Date`
  becomes `"YYYY-MM-DD"`. So `@prices` can be `[{ time: record.traded_at, value: record.price }]` straight
  from ActiveRecord, no manual formatting needed.
- Extra `html_options` (`id`, `class`, `style`, `data: { ... }`, a block, `tag: :section`, ...) pass through
  to `content_tag` as usual. A `data: { controller: "other" }` you pass is merged after ours
  (`"lightweight-chart other"`), and a `values:` hash adds extra Stimulus values, dasherizing underscored
  keys (`values: { chart_id: "abc" }` -> `data-lightweight-chart-chart-id-value="abc"`).
- `controller:` (default `"lightweight-chart"`) lets you target a subclass registered under another
  identifier; the `data-*-value` attribute names follow it.

### Raw data attributes

`lightweight_chart_tag` is just a thin layer over plain Stimulus data attributes, which still work if you'd
rather build the tag yourself (e.g. from a non-ERB template, or with hand-normalized data):

```erb
<div style="height: 300px"
     data-controller="lightweight-chart"
     data-lightweight-chart-options-value='{"layout": {"background": {"color": "#fff"}}}'
     data-lightweight-chart-series-value='[{"type": "Line", "name": "price", "options": {"color": "#2563eb"}, "data": [{"time": "2026-01-01", "value": 100}]}]'>
</div>
```

### Options

- `options` — chart options passed to `createChart` (`autoSize: true` is added unless you set it). Changing
  it after connect calls `chart.applyOptions(options)`.
- `series` — `[{ type, name, options, data, pane, markers, priceLines }]`.
  - `type` is one of `Line`, `Area`, `Bar`, `Candlestick`, `Histogram`, `Baseline`.
  - `name` defaults to `series0`, `series1`, … in declaration order.
  - `data` is in lightweight-charts' own format (`time` as UNIX seconds, `"YYYY-MM-DD"` or a business day
    object -- or, through the helper/time normalization, a `Time`/`Date` you hand it directly).
  - `pane` is the pane index (`0` is the main pane); series with the same `pane` share a price scale area.
    Omit it to use the default pane.
  - `markers` is an array of [`SeriesMarker`](https://tradingview.github.io/lightweight-charts/docs/api/type-aliases/SeriesMarker)
    options (`time`, `position`, `color`, `shape`, `text`, ...), rendered through the `createSeriesMarkers`
    plugin.
  - `priceLines` is an array of [`createPriceLine`](https://tradingview.github.io/lightweight-charts/docs/api/interfaces/ISeriesApi#createpriceline)
    options (`price`, `color`, `lineWidth`, `lineStyle`, `title`, ...).
- `fit_content` — when true, calls `chart.timeScale().fitContent()` after the declared series are (re)built.

### Diff-based series updates

Changing the `series` attribute after connect does **not** rebuild every series from scratch. Each declared
entry is matched to the previous one by `name` (or its positional `series0`/`series1`/… key):

- Same `type` and `pane` as before -> updated in place: `applyOptions`, `setData` (replacing the series'
  full data -- an entry with no `data` clears it), and markers/price lines are replaced wholesale (an entry
  with no `markers` clears an existing markers plugin instead of leaving it stale; the same is true for
  `priceLines`).
- New name, different `type`, or moved to a different `pane` -> the old series is removed and a new one
  added.
- No longer present in the array -> removed.
- A series you added **imperatively** (via `addSeries`/`controller.addSeries`, not through the `series`
  value) is never touched by this reconciliation, even across value changes.

The chart itself is destroyed on `disconnect` and on `turbo:before-cache`.

## Subclassing

```js
import { LightweightChartController } from "lightweight-charts-rails"

export default class extends LightweightChartController {
  static values = { url: String }   // options and series are inherited

  async connect() {
    super.connect()
    const { points } = await (await fetch(this.urlValue)).json()
    this.addSeries("Line", {}, { name: "price", data: points })
    this.fitContent()
  }
}
```

Available on the controller: `chart` (`IChartApi`), `series` (`Map` name -> `ISeriesApi`),
`addSeries(type, options, { name, data, pane, markers, priceLines })`, `setData(name, data)`,
`update(name, point)`, `setMarkers(name, markers)`, `removeSeries(name)`, `fitContent()`. The framework-free
core is also exported as `ChartHost`.

## Outgoing events

The controller dispatches Stimulus events, bubbling and prefixed with its own identifier (so a subclass
registered as `"sub-chart"` fires `sub-chart:connected`, not `lightweight-chart:connected`):

- **`connected`** — fired at the end of `connect()`, after the declared series (and `fitContent`, if
  requested) are applied. `detail: { chart, controller }`.
- **`crosshair-move`** / **`click`** — fired from `chart.subscribeCrosshairMove` / `subscribeClick`,
  subscribed on connect and unsubscribed on disconnect (and before the host is destroyed on
  `turbo:before-cache`). `detail: { time, logical, point, seriesData }`, where `seriesData` is a plain
  object mapping series name -> data item (translated from lightweight-charts' own `Map<ISeriesApi, data>`;
  a series this controller doesn't know about is skipped).

```js
document.addEventListener("lightweight-chart:crosshair-move", (event) => {
  const { time, seriesData } = event.detail
  console.log(time, seriesData.price)
})
```

## Realtime updates

### Incoming DOM events

Independently of any subclassing, the controller listens on its own element for three fixed
`CustomEvent`s (names are not prefixed by the identifier, unlike the outgoing events above) and drives the
chart from them:

| Event | `detail` | Effect |
| --- | --- | --- |
| `lightweight-chart:update` | `{ name, point }` | `host.update(name, point)` |
| `lightweight-chart:set-data` | `{ name, data }` | `host.setData(name, data)` |
| `lightweight-chart:set-markers` | `{ name, markers }` | `host.setMarkers(name, markers)` |

```js
document.getElementById("price-chart").dispatchEvent(
  new CustomEvent("lightweight-chart:update", { detail: { name: "price", point: { time: 1706745600, value: 101.2 } } })
)
```

### Turbo Stream actions

When `turbo-rails` is loaded, the gem registers three matching `turbo_stream` actions
(`turbo_stream.lightweight_chart_update` / `_set_data` / `_set_markers`). Each renders a `<turbo-stream>`
whose `<template>` holds the (time-normalized) JSON payload; on the client, `installTurboStreamActions()`
(installed automatically when `lightweight-charts-rails` is imported) turns that back into the matching
`lightweight-chart:*` `CustomEvent` above on every target element -- so a chart reacts the same way whether
the event was dispatched by hand or delivered through Turbo.

```erb
<%# app/views/prices/update.turbo_stream.erb %>
<%= turbo_stream.lightweight_chart_update("price-chart", name: "price", point: { time: @price.traded_at, value: @price.value }) %>
<%= turbo_stream.lightweight_chart_set_data("price-chart", name: "price", data: @prices) %>
<%= turbo_stream.lightweight_chart_set_markers("price-chart", name: "price", markers: @markers) %>
```

`target` (the first argument) can be an id string or, like the built-in turbo_stream actions, any object
`dom_id` accepts.

### Broadcasting over ActionCable

These are plain `turbo_stream` actions, so they work with `Turbo::StreamsChannel.broadcast_action_to` (the
method `Turbo::Broadcastable`'s `broadcast_*_to` helpers call) like any other action. Build the payload with
`LightweightChartsRails::TimeNormalizer.normalize` -- the same normalization `turbo_stream.lightweight_chart_*`
applies -- and pass it as `content:`:

```ruby
Turbo::StreamsChannel.broadcast_action_to(
  "prices",
  action: :lightweight_chart_update,
  target: "price-chart",
  content: LightweightChartsRails::TimeNormalizer.normalize(name: "price", point: { time: price.traded_at, value: price.value }).to_json
)
```

This broadcasts the identical `<turbo-stream>` markup `turbo_stream.lightweight_chart_update` would render
inline, over the `"prices"` stream, to every subscriber's matching target element.

## Development

```bash
bundle install && npm install
bundle exec rake test   # Ruby: engine + dummy app
npm test                # JavaScript: node --test + jsdom
bundle exec puma -p 3939 test/dummy/config.ru   # demo page at http://localhost:3939/
```

### Updating the vendored JavaScript

```bash
bundle exec rake "lightweight_charts_rails:update[5.2.1]"   # version defaults to npm latest
```

This task lives in `tasks/` and is excluded from the packaged gem, so it must be run from a checkout
of this repository, not from an application that depends on the gem.

## License

MIT for this gem. lightweight-charts is Apache-2.0 and fancy-canvas is MIT; see `THIRD_PARTY_NOTICES.md`.
