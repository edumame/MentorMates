import { render } from "@testing-library/react";
import { CallActive } from "./call-active";

jest.mock("@stream-io/video-react-sdk", () => ({
  SpeakerLayout: () => null,
  CallControls: () => null,
  useCallStateHooks: () => ({ useMicrophoneState: () => ({}) }),
}));
jest.mock("./screen-capture", () => ({ __esModule: true, default: () => null }));

it("subscribes to captions through the authorized app route, not the worker", () => {
  const close = jest.fn();
  const eventSource = jest.fn(() => ({ close }));
  Object.defineProperty(globalThis, "EventSource", { value: eventSource, configurable: true, writable: true });
  process.env.NEXT_PUBLIC_SCREEN_VISION_WORKER_URL = "https://worker.example";

  const { unmount } = render(<CallActive onLeave={jest.fn()} meetingId="meeting 1" meetingName="Demo" />);

  expect(eventSource).toHaveBeenCalledWith("/api/voice-agent/captions?meetingId=meeting%201");
  unmount();
  expect(close).toHaveBeenCalled();
});
