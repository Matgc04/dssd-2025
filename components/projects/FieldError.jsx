"use client";

import React from "react";
import styles from "./FormStyles.module.css";

export default function FieldError({ err }) {
  if (!err) return null;
  return <div className={styles.error}>{err.message}</div>;
}
