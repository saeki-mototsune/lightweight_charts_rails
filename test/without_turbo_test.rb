# frozen_string_literal: true

require "test_helper"
require "tmpdir"

class WithoutTurboTest < Minitest::Test
  # Boots a separate Rails app in a child process without turbo-rails to prove the engine does not
  # depend on it (turbo-rails is a dev/test dependency only, see Gemfile and engine.rb).
  def test_engine_boots_without_turbo_rails
    script = <<~RUBY
      require "rails"
      require "action_controller/railtie"
      require "propshaft"
      require "importmap-rails"
      require "lightweight_charts_rails"
      class BareApp < Rails::Application
        config.root = Dir.pwd
        config.eager_load = false
        config.secret_key_base = "x"
        config.logger = Logger.new(nil)
      end
      BareApp.initialize!
      puts defined?(Turbo).nil?
      puts LightweightChartsRails::TurboStreamActions.instance_methods(false).sort.inspect
    RUBY
    lib = File.expand_path("../lib", __dir__)

    # Same reasoning as WithoutImportmapTest: run from a scratch directory so this gem's own
    # app/assets/javascripts isn't added a second time by BareApp's own asset initializer.
    Dir.mktmpdir do |scratch_root|
      output = IO.popen([RbConfig.ruby, "-I", lib, "-e", script], chdir: scratch_root, err: [:child, :out], &:read)

      assert_predicate $?, :success?, output
      lines = output.split("\n")
      assert_equal "true", lines[0]
      assert_equal "[:lightweight_chart_set_data, :lightweight_chart_set_markers, :lightweight_chart_update]", lines[1]
    end
  end
end
