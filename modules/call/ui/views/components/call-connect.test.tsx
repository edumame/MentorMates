import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CallConnect } from "./call-connect";

const mockEnsureCallExists = jest.fn();
const mockGenerateToken = jest.fn();
const mockClientCall = jest.fn();

jest.mock("@/trpc/client", () => ({
  useTRPC: () => ({
    meetings: {
      generateToken: { mutationOptions: () => ({ key: "generateToken" }) },
      ensureCallExists: { mutationOptions: () => ({ key: "ensureCallExists" }) },
    },
  }),
}));

jest.mock("@tanstack/react-query", () => ({
  useMutation: ({ key }: { key: string }) => ({
    mutateAsync: key === "generateToken" ? mockGenerateToken : mockEnsureCallExists,
  }),
}));

jest.mock("@stream-io/video-react-sdk", () => ({
  CallingState: { LEFT: "left" },
  StreamCall: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  StreamVideo: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  StreamVideoClient: class {
    call = mockClientCall;
    disconnectUser = jest.fn();
  },
}));

jest.mock("@stream-io/video-react-sdk/dist/css/styles.css", () => ({}), { virtual: true });

jest.mock("./call-ui", () => ({
  CallUI: () => <div>call ui</div>,
}));

const defaultProps = {
  meetingId: "meeting-1",
  meetingName: "Mentor sync",
  userId: "user-1",
  userName: "Ada",
  userImage: "",
};

describe("CallConnect", () => {
  beforeEach(() => {
    mockEnsureCallExists.mockReset();
    mockClientCall.mockReset();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockClientCall.mockReturnValue({
      camera: { disable: jest.fn() },
      microphone: { disable: jest.fn() },
      state: { callingState: "idle" },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders the call once setup succeeds", async () => {
    mockEnsureCallExists.mockResolvedValue({});

    render(<CallConnect {...defaultProps} />);

    expect(await screen.findByText("call ui")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an error with a way back when call setup fails", async () => {
    mockEnsureCallExists.mockRejectedValue(new Error("stream outage"));

    render(<CallConnect {...defaultProps} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't set up this call/i);
    expect(screen.getByRole("button", { name: /try again/i })).toBeEnabled();
    expect(screen.getByRole("link", { name: /back to learn/i })).toHaveAttribute("href", "/learn");
    expect(screen.queryByText("call ui")).not.toBeInTheDocument();
  });

  it("retries setup and recovers when the retry succeeds", async () => {
    const user = userEvent.setup();
    mockEnsureCallExists.mockRejectedValueOnce(new Error("stream outage")).mockResolvedValueOnce({});

    render(<CallConnect {...defaultProps} />);
    await user.click(await screen.findByRole("button", { name: /try again/i }));

    expect(await screen.findByText("call ui")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mockEnsureCallExists).toHaveBeenCalledTimes(2);
  });

  it("shows the error again when the retry also fails", async () => {
    const user = userEvent.setup();
    mockEnsureCallExists.mockRejectedValue(new Error("stream outage"));

    render(<CallConnect {...defaultProps} />);
    await user.click(await screen.findByRole("button", { name: /try again/i }));

    await waitFor(() => expect(mockEnsureCallExists).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("ignores a failure from a setup attempt that was superseded", async () => {
    let rejectFirstAttempt: (error: Error) => void = () => undefined;
    mockEnsureCallExists
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectFirstAttempt = reject;
          }),
      )
      .mockResolvedValueOnce({});

    const { rerender } = render(<CallConnect {...defaultProps} />);
    await waitFor(() => expect(mockEnsureCallExists).toHaveBeenCalledTimes(1));

    rerender(<CallConnect {...defaultProps} meetingId="meeting-2" />);
    expect(await screen.findByText("call ui")).toBeInTheDocument();

    await act(async () => {
      rejectFirstAttempt(new Error("stale failure"));
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("call ui")).toBeInTheDocument();
  });
});
