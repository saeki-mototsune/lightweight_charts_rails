# frozen_string_literal: true

namespace :lightweight_charts_rails do
  desc "Vendor lightweight-charts (+ fancy-canvas) into app/assets/javascripts. Usage: rake \"lightweight_charts_rails:update[5.2.1]\" (version defaults to npm latest)"
  task :update, [:version] do |_task, args|
    require_relative "../lib/lightweight_charts_rails/updater"
    root = File.expand_path("..", __dir__)
    result = LightweightChartsRails::Updater.new(root: root, version: args[:version]).run
    puts "Vendored #{result.map { |name, version| "#{name} #{version}" }.join(", ")}"
  end
end
