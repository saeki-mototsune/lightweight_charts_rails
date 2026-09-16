# frozen_string_literal: true

require_relative "lib/lightweight_charts_rails/version"

Gem::Specification.new do |spec|
  spec.name = "lightweight_charts_rails"
  spec.version = LightweightChartsRails::VERSION
  spec.authors = ["Saeki Mototsune"]
  spec.email = ["mototsune@featherstonhaugh.jp"]

  spec.summary = "TradingView Lightweight Charts for importmap-rails + Stimulus"
  spec.description = "Bundles lightweight-charts as importmap pins and ships a Stimulus controller (ChartHost + LightweightChartController) to subclass."
  spec.homepage = "https://github.com/SaekiMototsune/lightweight_charts_rails"
  spec.license = "MIT"
  spec.required_ruby_version = ">= 3.2.0"
  spec.metadata["homepage_uri"] = spec.homepage
  spec.metadata["source_code_uri"] = spec.homepage

  gemspec = File.basename(__FILE__)
  spec.files = IO.popen(%w[git ls-files -z], chdir: __dir__, err: IO::NULL) do |ls|
    ls.readlines("\x0", chomp: true).reject do |f|
      (f == gemspec) || (f == ".gitignore") ||
        f.start_with?(*%w[bin/ Gemfile test/ tasks/ package])
    end
  end
  spec.require_paths = ["lib"]

  spec.add_dependency "railties", ">= 7.1"
end
