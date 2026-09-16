# frozen_string_literal: true

require "json"
require "net/http"
require "pathname"
require "uri"

module LightweightChartsRails
  # Downloads lightweight-charts (and its only dependency, fancy-canvas) into app/assets/javascripts
  # and rewrites the version constants. `fetch` is a callable (url -> body) so tests can avoid the network.
  class Updater
    REGISTRY = "https://registry.npmjs.org/lightweight-charts"
    JSDELIVR = "https://cdn.jsdelivr.net/npm"
    ASSETS_DIR = "app/assets/javascripts"

    def initialize(root:, version: nil, fetch: nil)
      @root = Pathname(root)
      @requested_version = version
      @fetch = fetch || method(:http_get)
    end

    def run
      version = @requested_version || JSON.parse(@fetch.call("#{REGISTRY}/latest")).fetch("version")
      metadata = JSON.parse(@fetch.call("#{REGISTRY}/#{version}"))
      fancy_canvas_version = metadata.fetch("dependencies").fetch("fancy-canvas")

      write "#{ASSETS_DIR}/lightweight-charts.js",
            @fetch.call("#{JSDELIVR}/lightweight-charts@#{version}/dist/lightweight-charts.production.mjs")
      write "#{ASSETS_DIR}/fancy-canvas.js",
            @fetch.call("#{JSDELIVR}/fancy-canvas@#{fancy_canvas_version}/+esm")
      write "LICENSE-lightweight-charts",
            @fetch.call("#{JSDELIVR}/lightweight-charts@#{version}/LICENSE")
      write "THIRD_PARTY_NOTICES.md", notices(version, fancy_canvas_version)
      rewrite_versions(version, fancy_canvas_version)

      { "lightweight-charts" => version, "fancy-canvas" => fancy_canvas_version }
    end

    private

    def write(relative, body)
      path = @root.join(relative)
      path.dirname.mkpath
      path.write(body)
    end

    def notices(version, fancy_canvas_version)
      <<~MD
        # Third-party notices

        The JavaScript files in `app/assets/javascripts` are vendored copies of:

        - lightweight-charts #{version} — Apache-2.0, Copyright TradingView, Inc.
          https://github.com/tradingview/lightweight-charts (license text: `LICENSE-lightweight-charts`)
        - fancy-canvas #{fancy_canvas_version} — MIT, Copyright TradingView, Inc.
          https://github.com/tradingview/fancy-canvas (single-file build from https://cdn.jsdelivr.net/npm/fancy-canvas@#{fancy_canvas_version}/+esm)

        Regenerate with `bundle exec rake "lightweight_charts_rails:update[<version>]"`.
      MD
    end

    def rewrite_versions(version, fancy_canvas_version)
      path = @root.join("lib/lightweight_charts_rails/version.rb")
      source = path.read
      source = source.sub(/LIGHTWEIGHT_CHARTS_VERSION = "[^"]*"/, %(LIGHTWEIGHT_CHARTS_VERSION = "#{version}"))
      source = source.sub(/FANCY_CANVAS_VERSION = "[^"]*"/, %(FANCY_CANVAS_VERSION = "#{fancy_canvas_version}"))
      path.write(source)
    end

    def http_get(url, redirects_left = 3)
      response = Net::HTTP.get_response(URI(url))
      case response
      when Net::HTTPSuccess then response.body
      when Net::HTTPRedirection
        raise "too many redirects for #{url}" if redirects_left.zero?
        http_get(URI.join(url, response["location"]).to_s, redirects_left - 1)
      else
        raise "GET #{url} failed: #{response.code} #{response.message}"
      end
    end
  end
end
