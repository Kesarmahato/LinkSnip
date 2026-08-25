import axios from "axios";

const defaultProdApiUrl = "https://link-snip-backend.vercel.app";
const configuredApiUrl = (
  import.meta.env.VITE_API_URL || ""
).trim();

let apiBaseUrl =
  import.meta.env.PROD
    ? defaultProdApiUrl
    : "http://127.0.0.1:8000";

if (configuredApiUrl && configuredApiUrl !== "/") {
  let shouldUseConfigured = true;

  if (
    import.meta.env.PROD &&
    typeof window !== "undefined"
  ) {
    try {
      const configuredHost = new URL(
        configuredApiUrl
      ).host;

      // Prevent accidental frontend-domain API calls in production.
      if (configuredHost === window.location.host) {
        shouldUseConfigured = false;
      }
    } catch {
      shouldUseConfigured = false;
    }
  }

  if (shouldUseConfigured) {
    apiBaseUrl = configuredApiUrl;
  }
}

const api = axios.create({
  baseURL: apiBaseUrl.replace(/\/$/, ""),
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
