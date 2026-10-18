import { describe, expect, it } from "vitest";
import {
  callStateReducer,
  formatCallDuration,
  initialCallState,
  type CallState,
  type CallStatus,
} from "@/lib/webrtc/callStateMachine";

describe("callStateMachine - Phase 6 WebRTC Call State Machine", () => {
  describe("formatCallDuration", () => {
    it("formats 0 and negative seconds as 00:00", () => {
      expect(formatCallDuration(0)).toBe("00:00");
      expect(formatCallDuration(-5)).toBe("00:00");
    });

    it("formats seconds under a minute with zero-padding", () => {
      expect(formatCallDuration(5)).toBe("00:05");
      expect(formatCallDuration(45)).toBe("00:45");
    });

    it("formats minutes and seconds accurately", () => {
      expect(formatCallDuration(60)).toBe("01:00");
      expect(formatCallDuration(65)).toBe("01:05");
      expect(formatCallDuration(600)).toBe("10:00");
      expect(formatCallDuration(1425)).toBe("23:45");
    });
  });

  describe("callStateReducer transitions", () => {
    it("starts from initial idle state", () => {
      expect(initialCallState).toEqual({
        status: "idle",
        isMuted: false,
        durationSeconds: 0,
        errorMessage: null,
      });
    });

    it("transitions from idle to requesting on START_REQUEST", () => {
      const state = callStateReducer(initialCallState, { type: "START_REQUEST" });
      expect(state.status).toBe("requesting");
      expect(state.errorMessage).toBeNull();
    });

    it("transitions from idle to requested on RECEIVE_REQUEST", () => {
      const state = callStateReducer(initialCallState, { type: "RECEIVE_REQUEST" });
      expect(state.status).toBe("requested");
      expect(state.errorMessage).toBeNull();
    });

    it("handles standard caller -> callee accept flow", () => {
      // Caller initiates
      let caller = callStateReducer(initialCallState, { type: "START_REQUEST" });
      expect(caller.status).toBe("requesting");

      // Callee receives
      let callee = callStateReducer(initialCallState, { type: "RECEIVE_REQUEST" });
      expect(callee.status).toBe("requested");

      // Callee accepts -> callee transitions to connecting
      callee = callStateReducer(callee, { type: "ACCEPT_REQUEST" });
      expect(callee.status).toBe("connecting");

      // Caller receives accept -> caller transitions to connecting
      caller = callStateReducer(caller, { type: "RECEIVE_ACCEPT" });
      expect(caller.status).toBe("connecting");

      // WebRTC establishes connection
      caller = callStateReducer(caller, { type: "CONNECT_SUCCESS" });
      callee = callStateReducer(callee, { type: "CONNECT_SUCCESS" });

      expect(caller.status).toBe("connected");
      expect(callee.status).toBe("connected");
    });

    it("handles simultaneous requests (both request almost at the same time)", () => {
      // User A starts request
      let userA = callStateReducer(initialCallState, { type: "START_REQUEST" });
      expect(userA.status).toBe("requesting");

      // User A receives request from User B while already requesting -> immediate mutual agreement!
      userA = callStateReducer(userA, { type: "RECEIVE_REQUEST" });
      expect(userA.status).toBe("connecting");
    });

    it("handles caller cancelling request", () => {
      let state = callStateReducer(initialCallState, { type: "START_REQUEST" });
      expect(state.status).toBe("requesting");

      state = callStateReducer(state, { type: "CANCEL_REQUEST" });
      expect(state.status).toBe("idle");
    });

    it("handles callee rejecting request or sender receiving rejection", () => {
      let callee = callStateReducer(initialCallState, { type: "RECEIVE_REQUEST" });
      expect(callee.status).toBe("requested");

      callee = callStateReducer(callee, { type: "REJECT_REQUEST" });
      expect(callee.status).toBe("idle");

      let caller = callStateReducer(initialCallState, { type: "START_REQUEST" });
      caller = callStateReducer(caller, { type: "REJECT_REQUEST" });
      expect(caller.status).toBe("idle");
    });

    it("handles mute toggle and explicit mute set during connected call", () => {
      let state: CallState = {
        status: "connected",
        isMuted: false,
        durationSeconds: 10,
        errorMessage: null,
      };

      state = callStateReducer(state, { type: "TOGGLE_MUTE" });
      expect(state.isMuted).toBe(true);

      state = callStateReducer(state, { type: "TOGGLE_MUTE" });
      expect(state.isMuted).toBe(false);

      state = callStateReducer(state, { type: "SET_MUTED", isMuted: true });
      expect(state.isMuted).toBe(true);
    });

    it("advances timer only when connected", () => {
      let idle = callStateReducer(initialCallState, { type: "TICK_TIMER" });
      expect(idle.durationSeconds).toBe(0);

      let connected: CallState = {
        status: "connected",
        isMuted: false,
        durationSeconds: 0,
        errorMessage: null,
      };

      connected = callStateReducer(connected, { type: "TICK_TIMER" });
      expect(connected.durationSeconds).toBe(1);

      connected = callStateReducer(connected, { type: "TICK_TIMER" });
      expect(connected.durationSeconds).toBe(2);
    });

    it("handles one-tap end call from any active state", () => {
      let requesting = callStateReducer(initialCallState, { type: "START_REQUEST" });
      expect(callStateReducer(requesting, { type: "END_CALL" }).status).toBe("ended");

      let connected: CallState = {
        status: "connected",
        isMuted: false,
        durationSeconds: 30,
        errorMessage: null,
      };
      expect(callStateReducer(connected, { type: "END_CALL" }).status).toBe("ended");
    });

    it("handles SET_ERROR gracefully", () => {
      let requesting = callStateReducer(initialCallState, { type: "START_REQUEST" });
      let errState = callStateReducer(requesting, {
        type: "SET_ERROR",
        message: "マイクの使用が拒否されました",
      });
      expect(errState.status).toBe("idle");
      expect(errState.errorMessage).toBe("マイクの使用が拒否されました");

      let connected: CallState = {
        status: "connected",
        isMuted: false,
        durationSeconds: 50,
        errorMessage: null,
      };
      let connErrState = callStateReducer(connected, {
        type: "SET_ERROR",
        message: "接続が途切れました",
      });
      expect(connErrState.status).toBe("ended");
      expect(connErrState.errorMessage).toBe("接続が途切れました");
    });

    it("resets to initialCallState on RESET", () => {
      let state: CallState = {
        status: "connected",
        isMuted: true,
        durationSeconds: 120,
        errorMessage: "error",
      };
      expect(callStateReducer(state, { type: "RESET" })).toEqual(initialCallState);
    });

    it("strictly prevents call initiation with only unilateral consent", () => {
      // 1. Caller only
      const callerOnly = callStateReducer(initialCallState, { type: "START_REQUEST" });
      expect(callerOnly.status).toBe("requesting");
      // Calling CONNECT_SUCCESS prematurely has no effect
      expect(callStateReducer(callerOnly, { type: "CONNECT_SUCCESS" }).status).toBe("requesting");

      // 2. Callee only
      const calleeOnly = callStateReducer(initialCallState, { type: "RECEIVE_REQUEST" });
      expect(calleeOnly.status).toBe("requested");
      // Calling CONNECT_SUCCESS prematurely has no effect
      expect(callStateReducer(calleeOnly, { type: "CONNECT_SUCCESS" }).status).toBe("requested");

      // 3. Rejection resets back to idle
      expect(callStateReducer(callerOnly, { type: "REJECT_REQUEST" }).status).toBe("idle");
      expect(callStateReducer(calleeOnly, { type: "REJECT_REQUEST" }).status).toBe("idle");

      // 4. Cancellation resets back to idle
      expect(callStateReducer(callerOnly, { type: "CANCEL_REQUEST" }).status).toBe("idle");
      expect(callStateReducer(calleeOnly, { type: "CANCEL_REQUEST" }).status).toBe("idle");
    });

    it("completes full simultaneous mutual request lifecycle to connected state", () => {
      // User A and User B request simultaneously
      let userA = callStateReducer(initialCallState, { type: "START_REQUEST" });
      let userB = callStateReducer(initialCallState, { type: "START_REQUEST" });
      expect(userA.status).toBe("requesting");
      expect(userB.status).toBe("requesting");

      // Cross-receive each other's requests
      userA = callStateReducer(userA, { type: "RECEIVE_REQUEST" });
      userB = callStateReducer(userB, { type: "RECEIVE_REQUEST" });
      expect(userA.status).toBe("connecting");
      expect(userB.status).toBe("connecting");

      // WebRTC connection establishes on both ends
      userA = callStateReducer(userA, { type: "CONNECT_SUCCESS" });
      userB = callStateReducer(userB, { type: "CONNECT_SUCCESS" });
      expect(userA.status).toBe("connected");
      expect(userB.status).toBe("connected");
      expect(userA.durationSeconds).toBe(0);
      expect(userB.durationSeconds).toBe(0);
    });

    it("does not increment timer in any non-connected states", () => {
      const nonConnectedStates: CallStatus[] = ["idle", "requesting", "requested", "connecting", "ended"];
      for (const status of nonConnectedStates) {
        const state: CallState = {
          status,
          isMuted: false,
          durationSeconds: 0,
          errorMessage: null,
        };
        const ticked = callStateReducer(state, { type: "TICK_TIMER" });
        expect(ticked.durationSeconds).toBe(0);
      }
    });

    it("supports one-tap end call from all non-idle states", () => {
      const activeStatuses: CallStatus[] = ["requesting", "requested", "connecting", "connected", "ended"];
      for (const status of activeStatuses) {
        const state: CallState = {
          status,
          isMuted: false,
          durationSeconds: 15,
          errorMessage: null,
        };
        const ended = callStateReducer(state, { type: "END_CALL" });
        expect(ended.status).toBe("ended");
      }
    });

    it("allows restarting a call from ended state and clears previous errors", () => {
      const endedWithError: CallState = {
        status: "ended",
        isMuted: false,
        durationSeconds: 42,
        errorMessage: "以前のエラー",
      };

      // Restart by initiating request
      const restartedCaller = callStateReducer(endedWithError, { type: "START_REQUEST" });
      expect(restartedCaller.status).toBe("requesting");
      expect(restartedCaller.errorMessage).toBeNull();

      // Restart by receiving request
      const restartedCallee = callStateReducer(endedWithError, { type: "RECEIVE_REQUEST" });
      expect(restartedCallee.status).toBe("requested");
      expect(restartedCallee.errorMessage).toBeNull();
    });

    it("handles errors during connecting transition gracefully", () => {
      const connectingState: CallState = {
        status: "connecting",
        isMuted: false,
        durationSeconds: 0,
        errorMessage: null,
      };

      const failedConnecting = callStateReducer(connectingState, {
        type: "SET_ERROR",
        message: "ICE接続に失敗しました",
      });

      expect(failedConnecting.status).toBe("ended");
      expect(failedConnecting.errorMessage).toBe("ICE接続に失敗しました");
    });
  });
});
