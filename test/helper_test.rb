# frozen_string_literal: true

require "test_helper"

class LightweightChartTagTest < ActionView::TestCase
  include LightweightChartsRails::Helper

  test "the helper is mixed into the dummy app's view context" do
    assert ActionController::Base.helpers.respond_to?(:lightweight_chart_tag)
  end

  test "renders a div with the default controller and no value attributes when nothing is given" do
    html = lightweight_chart_tag

    node = Nokogiri::HTML5.fragment(html).children.first
    assert_equal "div", node.name
    assert_equal "lightweight-chart", node["data-controller"]
    assert_nil node["data-lightweight-chart-options-value"]
    assert_nil node["data-lightweight-chart-series-value"]
    assert_nil node["data-lightweight-chart-fit-content-value"]
  end

  test "serializes options as JSON on the options-value attribute" do
    html = lightweight_chart_tag(options: { layout: { background: { color: "#fff" } } })

    node = Nokogiri::HTML5.fragment(html).children.first
    parsed = JSON.parse(node["data-lightweight-chart-options-value"])
    assert_equal({ "layout" => { "background" => { "color" => "#fff" } } }, parsed)
  end

  test "serializes series as JSON on the series-value attribute" do
    series = [{ type: "Line", name: "price", data: [{ time: "2024-01-01", value: 1 }] }]

    html = lightweight_chart_tag(series: series)

    node = Nokogiri::HTML5.fragment(html).children.first
    parsed = JSON.parse(node["data-lightweight-chart-series-value"])
    assert_equal "Line", parsed.first.fetch("type")
    assert_equal "2024-01-01", parsed.first.fetch("data").first.fetch("time")
  end

  test "normalizes Date/Time values under time keys inside series data" do
    series = [{ type: "Line", data: [{ time: Date.new(2024, 1, 2), value: 1 }] }]

    html = lightweight_chart_tag(series: series)

    parsed = JSON.parse(Nokogiri::HTML5.fragment(html).children.first["data-lightweight-chart-series-value"])
    assert_equal "2024-01-02", parsed.first.fetch("data").first.fetch("time")
  end

  test "normalizes time values inside series markers too" do
    series = [{ type: "Line", markers: [{ time: Time.utc(2024, 1, 2, 3, 4, 5), text: "note" }] }]

    html = lightweight_chart_tag(series: series)

    parsed = JSON.parse(Nokogiri::HTML5.fragment(html).children.first["data-lightweight-chart-series-value"])
    assert_equal Time.utc(2024, 1, 2, 3, 4, 5).to_i, parsed.first.fetch("markers").first.fetch("time")
  end

  test "supports a custom controller identifier" do
    html = lightweight_chart_tag(controller: "candles-chart", options: { a: 1 })

    node = Nokogiri::HTML5.fragment(html).children.first
    assert_equal "candles-chart", node["data-controller"]
    assert node["data-candles-chart-options-value"]
    assert_nil node["data-lightweight-chart-options-value"]
  end

  test "renders extra Stimulus values, dasherizing underscored keys" do
    html = lightweight_chart_tag(values: { chart_id: "abc-123", ready: true })

    node = Nokogiri::HTML5.fragment(html).children.first
    assert_equal "abc-123", node["data-lightweight-chart-chart-id-value"]
    assert_equal "true", node["data-lightweight-chart-ready-value"]
  end

  test "renders fit_content as a stringified boolean value attribute" do
    html_true = lightweight_chart_tag(fit_content: true)
    html_false = lightweight_chart_tag(fit_content: false)

    assert_equal "true", Nokogiri::HTML5.fragment(html_true).children.first["data-lightweight-chart-fit-content-value"]
    assert_equal "false", Nokogiri::HTML5.fragment(html_false).children.first["data-lightweight-chart-fit-content-value"]
  end

  test "merges a caller-supplied data-controller with ours, ours first" do
    html = lightweight_chart_tag(data: { controller: "other-controller" })

    node = Nokogiri::HTML5.fragment(html).children.first
    assert_equal "lightweight-chart other-controller", node["data-controller"]
  end

  test "passes through other html options like id, class, and extra data keys" do
    html = lightweight_chart_tag(id: "chart-1", class: "chart", style: "height: 300px",
                                  data: { testid: "chart" })

    node = Nokogiri::HTML5.fragment(html).children.first
    assert_equal "chart-1", node["id"]
    assert_equal "chart", node["class"]
    assert_equal "height: 300px", node["style"]
    assert_equal "chart", node["data-testid"]
  end

  test "renders a custom tag" do
    html = lightweight_chart_tag(tag: :section)

    assert_equal "section", Nokogiri::HTML5.fragment(html).children.first.name
  end

  test "renders block content inside the tag" do
    html = lightweight_chart_tag { content_tag(:p, "loading...") }

    node = Nokogiri::HTML5.fragment(html).children.first
    assert_equal "loading...", node.at_css("p").text
  end
end
