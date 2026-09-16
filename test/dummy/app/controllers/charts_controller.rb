# frozen_string_literal: true

class ChartsController < ActionController::Base
  # This dummy app has no ApplicationController, so Rails' usual implicit fallback to
  # layouts/application.html.erb (which only kicks in because a real app's controllers
  # inherit from ApplicationController, whose controller_path is "application") never
  # triggers. Declare it explicitly instead.
  layout "application"

  def show
    base = Date.new(2026, 1, 1)
    @line = 60.times.map { |i| { time: (base + i).iso8601, value: (100 + 10 * Math.sin(i / 5.0) + i * 0.3).round(2) } }
    @volume = 60.times.map { |i| { time: (base + i).iso8601, value: (500 + 300 * Math.cos(i / 3.0)).round, color: i.even? ? "#26a69a" : "#ef5350" } }
  end
end
