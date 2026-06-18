"use client";

import { useState } from "react";
import axios from "axios";

export default function Home() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveInfo, setSaveInfo] = useState<string | null>(null);

  async function ask() {
    setLoading(true);
    try {
      const res = await axios.post("/ask", { query });
      setResult(res.data);
    } catch (e: any) {
      setResult({ error: e?.message ?? String(e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 40, fontFamily: "Inter, Arial, sans-serif" }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>COSMOS PROWLER v7</h1>

      <textarea
        rows={4}
        style={{ width: "100%", padding: 8, fontSize: 14 }}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Enter your query here"
      />

      <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={ask} disabled={loading} style={{ padding: "8px 12px" }}>
          {loading ? (
            <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
              <span style={{ width: 14, height: 14, border: "2px solid #ccc", borderTopColor: "#000", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
              Running...
            </span>
          ) : (
            "Run"
          )}
        </button>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

        {result && (
          <button
            onClick={async () => {
              if (!result) return;
              setSaveStatus("saving");
              try {
                const r = await axios.post("/api/save", { payload: result });
                setSaveInfo(JSON.stringify(r.data));
                setSaveStatus("saved");
              } catch (e: any) {
                setSaveInfo(e?.message ?? String(e));
                setSaveStatus("error");
              }
            }}
            disabled={saveStatus === "saving"}
            style={{ padding: "8px 12px" }}
          >
            {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : "Save to Cloud"}
          </button>
        )}
      </div>

      {result && (
        <div style={{ marginTop: 20 }}>
          {result.error ? (
            <div style={{ color: "red" }}>Error: {result.error}</div>
          ) : (
            <>
              <h3>Confidence: {result.confidence?.toFixed?.(2)}</h3>
              {result.insights?.map((i: any, idx: number) => (
                <div key={idx} style={{ marginTop: 10 }}>
                  <b>{i.model}</b>: {i.text}
                  <br />
                  confidence: {i.confidence?.toFixed?.(2)}
                </div>
              ))}
            </>
          )}

          <div style={{ marginTop: 12 }}>
            {saveStatus === "saving" && <div style={{ color: "#555" }}>Saving to cloud...</div>}
            {saveStatus === "saved" && <div style={{ color: "green" }}>Saved ✓ — {saveInfo}</div>}
            {saveStatus === "error" && <div style={{ color: "red" }}>Save failed — {saveInfo}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
