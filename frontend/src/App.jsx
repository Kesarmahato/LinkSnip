import { useCallback, useEffect, useMemo, useState } from "react";
import api from "./services/api";
import "./App.css";

const emptyForm = {
  url: "",
  custom_alias: "",
  expires_at: "",
  expires_after_clicks: "",
  folder: "",
  tags: "",
};

function App() {
  const [backendStatus, setBackendStatus] = useState("Checking backend...");
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authOpen, setAuthOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [links, setLinks] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [publicUrl, setPublicUrl] = useState("");
  const [publicResult, setPublicResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [linksLoading, setLinksLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  const [analyticsLink, setAnalyticsLink] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [editingLink, setEditingLink] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editLoading, setEditLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [folderFilter, setFolderFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("");
  const [sort, setSort] = useState("newest");

  const getToken = useCallback(() => localStorage.getItem("access_token"), []);

  const extractError = (err, fallback) => {
    const detail = err.response?.data?.detail;
    if (Array.isArray(detail)) return detail.map((item) => item.msg).join(", ");
    if (typeof detail === "string") return detail;
    return fallback;
  };

  const checkBackend = useCallback(async () => {
    try {
      const response = await api.get("/api/health");
      setBackendStatus(response.data.status === "healthy" ? "Backend connected" : "Backend unavailable");
    } catch {
      setBackendStatus("Backend unavailable");
    }
  }, []);

  const loadLinks = useCallback(async (token = getToken()) => {
    if (!token) return;
    setLinksLoading(true);
    try {
      const response = await api.get("/api/links/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLinks(response.data);
    } catch (err) {
      setError(extractError(err, "Unable to load your links."));
    } finally {
      setLinksLoading(false);
    }
  }, [getToken]);

  const restoreSession = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const response = await api.get("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(response.data);
      await loadLinks(token);
    } catch {
      localStorage.removeItem("access_token");
      setUser(null);
      setLinks([]);
    }
  }, [getToken, loadLinks]);

  useEffect(() => {
    checkBackend();
    restoreSession();
  }, [checkBackend, restoreSession]);

  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updateEditForm = (key, value) => setEditForm((current) => ({ ...current, [key]: value }));

  const parseTags = (value) => value.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 20);

  const handleAuth = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      if (authMode === "login") {
        const response = await api.post("/api/auth/login", { email, password });
        localStorage.setItem("access_token", response.data.access_token);
        setUser({ id: response.data.user_id, email: response.data.email });
        setAuthOpen(false);
        setPassword("");
        await loadLinks(response.data.access_token);
      } else {
        const response = await api.post("/api/auth/register", { email, password });
        setMessage(`Account created for ${response.data.email}. Please log in.`);
        setAuthMode("login");
        setPassword("");
      }
    } catch (err) {
      setError(extractError(err, "Something went wrong. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const buildPayload = (source, allowAlias = true) => ({
    url: source.url,
    ...(allowAlias && source.custom_alias.trim() ? { custom_alias: source.custom_alias.trim() } : {}),
    expires_at: source.expires_at || null,
    expires_after_clicks: source.expires_after_clicks ? Number(source.expires_after_clicks) : null,
    folder: source.folder.trim() || null,
    tags: parseTags(source.tags),
  });

  const handlePublicShorten = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setPublicResult(null);
    setLoading(true);
    try {
      const response = await api.post("/api/links/public", { url: publicUrl });
      setPublicResult(response.data);
      setPublicUrl("");
    } catch (err) {
      setError(extractError(err, "Unable to shorten that URL."));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLink = async (event) => {
    event.preventDefault();
    const token = getToken();
    if (!token) {
      setAuthMode("login");
      setAuthOpen(true);
      setError("Please log in to use custom aliases and link management.");
      return;
    }
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await api.post("/api/links/", buildPayload(form), {
        headers: { Authorization: `Bearer ${token}` },
      });
      setForm(emptyForm);
      setMessage("Short link created successfully.");
      await loadLinks(token);
    } catch (err) {
      setError(extractError(err, "Unable to create the short link."));
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (linkId) => {
    if (!window.confirm("Deactivate this link? The short URL will stop redirecting.")) return;
    const token = getToken();
    if (!token) return;
    try {
      await api.delete(`/api/links/${linkId}`, { headers: { Authorization: `Bearer ${token}` } });
      setMessage("Link deactivated.");
      await loadLinks(token);
    } catch (err) {
      setError(extractError(err, "Unable to deactivate this link."));
    }
  };

  const openEdit = (link) => {
    setError("");
    setEditForm({
      url: link.original_url,
      custom_alias: link.custom_alias || "",
      expires_at: toDateTimeLocal(link.expires_at),
      expires_after_clicks: link.expires_after_clicks || "",
      folder: link.folder || "",
      tags: (link.tags || []).join(", "),
    });
    setEditingLink(link);
  };

  const handleEdit = async (event) => {
    event.preventDefault();
    const token = getToken();
    if (!token || !editingLink) return;
    setEditLoading(true);
    setError("");
    try {
      const response = await api.put(`/api/links/${editingLink.id}`, buildPayload(editForm), {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLinks((current) => current.map((link) => link.id === response.data.id ? response.data : link));
      setEditingLink(null);
      setMessage("Link updated. Your short URL stayed the same.");
    } catch (err) {
      setError(extractError(err, "Unable to update this link."));
    } finally {
      setEditLoading(false);
    }
  };

  const loadAnalytics = async (link) => {
    const token = getToken();
    if (!token) return;
    setAnalyticsLink(link);
    setAnalytics(null);
    setAnalyticsLoading(true);
    setError("");
    try {
      const response = await api.get(`/api/links/${link.id}/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAnalytics(response.data);
    } catch (err) {
      setError(extractError(err, "Unable to load analytics."));
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const copyShortUrl = async (link) => {
    try {
      await navigator.clipboard.writeText(link.short_url);
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      setError("Unable to copy the short URL.");
    }
  };

  const copyPublicResult = async () => {
    if (!publicResult) return;
    try {
      await navigator.clipboard.writeText(publicResult.short_url);
      setMessage("Short URL copied.");
    } catch {
      setError("Unable to copy the short URL.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    setUser(null);
    setLinks([]);
    setAnalytics(null);
    setAnalyticsLink(null);
    setEditingLink(null);
    setMessage("");
    setError("");
  };

  const folders = useMemo(() => [...new Set(links.map((link) => link.folder).filter(Boolean))].sort(), [links]);
  const allTags = useMemo(() => [...new Set(links.flatMap((link) => link.tags || []))].sort(), [links]);

  const filteredLinks = useMemo(() => {
    const query = search.trim().toLowerCase();
    const tagQuery = tagFilter.trim().toLowerCase();
    return [...links]
      .filter((link) => {
        const matchesSearch = !query || [link.short_url, link.original_url, link.custom_alias, link.folder, ...(link.tags || [])]
          .filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
        const matchesFolder = folderFilter === "all" || link.folder === folderFilter;
        const matchesTag = !tagQuery || (link.tags || []).some((tag) => tag.toLowerCase().includes(tagQuery));
        return matchesSearch && matchesFolder && matchesTag;
      })
      .sort((a, b) => {
        if (sort === "oldest") return new Date(a.created_at) - new Date(b.created_at);
        if (sort === "clicks") return (b.clicks || 0) - (a.clicks || 0);
        return new Date(b.created_at) - new Date(a.created_at);
      });
  }, [links, search, folderFilter, tagFilter, sort]);

  if (!user) {
    return (
      <div className="app public-app">
        <header className="topbar public-topbar">
          <a className="brand" href="#top" aria-label="LinkSnip home">
            <span>Link</span>Snip
          </a>
          <div className="account-area">
            <span className="backend-mini"><i className={backendStatus === "Backend connected" ? "online" : ""} />{backendStatus}</span>
            <button className="ghost-button" onClick={() => { setAuthMode("login"); setAuthOpen(true); }}>Log in</button>
            <button className="primary-small" onClick={() => { setAuthMode("register"); setAuthOpen(true); }}>Create account</button>
          </div>
        </header>

        <main id="top" className="public-main">
          <section className="hero-section">
            <div className="eyebrow"><span>●</span> Simple links. Useful analytics.</div>
            <h1>Shorten links.<br /><em>Understand every click.</em></h1>
            <p className="hero-copy">Turn long URLs into clean, shareable links in seconds. Visitors can shorten links instantly — no account required.</p>

            <form className="visitor-shortener" onSubmit={handlePublicShorten}>
              <div className="url-input-wrap">
                <span>↗</span>
                <input value={publicUrl} onChange={(e) => setPublicUrl(e.target.value)} type="url" placeholder="Paste a long URL, e.g. https://example.com/your-page" required />
              </div>
              <button className="primary-button hero-button" disabled={loading}>{loading ? "Shortening…" : "Shorten URL"}<span>→</span></button>
            </form>

            {publicResult && (
              <div className="result-card">
                <div><span className="result-label">Your short link is ready</span><a href={publicResult.short_url} target="_blank" rel="noreferrer">{publicResult.short_url}</a></div>
                <div className="result-actions"><button onClick={copyPublicResult}>Copy</button><a href={publicResult.short_url} target="_blank" rel="noreferrer">Open ↗</a></div>
              </div>
            )}

            <div className="trust-row"><span>✓ No login required</span><span>✓ Free to use</span><span>✓ Fast redirects</span></div>
          </section>

          <section className="feature-section">
            <div className="section-intro"><span className="section-kicker">FOR REGISTERED USERS</span><h2>Everything you need to manage links.</h2><p>Create custom aliases, organize campaigns, control expiration and see what happens after every click.</p></div>
            <div className="feature-grid">
              <Feature icon="Aa" title="Custom aliases" text="Create memorable links such as linksnip.com/my-sale without changing the destination." />
              <Feature icon="◴" title="Click analytics" text="See click counts, timestamps, referrers, devices and available location data." />
              <Feature icon="✎" title="Edit destinations" text="Change the destination URL while keeping the same short link." />
              <Feature icon="#" title="Folders & tags" text="Keep campaigns organized with folders and searchable tags." />
              <Feature icon="⌛" title="Smart expiration" text="Expire a link on a date or automatically after a click limit." />
              <Feature icon="⌕" title="Find links fast" text="Search, filter by folder or tag, and sort by newest or performance." />
            </div>
          </section>
        </main>

        {authOpen && <AuthModal mode={authMode} setMode={setAuthMode} email={email} setEmail={setEmail} password={password} setPassword={setPassword} loading={loading} error={error} message={message} onSubmit={handleAuth} onClose={() => { setAuthOpen(false); setError(""); setMessage(""); }} />}
        {error && !authOpen && <Toast type="error" text={error} onClose={() => setError("")} />}
        {message && !authOpen && <Toast type="success" text={message} onClose={() => setMessage("")} />}
      </div>
    );
  }

  return (
    <div className="app dashboard-app">
      <header className="topbar">
        <a className="brand" href="#top"><span>Link</span>Snip</a>
        <div className="account-area"><span className="user-email">{user.email}</span><button className="ghost-button" onClick={handleLogout}>Log out</button></div>
      </header>

      <main id="top" className="dashboard">
        <div className="dashboard-head">
          <div><span className="section-kicker">LINK WORKSPACE</span><h1>Good to see you.</h1><p>Build, organize and measure your links from one place.</p></div>
          <div className="backend-pill"><i className={backendStatus === "Backend connected" ? "online" : ""} />{backendStatus}</div>
        </div>

        {error && <Toast type="error" text={error} onClose={() => setError("")} />}
        {message && <Toast type="success" text={message} onClose={() => setMessage("")} />}

        <section className="create-panel">
          <div className="panel-copy"><span className="number-badge">01</span><div><h2>Create a short link</h2><p>Custom aliases, folders, tags and two ways to expire a link.</p></div></div>
          <form className="create-grid" onSubmit={handleCreateLink}>
            <label className="field wide"><span>Destination URL</span><input type="url" value={form.url} onChange={(e) => updateForm("url", e.target.value)} placeholder="https://example.com/your-long-url" required /></label>
            <label className="field"><span>Custom alias <small>optional</small></span><input value={form.custom_alias} onChange={(e) => updateForm("custom_alias", e.target.value)} placeholder="my-sale" /></label>
            <label className="field"><span>Folder <small>optional</small></span><input value={form.folder} onChange={(e) => updateForm("folder", e.target.value)} placeholder="Marketing" /></label>
            <label className="field"><span>Tags <small>comma separated</small></span><input value={form.tags} onChange={(e) => updateForm("tags", e.target.value)} placeholder="campaign, summer, social" /></label>
            <label className="field"><span>Expires on <small>optional</small></span><input type="datetime-local" value={form.expires_at} onChange={(e) => updateForm("expires_at", e.target.value)} /></label>
            <label className="field"><span>Click limit <small>optional</small></span><input type="number" min="1" value={form.expires_after_clicks} onChange={(e) => updateForm("expires_after_clicks", e.target.value)} placeholder="e.g. 500" /></label>
            <button className="primary-button create-button" disabled={loading}>{loading ? "Creating…" : "Shorten URL"}<span>→</span></button>
          </form>
        </section>

        <section className="links-section">
          <div className="section-heading"><div><span className="section-kicker">02 · LIBRARY</span><h2>Your links <span>{links.length}</span></h2></div><button className="ghost-button" onClick={() => loadLinks()} disabled={linksLoading}>{linksLoading ? "Refreshing…" : "Refresh"}</button></div>
          <div className="filters">
            <div className="search-field"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search URL, alias, folder or tag" /></div>
            <select value={folderFilter} onChange={(e) => setFolderFilter(e.target.value)}><option value="all">All folders</option>{folders.map((folder) => <option key={folder} value={folder}>{folder}</option>)}</select>
            <input className="tag-filter" list="tag-options" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} placeholder="Filter by tag" />
            <datalist id="tag-options">{allTags.map((tag) => <option key={tag} value={tag} />)}</datalist>
            <select value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="clicks">Most clicks</option></select>
          </div>

          {linksLoading ? <div className="empty-state"><div className="spinner" />Loading your links…</div> : filteredLinks.length === 0 ? <div className="empty-state"><div className="empty-icon">↗</div><h3>{links.length ? "No links match your filters" : "Your link library is empty"}</h3><p>{links.length ? "Try clearing a filter or search term." : "Create your first managed link above."}</p></div> : <div className="links-list">{filteredLinks.map((link) => <LinkCard key={link.id} link={link} copiedId={copiedId} onCopy={copyShortUrl} onAnalytics={loadAnalytics} onEdit={openEdit} onDeactivate={handleDeactivate} />)}</div>}
        </section>
      </main>

      {analyticsLink && <AnalyticsModal link={analyticsLink} analytics={analytics} loading={analyticsLoading} onClose={() => { setAnalyticsLink(null); setAnalytics(null); }} />}
      {editingLink && <EditModal link={editingLink} form={editForm} updateForm={updateEditForm} loading={editLoading} onSubmit={handleEdit} onClose={() => setEditingLink(null)} />}
    </div>
  );
}

function Feature({ icon, title, text }) {
  return <article className="feature-card"><div className="feature-icon">{icon}</div><h3>{title}</h3><p>{text}</p></article>;
}

function LinkCard({ link, copiedId, onCopy, onAnalytics, onEdit, onDeactivate }) {
  const active = link.is_active && (!link.expires_at || new Date(link.expires_at) > new Date());
  const hasClickLimit = Number.isFinite(link.expires_after_clicks) && link.expires_after_clicks;
  const remaining = hasClickLimit ? Math.max(link.expires_after_clicks - (link.clicks || 0), 0) : null;
  return (
    <article className="link-card">
      <div className="link-card-main">
        <div className="link-meta"><span className={`status-badge ${active ? "active" : "inactive"}`}>{active ? "Active" : "Inactive"}</span>{link.folder && <span className="folder-chip">{link.folder}</span>}{(link.tags || []).map((tag) => <span className="tag-chip" key={tag}>#{tag}</span>)}</div>
        <a className="short-url" href={link.short_url} target="_blank" rel="noreferrer">{link.short_url}</a>
        <div className="original-url">{link.original_url}</div>
        <div className="link-stats"><span><strong>{link.clicks || 0}</strong> clicks</span><span>Created {formatDate(link.created_at)}</span>{link.expires_at && <span>Expires {formatDate(link.expires_at)}</span>}{remaining !== null && <span>{remaining} clicks left</span>}</div>
      </div>
      <div className="link-actions"><button onClick={() => onCopy(link)}>{copiedId === link.id ? "Copied ✓" : "Copy"}</button><button onClick={() => onAnalytics(link)}>Analytics</button><button onClick={() => onEdit(link)}>Edit</button>{active && <button className="danger-button" onClick={() => onDeactivate(link.id)}>Deactivate</button>}</div>
    </article>
  );
}

function AuthModal({ mode, setMode, email, setEmail, password, setPassword, loading, error, message, onSubmit, onClose }) {
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="auth-modal"><button className="modal-close" onClick={onClose} aria-label="Close">×</button><div className="auth-brand"><span>Link</span>Snip</div><span className="section-kicker">{mode === "login" ? "WELCOME BACK" : "GET STARTED"}</span><h2>{mode === "login" ? "Manage every link in one place." : "Create your LinkSnip account."}</h2><p>{mode === "login" ? "Sign in to use custom aliases, analytics and link management." : "Unlock custom aliases, folders, tags, analytics and advanced expiration."}</p><form onSubmit={onSubmit}><label className="field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></label><label className="field"><span>Password</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" minLength="6" required /></label>{error && <div className="inline-message error">{error}</div>}{message && <div className="inline-message success">{message}</div>}<button className="primary-button" disabled={loading}>{loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}</button></form><button className="switch-button" onClick={() => setMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}</button></section></div>;
}

function AnalyticsModal({ link, analytics, loading, onClose }) {
  const maxClicks = Math.max(...(analytics?.clicks_over_time || []).map((item) => item.clicks), 1);
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="analytics-modal"><div className="modal-title"><div><span className="section-kicker">LINK ANALYTICS</span><h2>{link.short_url}</h2><p>{link.original_url}</p></div><button className="modal-close" onClick={onClose}>×</button></div>{loading ? <div className="empty-state"><div className="spinner" />Loading analytics…</div> : !analytics ? <div className="empty-state">No analytics available.</div> : <div className="analytics-body"><div className="analytics-grid"><Stat label="Total clicks" value={analytics.total_clicks ?? 0} /><Stat label="Today" value={analytics.today_clicks ?? 0} /><Stat label="Click limit" value={analytics.click_limit ?? "—"} /><Stat label="Remaining" value={analytics.click_limit ? Math.max(analytics.click_limit - analytics.total_clicks, 0) : "—"} /></div><div className="analytics-card full"><h3>Clicks over time</h3>{analytics.clicks_over_time?.length ? <div className="bar-chart">{analytics.clicks_over_time.map((item) => <div className="bar-item" key={item.date}><strong>{item.clicks}</strong><div className="bar-track"><div className="bar-fill" style={{ height: `${Math.max((item.clicks / maxClicks) * 100, 5)}%` }} /></div><span>{item.date.slice(5)}</span></div>)}</div> : <div className="analytics-empty">No click data yet.</div>}</div><div className="analytics-columns"><AnalyticsBreakdown title="Top referrers" data={analytics.top_referrers} valueKey="referrer" /><AnalyticsBreakdown title="Devices" data={analytics.devices} valueKey="device_type" /><AnalyticsBreakdown title="Countries" data={analytics.countries} valueKey="country" /><AnalyticsBreakdown title="Browsers" data={analytics.browsers} valueKey="browser" /></div><div className="analytics-card full"><div className="table-heading"><div><h3>Recent click details</h3><p>Timestamp, referrer, device and available location.</p></div></div>{analytics.click_details?.length ? <div className="click-table-wrap"><table className="click-table"><thead><tr><th>Timestamp</th><th>Referrer</th><th>Device</th><th>Location</th><th>Browser</th></tr></thead><tbody>{analytics.click_details.map((click, index) => <tr key={`${click.timestamp}-${index}`}><td>{formatDateTime(click.timestamp)}</td><td title={click.referrer}>{truncate(click.referrer)}</td><td>{click.device}</td><td>{click.location}</td><td>{click.browser}</td></tr>)}</tbody></table></div> : <div className="analytics-empty">No clicks recorded yet.</div>}</div></div>}</section></div>;
}

function AnalyticsBreakdown({ title, data = [], valueKey }) {
  return <div className="analytics-card"><h3>{title}</h3>{data.length ? <div className="breakdown-list">{data.slice(0, 6).map((item, index) => <div className="breakdown-row" key={`${item[valueKey]}-${index}`}><span>{item[valueKey] || "Direct"}</span><strong>{item.clicks}</strong></div>)}</div> : <div className="analytics-empty">No data yet.</div>}</div>;
}

function Stat({ label, value }) { return <div className="stat-card"><span>{label}</span><strong>{value}</strong></div>; }

function EditModal({ link, form, updateForm, loading, onSubmit, onClose }) {
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="edit-modal"><div className="modal-title"><div><span className="section-kicker">EDIT LINK</span><h2>Keep your short URL, change what it does.</h2><p>{link.short_url}</p></div><button className="modal-close" onClick={onClose}>×</button></div><form className="edit-grid" onSubmit={onSubmit}><label className="field wide"><span>Destination URL</span><input type="url" value={form.url} onChange={(e) => updateForm("url", e.target.value)} required /></label><label className="field"><span>Custom alias</span><input value={form.custom_alias} onChange={(e) => updateForm("custom_alias", e.target.value)} /></label><label className="field"><span>Folder</span><input value={form.folder} onChange={(e) => updateForm("folder", e.target.value)} /></label><label className="field"><span>Tags</span><input value={form.tags} onChange={(e) => updateForm("tags", e.target.value)} /></label><label className="field"><span>Expires on</span><input type="datetime-local" value={form.expires_at} onChange={(e) => updateForm("expires_at", e.target.value)} /></label><label className="field"><span>Click limit</span><input type="number" min="1" value={form.expires_after_clicks} onChange={(e) => updateForm("expires_after_clicks", e.target.value)} placeholder="No limit" /></label><div className="modal-actions"><button type="button" className="ghost-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={loading}>{loading ? "Saving…" : "Save changes"}</button></div></form></section></div>;
}

function Toast({ type, text, onClose }) { return <div className={`toast ${type}`}><span>{type === "error" ? "!" : "✓"}</span><div>{text}</div><button onClick={onClose}>×</button></div>; }

function formatDate(value) { if (!value) return "—"; return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
function formatDateTime(value) { if (!value) return "—"; return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); }
function toDateTimeLocal(value) { if (!value) return ""; const date = new Date(value); const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16); }
function truncate(value, length = 32) { if (!value) return "Direct"; return value.length > length ? `${value.slice(0, length)}…` : value; }

export default App;
