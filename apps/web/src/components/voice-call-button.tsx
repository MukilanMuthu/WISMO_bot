"use client";

import { useRef, useState } from "react";
import { Mic, PhoneOff, Radio } from "lucide-react";
import { RetellWebClient } from "retell-client-js-sdk";
import type { WebCallResponse } from "@wismo/shared";
import { apiFetch } from "@/lib/api";

type CallState = "idle" | "connecting" | "active" | "error";

// Start and stop one Retell browser call while keeping media state isolated from page rendering.
export function VoiceCallButton({ orderId }: { orderId?: string }) {
  const clientRef = useRef<RetellWebClient | null>(null);
  const [state, setState] = useState<CallState>("idle");
  const [error, setError] = useState("");

  // Exchange authenticated app context for Retell's short-lived web-call token.
  async function startCall() {
    setState("connecting");
    setError("");

    try {
      const call = await apiFetch<WebCallResponse>("/retell/web-call", {
        method: "POST",
        body: JSON.stringify({ orderId }),
      });

      const client = new RetellWebClient();
      clientRef.current = client;
      client.on("call_started", () => setState("active"));
      client.on("call_ended", () => setState("idle"));
      client.on("error", (callError) => {
        setError(callError instanceof Error ? callError.message : "Voice call failed");
        setState("error");
      });
      await client.startCall({ accessToken: call.accessToken });
    } catch (callError) {
      setError(callError instanceof Error ? callError.message : "Voice call failed");
      setState("error");
    }
  }

  // Stop microphone transport immediately when customer ends the call.
  function stopCall() {
    clientRef.current?.stopCall();
    clientRef.current = null;
    setState("idle");
  }

  return (
    <div className="voice-control">
      {state === "active" ? (
        <button className="button danger" onClick={stopCall} type="button">
          <PhoneOff size={17} /> End call
        </button>
      ) : (
        <button className="button primary" disabled={state === "connecting"} onClick={startCall} type="button">
          {state === "connecting" ? <Radio className="pulse" size={17} /> : <Mic size={17} />}
          {state === "connecting" ? "Connecting" : orderId ? "Ask about this order" : "Call order assistant"}
        </button>
      )}
      {error ? <span className="call-error" role="alert">{error}</span> : null}
    </div>
  );
}
