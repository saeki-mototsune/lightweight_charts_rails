# frozen_string_literal: true

require "lightweight_charts_rails/time_normalizer"

module LightweightChartsRails
  # View helper that renders the tag LightweightChartController (or a subclass) hooks onto,
  # translating Ruby option/series hashes into the JSON string values Stimulus reads.
  module Helper
    def lightweight_chart_tag(series: [], options: {}, fit_content: nil, controller: "lightweight-chart",
                               values: {}, tag: :div, **html_options, &block)
      data = (html_options.delete(:data) || {}).dup

      existing_controller = data.delete(:controller) || data.delete("controller")
      data[:controller] = [controller, existing_controller].compact.join(" ")

      unless options.empty?
        data["#{controller}-options-value"] = LightweightChartsRails::TimeNormalizer.normalize(options).to_json
      end
      unless series.empty?
        data["#{controller}-series-value"] = LightweightChartsRails::TimeNormalizer.normalize(series).to_json
      end
      data["#{controller}-fit-content-value"] = fit_content.to_s unless fit_content.nil?

      # Stimulus values dasherize the identifier (chart_id: -> data-<controller>-chart-id-value).
      values.each do |key, value|
        dashed_key = key.to_s.tr("_", "-")
        data["#{controller}-#{dashed_key}-value"] = value.is_a?(String) ? value : value.to_json
      end

      html_options = html_options.merge(data: data)

      if block
        content_tag(tag, html_options, &block)
      else
        content_tag(tag, nil, html_options)
      end
    end
  end
end
