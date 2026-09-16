import { Application } from "@hotwired/stimulus"
import { LightweightChartController } from "lightweight-charts-rails"

const application = Application.start()
application.register("lightweight-chart", LightweightChartController)
