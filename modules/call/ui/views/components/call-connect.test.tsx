import { act, render, screen, waitFor } from "@testing-library/react";
import { CallConnect } from "./call-connect";
import { ChatUI } from "@/modules/meetings/ui/components/chat-ui";

const mockVideoToken = jest.fn();
const mockChatToken = jest.fn();
const mockEnsure = jest.fn();
const mockClients: Array<{ kind: string; provider?: () => Promise<string>; disconnectUser: jest.Mock; call: jest.Mock; channel: jest.Mock }> = [];
let mockPauseConnect: Promise<void> | undefined;
let mockWatchError = false;
jest.mock("@/trpc/client", () => ({ useTRPC: () => ({ meetings: {
  generateToken: { mutationOptions: () => ({ mutateAsync: mockVideoToken }) },
  generateChatToken: { mutationOptions: () => ({ mutateAsync: mockChatToken }) },
  ensureCallExists: { mutationOptions: () => ({ mutateAsync: mockEnsure }) },
} }) }));
jest.mock("@tanstack/react-query", () => ({ useMutation: (options: unknown) => options }));
jest.mock("./call-ui", () => ({ CallUI: ({ meetingId }: { meetingId: string }) => <div>Call {meetingId}</div> }));
jest.mock("@/components/error-state", () => ({ ErrorState: ({ title }: { title: string }) => <div role="alert">{title}</div> }));
jest.mock("@/components/loading-state", () => ({ LoadingState: () => <div>Loading chat</div> }));
function mockClient(kind: string) {
  const instance = {
    kind, provider: undefined as (() => Promise<string>) | undefined,
    connectUser: jest.fn(async (_user: unknown, provider: () => Promise<string>) => {
      instance.provider = provider; await provider(); await mockPauseConnect;
    }),
    disconnectUser: jest.fn().mockResolvedValue(undefined),
    call: jest.fn((_type: string, id: string) => ({ id, camera: { disable: jest.fn().mockResolvedValue(undefined) }, microphone: { disable: jest.fn().mockResolvedValue(undefined) }, leave: jest.fn().mockResolvedValue(undefined), endCall: jest.fn() })),
    channel: jest.fn((_type: string, id: string) => ({ id, watch: jest.fn(async () => { if (mockWatchError) throw new Error("private provider error"); }), stopWatching: jest.fn().mockResolvedValue(undefined) })),
  };
  mockClients.push(instance); return instance;
}
jest.mock("@stream-io/video-react-sdk", () => ({
  StreamVideoClient: jest.fn(() => mockClient("video")),
  StreamVideo: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  StreamCall: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("stream-chat", () => ({ StreamChat: jest.fn(() => mockClient("chat")) }));
jest.mock("stream-chat-react", () => ({
  Chat: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Channel: ({ channel, children }: { channel: { id: string }; children: React.ReactNode }) => <div>Chat {channel.id}{children}</div>,
  Window: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  MessageInput: () => null, MessageList: () => null, Thread: () => null,
}));
const props = { meetingId: "meeting-one", meetingName: "Meeting", userId: "user-one", userName: "User", userImage: "" };
beforeEach(() => {
  jest.clearAllMocks(); mockClients.length = 0; mockPauseConnect = undefined; mockWatchError = false;
  mockVideoToken.mockResolvedValue("video-token"); mockChatToken.mockResolvedValue("chat-token"); mockEnsure.mockResolvedValue({});
});
it.each(["video", "chat"])("binds %s initial token and refresh to the meeting", async kind => {
  render(kind === "video" ? <CallConnect {...props} /> : <ChatUI {...props} />);
  await screen.findByText(`${kind === "video" ? "Call" : "Chat"} meeting-one`);
  const token = kind === "video" ? mockVideoToken : mockChatToken;
  expect(token).toHaveBeenCalledWith({ id: "meeting-one" });
  await act(async () => { await mockClients[0].provider!(); });
  expect(token).toHaveBeenCalledTimes(2);
  expect(token).toHaveBeenLastCalledWith({ id: "meeting-one" });
  if (kind === "chat") expect(mockClients[0].channel).toHaveBeenCalledWith("messaging", "meeting-one");
});
it.each(["video", "chat"])("surfaces %s token failures safely", async kind => {
  (kind === "video" ? mockVideoToken : mockChatToken).mockRejectedValue(new Error("secret"));
  render(kind === "video" ? <CallConnect {...props} /> : <ChatUI {...props} />);
  expect(await screen.findByRole("alert")).not.toHaveTextContent("secret");
  expect(mockClients[0].call).not.toHaveBeenCalled(); expect(mockClients[0].channel).not.toHaveBeenCalled();
});
it("does not create video resources when server admission fails", async () => {
  mockEnsure.mockRejectedValue(new Error("forbidden")); render(<CallConnect {...props} />);
  await screen.findByRole("alert"); expect(mockClients).toHaveLength(0);
});
it("shows chat watch failures instead of indefinite loading", async () => {
  mockWatchError = true; render(<ChatUI {...props} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load chat");
});
it.each(["video", "chat"])("disposes old %s resources and scopes replacement after identity change", async kind => {
  const element = (meetingId: string, userId: string) => kind === "video" ? <CallConnect {...props} meetingId={meetingId} userId={userId} /> : <ChatUI {...props} meetingId={meetingId} userId={userId} />;
  const { rerender, unmount } = render(element("meeting-one", "user-one"));
  await screen.findByText(`${kind === "video" ? "Call" : "Chat"} meeting-one`);
  const old = mockClients[0]; rerender(element("meeting-two", "user-two"));
  expect(screen.queryByText(`${kind === "video" ? "Call" : "Chat"} meeting-one`)).not.toBeInTheDocument();
  await screen.findByText(`${kind === "video" ? "Call" : "Chat"} meeting-two`);
  await waitFor(() => expect(old.disconnectUser).toHaveBeenCalledTimes(1));
  await expect(old.provider!()).rejects.toThrow("Connection closed");
  expect(kind === "video" ? mockVideoToken : mockChatToken).toHaveBeenLastCalledWith({ id: "meeting-two" });
  if (kind === "video") {
    expect(old.call.mock.results[0].value.leave).toHaveBeenCalledTimes(1);
    expect(old.call.mock.results[0].value.endCall).not.toHaveBeenCalled();
  } else expect(old.channel.mock.results[0].value.stopWatching).toHaveBeenCalledTimes(1);
  unmount(); await waitFor(() => expect(mockClients[1].disconnectUser).toHaveBeenCalledTimes(1));
});
it.each(["video", "chat"])("does not publish a late %s connection after unmount", async kind => {
  let resume!: () => void; mockPauseConnect = new Promise<void>(resolve => { resume = resolve; });
  const { unmount } = render(kind === "video" ? <CallConnect {...props} /> : <ChatUI {...props} />);
  await waitFor(() => expect(mockClients).toHaveLength(1));
  unmount(); await act(async () => { resume(); });
  await waitFor(() => expect(mockClients[0].disconnectUser).toHaveBeenCalledTimes(1));
  expect(mockClients[0].call).not.toHaveBeenCalled(); expect(mockClients[0].channel).not.toHaveBeenCalled();
});

it.each(["video", "chat"])("surfaces and disconnects %s refresh authorization failures", async kind => {
  render(kind === "video" ? <CallConnect {...props} /> : <ChatUI {...props} />);
  await screen.findByText(`${kind === "video" ? "Call" : "Chat"} meeting-one`);
  (kind === "video" ? mockVideoToken : mockChatToken).mockRejectedValue(new Error("private refresh error"));
  await act(async () => { await expect(mockClients[0].provider!()).rejects.toThrow("Unable to authorize"); });
  expect(await screen.findByRole("alert")).not.toHaveTextContent("private");
  await waitFor(() => expect(mockClients[0].disconnectUser).toHaveBeenCalledTimes(1));
});

it.each(["video", "chat"])("rejects an in-flight %s token refresh that resolves after unmount", async kind => {
  const { unmount } = render(kind === "video" ? <CallConnect {...props} /> : <ChatUI {...props} />);
  await screen.findByText(`${kind === "video" ? "Call" : "Chat"} meeting-one`);
  let resolveToken!: (token: string) => void;
  (kind === "video" ? mockVideoToken : mockChatToken).mockImplementationOnce(() => new Promise<string>(resolve => { resolveToken = resolve; }));
  const pending = mockClients[0].provider!();
  const rejected = expect(pending).rejects.toThrow("Unable to authorize");
  unmount();
  await act(async () => { resolveToken("stale-token"); await rejected; });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  await waitFor(() => expect(mockClients[0].disconnectUser).toHaveBeenCalledTimes(1));
});
