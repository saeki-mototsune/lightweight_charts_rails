# frozen_string_literal: true

require "lightweight_charts_rails/time_normalizer"

module LightweightChartsRails
  # Mixed into Turbo::Streams::TagBuilder (see Engine, only when turbo-rails is loaded) to add
  # turbo_stream.lightweight_chart_update / _set_data / _set_markers actions. Each renders a
  # <turbo-stream> tag whose <template> holds normalized JSON that the JS-side
  # installTurboStreamActions() (app/assets/javascripts/lightweight-charts-rails.js) turns back
  # into the matching incoming "lightweight-chart:*" CustomEvent on the stream's target element(s).
  module TurboStreamActions
    def lightweight_chart_update(target, name:, point:)
      action :lightweight_chart_update, target, payload(name: name, point: point)
    end

    def lightweight_chart_set_data(target, name:, data:)
      action :lightweight_chart_set_data, target, payload(name: name, data: data)
    end

    def lightweight_chart_set_markers(target, name:, markers:)
      action :lightweight_chart_set_markers, target, payload(name: name, markers: markers)
    end

    private

    def payload(hash)
      LightweightChartsRails::TimeNormalizer.normalize(hash).to_json
    end
  end
end
