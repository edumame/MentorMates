import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { CallUI } from "./call-ui";

let callingState: string;
const call = {
  join: jest.fn(),
  get: jest.fn(),
  endCall: jest.fn(),
  leave: jest.fn(),
  state: { endedAt: undefined as Date | undefined },
};

jest.mock("sonner", () => ({ toast: { error: jest.fn() } }));
jest.mock("@stream-io/video-react-sdk", () => ({
  CallingState: {
    IDLE: "idle",
    JOINED: "joined",
    LEFT: "left",
    RECONNECTING_FAILED: "reconnecting-failed",
  },
  StreamTheme: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useCall: () => call,
  useCallStateHooks: () => ({ useCallCallingState: () => callingState }),
}));
jest.mock("./call-lobby", () => ({
  CallLobby: ({ onJoin }: { onJoin: () => void }) => <button onClick={onJoin}>Join Call</button>,
}));
jest.mock("./call-active", () => ({
  CallActive: ({ onLeave }: { onLeave: () => void }) => <button onClick={onLeave}>Hang up</button>,
}));
jest.mock("./call-ended", () => ({ CallEnded: () => <p>Call ended</p> }));

const renderCall = (isOwner = true) => {
  const ui = () => <CallUI meetingId="meeting-1" meetingName="Demo" isOwner={isOwner} />;
  const view = render(ui());
  return { ...view, update: () => view.rerender(ui()) };
};

const join = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Join Call" }));
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  callingState = "idle";
  call.state.endedAt = undefined;
  call.join.mockImplementation(async () => {
    callingState = "joined";
  });
  call.get.mockResolvedValue({});
  call.endCall.mockResolvedValue({});
  call.leave.mockResolvedValue(undefined);
});

describe("CallUI", () => {
  it("shows the active call after joining", async () => {
    renderCall();

    await join();

    expect(screen.getByRole("button", { name: "Hang up" })).toBeInTheDocument();
  });

  it("switches to the ended screen when the call is ended remotely", async () => {
    const { update } = renderCall();
    await join();

    callingState = "left";
    update();

    expect(screen.getByText("Call ended")).toBeInTheDocument();
  });

  it("shows the ended screen when reconnecting fails because the call ended", async () => {
    const { update } = renderCall();
    await join();

    call.state.endedAt = new Date();
    callingState = "reconnecting-failed";
    update();

    expect(screen.getByText("Call ended")).toBeInTheDocument();
    expect(call.leave).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("offers the lobby again when reconnecting fails on a live call", async () => {
    const { update } = renderCall();
    await join();

    callingState = "reconnecting-failed";
    update();

    expect(screen.getByRole("button", { name: "Join Call" })).toBeInTheDocument();
    expect(call.leave).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledTimes(1);

    callingState = "left";
    update();
    await join();

    expect(call.join).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Hang up" })).toBeInTheDocument();
  });

  it("still gets off the frozen view when leaving after a failed reconnect fails", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    call.leave.mockRejectedValue(new Error("leave failed"));
    const { update } = renderCall();
    await join();

    callingState = "reconnecting-failed";
    update();

    expect(screen.getByRole("button", { name: "Join Call" })).toBeInTheDocument();
    await waitFor(() => expect(consoleError).toHaveBeenCalled());
    consoleError.mockRestore();
  });

  it.each(["left", "reconnecting-failed"])(
    "stays in the lobby before joining when the calling state is %s",
    (state) => {
      callingState = state;

      renderCall();

      expect(screen.getByRole("button", { name: "Join Call" })).toBeInTheDocument();
      expect(call.leave).not.toHaveBeenCalled();
    }
  );

  it("shows the ended screen when joining a call that has already ended", async () => {
    call.join.mockRejectedValue(new Error("call ended"));
    call.get.mockImplementation(async () => {
      call.state.endedAt = new Date();
    });
    renderCall();

    await join();

    await waitFor(() => expect(screen.getByText("Call ended")).toBeInTheDocument());
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("stays in the lobby and reports the error when joining fails for another reason", async () => {
    call.join.mockRejectedValue(new Error("network"));
    renderCall();

    await join();

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Join Call" })).toBeInTheDocument();
  });

  it("reports the error when the ended check itself fails", async () => {
    call.join.mockRejectedValue(new Error("network"));
    call.get.mockRejectedValue(new Error("network"));
    renderCall();

    await join();

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Join Call" })).toBeInTheDocument();
  });

  it("ends the call for everyone when the owner hangs up", async () => {
    renderCall(true);
    await join();

    fireEvent.click(screen.getByRole("button", { name: "Hang up" }));

    expect(call.endCall).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Call ended")).toBeInTheDocument();
  });

  it("only leaves when a non-owner hangs up", async () => {
    renderCall(false);
    await join();

    fireEvent.click(screen.getByRole("button", { name: "Hang up" }));

    expect(call.endCall).not.toHaveBeenCalled();
    expect(screen.getByText("Call ended")).toBeInTheDocument();
  });
});
