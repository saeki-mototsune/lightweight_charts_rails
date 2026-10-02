# frozen_string_literal: true

require "date"
require "time"

module LightweightChartsRails
  # Recursively rewrites the value of every "time" key (Symbol or String) in a Hash/Array
  # structure into the string/integer form lightweight-charts' UTCTimestamp / BusinessDay expect,
  # so view code can hand series data straight from ActiveRecord without formatting it by hand.
  module TimeNormalizer
    class << self
      def normalize(obj)
        case obj
        when Hash
          obj.each_with_object({}) { |(key, value), result| result[key] = normalize_pair(key, value) }
        when Array
          obj.map { |item| normalize(item) }
        else
          obj
        end
      end

      private

      def normalize_pair(key, value)
        time_key?(key) ? normalize_time_value(value) : normalize(value)
      end

      def time_key?(key)
        (key.is_a?(Symbol) || key.is_a?(String)) && key.to_s == "time"
      end

      def normalize_time_value(value)
        # Time/DateTime/TimeWithZone all become UNIX seconds; DateTime is a Date subclass, so it
        # must be checked (here, via Time/DateTime first) before the plain-Date case below.
        return value.to_i if value.is_a?(Time) || value.is_a?(DateTime)
        return value.to_i if defined?(ActiveSupport::TimeWithZone) && value.is_a?(ActiveSupport::TimeWithZone)
        return value.strftime("%Y-%m-%d") if value.is_a?(Date)
        return normalize(value) if value.is_a?(Hash) || value.is_a?(Array)

        value
      end
    end
  end
end
