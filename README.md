# lightweight_charts_rails

[TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts) for Rails apps that use
importmap-rails and Stimulus. The gem vendors the library (plus its only dependency, fancy-canvas), pins both in the
importmap, and ships a small Stimulus controller you subclass.

## Requirements

- Rails >= 7.1 with `importmap-rails` and `stimulus-rails` (propshaft or sprockets).
- No jsbundling support: the JavaScript is served straight from the gem.

## Installation

```ruby
gem "lightweight_charts_rails"
```

Register the controller (or your subclass) in `app/javascript/controllers/index.js`:

```js
import { application } from "controllers/application"
import { LightweightChartController } from "lightweight-charts-rails"
application.register("lightweight-chart", LightweightChartController)
```

## Declarative usage

```erb
<div style="height: 300px"
     data-controller="lightweight-chart"
     data-lightweight-chart-options-value='{"layout": {"background": {"color": "#fff"}}}'
     data-lightweight-chart-series-value='[{"type": "Line", "name": "price", "options": {"color": "#2563eb"}, "data": [{"time": "2026-01-01", "value": 100}]}]'>
</div>
```

- `options` — chart options passed to `createChart` (`autoSize: true` is added unless you set it).
- `series` — `[{ type, name, options, data }]`. `type` is one of `Line`, `Area`, `Bar`, `Candlestick`, `Histogram`, `Baseline`.
  `name` defaults to `series0`, `series1`, …; `data` is in lightweight-charts' own format (`time` as UNIX seconds, `"YYYY-MM-DD"` or a business day object).
- Changing the `series` attribute after connect rebuilds every series. The chart is destroyed on `disconnect` and on `turbo:before-cache`.

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

Available on the controller: `chart` (IChartApi), `series` (Map name → ISeriesApi), `addSeries(type, options, { name, data })`,
`setData(name, data)`, `update(name, point)`, `removeSeries(name)`, `fitContent()`. The framework-free core is also exported as `ChartHost`.

## Updating the vendored JavaScript

```bash
bundle exec rake "lightweight_charts_rails:update[5.2.1]"   # version defaults to npm latest
```

## Development

```bash
bundle install && npm install
bundle exec rake test   # Ruby: engine + dummy app
npm test                # JavaScript: node --test + jsdom
bundle exec puma -p 3939 test/dummy/config.ru   # demo page at http://localhost:3939/
```

## License

MIT for this gem. lightweight-charts is Apache-2.0 and fancy-canvas is MIT; see `THIRD_PARTY_NOTICES.md`.
