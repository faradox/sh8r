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
];

export default function App() {
  const location = useLocation();
  const isLive =
    location.pathname === "/" || location.pathname === "/live";

  return (
    <div className={`app${isLive ? " live" : ""}`}>
      {!isLive && (
        <nav className="topbar">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                opacity: isActive ? 1 : 0.6,
              })}
            >
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
        </Routes>
      </main>
    </div>
  );
}
