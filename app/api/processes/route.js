import { NextResponse } from "next/server";
import {
  bonitaFetch,
  readBonitaPayload,
  fetchProcessByDisplayName,
  instantiateProcess,
} from "@/lib/bonita";

const DEFAULT_PROCESS_DISPLAY_NAME = "Creacion de proyecto y colaboracion de ONGs";

function encodeFilterParam(filterValue) {
  const [field, ...rest] = filterValue.split("=");
  if (!rest.length) {
    return encodeURIComponent(filterValue);
  }
  const value = rest.join("=");
  return `${field}=${encodeURIComponent(value)}`;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const queryParts = [];
  let hasPage = false;
  let hasCount = false;

  searchParams.forEach((value, key) => {
    if (key === "displayName") {
      queryParts.push(`f=${encodeFilterParam(`displayName=${value}`)}`);
      return;
    }
    if (key === "f") {
      queryParts.push(`f=${encodeFilterParam(value)}`);
      return;
    }
    if (key === "p") {
      hasPage = true;
      queryParts.push(`p=${encodeURIComponent(value)}`);
      return;
    }
    if (key === "c") {
      hasCount = true;
      queryParts.push(`c=${encodeURIComponent(value)}`);
      return;
    }
    queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  });

  if (!hasPage) queryParts.push("p=0");
  if (!hasCount) queryParts.push("c=20");

  const url = `/bonita/API/bpm/process?${queryParts.join("&")}`;
  const res = await bonitaFetch(url);
  const payload = await readBonitaPayload(res);

  if (!res.ok) {
    const error =
      typeof payload === "string"
        ? payload
        : payload?.error || "Bonita process fetch failed";
    return NextResponse.json({ error }, { status: res.status });
  }

  return NextResponse.json(payload);
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const displayName = body?.displayName || DEFAULT_PROCESS_DISPLAY_NAME;
  const providedProcessId = body?.processId;

  let processId = providedProcessId;
  if (!processId) {
    try {
      const [process] = await fetchProcessByDisplayName(displayName, {
        activationState: body?.activationState || "ENABLED",
      });
      processId = process?.id;
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: err.status ?? 502 });
    }
  }

  if (!processId) {
    return NextResponse.json({ error: "Process not found" }, { status: 404 });
  }

  try {
    const payload = await instantiateProcess(processId, body?.contract || {});
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
