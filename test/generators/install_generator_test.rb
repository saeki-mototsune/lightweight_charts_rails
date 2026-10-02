# frozen_string_literal: true

require "test_helper"
require "rails/generators/test_case"
require "generators/lightweight_charts_rails/install/install_generator"

module LightweightChartsRails
  class InstallGeneratorTest < Rails::Generators::TestCase
    tests LightweightChartsRails::Generators::InstallGenerator
    destination File.expand_path("../../tmp/install_generator", __dir__)
    setup :prepare_destination

    test "appends the import and registration lines to an existing controllers/index.js" do
      write_controllers_index("import { Application } from \"@hotwired/stimulus\"\n")

      run_generator

      contents = read_controllers_index
      assert_includes contents, %(import { LightweightChartController } from "lightweight-charts-rails")
      assert_includes contents, %(application.register("lightweight-chart", LightweightChartController))
    end

    test "does nothing on a second run" do
      write_controllers_index("import { Application } from \"@hotwired/stimulus\"\n")

      run_generator
      contents_after_first_run = read_controllers_index

      run_generator
      contents_after_second_run = read_controllers_index

      assert_equal contents_after_first_run, contents_after_second_run
      assert_equal 1, contents_after_second_run.scan("lightweight-charts-rails").size
    end

    test "is a no-op and does not create the file when controllers/index.js is missing" do
      run_generator

      assert_no_file "app/javascript/controllers/index.js"
    end

    private

    def write_controllers_index(contents)
      path = File.join(destination_root, "app/javascript/controllers/index.js")
      FileUtils.mkdir_p(File.dirname(path))
      File.write(path, contents)
    end

    def read_controllers_index
      File.read(File.join(destination_root, "app/javascript/controllers/index.js"))
    end
  end
end
