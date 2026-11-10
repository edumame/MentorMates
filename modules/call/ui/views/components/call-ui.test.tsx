import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CallUI } from "./call-ui";

const mockJoin = jest.fn();

jest.mock("@stream-io/video-react-sdk", () => ({
  DefaultVideoPlaceholder: () => null,
  StreamTheme: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ToggleAudioPreviewButton: () => null,
  ToggleVideoPreviewButton: () => null,
  VideoPreview: () => null,
  useCall: () => ({ join: mockJoin, endCall: jest.fn() }),
  useCallStateHooks: () => ({
    useCameraState: () => ({ hasBrowserPermission: true }),
    useMicrophoneState: () => ({ hasBrowserPermission: true }),
  }),
}));

jest.mock("@stream-io/video-react-sdk/dist/css/styles.css", () => ({}), { virtual: true });

jest.mock("@/features/user/authentication/auth/AuthContext", () => ({
  useAuth: () => ({ session: null }),
}));

jest.mock("./call-active", () => ({
  CallActive: () => <div>active call</div>,
}));

const renderCallUI = () => render(<CallUI meetingId="meeting-1" meetingName="Mentor sync" />);

const joinButton = () => screen.getByRole("button", { name: /join/i });

describe("CallUI", () => {
  beforeEach(() => {
    mockJoin.mockReset();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("enters the call when join succeeds", async () => {
    const user = userEvent.setup();
    mockJoin.mockResolvedValue(undefined);

    renderCallUI();
    await user.click(joinButton());

    expect(await screen.findByText("active call")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an error and keeps the lobby usable when join fails", async () => {
    const user = userEvent.setup();
    mockJoin.mockRejectedValue(new Error("call ended"));

    renderCallUI();
    await user.click(joinButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't join this call/i);
    expect(joinButton()).toBeEnabled();
    expect(screen.getByRole("link", { name: /cancel/i })).toHaveAttribute("href", "/learn");
    expect(screen.queryByText("active call")).not.toBeInTheDocument();
  });

  it("clears the error and enters the call when a retry succeeds", async () => {
    const user = userEvent.setup();
    mockJoin.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(undefined);

    renderCallUI();
    await user.click(joinButton());
    await screen.findByRole("alert");
    await user.click(joinButton());

    expect(await screen.findByText("active call")).toBeInTheDocument();
    expect(mockJoin).toHaveBeenCalledTimes(2);
  });

  it("disables Join while a join is pending so it cannot run twice", async () => {
    const user = userEvent.setup();
    let resolveJoin: () => void = () => undefined;
    mockJoin.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveJoin = resolve;
        }),
    );

    renderCallUI();
    await user.click(joinButton());

    expect(joinButton()).toBeDisabled();
    await user.click(joinButton());
    expect(mockJoin).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveJoin();
    });
    expect(await screen.findByText("active call")).toBeInTheDocument();
  });
});
