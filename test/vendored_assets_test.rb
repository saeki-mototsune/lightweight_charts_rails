# frozen_string_literal: true

require "test_helper"

class VendoredAssetsTest < Minitest::Test
  ROOT = File.expand_path("..", __dir__)
  ASSETS = File.join(ROOT, "app/assets/javascripts")

  def test_lightweight_charts_is_the_pinned_version
    source = read("app/assets/javascripts/lightweight-charts.js")
    assert_includes source, "Lightweight Charts™ v#{LightweightChartsRails::LIGHTWEIGHT_CHARTS_VERSION}"
  end

  def test_lightweight_charts_only_imports_fancy_canvas
    source = read("app/assets/javascripts/lightweight-charts.js")
    specifiers = source.scan(/from\s*["']([^"']+)["']/).flatten.uniq
    assert_equal ["fancy-canvas"], specifiers
  end

  def test_fancy_canvas_is_a_self_contained_module
    source = read("app/assets/javascripts/fancy-canvas.js")
    assert_includes source, "fancy-canvas@#{LightweightChartsRails::FANCY_CANVAS_VERSION}"
    refute_match(/from\s*["']/, source)
    assert_includes source, "export{"
  end

  def test_license_and_notices_are_vendored
    assert_includes read("LICENSE-lightweight-charts"), "Apache License"
    notices = read("THIRD_PARTY_NOTICES.md")
    assert_includes notices, "lightweight-charts #{LightweightChartsRails::LIGHTWEIGHT_CHARTS_VERSION}"
    assert_includes notices, "fancy-canvas #{LightweightChartsRails::FANCY_CANVAS_VERSION}"
  end

  private

  def read(relative)
    File.read(File.join(ROOT, relative), encoding: "UTF-8")
  end
end
