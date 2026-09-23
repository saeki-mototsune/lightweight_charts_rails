// A stand-in for lightweight-charts' createChart that records every call instead of drawing.
export function fakeCreateChart(calls = []) {
  return (element, options) => {
    calls.push(["createChart", element, options])
    return {
      element,
      options,
      addSeries(definition, seriesOptions) {
        calls.push(["addSeries", definition, seriesOptions])
        return {
          definition,
          seriesOptions,
          data: null,
          updates: [],
          setData(data) { this.data = data },
          update(point) { this.updates.push(point) }
        }
      },
      removeSeries(series) { calls.push(["removeSeries", series]) },
      applyOptions(options) { calls.push(["applyOptions", options]) },
      remove() { calls.push(["remove"]) },
      timeScale() { return { fitContent: () => calls.push(["fitContent"]) } }
    }
  }
}
