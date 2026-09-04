import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [description, setDescription] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [similarIncidents, setSimilarIncidents] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [stats, setStats] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [selectedIncident, setSelectedIncident] = useState(null);

  async function loadIncidents() {
    try {
      const response = await fetch("http://127.0.0.1:8001/incidents");

      if (!response.ok) {
        throw new Error("Failed to load incidents");
      }

      const data = await response.json();
      setIncidents(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadStats() {
    try {
      const response = await fetch("http://127.0.0.1:8001/stats");

      if (!response.ok) {
        throw new Error("Failed to load stats");
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadIncidents();
    loadStats();
  }, []);

  async function analyzeIncident() {
    if (!description.trim()) {
      setError("Please enter an incident description.");
      setResult(null);
      setSimilarIncidents([]);
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setSimilarIncidents([]);

    try {
      const response = await fetch("http://127.0.0.1:8001/incidents/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze incident");
      }

      const data = await response.json();
      setResult(data);
      setSelectedCategory(data.recommended_category || data.category);
      loadIncidents();
      loadStats();

      const similarResponse = await fetch(
      "http://127.0.0.1:8001/incidents/similar",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description,
        }),
      }
    );

    if (!similarResponse.ok) {
      throw new Error("Failed to find similar incidents");
    }

    const similarData = await similarResponse.json();
    setSimilarIncidents(
      similarData.filter((item) => item.id !== data.id)
    );

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateCategory() {
  if (!result || !selectedCategory) return;

  try {
    const response = await fetch(
      `http://127.0.0.1:8001/incidents/${result.id}/category`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category: selectedCategory,
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to update category");
    }

    const data = await response.json();

    setResult((current) => ({
      ...current,
      category: data.category,
      recommended_category: data.category,
    }));

    loadIncidents();
    loadStats();
  } catch (err) {
    console.error(err);
    setError("Failed to update category");
  }
}
  const severityRank = {
    Critical: 4,
    High: 3,
    Medium: 2,
    Low: 1,
  };

const filteredIncidents = incidents
  .filter(
    (item) =>
      (categoryFilter === "All" || item.category === categoryFilter) &&
      (severityFilter === "All" || item.severity === severityFilter) &&
      (
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
  )
  .sort((a, b) => {
    if (sortOrder === "oldest") {
      return new Date(a.created_at) - new Date(b.created_at);
    }

    if (sortOrder === "severity") {
      return (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
    }

    return new Date(b.created_at) - new Date(a.created_at);
  });
  
  function resetFilters() {
    setCategoryFilter("All");
    setSeverityFilter("All");
    setSortOrder("newest");
    setSearchQuery("");
  }

  return (
    <main className="app">
      <section className="hero">
        <p className="eyebrow">AI INCIDENT INTELLIGENCE</p>
        <h1>OpsGraph AI</h1>
        <p className="subtitle">
          Classify operational incidents and prepare them for historical
          similarity analysis.
        </p>
      </section>

      <section className="panel">
        <label htmlFor="incident">Incident description</label>

        <textarea
          id="incident"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Example: Payment API starts timing out after deployment..."
          rows="6"
        />

        <button onClick={analyzeIncident} disabled={loading}>
          {loading ? "Analyzing..." : "Analyze incident"}
        </button>

        {error && <p className="error">{error}</p>}
      </section>

      {result && (
        <section className="result">
          <div>
            <span>Category</span>
            <strong>{result.category}</strong>
          </div>

          <div>
            <span>Confidence</span>
            <strong>{Math.round(result.confidence * 100)}%</strong>
          </div>

          <div>
            <span>Incident ID</span>
            <strong>#{result.id}</strong>
          </div>

          <div>
            <span>Severity</span>
            <strong>
              {result.severity} — {Math.round(result.severity_confidence * 100)}%
            </strong>
          </div>

          {result.historical_suggestion && (
            <div className="full">
              <span>Historical suggestion</span>
              <p>
                {result.historical_suggestion.category} — based on incident #
                {result.historical_suggestion.incident_id} —{" "}
                {Math.round(result.historical_suggestion.similarity * 100)}% similarity
              </p>
            </div>
          )}

          {result.recommended_category && (
            <div className="full">
              <span>Recommended classification</span>
              <p>
                <strong>
                  {result.recommended_category} – {Math.round(result.recommendation_score * 100)}%
                </strong>
              </p>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="Database">Database</option>
                <option value="Network">Network</option>
                <option value="Deployment">Deployment</option>
                <option value="Authentication">Authentication</option>
                <option value="Storage">Storage</option>
                <option value="Performance">Performance</option>
              </select>

              <button type="button" onClick={updateCategory}>
                Update category
              </button>

              <p>{result.recommendation_reason}</p>
            </div>
          )}

          <div className="full">
            <span>Description</span>
            <p>{result.description}</p>
          </div>

          {result.predictions && (
            <div className="full">
              <span>Prediction breakdown</span>

              {result.predictions.map((prediction) => {
                const percentage = Math.round(prediction.confidence * 100);

                return (
                  <div className="prediction-row" key={prediction.category}>
                    <div className="prediction-label">
                      <span>{prediction.category}</span>
                      <strong>{percentage}%</strong>
                    </div>

                    <div className="prediction-bar">
                      <div
                        className="prediction-fill"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {similarIncidents.length > 0 && (
        <section className="result">
          <div className="full">
            <span>Similar historical incidents</span>

            {similarIncidents.map((item) => (
              <p key={item.id}>
                #{item.id} — {item.category}
                {item.manually_corrected ? " — Human corrected" : ""}
                {item.severity ? ` — ${item.severity}` : ""}
                {" — "}
                {item.description} — {Math.round(item.similarity * 100)}% similarity
              </p>
            ))}
          </div>
        </section>
      )}

      {stats && (
        <section className="result">
          <div className="full">
            <span>System statistics</span>

            <p>Total incidents — {stats.total_incidents}</p>
            <p>Human corrected — {stats.manually_corrected}</p>
            <p>
              Average AI confidence — {Math.round(stats.average_confidence * 100)}%
            </p>

            <span>Category distribution</span>

            {Object.entries(stats.category_counts).map(([category, count]) => (
              <p key={category}>
                {category} — {count}
              </p>
            ))}
          </div>
        </section>
      )}

      {incidents.length > 0 && (
        <section className="result">
          <div className="full">
            <span>Recent incidents</span>

            <div className="incident-filters">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="All">All categories</option>
                <option value="Database">Database</option>
                <option value="Network">Network</option>
                <option value="Deployment">Deployment</option>
                <option value="Authentication">Authentication</option>
                <option value="Storage">Storage</option>
                <option value="Performance">Performance</option>
              </select>

              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
              >
                <option value="All">All severities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>

              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="severity">Highest severity</option>
              </select>

              <input
                type="text"
                placeholder="Search incidents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <button type="button" onClick={resetFilters}>
                Reset filters
              </button>
            </div>

            {filteredIncidents.slice(0, 5).map((item) => (
              <p
                key={item.id}
                className={`incident-row ${
                  selectedIncident?.id === item.id ? "selected" : ""
                }`}
                onClick={() => setSelectedIncident(item)}
              >
                #{item.id} — {item.category}
                {item.manually_corrected ? " — Human corrected" : ""}
                {item.severity ? ` — ${item.severity}` : ""}
                {" — "}
                {item.description}
              </p>
            ))}

            {selectedIncident && (
              <div className="incident-details">
                <span>Selected incident #{selectedIncident.id}</span>

                <p><strong>Category:</strong> {selectedIncident.category}</p>
                <p><strong>Severity:</strong> {selectedIncident.severity || "Unknown"}</p>
                <p>
                  <strong>AI confidence:</strong>{" "}
                  {Math.round((selectedIncident.confidence || 0) * 100)}%
                </p>

                <p>
                  <strong>Human corrected:</strong>{" "}
                  {selectedIncident.manually_corrected ? "Yes" : "No"}
                </p>

                <p>
                  <strong>Created:</strong>{" "}
                  {selectedIncident.created_at
                    ? new Date(selectedIncident.created_at).toLocaleString()
                    : "Unknown"}
                </p>
                <p><strong>Description:</strong> {selectedIncident.description}</p>

                <button
                  type="button"
                  onClick={() => setSelectedIncident(null)}
                >
                  Close
                </button>
              </div>
            )}

            {filteredIncidents.length === 0 && (
              <p>No incidents match the current filters.</p>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

export default App;