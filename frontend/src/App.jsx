import { useCallback, useEffect, useState } from "react";
import api from "./services/api";
import "./App.css";

function App() {
  // --------------------------------------------------
  // STATE
  // --------------------------------------------------

  const [backendStatus, setBackendStatus] = useState("Checking...");
  const [mode, setMode] = useState("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [user, setUser] = useState(null);
  const [links, setLinks] = useState([]);

  const [analyticsLink, setAnalyticsLink] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [url, setUrl] = useState("");
  const [customAlias, setCustomAlias] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const [loading, setLoading] = useState(false);
  const [linksLoading, setLinksLoading] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [guestUrl, setGuestUrl] = useState("");
  const [guestResult, setGuestResult] = useState("");
  const [guestLoading, setGuestLoading] = useState(false);

  // --------------------------------------------------
  // AUTH TOKEN
  // --------------------------------------------------

  const getToken = useCallback(() => {
    return localStorage.getItem("access_token");
  }, []);

  // --------------------------------------------------
  // LINK STATUS
  // --------------------------------------------------

  const isLinkActive = (link) => {
    if (!link.is_active) {
      return false;
    }

    if (
      link.expires_at &&
      new Date(link.expires_at) <= new Date()
    ) {
      return false;
    }

    return true;
  };

  // --------------------------------------------------
  // BACKEND HEALTH
  // --------------------------------------------------

  const checkBackend = useCallback(async () => {
    try {
      const response = await api.get("/api/health");

      if (response.data.status === "healthy") {
        setBackendStatus("Backend connected successfully");
      } else {
        setBackendStatus("Backend connection failed");
      }
    } catch (error) {
      console.error("Backend error:", error);
      setBackendStatus("Backend connection failed");
    }
  }, []);

  // --------------------------------------------------
  // LOAD LINKS
  // --------------------------------------------------

  const loadLinks = useCallback(
    async (authToken = getToken()) => {
      if (!authToken) {
        return;
      }

      setLinksLoading(true);
      setError("");

      try {
        const response = await api.get("/api/links/", {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        setLinks(response.data);
        setBackendStatus("Backend connected successfully");
      } catch (error) {
        console.error("Failed to load links:", error);

        const detail = error.response?.data?.detail;

        if (Array.isArray(detail)) {
          setError(
            detail
              .map((item) => item.msg)
              .join(", ")
          );
        } else if (typeof detail === "string") {
          setError(detail);
        } else {
          setError("Unable to load your links.");
        }
      } finally {
        setLinksLoading(false);
      }
    },
    [getToken]
  );

  // --------------------------------------------------
  // RESTORE LOGIN SESSION
  // --------------------------------------------------

  const restoreSession = useCallback(async () => {
    const savedToken = getToken();

    if (!savedToken) {
      return;
    }

    try {
      const response = await api.get("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${savedToken}`,
        },
      });

      setUser(response.data);

      await loadLinks(savedToken);

      setBackendStatus("Backend connected successfully");
    } catch (error) {
      console.error(
        "Session restore failed:",
        error
      );

      localStorage.removeItem("access_token");
      setUser(null);
      setLinks([]);
    }
  }, [getToken, loadLinks]);

  // --------------------------------------------------
  // INITIAL LOAD
  // --------------------------------------------------

  useEffect(() => {
    const initializeApp = async () => {
      await Promise.all([
        checkBackend(),
        restoreSession(),
      ]);
    };

    initializeApp();
  }, [checkBackend, restoreSession]);

  // --------------------------------------------------
  // LOGIN / REGISTER
  // --------------------------------------------------

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (mode === "login") {
        const response = await api.post(
          "/api/auth/login",
          {
            email,
            password,
          }
        );

        localStorage.setItem(
          "access_token",
          response.data.access_token
        );

        const loggedInUser = {
          id: response.data.user_id,
          email: response.data.email,
        };

        setUser(loggedInUser);

        setBackendStatus(
          "Backend connected successfully"
        );

        await loadLinks(
          response.data.access_token
        );
      } else {
        const response = await api.post(
          "/api/auth/register",
          {
            email,
            password,
          }
        );

        setMessage(
          `Account created successfully for ${response.data.email}. You can now log in.`
        );

        setMode("login");
        setPassword("");
      }
    } catch (error) {
      console.error(
        "Authentication error:",
        error
      );

      const detail = error.response?.data?.detail;

      if (Array.isArray(detail)) {
        setError(
          detail
            .map((item) => item.msg)
            .join(", ")
        );
      } else if (typeof detail === "string") {
        setError(detail);
      } else {
        setError(
          "Something went wrong. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };
  const handleGuestShorten = async (event) => {
  event.preventDefault();

  if (!guestUrl.trim()) {
    setError("Please enter a URL.");
    return;
  }

  setGuestLoading(true);
  setError("");
  setGuestResult("");

  try {
    // IMPORTANT:
    // Your current backend requires authentication for /api/links/.
    // This generates a temporary frontend-only short code.
    const shortCode = Math.random()
      .toString(62)
      .substring(2, 8);

    const shortUrl =
      `${window.location.origin}/s/${shortCode}`;

    setGuestResult(shortUrl);
  } catch (error) {
    console.error(error);
    setError("Unable to shorten URL.");
  } finally {
    setGuestLoading(false);
  }
};
  // --------------------------------------------------
  // CREATE SHORT LINK
  // --------------------------------------------------

  const handleCreateLink = async (event) => {
    event.preventDefault();

    const authToken = getToken();

    if (!authToken) {
      setError(
        "Your session has expired. Please log in again."
      );

      setUser(null);
      return;
    }

    setError("");
    setMessage("");
    setLoading(true);

    try {
      const payload = {
        url,
        custom_alias:
          customAlias.trim() || null,
        expires_at: expiresAt || null,
      };

      await api.post(
        "/api/links/",
        payload,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      setUrl("");
      setCustomAlias("");
      setExpiresAt("");

      setMessage(
        "Short link created successfully."
      );

      await loadLinks(authToken);
    } catch (error) {
      console.error(
        "Create link error:",
        error
      );

      const detail = error.response?.data?.detail;

      if (Array.isArray(detail)) {
        setError(
          detail
            .map((item) => item.msg)
            .join(", ")
        );
      } else if (typeof detail === "string") {
        setError(detail);
      } else {
        setError(
          "Unable to create the short link."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // DEACTIVATE LINK
  // --------------------------------------------------

  const handleDeactivate = async (linkId) => {
    const confirmed = window.confirm(
      "Are you sure you want to deactivate this link?"
    );

    if (!confirmed) {
      return;
    }

    const authToken = getToken();

    if (!authToken) {
      setError(
        "Your session has expired. Please log in again."
      );

      setUser(null);
      return;
    }

    setError("");
    setMessage("");

    try {
      await api.delete(
        `/api/links/${linkId}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      setMessage(
        "Link deactivated successfully."
      );

      await loadLinks(authToken);
    } catch (error) {
      console.error(
        "Deactivate error:",
        error
      );

      const detail =
        error.response?.data?.detail;

      setError(
        typeof detail === "string"
          ? detail
          : "Unable to deactivate this link."
      );
    }
  };

  // --------------------------------------------------
  // ANALYTICS
  // --------------------------------------------------

  const loadAnalytics = async (link) => {
    const authToken = getToken();

    if (!authToken) {
      setError(
        "Your session has expired. Please log in again."
      );

      setUser(null);
      return;
    }

    setAnalyticsLink(link);
    setAnalytics(null);
    setAnalyticsLoading(true);
    setError("");

    try {
      const response = await api.get(
        `/api/links/${link.id}/analytics`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      console.log(
        "Analytics response:",
        response.data
      );

      setAnalytics(response.data);
    } catch (error) {
      console.error(
        "Analytics error:",
        error
      );

      const detail =
        error.response?.data?.detail;

      setError(
        typeof detail === "string"
          ? detail
          : "Unable to load analytics."
      );
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // --------------------------------------------------
  // CLOSE ANALYTICS
  // --------------------------------------------------

  const closeAnalytics = () => {
    setAnalyticsLink(null);
    setAnalytics(null);
    setAnalyticsLoading(false);
  };

  // --------------------------------------------------
  // COPY SHORT URL
  // --------------------------------------------------

  const copyShortUrl = async (link) => {
    try {
      await navigator.clipboard.writeText(
        link.short_url
      );

      setCopiedId(link.id);

      setTimeout(() => {
        setCopiedId(null);
      }, 2000);
    } catch (error) {
      console.error(
        "Copy failed:",
        error
      );

      setError(
        "Unable to copy the short URL."
      );
    }
  };

  // --------------------------------------------------
  // LOGOUT
  // --------------------------------------------------

  const handleLogout = () => {
    localStorage.removeItem(
      "access_token"
    );

    setUser(null);
    setLinks([]);

    setAnalytics(null);
    setAnalyticsLink(null);

    setEmail("");
    setPassword("");

    setMessage("");
    setError("");
  };

  // ==================================================
  // DASHBOARD
  // ==================================================

  if (user) {
    return (
      <div className="app">

        {/* TOP BAR */}
        <header className="topbar">
          <div>
            <h1>LinkSnip</h1>

            <p>
              URL Shortening &amp; Analytics
            </p>
          </div>

          <div className="account-area">
            <span>{user.email}</span>

            <button
              onClick={handleLogout}
            >
              Log out
            </button>
          </div>
        </header>

        <main className="dashboard">

          {/* BACKEND STATUS */}
          <div className="backend-status">
            <span
              className={
                backendStatus ===
                "Backend connected successfully"
                  ? "status-dot connected"
                  : "status-dot"
              }
            />

            {backendStatus}
          </div>

          {/* CREATE LINK */}
          <section className="create-card">
            <div>
              <h2>
                Create a short link
              </h2>

              <p>
                Turn a long URL into a
                shareable LinkSnip URL.
              </p>
            </div>

            <form
              onSubmit={handleCreateLink}
              className="create-form"
            >
              <input
                type="url"
                placeholder="https://example.com/very/long/url"
                value={url}
                onChange={(event) =>
                  setUrl(event.target.value)
                }
                required
              />

              <input
                type="text"
                placeholder="Custom alias (optional)"
                value={customAlias}
                onChange={(event) =>
                  setCustomAlias(
                    event.target.value
                  )
                }
              />

              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(event) =>
                  setExpiresAt(
                    event.target.value
                  )
                }
              />

              <button
                type="submit"
                disabled={loading}
              >
                {loading
                  ? "Creating..."
                  : "Shorten URL"}
              </button>
            </form>
          </section>

          {/* ERROR */}
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* SUCCESS */}
          {message && (
            <div className="success-message">
              {message}
            </div>
          )}

          {/* LINKS */}
          <section className="links-section">

            <div className="section-heading">

              <div>
                <h2>Your links</h2>

                <p>
                  {links.length} link
                  {links.length === 1
                    ? ""
                    : "s"}
                </p>
              </div>

              <button
                onClick={() =>
                  loadLinks()
                }
                disabled={linksLoading}
              >
                {linksLoading
                  ? "Refreshing..."
                  : "Refresh"}
              </button>

            </div>

            {/* LOADING */}
            {linksLoading ? (
              <div className="empty-state">
                Loading your links...
              </div>

            ) : links.length === 0 ? (

              /* EMPTY */
              <div className="empty-state">
                <h3>
                  No links yet
                </h3>

                <p>
                  Create your first
                  shortened link above.
                </p>
              </div>

            ) : (

              /* LINK LIST */
              <div className="links-list">

                {links.map((link) => {

                  const active =
                    isLinkActive(link);

                  return (
                    <article
                      className="link-card"
                      key={link.id}
                    >

                      <div className="link-main">

                        <div className="link-header">

                          <span
                            className={
                              active
                                ? "badge active"
                                : "badge inactive"
                            }
                          >
                            {active
                              ? "Active"
                              : "Inactive"}
                          </span>

                          {link.expires_at && (
                            <span className="expiry">
                              Expires:{" "}
                              {new Date(
                                link.expires_at
                              ).toLocaleString()}
                            </span>
                          )}

                        </div>

                        {/* SHORT URL */}
                        <h3>
                          <a
                            href={
                              link.short_url
                            }
                            target="_blank"
                            rel="noreferrer"
                          >
                            {link.short_url}
                          </a>
                        </h3>

                        {/* ORIGINAL URL */}
                        <a
                          href={
                            link.original_url
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="original-url"
                        >
                          {link.original_url}
                        </a>

                      </div>

                      {/* ACTIONS */}
                      <div className="link-actions">

                        <button
                          onClick={() =>
                            copyShortUrl(link)
                          }
                        >
                          {copiedId ===
                          link.id
                            ? "Copied!"
                            : "Copy"}
                        </button>

                        <button
                          onClick={() =>
                            loadAnalytics(
                              link
                            )
                          }
                        >
                          Analytics
                        </button>

                        {active && (
                          <button
                            className="danger-button"
                            onClick={() =>
                              handleDeactivate(
                                link.id
                              )
                            }
                          >
                            Deactivate
                          </button>
                        )}

                      </div>

                    </article>
                  );
                })}

              </div>
            )}

          </section>

          {/* ANALYTICS */}
          {analyticsLink && (
            <section className="analytics-section">

              <div className="section-heading">

                <div>
                  <h2>
                    Analytics
                  </h2>

                  <p>
                    {analyticsLink.short_url}
                  </p>
                </div>

                <button
                  onClick={
                    closeAnalytics
                  }
                >
                  Close
                </button>

              </div>

              {/* ANALYTICS LOADING */}
              {analyticsLoading ? (

                <div className="empty-state">
                  Loading analytics...
                </div>

              ) : analytics ? (

                <>

                  {/* STAT CARDS */}
                  <div className="analytics-grid">

                    <div className="stat-card">
                      <span>
                        Total clicks
                      </span>

                      <strong>
                        {analytics.total_clicks ??
                          0}
                      </strong>
                    </div>

                    <div className="stat-card">
                      <span>
                        Today
                      </span>

                      <strong>
                        {analytics.today_clicks ??
                          0}
                      </strong>
                    </div>

                    <div className="stat-card">
                      <span>
                        Referrers
                      </span>

                      <strong>
                        {analytics
                          .top_referrers
                          ?.length ?? 0}
                      </strong>
                    </div>

                    <div className="stat-card">
                      <span>
                        Countries
                      </span>

                      <strong>
                        {analytics.countries
                          ?.length ?? 0}
                      </strong>
                    </div>

                  </div>

                  {/* CLICKS OVER TIME */}
                  <div className="analytics-card full-width">

                    <h3>
                      Clicks over time
                    </h3>

                    {analytics
                      .clicks_over_time
                      ?.length ? (

                      <div className="analytics-list">

                        {analytics
                          .clicks_over_time
                          .map(
                            (
                              item,
                              index
                            ) => (
                              <div
                                className="analytics-row"
                                key={
                                  item.date ??
                                  index
                                }
                              >

                                <span>
                                  {item.date}
                                </span>

                                <strong>
                                  {item.clicks ??
                                    0}
                                </strong>

                              </div>
                            )
                          )}

                      </div>

                    ) : (
                      <p>
                        No click data yet.
                      </p>
                    )}

                  </div>

                  {/* ANALYTICS COLUMNS */}
                  <div className="analytics-columns">

                    {/* REFERRERS */}
                    <div className="analytics-card">

                      <h3>
                        Top referrers
                      </h3>

                      {analytics
                        .top_referrers
                        ?.length ? (

                        <div className="analytics-list">

                          {analytics
                            .top_referrers
                            .map(
                              (
                                item,
                                index
                              ) => (
                                <div
                                  className="analytics-row"
                                  key={`${item.referrer}-${index}`}
                                >

                                  <span>
                                    {item.referrer ||
                                      "Direct"}
                                  </span>

                                  <strong>
                                    {item.clicks ??
                                      0}
                                  </strong>

                                </div>
                              )
                            )}

                        </div>

                      ) : (
                        <p>
                          No referrer
                          data yet.
                        </p>
                      )}

                    </div>

                    {/* DEVICES */}
                    <div className="analytics-card">

                      <h3>
                        Devices
                      </h3>

                      {analytics.devices
                        ?.length ? (

                        <div className="analytics-list">

                          {analytics.devices.map(
                            (
                              item,
                              index
                            ) => (
                              <div
                                className="analytics-row"
                                key={`${item.device}-${index}`}
                              >

                                <span>
                                  {item.device}
                                </span>

                                <strong>
                                  {item.clicks ??
                                    0}
                                </strong>

                              </div>
                            )
                          )}

                        </div>

                      ) : (
                        <p>
                          No device
                          data yet.
                        </p>
                      )}

                    </div>

                    {/* BROWSERS */}
                    <div className="analytics-card">

                      <h3>
                        Browsers
                      </h3>

                      {analytics.browsers
                        ?.length ? (

                        <div className="analytics-list">

                          {analytics.browsers.map(
                            (
                              item,
                              index
                            ) => (
                              <div
                                className="analytics-row"
                                key={`${item.browser}-${index}`}
                              >

                                <span>
                                  {item.browser}
                                </span>

                                <strong>
                                  {item.clicks ??
                                    0}
                                </strong>

                              </div>
                            )
                          )}

                        </div>

                      ) : (
                        <p>
                          No browser
                          data yet.
                        </p>
                      )}

                    </div>

                    {/* OPERATING SYSTEMS */}
                    <div className="analytics-card">

                      <h3>
                        Operating systems
                      </h3>

                      {analytics
                        .operating_systems
                        ?.length ? (

                        <div className="analytics-list">

                          {analytics
                            .operating_systems
                            .map(
                              (
                                item,
                                index
                              ) => (
                                <div
                                  className="analytics-row"
                                  key={`${item.operating_system}-${index}`}
                                >

                                  <span>
                                    {
                                      item.operating_system
                                    }
                                  </span>

                                  <strong>
                                    {item.clicks ??
                                      0}
                                  </strong>

                                </div>
                              )
                            )}

                        </div>

                      ) : (
                        <p>
                          No
                          operating-system
                          data yet.
                        </p>
                      )}

                    </div>

                    {/* COUNTRIES */}
                    <div className="analytics-card">

                      <h3>
                        Countries
                      </h3>

                      {analytics.countries
                        ?.length ? (

                        <div className="analytics-list">

                          {analytics.countries.map(
                            (
                              item,
                              index
                            ) => (
                              <div
                                className="analytics-row"
                                key={`${item.country}-${index}`}
                              >

                                <span>
                                  {item.country}
                                </span>

                                <strong>
                                  {item.clicks ??
                                    0}
                                </strong>

                              </div>
                            )
                          )}

                        </div>

                      ) : (
                        <p>
                          No country
                          data yet.
                        </p>
                      )}

                    </div>

                    {/* CITIES */}
                    <div className="analytics-card">

                      <h3>
                        Cities
                      </h3>

                      {analytics.cities
                        ?.length ? (

                        <div className="analytics-list">

                          {analytics.cities.map(
                            (
                              item,
                              index
                            ) => (
                              <div
                                className="analytics-row"
                                key={`${item.city}-${index}`}
                              >

                                <span>
                                  {item.city}
                                </span>

                                <strong>
                                  {item.clicks ??
                                    0}
                                </strong>

                              </div>
                            )
                          )}

                        </div>

                      ) : (
                        <p>
                          No city
                          data yet.
                        </p>
                      )}

                    </div>

                  </div>

                </>

              ) : (

                <div className="empty-state">
                  No analytics
                  available.
                </div>

              )}

            </section>
          )}

        </main>
      </div>
    );
  }

  // ==================================================
  // LOGIN / REGISTER
  // ==================================================

  return (
    <div className="app">

      {/* HERO */}
      <header className="hero">

        <h1>
          LinkSnip
        </h1>

        <p>
          URL Shortening &amp;
          Analytics Platform
        </p>

        <div className="backend-status">

          <span
            className={
              backendStatus ===
              "Backend connected successfully"
                ? "status-dot connected"
                : "status-dot"
            }
          />

          {backendStatus}

        </div>

      </header>

      {/* AUTH */}
      <main>

        <section className="auth-card">

          <h2>
            {mode === "login"
              ? "Welcome back"
              : "Create your account"}
          </h2>

          <p className="subtitle">
            {mode === "login"
              ? "Sign in to manage your shortened links."
              : "Create an account to start shortening links."}
          </p>

          <form onSubmit={handleSubmit}>

            {/* EMAIL */}
            <label htmlFor="email">
              Email
            </label>

            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              required
            />

            {/* PASSWORD */}
            <label htmlFor="password">
              Password
            </label>

            <input
              id="password"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
              required
            />

            {/* ERROR */}
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {/* MESSAGE */}
            {message && (
              <div className="success-message">
                {message}
              </div>
            )}

            {/* SUBMIT */}
            <button
              className="primary-button"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                  ? "Log in"
                  : "Create account"}
            </button>

          </form>

          {/* SWITCH LOGIN/REGISTER */}
          <button
            className="switch-button"
            type="button"
            onClick={() => {
              setMode(
                mode === "login"
                  ? "register"
                  : "login"
              );

              setError("");
              setMessage("");
            }}
          >
            {mode === "login"
              ? "Don't have an account? Create account"
              : "Already have an account? Log in"}
          </button>

        </section>

      </main>

    </div>
  );
}

export default App;