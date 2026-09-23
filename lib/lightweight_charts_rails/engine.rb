# frozen_string_literal: true

# Rails 8.1's rails/initializable.rb calls `delegate_missing_to` at class-body load time but does not
# require this itself; a full `require "rails"` boot papers over the gap via active_support/rails.rb.
# Since this engine is required standalone (no dummy app in this gem's own test suite), we must load it
# explicitly before `rails/engine` pulls in rails/railtie -> rails/initializable.
require "active_support/core_ext/module/delegation"
require "rails/engine"

module LightweightChartsRails
  class Engine < ::Rails::Engine
    PRECOMPILE_ASSETS = %w[lightweight-charts.js fancy-canvas.js lightweight-charts-rails.js].freeze

    # propshaft / sprockets both pick up an engine's app/assets/* automatically; sprockets additionally
    # needs the files listed for precompilation. propshaft defines an (unused) empty precompile array, so this is harmless there.
    initializer "lightweight_charts_rails.assets" do |app|
      if app.config.respond_to?(:assets) && app.config.assets.precompile
        app.config.assets.precompile += PRECOMPILE_ASSETS
      end
    end

    # importmap-rails draws every path in config.importmap.paths inside its own "importmap" initializer,
    # so ours must be registered before it runs. Without importmap-rails the config key is absent and we do nothing.
    initializer "lightweight_charts_rails.importmap", before: "importmap" do |app|
      if app.config.respond_to?(:importmap)
        app.config.importmap.paths << root.join("config/importmap.rb")
      end
    end

    initializer "lightweight_charts_rails.helper" do
      ActiveSupport.on_load(:action_view) do
        include LightweightChartsRails::Helper
      end
    end

    # turbo-rails is optional (dev/test dependency only, see Gemfile); without it Turbo is
    # undefined and we add nothing. When it is present, Turbo::Streams::TagBuilder itself runs the
    # :turbo_streams_tag_builder load hook at the end of its class body, so registering here (before
    # that file loads) is enough -- no config.to_prepare fallback is needed.
    initializer "lightweight_charts_rails.turbo_stream_actions" do
      if defined?(Turbo)
        ActiveSupport.on_load(:turbo_streams_tag_builder) do
          include LightweightChartsRails::TurboStreamActions
        end
      end
    end
  end
end
