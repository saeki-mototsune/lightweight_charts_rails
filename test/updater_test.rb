# frozen_string_literal: true

require "test_helper"
require "tmpdir"
require "lightweight_charts_rails/updater"

class UpdaterTest < Minitest::Test
  FAKE = {
    "https://registry.npmjs.org/lightweight-charts/latest" => '{"version":"9.9.9","dependencies":{"fancy-canvas":"3.3.3"}}',
    "https://registry.npmjs.org/lightweight-charts/9.9.9" => '{"version":"9.9.9","dependencies":{"fancy-canvas":"3.3.3"}}',
    "https://cdn.jsdelivr.net/npm/lightweight-charts@9.9.9/dist/lightweight-charts.production.mjs" => 'import{size}from"fancy-canvas";export{createChart}',
    "https://cdn.jsdelivr.net/npm/fancy-canvas@3.3.3/+esm" => "export{size}",
    "https://cdn.jsdelivr.net/npm/lightweight-charts@9.9.9/LICENSE" => "Apache License 2.0 (fake)"
  }.freeze

  def setup
    @root = Dir.mktmpdir
    FileUtils.mkdir_p File.join(@root, "lib/lightweight_charts_rails")
    File.write File.join(@root, "lib/lightweight_charts_rails/version.rb"), <<~RUBY
      module LightweightChartsRails
        VERSION = "0.1.0"
        LIGHTWEIGHT_CHARTS_VERSION = "5.2.1"
        FANCY_CANVAS_VERSION = "2.1.0"
      end
    RUBY
    @requested = []
    @fetch = ->(url) { @requested << url; FAKE.fetch(url) { raise "unexpected fetch #{url}" } }
  end

  def teardown
    FileUtils.remove_entry @root
  end

  def test_run_with_explicit_version_writes_assets_licenses_and_versions
    result = LightweightChartsRails::Updater.new(root: @root, version: "9.9.9", fetch: @fetch).run

    assert_equal({ "lightweight-charts" => "9.9.9", "fancy-canvas" => "3.3.3" }, result)
    assert_equal 'import{size}from"fancy-canvas";export{createChart}', read("app/assets/javascripts/lightweight-charts.js")
    assert_equal "export{size}", read("app/assets/javascripts/fancy-canvas.js")
    assert_equal "Apache License 2.0 (fake)", read("LICENSE-lightweight-charts")
    assert_includes read("THIRD_PARTY_NOTICES.md"), "lightweight-charts 9.9.9"
    assert_includes read("THIRD_PARTY_NOTICES.md"), "fancy-canvas 3.3.3"
    assert_includes read("lib/lightweight_charts_rails/version.rb"), 'LIGHTWEIGHT_CHARTS_VERSION = "9.9.9"'
    assert_includes read("lib/lightweight_charts_rails/version.rb"), 'FANCY_CANVAS_VERSION = "3.3.3"'
    refute_includes @requested, "https://registry.npmjs.org/lightweight-charts/latest"
  end

  def test_run_without_version_resolves_latest_first
    LightweightChartsRails::Updater.new(root: @root, fetch: @fetch).run

    assert_equal "https://registry.npmjs.org/lightweight-charts/latest", @requested.first
    assert_includes read("lib/lightweight_charts_rails/version.rb"), 'LIGHTWEIGHT_CHARTS_VERSION = "9.9.9"'
  end

  private

  def read(relative)
    File.read(File.join(@root, relative))
  end
end
