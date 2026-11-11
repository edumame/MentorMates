import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "@/lib/hooks/use-toast";
import { CallActive } from "./call-active";

jest.mock("@/lib/hooks/use-toast", () => ({ toast: jest.fn() }));

jest.mock("./screen-capture", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@stream-io/video-react-sdk", () => ({
  SpeakerLayout: () => null,
  CallControls: () => null,
  useCallStateHooks: () => ({
    useMicrophoneState: () => ({ isEnabled: true }),
  }),
}));

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const renderCall = () =>
  render(<CallActive onLeave={jest.fn()} meetingId="meeting-1" meetingName="Demo" />);

// The mic analyser reports speech on its first read, which enables Start Q&A.
const findEnabledButton = async (name: string) => {
  await waitFor(() => expect(screen.getByRole("button", { name })).toBeEnabled());
  return screen.getByRole("button", { name });
};

describe("CallActive Q&A toggle", () => {
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    fetchMock.mockReset();
    (toast as jest.Mock).mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    jest.spyOn(console, "error").mockImplementation(() => {});

    Object.defineProperty(global.navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: jest.fn().mockResolvedValue({ getTracks: () => [] }),
      },
    });
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: class {
        createMediaStreamSource() {
          return { connect: jest.fn() };
        }
        createAnalyser() {
          return {
            fftSize: 2048,
            getByteTimeDomainData: (data: Uint8Array) => data.fill(255),
          };
        }
        close() {
          return Promise.resolve();
        }
      },
    });
    Object.defineProperty(global, "EventSource", {
      configurable: true,
      value: class {
        close() {}
      },
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("switches to Pause Q&A when the worker confirms the resume", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, paused: false }));
    renderCall();

    fireEvent.click(await findEnabledButton("Start Q&A"));

    expect(await screen.findByRole("button", { name: "Pause Q&A" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/voice-agent/resume",
      expect.objectContaining({ body: JSON.stringify({ meetingId: "meeting-1" }) })
    );
    expect(toast).not.toHaveBeenCalled();
  });

  it.each([
    ["a 200 body with ok:false", jsonResponse({ ok: false, waitingForCaptions: true })],
    ["a waiting 503", jsonResponse({ ok: false, waitingForCaptions: true }, 503)],
    ["a missing session 402", jsonResponse({ error: "session not found" }, 402)],
  ])("stays on Start Q&A and shows an error on %s", async (_name, response) => {
    fetchMock.mockResolvedValue(response);
    renderCall();

    fireEvent.click(await findEnabledButton("Start Q&A"));

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't start Q&A", variant: "destructive" })
    );
    expect(screen.getByRole("button", { name: "Start Q&A" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pause Q&A" })).not.toBeInTheDocument();
  });

  it("stays on Start Q&A and shows an error when the request throws", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    renderCall();

    fireEvent.click(await findEnabledButton("Start Q&A"));

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Start Q&A" })).toBeInTheDocument();
  });

  it("lets the user retry straight after a failed start", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "session not found" }, 402))
      .mockResolvedValueOnce(jsonResponse({ ok: true, paused: false }));
    renderCall();

    fireEvent.click(await findEnabledButton("Start Q&A"));
    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));

    fireEvent.click(await findEnabledButton("Start Q&A"));

    expect(await screen.findByRole("button", { name: "Pause Q&A" })).toBeInTheDocument();
  });

  it("stays on Pause Q&A and shows an error when pausing fails", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ ok: true, paused: false }))
      .mockResolvedValueOnce(jsonResponse({ error: "session not found" }, 402));
    renderCall();

    fireEvent.click(await findEnabledButton("Start Q&A"));
    fireEvent.click(await findEnabledButton("Pause Q&A"));

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't pause Q&A", variant: "destructive" })
    );
    expect(fetchMock).toHaveBeenLastCalledWith("/api/voice-agent/pause", expect.anything());
    expect(screen.getByRole("button", { name: "Pause Q&A" })).toBeInTheDocument();
  });
});
