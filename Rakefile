# frozen_string_literal: true

require "bundler/gem_tasks"
require "minitest/test_task"

Minitest::TestTask.create do |t|
  t.test_globs = ["test/**/*_test.rb"]
end

Dir.glob(File.expand_path("tasks/*.rake", __dir__)).each { |f| load f }

task default: :test
