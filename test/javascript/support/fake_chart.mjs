// A stand-in for lightweight-charts' createChart that records every call instead of drawing.
export function fakeCreateChart(calls = []) {
  return (element, options) => {
    calls.push(["createChart", element, options])
    return {
      element,
      options,
      addSeries(definition, seriesOptions, ...paneIndex) {
        calls.push(["addSeries", definition, seriesOptions, ...paneIndex])
        return {
          definition,
          seriesOptions,
          paneIndex: paneIndex[0],
          data: null,
          updates: [],
          priceLines: [],
          setData(data) { this.data = data },
          update(point) { this.updates.push(point) },
          applyOptions(options) {
            calls.push(["series.applyOptions", this, options])
          },
          createPriceLine(options) {
            const line = { options }
            calls.push(["createPriceLine", this, options])
            this.priceLines.push(line)
            return line
          },
          removePriceLine(line) {
            calls.push(["removePriceLine", this, line])
            this.priceLines = this.priceLines.filter((l) => l !== line)
          }
        }
      },
      removeSeries(series) { calls.push(["removeSeries", series]) },
      applyOptions(options) { calls.push(["applyOptions", options]) },
      remove() { calls.push(["remove"]) },
      timeScale() { return { fitContent: () => calls.push(["fitContent"]) } },
      // Store the handler (rather than firing it) so tests can call it directly, e.g.
      // chart.crosshairMoveHandler({ seriesData: new Map([[series, { time: 1 }]]) }).
      subscribeCrosshairMove(handler) {
        calls.push(["subscribeCrosshairMove", handler])
        this.crosshairMoveHandler = handler
      },
      unsubscribeCrosshairMove(handler) {
        calls.push(["unsubscribeCrosshairMove", handler])
        if (this.crosshairMoveHandler === handler) this.crosshairMoveHandler = null
      },
      subscribeClick(handler) {
        calls.push(["subscribeClick", handler])
        this.clickHandler = handler
      },
      unsubscribeClick(handler) {
        calls.push(["unsubscribeClick", handler])
        if (this.clickHandler === handler) this.clickHandler = null
      }
    }
  }
}

// A stand-in for lightweight-charts' createSeriesMarkers that records every call instead of drawing.
export function fakeCreateSeriesMarkers(calls = []) {
  return (series, markers = [], options) => {
    calls.push(["createSeriesMarkers", series, markers, options])
    let current = markers
    return {
      series,
      setMarkers(newMarkers) {
        current = newMarkers
        calls.push(["setMarkers", series, newMarkers])
      },
      markers() { return current },
      detach() { calls.push(["detach", series]) }
    }
  }
}
