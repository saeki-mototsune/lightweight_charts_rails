# Third-party notices

The JavaScript files in `app/assets/javascripts` are vendored copies of:

- lightweight-charts 5.2.1 — Apache-2.0, Copyright TradingView, Inc.
  https://github.com/tradingview/lightweight-charts (license text: `LICENSE-lightweight-charts`)
- fancy-canvas 2.1.0 — MIT, Copyright TradingView, Inc.
  https://github.com/tradingview/fancy-canvas (single-file build from https://cdn.jsdelivr.net/npm/fancy-canvas@2.1.0/+esm)

Regenerate with `bundle exec rake "lightweight_charts_rails:update[<version>]"`.
