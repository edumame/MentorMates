/** @jest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JevPlayground } from "./jev-playground";

const okResponse = (body: unknown, headers: Record<string, string> = {}, status = 200) => ({
  ok: status < 300,
  status,
  headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
  json: async () => body,
});

describe("JevPlayground", () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = jest.fn();
  });

  it("shows the invite label and keeps Ask disabled until there is a key and a question", async () => {
    render(<JevPlayground invite="beta-2026" label="Aikagra" />);
    expect(screen.getByText(/Aikagra/)).toBeInTheDocument();
    const ask = screen.getByRole("button", { name: /ask jev/i });
    expect(ask).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/question/i), "Is 2+2=4?");
    expect(ask).toBeDisabled(); // a question alone is not enough
    await userEvent.type(screen.getByLabelText(/api key/i), "mm_sk_abc");
    expect(ask).toBeEnabled();
    await userEvent.clear(screen.getByLabelText(/question/i));
    expect(ask).toBeDisabled(); // a key alone is not enough either
  });

  it("sends the question, shows the answer, latency and remaining calls, and remembers the key", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      okResponse({ choices: [{ message: { content: "true" } }] }, { "x-ratelimit-remaining": "4" })
    );
    render(<JevPlayground invite="beta-2026" label="Aikagra" />);
    await userEvent.type(screen.getByLabelText(/api key/i), "mm_sk_abc");
    await userEvent.type(screen.getByLabelText(/question/i), "Is 2+2=4?");
    await userEvent.click(screen.getByRole("button", { name: /ask jev/i }));
    await waitFor(() => expect(screen.getByTestId("jev-answer")).toHaveTextContent("true"));
    expect(screen.getByText(/4 calls left this minute/i)).toBeInTheDocument();
    expect(screen.getByText(/ms/)).toBeInTheDocument();
    expect(localStorage.getItem("mm:jev:apiKey")).toBe("mm_sk_abc");
  });

  it("prefills the key from localStorage", () => {
    localStorage.setItem("mm:jev:apiKey", "mm_sk_saved");
    render(<JevPlayground invite="beta-2026" label="Aikagra" />);
    expect(screen.getByLabelText(/api key/i)).toHaveValue("mm_sk_saved");
  });

  it("shows the rate-limit message on 429", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(okResponse({ error: "Rate limit" }, { "retry-after": "12" }, 429));
    render(<JevPlayground invite="beta-2026" label="Aikagra" />);
    await userEvent.type(screen.getByLabelText(/api key/i), "mm_sk_abc");
    await userEvent.type(screen.getByLabelText(/question/i), "x");
    await userEvent.click(screen.getByRole("button", { name: /ask jev/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/12 seconds/));
  });
});
