# frozen_string_literal: true

require "rails/generators/base"

module LightweightChartsRails
  module Generators
    # `bin/rails generate lightweight_charts_rails:install` — registers LightweightChartController
    # under the "lightweight-chart" identifier in app/javascript/controllers/index.js.
    class InstallGenerator < Rails::Generators::Base
      desc "Registers LightweightChartController in app/javascript/controllers/index.js"

      CONTROLLERS_INDEX = "app/javascript/controllers/index.js"
      MARKER = "lightweight-charts-rails"
      SNIPPET = <<~JS

        import { LightweightChartController } from "lightweight-charts-rails"
        application.register("lightweight-chart", LightweightChartController)
      JS

      def register_controller
        unless File.exist?(File.join(destination_root, CONTROLLERS_INDEX))
          say_status :missing, "#{CONTROLLERS_INDEX} not found; add these two lines manually:", :yellow
          say SNIPPET
          return
        end

        if File.read(File.join(destination_root, CONTROLLERS_INDEX)).include?(MARKER)
          say_status :skip, "#{CONTROLLERS_INDEX} already registers #{MARKER}"
          return
        end

        append_to_file CONTROLLERS_INDEX, SNIPPET
      end
    end
  end
end
