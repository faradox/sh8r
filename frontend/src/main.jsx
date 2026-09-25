import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { Sh8rProvider } from "./state/Sh8rContext.jsx";
import "./styles.css";

const root = createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Sh8rProvider>
        <App />
      </Sh8rProvider>
    </BrowserRouter>
  </React.StrictMode>
);
