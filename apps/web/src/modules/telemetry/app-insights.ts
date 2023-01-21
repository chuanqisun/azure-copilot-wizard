import { ApplicationInsights, ITelemetryItem } from "@microsoft/applicationinsights-web";
import { getJson } from "../../utils/local-storage";
import { CONFIG_CACHE_KEY, HitsConfig } from "../account/config";

export const appInsights = new ApplicationInsights({
  config: {
    connectionString: import.meta.env.VITE_APP_INSIGHTS_CONNECTION_STRING,
  },
});
appInsights.loadAppInsights();

appInsights.addTelemetryInitializer((item: ITelemetryItem) => {
  item.data = { ...item.data, envMode: import.meta.env.MODE };
});

appInsights.setAuthenticatedUserContext(getJson<HitsConfig>(CONFIG_CACHE_KEY)?.email ?? "");
