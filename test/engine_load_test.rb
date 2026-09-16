# frozen_string_literal: true

require "test_helper"

class EngineLoadTest < Minitest::Test
  def test_engine_is_a_rails_engine
    assert LightweightChartsRails::Engine < Rails::Engine
  end

  def test_versions_are_present
    assert_match(/\A\d+\.\d+\.\d+\z/, LightweightChartsRails::VERSION)
    assert_match(/\A\d+\.\d+\.\d+\z/, LightweightChartsRails::LIGHTWEIGHT_CHARTS_VERSION)
    assert_match(/\A\d+\.\d+\.\d+\z/, LightweightChartsRails::FANCY_CANVAS_VERSION)
  end

  def test_precompile_list_names_the_three_vendored_files
    assert_equal %w[lightweight-charts.js fancy-canvas.js lightweight-charts-rails.js],
                 LightweightChartsRails::Engine::PRECOMPILE_ASSETS
  end
end
