import React from "react";

export default function StatusDot({ status }) {
  return (
    <span className="status-dot" data-status={status} title={`Server: ${status}`}>
      <span aria-hidden="true" />
      <span className="label">{status}</span>
    </span>
  );
}
