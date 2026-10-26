import React from "react"
import ReactDOM from "react-dom/client"
import { getAppRoot } from "./react-root"
import App from "./app/App"
import "./index.css"

const container = document.getElementById("root")
if (!container) throw new Error("The application root container is missing.")

getAppRoot(container, ReactDOM.createRoot).render(
  <React.StrictMode>
    <React.Suspense
      fallback={
        <div style={{ padding: 40, fontFamily: "monospace", color: "#E5C158" }}>
          INITIALIZING SILPH TERMINAL…
        </div>
      }
    >
      <App />
    </React.Suspense>
  </React.StrictMode>,
)
