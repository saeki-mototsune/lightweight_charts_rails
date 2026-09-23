# frozen_string_literal: true

require "test_helper"

class TurboStreamActionsTest < ActionView::TestCase
  # `view` (ActionView::TestCase::Behavior) is a real ActionView::Base view context, unlike `self`
  # here, so it responds to `formats` as Turbo::Streams::TagBuilder#initialize expects.
  def turbo_stream
    Turbo::Streams::TagBuilder.new(view)
  end

  test "lightweight_chart_update renders a turbo-stream tag whose template carries the normalized payload" do
    html = turbo_stream.lightweight_chart_update("chart-1", name: "price", point: { time: 1, value: 5 })

    node = Nokogiri::HTML5.fragment(html).children.first
    assert_equal "turbo-stream", node.name
    assert_equal "lightweight_chart_update", node["action"]
    assert_equal "chart-1", node["target"]
    assert_equal({ "name" => "price", "point" => { "time" => 1, "value" => 5 } }, template_payload(node))
  end

  test "lightweight_chart_set_data renders a turbo-stream tag with name and data" do
    html = turbo_stream.lightweight_chart_set_data("chart-1", name: "price", data: [{ time: 1, value: 5 }])

    node = Nokogiri::HTML5.fragment(html).children.first
    assert_equal "lightweight_chart_set_data", node["action"]
    assert_equal "chart-1", node["target"]
    assert_equal({ "name" => "price", "data" => [{ "time" => 1, "value" => 5 }] }, template_payload(node))
  end

  test "lightweight_chart_set_markers renders a turbo-stream tag with name and markers" do
    html = turbo_stream.lightweight_chart_set_markers("chart-1", name: "price", markers: [{ time: 1, text: "note" }])

    node = Nokogiri::HTML5.fragment(html).children.first
    assert_equal "lightweight_chart_set_markers", node["action"]
    assert_equal "chart-1", node["target"]
    assert_equal({ "name" => "price", "markers" => [{ "time" => 1, "text" => "note" }] }, template_payload(node))
  end

  test "Time values under a time key are normalized to UNIX seconds" do
    time = Time.utc(2024, 1, 2, 3, 4, 5)

    html = turbo_stream.lightweight_chart_update("chart-1", name: "price", point: { time: time, value: 5 })

    node = Nokogiri::HTML5.fragment(html).children.first
    assert_equal time.to_i, template_payload(node).dig("point", "time")
  end

  private

  # The <template> content is inserted as raw (html_safe) text, but unescape it anyway in case a
  # future Rails/turbo-rails version starts escaping it.
  def template_payload(node)
    JSON.parse(CGI.unescapeHTML(node.at_css("template").inner_html))
  end
end
