/**
 * WebRTC P2P wrapper for PVP gameplay.
 * Uses a strict single-offer state machine to prevent negotiation collisions.
 * Hybrid ICE strategy:
 *   1. Wait briefly for ICE gathering so candidates are embedded in SDP
 *   2. Also trickle any late candidates as fallback
 *   3. One automatic ICE restart if checking stalls
 * RTCDataChannel for high-frequency game messages,
 * Supabase Realtime only for signaling.
 */

export interface PeerSignal {
  type: "rtc_offer" | "rtc_answer" | "rtc_ice" | "rtc_ready";
  sdp?: string;
  candidate?: RTCIceCandidateInit;
  seq?: number;
}

export interface PeerDiagnostics {
  iceState: string;
  connState: string;
  gatherState: string;
  localCandidates: { type: string; protocol: string; address: string }[];
  remoteCandidates: { type: string; protocol: string; address: string }[];
  iceCandidateErrors: string[];
  negotiationState: string;
  iceRestarted: boolean;
  stats: Record<string, any> | null;
}

export interface PeerConnectionOptions {
  isHost: boolean;
  onMessage: (event: string, payload: any) => void;
  onOpen: () => void;
  onFailed?: (diagnostics?: PeerDiagnostics) => void;
  sendSignal: (signal: PeerSignal) => void;
  iceServers?: RTCIceServer[];
}

export interface DataUsage {
  bytesSent: number;
  bytesReceived: number;
}

export interface PeerConnection {
  send: (event: string, payload: any) => void;
  handleSignal: (signal: PeerSignal) => void;
  isReady: () => boolean;
  close: () => void;
  getState: () => string;
  getDiagnostics: () => Promise<PeerDiagnostics>;
  getDataUsage: () => DataUsage;
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:stun.l.google.com:19302" },
];

type NegotiationState = "idle" | "offer_sent" | "answer_sent" | "connected" | "failed";

/**
 * Wait for ICE gathering. Resolves when complete or after timeoutMs.
 * Uses a short timeout so we don't block forever if gathering is slow.
 */
const waitForIceGathering = (pc: RTCPeerConnection, timeoutMs = 2000): Promise<void> => {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise<void>((resolve) => {
    let resolved = false;
    const done = () => {
      if (resolved) return;
      resolved = true;
      pc.removeEventListener("icegatheringstatechange", onStateChange);
      resolve();
    };
    const onStateChange = () => {
      if (pc.iceGatheringState === "complete") done();
    };
    pc.addEventListener("icegatheringstatechange", onStateChange);
    setTimeout(done, timeoutMs);
  });
};

export function createPeerConnection(
  isHostOrOpts: boolean | PeerConnectionOptions,
  onMessage?: (event: string, payload: any) => void,
  onOpen?: () => void,
  sendSignal?: (signal: PeerSignal) => void,
): PeerConnection {
  let opts: PeerConnectionOptions;
  if (typeof isHostOrOpts === "object") {
    opts = isHostOrOpts;
  } else {
    opts = {
      isHost: isHostOrOpts,
      onMessage: onMessage!,
      onOpen: onOpen!,
      sendSignal: sendSignal!,
    };
  }

  const { isHost, onMessage: handleMsg, onOpen: handleOpen, onFailed, sendSignal: send, iceServers } = opts;

  const servers = iceServers && iceServers.length > 0 ? iceServers : DEFAULT_ICE_SERVERS;
  const pc = new RTCPeerConnection({ iceServers: servers });
  let dc: RTCDataChannel | null = null;
  let ready = false;
  let closed = false;
  let totalBytesSent = 0;
  let totalBytesReceived = 0;
  let negotiationState: NegotiationState = "idle";
  let offerSeq = 0;
  let makingOffer = false;
  let iceRestarted = false;

  const timers: ReturnType<typeof setInterval | typeof setTimeout>[] = [];
  const iceCandidateQueue: RTCIceCandidateInit[] = [];

  // Diagnostics
  const diag = {
    localCandidates: [] as { type: string; protocol: string; address: string }[],
    remoteCandidates: [] as { type: string; protocol: string; address: string }[],
    iceCandidateErrors: [] as string[],
  };

  const log = (msg: string) => console.log(`[WebRTC][${isHost ? "HOST" : "GUEST"}][${Date.now()}] ${msg}`);

  // === Hybrid ICE: embed candidates in SDP AND trickle late ones ===
  let sdpSent = false; // tracks whether the local SDP has been sent
  pc.onicecandidate = (e) => {
    if (e.candidate) {
      const c = e.candidate;
      diag.localCandidates.push({
        type: c.type || "unknown",
        protocol: c.protocol || "unknown",
        address: c.address || c.candidate.split(" ")[4] || "?",
      });
      log(`Local ICE candidate: ${c.type}/${c.protocol} ${c.address || "?"}`);

      // Trickle fallback: if SDP was already sent, send this candidate separately
      if (sdpSent) {
        log("Trickling late ICE candidate");
        send({ type: "rtc_ice", candidate: c.toJSON(), seq: offerSeq });
      }
    } else {
      log(`ICE gathering complete — ${diag.localCandidates.length} total candidates`);
    }
  };

  pc.onicecandidateerror = (e: any) => {
    const errMsg = `ICE error: ${e.errorCode} ${e.errorText || ""} ${e.url || ""}`;
    diag.iceCandidateErrors.push(errMsg);
    console.warn(`[WebRTC] ${errMsg}`);
  };

  pc.onicegatheringstatechange = () => {
    log(`ICE gathering state: ${pc.iceGatheringState}`);
  };

  const flushIceCandidateQueue = async () => {
    while (iceCandidateQueue.length > 0) {
      const candidate = iceCandidateQueue.shift()!;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn("[WebRTC] Failed to add queued ICE candidate:", err);
      }
    }
  };

  const setupChannel = (channel: RTCDataChannel) => {
    dc = channel;
    dc.binaryType = "arraybuffer";

    dc.onopen = () => {
      ready = true;
      negotiationState = "connected";
      log("DataChannel opened — state → connected");
      handleOpen();
    };

    dc.onclose = () => {
      ready = false;
      log("DataChannel closed");
    };

    dc.onerror = (e) => {
      console.warn("[WebRTC] DataChannel error:", e);
    };

    dc.onmessage = (e) => {
      try {
        const rawLen = typeof e.data === "string" ? e.data.length : (e.data as ArrayBuffer).byteLength;
        totalBytesReceived += rawLen;
        const msg = JSON.parse(e.data);
        handleMsg(msg.event, msg.payload);
      } catch (err) {
        console.warn("[WebRTC] Failed to parse DataChannel message:", err);
      }
    };
  };

  // Host creates the DataChannel; guest waits for it
  if (isHost) {
    const channel = pc.createDataChannel("game", { ordered: false, maxRetransmits: 0 });
    setupChannel(channel);
  } else {
    pc.ondatachannel = (e) => {
      log("Guest received DataChannel");
      setupChannel(e.channel);
    };
  }

  // Connection state monitoring with ICE restart
  let disconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const collectStats = async (): Promise<Record<string, any> | null> => {
    try {
      const stats = await pc.getStats();
      const result: Record<string, any> = {};
      stats.forEach((report) => {
        if (report.type === "candidate-pair") {
          result[report.id] = {
            state: report.state,
            nominated: report.nominated,
            bytesSent: report.bytesSent,
            bytesReceived: report.bytesReceived,
            currentRoundTripTime: report.currentRoundTripTime,
            localCandidateId: report.localCandidateId,
            remoteCandidateId: report.remoteCandidateId,
          };
        }
      });
      return Object.keys(result).length > 0 ? result : null;
    } catch {
      return null;
    }
  };

  const buildDiagnostics = async (): Promise<PeerDiagnostics> => ({
    iceState: pc.iceConnectionState,
    connState: pc.connectionState,
    gatherState: pc.iceGatheringState,
    localCandidates: diag.localCandidates,
    remoteCandidates: diag.remoteCandidates,
    iceCandidateErrors: diag.iceCandidateErrors,
    negotiationState,
    iceRestarted,
    stats: await collectStats(),
  });

  pc.oniceconnectionstatechange = () => {
    log(`ICE connection state: ${pc.iceConnectionState}`);

    if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
      if (disconnectTimer) { clearTimeout(disconnectTimer); disconnectTimer = null; }
      log(`ICE connected! Local candidates: ${diag.localCandidates.length}, Remote candidates: ${diag.remoteCandidates.length}`);
    }

    if (pc.iceConnectionState === "failed") {
      negotiationState = "failed";
      log("ICE connection failed");
      buildDiagnostics().then(d => {
        log(`Diagnostics: local=${d.localCandidates.length} remote=${d.remoteCandidates.length} errors=${d.iceCandidateErrors.join("; ")} stats=${JSON.stringify(d.stats)}`);
        onFailed?.(d);
      });
    } else if (pc.iceConnectionState === "disconnected") {
      log("ICE disconnected — starting 10s grace period");
      disconnectTimer = setTimeout(() => {
        if (!closed && pc.iceConnectionState === "disconnected") {
          negotiationState = "failed";
          log("ICE still disconnected after grace period");
          buildDiagnostics().then(d => onFailed?.(d));
        }
      }, 10000);
      timers.push(disconnectTimer);
    }
  };

  // ICE restart: if still checking after 4s, host triggers restart
  const scheduleIceRestart = () => {
    if (!isHost) return;
    const restartTimer = setTimeout(async () => {
      if (closed || ready || iceRestarted) return;
      if (pc.iceConnectionState !== "checking" && pc.iceConnectionState !== "new") return;

      iceRestarted = true;
      log("ICE still checking after 4s — triggering ICE restart");

      try {
        pc.restartIce();
        offerSeq++;
        const seq = offerSeq;
        sdpSent = false;
        diag.localCandidates.length = 0; // reset for restart

        const offer = await pc.createOffer({ iceRestart: true });
        if (closed || ready) return;
        await pc.setLocalDescription(offer);

        log("Waiting for ICE gathering (restart offer)...");
        await waitForIceGathering(pc, 2000);

        if (closed || ready) return;
        sdpSent = true;
        negotiationState = "offer_sent";

        if (pc.localDescription) {
          send({ type: "rtc_offer", sdp: pc.localDescription.sdp, seq });
          log(`ICE restart offer sent (seq=${seq}), ${diag.localCandidates.length} candidates`);
        }
      } catch (err) {
        log(`ICE restart failed: ${err}`);
      }
    }, 4000);
    timers.push(restartTimer);
  };

  pc.onconnectionstatechange = () => {
    log(`Connection state: ${pc.connectionState}`);
    if (pc.connectionState === "failed") {
      negotiationState = "failed";
      buildDiagnostics().then(d => onFailed?.(d));
    }
  };

  // === Host: Create offer with hybrid ICE ===
  const createOffer = async () => {
    if (closed || makingOffer || negotiationState === "connected" || negotiationState === "failed") return;
    if (negotiationState === "offer_sent") {
      log("Ignoring offer request — already have outstanding offer");
      return;
    }

    makingOffer = true;
    offerSeq++;
    const seq = offerSeq;
    sdpSent = false;
    diag.localCandidates.length = 0;

    try {
      if (pc.signalingState === "have-local-offer") {
        log("Rolling back stale local offer before creating new one");
        await pc.setLocalDescription({ type: "rollback" } as RTCSessionDescriptionInit);
      }

      if (pc.signalingState !== "stable") {
        log(`Cannot create offer — signalingState is ${pc.signalingState}`);
        makingOffer = false;
        return;
      }

      log(`Creating offer (seq=${seq})`);
      const offer = await pc.createOffer();

      if (closed || ready) {
        makingOffer = false;
        return;
      }

      await pc.setLocalDescription(offer);

      // Wait briefly for ICE gathering so candidates are embedded
      log("Waiting for ICE gathering to complete before sending offer...");
      await waitForIceGathering(pc, 2000);

      if (closed || ready) {
        makingOffer = false;
        return;
      }

      sdpSent = true;
      negotiationState = "offer_sent";

      if (pc.localDescription) {
        send({ type: "rtc_offer", sdp: pc.localDescription.sdp, seq });
        log(`Offer sent (seq=${seq}), ${diag.localCandidates.length} candidates embedded, SDP length=${pc.localDescription.sdp?.length}`);
      }

      // Schedule ICE restart in case checking stalls
      scheduleIceRestart();

      // Schedule offer retry if no answer after 5s
      const retryTimer = setTimeout(async () => {
        if (closed || negotiationState !== "offer_sent" || offerSeq !== seq || iceRestarted) return;
        log(`No answer after 5s for offer seq=${seq} — rolling back for retry`);
        try {
          if (pc.signalingState === "have-local-offer") {
            await pc.setLocalDescription({ type: "rollback" } as RTCSessionDescriptionInit);
          }
          negotiationState = "idle";
          makingOffer = false;
          createOffer();
        } catch (err) {
          log(`Rollback failed: ${err}`);
        }
      }, 5000);
      timers.push(retryTimer);
    } catch (err) {
      log(`Failed to create offer: ${err}`);
      negotiationState = "idle";
    } finally {
      makingOffer = false;
    }
  };

  // Guest: retry rtc_ready every 500ms (up to 20 = 10s)
  if (!isHost) {
    let attempts = 0;
    const readyInterval = setInterval(() => {
      if (closed || negotiationState === "answer_sent" || negotiationState === "connected" || attempts >= 20) {
        clearInterval(readyInterval);
        return;
      }
      attempts++;
      log(`Sending rtc_ready (attempt ${attempts})`);
      send({ type: "rtc_ready" });
    }, 500);
    timers.push(readyInterval);
  }

  // Host: fallback offer after 3s if no rtc_ready received
  if (isHost) {
    const fallbackTimer = setTimeout(() => {
      if (negotiationState === "idle" && !closed) {
        log("Fallback — creating offer after 3s (no rtc_ready received)");
        createOffer();
      }
    }, 3000);
    timers.push(fallbackTimer);
  }

  const handleSignal = async (signal: PeerSignal) => {
    if (closed) return;

    try {
      if (signal.type === "rtc_ready" && isHost) {
        log("Received rtc_ready from guest");
        if (negotiationState === "idle") {
          createOffer();
        }
        return;
      }

      if (signal.type === "rtc_offer" && !isHost) {
        // Allow restart offers even after answer_sent
        if (negotiationState === "connected") {
          log("Ignoring offer — already connected");
          return;
        }

        // For restart offers, allow processing even if we already answered
        if (negotiationState === "answer_sent" && pc.signalingState !== "stable") {
          log(`Received restart offer — rolling back current state`);
          try {
            await pc.setLocalDescription({ type: "rollback" } as RTCSessionDescriptionInit);
            negotiationState = "idle";
          } catch (err) {
            log(`Rollback for restart failed: ${err}`);
            return;
          }
        }

        log(`Received offer (seq=${signal.seq || "?"}) — SDP length=${signal.sdp?.length || 0}`);
        try {
          await pc.setRemoteDescription({ type: "offer", sdp: signal.sdp! });
          negotiationState = "answer_sent";
          await flushIceCandidateQueue();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          // Hybrid: wait for gathering, then send; late candidates will trickle
          sdpSent = false;
          diag.localCandidates.length = 0;
          log("Waiting for ICE gathering to complete before sending answer...");
          await waitForIceGathering(pc, 2000);

          if (closed) return;
          sdpSent = true;

          if (pc.localDescription) {
            send({ type: "rtc_answer", sdp: pc.localDescription.sdp!, seq: signal.seq });
            log(`Answer sent (seq=${signal.seq || "?"}), ${diag.localCandidates.length} candidates, SDP length=${pc.localDescription.sdp?.length}`);
          }
        } catch (err) {
          log(`Failed to process offer: ${err}`);
          if (negotiationState === "answer_sent") {
            negotiationState = "idle";
          }
        }
        return;
      }

      if (signal.type === "rtc_answer" && isHost) {
        if (negotiationState !== "offer_sent") {
          log(`Ignoring answer — state is ${negotiationState}, not offer_sent`);
          return;
        }
        if (pc.signalingState !== "have-local-offer") {
          log(`Ignoring answer — signalingState is ${pc.signalingState}`);
          return;
        }

        log(`Received answer (seq=${signal.seq || "?"}) — SDP length=${signal.sdp?.length || 0}`);
        try {
          await pc.setRemoteDescription({ type: "answer", sdp: signal.sdp! });
          negotiationState = "connected";
          await flushIceCandidateQueue();
          log("Remote description set from answer — ICE connecting");
        } catch (err) {
          log(`Failed to set answer: ${err}`);
          negotiationState = "idle";
        }
        return;
      }

      // Trickle ICE: accept individual candidates
      if (signal.type === "rtc_ice" && signal.candidate) {
        const c = signal.candidate;
        // End-of-candidates marker
        if (c.candidate === "" || c.candidate === undefined) {
          log("Received end-of-candidates marker");
          try {
            await pc.addIceCandidate(undefined as any);
          } catch {}
          return;
        }

        diag.remoteCandidates.push({
          type: "trickle",
          protocol: "?",
          address: c.candidate?.split(" ")[4] || "?",
        });
        log(`Received trickle ICE candidate: ${c.candidate?.substring(0, 60)}`);

        if (pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          } catch (err) {
            console.warn("[WebRTC] Failed to add trickle ICE candidate:", err);
          }
        } else {
          iceCandidateQueue.push(c);
        }
      }
    } catch (err) {
      console.warn(`[WebRTC] Error handling signal ${signal.type}:`, err);
    }
  };

  const sendMsg = (event: string, payload: any) => {
    if (dc && dc.readyState === "open") {
      try {
        const data = JSON.stringify({ event, payload });
        totalBytesSent += data.length;
        dc.send(data);
      } catch (err) {
        console.warn("[WebRTC] Failed to send via DataChannel:", err);
      }
    }
  };

  const close = () => {
    closed = true;
    ready = false;
    negotiationState = "failed";
    timers.forEach(t => { clearInterval(t); clearTimeout(t); });
    dc?.close();
    pc.close();
  };

  return {
    send: sendMsg,
    handleSignal,
    isReady: () => ready,
    close,
    getState: () => negotiationState,
    getDiagnostics: buildDiagnostics,
    getDataUsage: () => ({ bytesSent: totalBytesSent, bytesReceived: totalBytesReceived }),
  };
}
