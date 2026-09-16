# frozen_string_literal: true

require "test_helper"

class DemoPageTest < ActionDispatch::IntegrationTest
  test "the demo page renders the importmap and a declarative chart" do
    get "/"

    assert_response :success
    assert_select "script[type=importmap]" do |scripts|
      imports = JSON.parse(scripts.first.text).fetch("imports")
      assert_includes imports.keys, "lightweight-charts-rails"
      assert_includes imports.keys, "fancy-canvas"
    end
    assert_select "[data-controller='lightweight-chart'][data-lightweight-chart-series-value]"
  end
end
