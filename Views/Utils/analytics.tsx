import { useEffect, useRef, useState } from "react";
import { IconX, IconShield, IconChartBar } from "@tabler/icons-react";
import ReactGA from "react-ga4";

import { getAppInfo } from "@/About/about";
import { useSettingsContext } from "@/Main/app";
import { saveSettings } from "@/Settings/settings";
import { PluginVariable } from "@/Components/FlowBuilder/flow.types";
import { HorusLink } from "@/Components/reusable";
import { getBaseURL } from "./utils";

const MEASUREMENT_ID = "G-D9DT7B1QHG";

// Whether the current session has consent and GA has been initialized.
// Read by track() below, set only from HorusGoogleAnalytics.
let analyticsEnabled = false;
let commonParams: Record<string, unknown> = {};

/**
 * Sends a GA4 event. No-ops until the user has accepted analytics and GA has
 * finished initializing (see HorusGoogleAnalytics). Every event is stamped
 * with the common app/mode params so events are filterable by platform.
 */
export function track(name: string, params?: Record<string, unknown>) {
  if (!analyticsEnabled) return;
  ReactGA.event(name, { ...commonParams, ...params, source: "client" });
}

function HorusGoogleAnalytics() {
  const [consent, setConsent] = useState<boolean | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const lastHeartbeat = useRef<number>(Date.now());

  const settings = useSettingsContext();

  useEffect(() => {
    // Get initial consent from settings (a boolean, or null if undecided)
    const storedConsent = settings?.["analytics"]?.value ?? null;
    setConsent(storedConsent as boolean | null);
  }, [settings]);

  useEffect(() => {
    if (consent !== true || isInitialized) {
      analyticsEnabled = consent === true;
      return;
    }

    // Fetch app info first so we can give GA a stable identity before the
    // very first event, instead of re-tagging events after the fact.
    getAppInfo().then((appInfo) => {
      commonParams = {
        app_version: appInfo.APP_VERSION,
        platform: appInfo.platform || "unknown",
        mode: appInfo.mode || "unknown",
        webapp: appInfo.mode === "webapp",
        debug: appInfo.debug || false
      };

      ReactGA.initialize(MEASUREMENT_ID, {
        gaOptions: {
          clientId: appInfo.installID,
          userId: appInfo.userID || undefined,
          anonymizeIp: true
        }
      });

      analyticsEnabled = true;
      setIsInitialized(true);

      track("app_launch");
      ReactGA.send({ hitType: "pageview", page: window.location.pathname });
    });
  }, [consent, isInitialized]);

  // Heartbeat: GA4 derives "time in app" from engagement_time_msec, which
  // otherwise only comes from the (unreliable, webview-killed-before-sent)
  // automatic engagement beacon. Send it explicitly every minute the tab is
  // visible, plus a final flush when the app is hidden/closed.
  useEffect(() => {
    if (!isInitialized) return;

    const sendHeartbeat = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      const elapsed = now - lastHeartbeat.current;
      lastHeartbeat.current = now;
      track("app_heartbeat", { engagement_time_msec: elapsed });
    };

    const interval = setInterval(sendHeartbeat, 60_000);

    document.addEventListener("visibilitychange", sendHeartbeat);
    window.addEventListener("pagehide", sendHeartbeat);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", sendHeartbeat);
      window.removeEventListener("pagehide", sendHeartbeat);
    };
  }, [isInitialized]);

  return null;
}

export function HorusAnalyticsProvider({
  children
}: {
  children?: React.ReactNode;
}) {
  return (
    <>
      <ConsentBanner />
      <HorusGoogleAnalytics />
      {children}
    </>
  );
}

export function ConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const settings = useSettingsContext();

  const analyticsSetting = settings?.["analytics"];

  useEffect(() => {
    // Show banner if no consent decision has been made
    const consent = analyticsSetting?.value ?? null;
    if (consent === null) {
      setIsVisible(true);
    }
  }, [analyticsSetting]);

  const handleAccept = () => {
    if (!analyticsSetting) {
      return;
    }

    saveSettings({
      settings: [
        { ...(analyticsSetting as unknown as PluginVariable), value: true }
      ]
    });
    setIsVisible(false);
    // Optional: Reload to initialize analytics
    // window.location.reload();
  };

  const handleReject = () => {
    if (!analyticsSetting) {
      return;
    }

    saveSettings({
      settings: [
        { ...(analyticsSetting as unknown as PluginVariable), value: false }
      ]
    });
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center p-4"
      style={{
        zIndex: 1000
      }}
    >
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg">
              <IconChartBar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Analytics Preferences
              </h2>
              <p className="text-sm text-gray-500">
                Manage your analytics and privacy settings
              </p>
            </div>
          </div>
          <button
            onClick={handleReject}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close banner"
          >
            <IconX className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-gray-700 mb-4">
            We collect anonymous analytics data to help us improve Horus. You
            can choose whether to allow analytics collection.
          </p>

          <div className="space-y-4 mb-6">
            <div className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
              <IconShield className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">
                  Essential Functionality
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Required for the app to work properly. Always enabled.
                </p>
              </div>
              <div className="flex items-center">
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  Always On
                </span>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg">
              <IconChartBar className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">Analytics</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Help us understand how users interact with Horus by collecting
                  anonymous usage data.
                </p>
                {showDetails && (
                  <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                    <strong>Anonymous Analytics:</strong> Tracks feature usage,
                    errors, and performance metrics. No personal or sensitive
                    data is collected. This helps us improve the app experience.
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-sm text-blue-600 hover:text-blue-700 underline mb-6"
          >
            {showDetails ? "Hide" : "Show"} analytics details
          </button>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleAccept}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Allow Analytics
            </button>
            <button
              onClick={handleReject}
              className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Essential Only
            </button>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Learn more about our{" "}
              <HorusLink
                to={getBaseURL("/privacy")}
                target="_blank"
                className="text-blue-600 hover:underline"
              >
                Privacy Policy
              </HorusLink>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
