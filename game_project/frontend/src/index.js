// // import React from "react"
// import ReactDOM from "react-dom/client"
// import "./index.css"
// import App from "./prisoners/App"
// import reportWebVitals from "./reportWebVitals"
// import React, { useState, useEffect } from "react";
// import Modal from "./components/Modal";

// function GlobalModalBus() {
//   const [payload, setPayload] = useState({open:false});

//   useEffect(() => {
//     const handler = e => setPayload({open:true, ...e.detail});
//     window.addEventListener("GLOBAL_MODAL", handler);
//     return () => window.removeEventListener("GLOBAL_MODAL", handler);
//   }, []);

//   if (!payload.open) return null;
//   return (
//     <Modal
//       open
//       title={payload.title}
//       message={payload.msg}
//       onClose={() => setPayload({open:false})}
//     />
//   );
// }
// const root = ReactDOM.createRoot(document.getElementById("root"))

// root.render(
//   <React.StrictMode>
//     <GlobalModalBus/>
//     <App />
//   </React.StrictMode>,
// )

// // If you want to start measuring performance in your app, pass a function
// // to log results (for example: reportWebVitals(console.log))
// // or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals()

// import React, { useState, useEffect } from "react";
// import ReactDOM from "react-dom/client";
// import { BrowserRouter, Routes, Route } from "react-router-dom";

// import "./index.css";
// import "./App.css";
// import reportWebVitals from "./reportWebVitals";
// import Modal from "./components/Modal";

// // Prisoner’s Dilemma game
// import PrisonersApp from "./prisoners/PrisonersApp";

// // Ultimatum game
// import RootLayout from "./ultimatum/RootLayout";
// import UltimatumHome from "./ultimatum/HomePage";
// import UltimatumGame from "./ultimatum/GamePage";
// import UltimatumMatchmaking from "./ultimatum/MatchmakingPage";

// function GlobalModalBus() {
//   const [payload, setPayload] = useState({ open: false });

//   useEffect(() => {
//     const handler = (e) => setPayload({ open: true, ...e.detail });
//     window.addEventListener("GLOBAL_MODAL", handler);
//     return () => window.removeEventListener("GLOBAL_MODAL", handler);
//   }, []);

//   if (!payload.open) return null;

//   return (
//     <Modal
//       open
//       title={payload.title}
//       message={payload.msg}
//       onClose={() => setPayload({ open: false })}
//     />
//   );
// }

// const root = ReactDOM.createRoot(document.getElementById("root"));
// root.render(
//   <React.StrictMode>
//     <GlobalModalBus />
//     <BrowserRouter>
//       <Routes>
//         {/* Home landing page */}
//         <Route
//           path="/"
//           element={
//             <div style={{ textAlign: "center", marginTop: "5rem", fontSize: "1.5rem" }}>
//               <h1>🎮 Welcome! Choose a Game</h1>
//               <p><a href="/prisoners" style={{ color: "#0ff" }}>Prisoner's Dilemma</a></p>
//               <p><a href="/ultimatum" style={{ color: "#0f0" }}>Ultimatum Game</a></p>
//             </div>
//           }
//         />

//         {/* Prisoner's Dilemma App */}
//         <Route path="/prisoners/*" element={<PrisonersApp />} />

//         {/* Ultimatum Game Routes */}
//         <Route path="/ultimatum" element={<RootLayout><UltimatumHome /></RootLayout>} />
//         <Route path="/ultimatum/matchmaking" element={<RootLayout><UltimatumMatchmaking /></RootLayout>} />
//         <Route path="/ultimatum/game" element={<RootLayout><UltimatumGame /></RootLayout>} />
//       </Routes>
//     </BrowserRouter>
//   </React.StrictMode>
// );

// reportWebVitals();
"use client"

import React, { useState, useEffect } from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter, Routes, Route } from "react-router-dom"

import "./index.css"
import "./App.css"
import reportWebVitals from "./reportWebVitals"
import Modal from "./components/Modal"
import HomePage from "./HomePage"

// Prisoner's Dilemma game
import PrisonersApp from "./prisoners/PrisonersApp"

// Ultimatum game
import RootLayout from "./ultimatum/RootLayout"
import UltimatumHome from "./ultimatum/HomePage"
import UltimatumGame from "./ultimatum/GamePage"
import UltimatumMatchmaking from "./ultimatum/MatchmakingPage"

function GlobalModalBus() {
  const [payload, setPayload] = useState({ open: false })

  useEffect(() => {
    const handler = (e) => setPayload({ open: true, ...e.detail })
    window.addEventListener("GLOBAL_MODAL", handler)
    return () => window.removeEventListener("GLOBAL_MODAL", handler)
  }, [])

  if (!payload.open) return null

  return <Modal open title={payload.title} message={payload.msg} onClose={() => setPayload({ open: false })} />
}

const root = ReactDOM.createRoot(document.getElementById("root"))
root.render(
  <React.StrictMode>
    <GlobalModalBus />
    <BrowserRouter>
      <Routes>
        {/* Home landing page */}
        <Route path="/" element={<HomePage />} />

        {/* Prisoner's Dilemma App */}
        <Route path="/prisoners/*" element={<PrisonersApp />} />

        {/* Ultimatum Game Routes */}
        <Route
          path="/ultimatum"
          element={
            <RootLayout>
              <UltimatumHome />
            </RootLayout>
          }
        />
        <Route
          path="/ultimatum/matchmaking"
          element={
            <RootLayout>
              <UltimatumMatchmaking />
            </RootLayout>
          }
        />
        <Route
          path="/ultimatum/game"
          element={
            <RootLayout>
              <UltimatumGame />
            </RootLayout>
          }
        />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)

reportWebVitals()
