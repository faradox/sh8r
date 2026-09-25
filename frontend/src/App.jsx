import React from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import SubmitView from "./views/SubmitView.jsx";
import VJView from "./views/VJView.jsx";
import LiveView from "./views/LiveView.jsx";
import DebugView from "./views/DebugView.jsx";

const navItems = [
  { path: "/vj", label: "VJ" },
  { path: "/submit", label: "Submit" },
  { path: "/debug", label: "Debug" },
  { path: "/live", label: "Live" },
];

export default function App() {
  const location = useLocation();
  const isLive = location.pathname === "/" || location.pathname === "/live";

  return (
    <div className={`app${isLive ? " live" : ""}`}>
      {!isLive && (
        <nav className="topbar">
          <span className="brand">sh8r</span>
          {navItems.map((item) => (
            <NavLink key={item.path} to={item.path}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
      <main className={`page${isLive ? " live" : ""}`}>
        <Routes>
          <Route path="/" element={<LiveView />} />
          <Route path="/live" element={<LiveView />} />
          <Route path="/vj" element={<VJView />} />
          <Route path="/submit" element={<SubmitView />} />
          <Route path="/debug" element={<DebugView />} />
          <Route path="*" element={<p className="label">Not found.</p>} />
        </Routes>
      </main>
    </div>
  );
}
