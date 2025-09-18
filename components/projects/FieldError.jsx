"use client";

import React from "react";

export default function FieldError({ err }) {
  if (!err) return null;
  return <div style={{ color: "#b00", fontSize: 12 }}>{err.message}</div>;
}
