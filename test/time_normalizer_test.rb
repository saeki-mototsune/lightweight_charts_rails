# frozen_string_literal: true

require "test_helper"
require "lightweight_charts_rails/time_normalizer"

class TimeNormalizerTest < Minitest::Test
  def test_leaves_non_time_keys_untouched
    input = { open: 1, close: 2, nested: { value: 3 } }

    assert_equal input, LightweightChartsRails::TimeNormalizer.normalize(input)
  end

  def test_converts_date_time_key_to_iso_date_string
    input = { time: Date.new(2024, 1, 2), value: 10 }

    assert_equal({ time: "2024-01-02", value: 10 }, LightweightChartsRails::TimeNormalizer.normalize(input))
  end

  def test_converts_time_time_key_to_unix_seconds
    time = Time.utc(2024, 1, 2, 3, 4, 5)

    result = LightweightChartsRails::TimeNormalizer.normalize({ time: time })

    assert_equal time.to_i, result.fetch(:time)
  end

  def test_converts_datetime_time_key_to_unix_seconds_not_date_string
    datetime = DateTime.new(2024, 1, 2, 3, 4, 5)

    result = LightweightChartsRails::TimeNormalizer.normalize({ time: datetime })

    assert_equal datetime.to_time.to_i, result.fetch(:time)
    refute_equal "2024-01-02", result.fetch(:time)
  end

  def test_converts_time_with_zone_time_key_to_unix_seconds
    tz_time = Time.zone.local(2024, 1, 2, 3, 4, 5)

    result = LightweightChartsRails::TimeNormalizer.normalize({ time: tz_time })

    assert_equal tz_time.to_i, result.fetch(:time)
  end

  def test_leaves_integer_time_key_untouched
    result = LightweightChartsRails::TimeNormalizer.normalize({ time: 1_700_000_000 })

    assert_equal 1_700_000_000, result.fetch(:time)
  end

  def test_leaves_string_time_key_untouched
    result = LightweightChartsRails::TimeNormalizer.normalize({ time: "2024-01-02" })

    assert_equal "2024-01-02", result.fetch(:time)
  end

  def test_leaves_business_day_hash_time_key_untouched
    business_day = { year: 2024, month: 1, day: 2 }

    result = LightweightChartsRails::TimeNormalizer.normalize({ time: business_day })

    assert_equal business_day, result.fetch(:time)
  end

  def test_recognizes_string_time_key_too
    result = LightweightChartsRails::TimeNormalizer.normalize({ "time" => Date.new(2024, 1, 2) })

    assert_equal "2024-01-02", result.fetch("time")
  end

  def test_recurses_into_arrays_of_hashes
    input = [{ time: Date.new(2024, 1, 1), value: 1 }, { time: Date.new(2024, 1, 2), value: 2 }]

    result = LightweightChartsRails::TimeNormalizer.normalize(input)

    assert_equal [{ time: "2024-01-01", value: 1 }, { time: "2024-01-02", value: 2 }], result
  end

  def test_recurses_into_nested_series_like_structures
    input = {
      data: [{ time: Date.new(2024, 1, 1), value: 1 }],
      markers: [{ time: Date.new(2024, 1, 1), text: "note" }]
    }

    result = LightweightChartsRails::TimeNormalizer.normalize(input)

    assert_equal "2024-01-01", result.dig(:data, 0, :time)
    assert_equal "2024-01-01", result.dig(:markers, 0, :time)
  end

  def test_does_not_mutate_the_input
    input = { time: Date.new(2024, 1, 2), nested: { time: Date.new(2024, 1, 3) } }
    duplicate = Marshal.load(Marshal.dump(input))

    LightweightChartsRails::TimeNormalizer.normalize(input)

    assert_equal duplicate, input
  end

  def test_leaves_non_hash_non_array_values_untouched
    assert_equal 5, LightweightChartsRails::TimeNormalizer.normalize(5)
    assert_equal "hi", LightweightChartsRails::TimeNormalizer.normalize("hi")
    assert_nil LightweightChartsRails::TimeNormalizer.normalize(nil)
  end
end
