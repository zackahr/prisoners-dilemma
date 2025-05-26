// import React from "react"
import ReactDOM from "react-dom/client"
import "./index.css"
import App from "./App"
import reportWebVitals from "./reportWebVitals"
import React, { useState, useEffect } from "react";
import Modal from "./components/Modal";

function GlobalModalBus() {
  const [payload, setPayload] = useState({open:false});

  useEffect(() => {
    const handler = e => setPayload({open:true, ...e.detail});
    window.addEventListener("GLOBAL_MODAL", handler);
    return () => window.removeEventListener("GLOBAL_MODAL", handler);
  }, []);

  if (!payload.open) return null;
  return (
    <Modal
      open
      title={payload.title}
      message={payload.msg}
      onClose={() => setPayload({open:false})}
    />
  );
}
const root = ReactDOM.createRoot(document.getElementById("root"))

root.render(
  <React.StrictMode>
    <GlobalModalBus/>
    <App />
  </React.StrictMode>,
)

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
