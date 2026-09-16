# frozen_string_literal: true

require "test_helper"

class EngineImportmapTest < ActiveSupport::TestCase
  test "the engine's pins are drawn into the application importmap" do
    packages = Rails.application.importmap.packages

    assert_equal "lightweight-charts.js", packages.fetch("lightweight-charts").path
    assert_equal "fancy-canvas.js", packages.fetch("fancy-canvas").path
    assert_equal "lightweight-charts-rails.js", packages.fetch("lightweight-charts-rails").path
  end

  test "the importmap JSON resolves the pins to digested asset paths" do
    json = Rails.application.importmap.to_json(resolver: ActionController::Base.helpers)
    imports = JSON.parse(json).fetch("imports")

    %w[lightweight-charts fancy-canvas lightweight-charts-rails].each do |name|
      assert_match %r{\A/assets/#{name}-[0-9a-f]+\.js\z}, imports.fetch(name)
    end
  end

  test "the engine's javascripts directory is on the asset load path" do
    expected = LightweightChartsRails::Engine.root.join("app/assets/javascripts").to_s
    assert_includes Rails.application.config.assets.paths.map(&:to_s), expected
  end

  test "the vendored files are registered for precompilation" do
    LightweightChartsRails::Engine::PRECOMPILE_ASSETS.each do |file|
      assert_includes Rails.application.config.assets.precompile, file
    end
  end
end

class EngineAssetServingTest < ActionDispatch::IntegrationTest
  %w[lightweight-charts.js fancy-canvas.js lightweight-charts-rails.js].each do |file|
    test "#{file} is served by the asset server" do
      get ActionController::Base.helpers.asset_path(file)

      assert_response :success
      assert_equal "text/javascript", response.media_type
      assert_operator response.body.bytesize, :>, 100
    end
  end
end
