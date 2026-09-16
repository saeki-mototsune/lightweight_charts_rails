# frozen_string_literal: true

require "rails"
require "action_controller/railtie"
require "action_view/railtie"
require "propshaft"
require "importmap-rails"
require "stimulus-rails"
require "lightweight_charts_rails"

module Dummy
  class Application < Rails::Application
    config.load_defaults Rails::VERSION::STRING.to_f
    config.root = File.expand_path("..", __dir__)
    config.eager_load = false
    config.secret_key_base = "dummy-secret-key-base-for-tests"
    config.hosts.clear
    config.logger = Logger.new(nil)
    config.assets.server = true
  end
end
