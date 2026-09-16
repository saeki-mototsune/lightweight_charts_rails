# frozen_string_literal: true

require "test_helper"
require "tmpdir"

class WithoutImportmapTest < Minitest::Test
  # Boots a separate Rails app in a child process without importmap-rails to prove the engine does not depend on it.
  def test_engine_boots_without_importmap_rails
    script = <<~RUBY
      require "rails"
      require "action_controller/railtie"
      require "propshaft"
      require "lightweight_charts_rails"
      class BareApp < Rails::Application
        config.root = Dir.pwd
        config.eager_load = false
        config.secret_key_base = "x"
        config.logger = Logger.new(nil)
      end
      BareApp.initialize!
      puts BareApp.config.assets.paths.map(&:to_s).grep(%r{lightweight_charts_rails/app/assets/javascripts}).size
      puts BareApp.config.respond_to?(:importmap)
    RUBY
    lib = File.expand_path("../lib", __dir__)

    # BareApp's config.root = Dir.pwd (inside the script). Run the child process from a scratch
    # directory instead of this gem's own root: this gem's root also happens to contain
    # app/assets/javascripts (the vendored assets), so if BareApp's root pointed at it too, its own
    # Rails::Engine-inherited propshaft initializer would add that same directory a second time,
    # independently of the LightweightChartsRails::Engine instance -- an artifact of testing the gem
    # against itself, not something a real host app would hit.
    Dir.mktmpdir do |scratch_root|
      output = IO.popen([RbConfig.ruby, "-I", lib, "-e", script], chdir: scratch_root, err: [:child, :out], &:read)

      assert_predicate $?, :success?, output
      assert_equal %w[1 false], output.split
    end
  end
end
