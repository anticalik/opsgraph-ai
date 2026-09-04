import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [description, setDescription] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [similarIncidents, setSimilarIncidents] = useState([]);
  const [incidents, setIncidents] = useState([]);

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

  useEffect(() => {
    loadIncidents();
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
      loadIncidents();

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
                <strong>{result.recommended_category}</strong>
              </p>
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
                {item.severity ? ` — ${item.severity}` : ""}
                {" — "}
                {item.description} — {Math.round(item.similarity * 100)}% similarity
              </p>
            ))}
          </div>
        </section>
      )}

      {incidents.length > 0 && (
        <section className="result">
          <div className="full">
            <span>Recent incidents</span>

            {incidents.slice(0, 5).map((item) => (
              <p key={item.id}>
                #{item.id} — {item.category}
                {item.severity ? ` — ${item.severity}` : ""}
                {" — "}
                {item.description}
              </p>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

export default App;