/** @jest-environment jsdom */
import { getCardNavigationDirection } from "./utils";

function keyEvent(key: string, target: EventTarget | null, extra: Partial<KeyboardEvent> = {}) {
  return {
    key,
    target,
    defaultPrevented: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...extra,
  };
}

function el(html: string, selector: string) {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.appendChild(host);
  return host.querySelector(selector)!;
}

describe("getCardNavigationDirection (JUDGE-003)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("navigates on bare arrow keys pressed on the page", () => {
    expect(getCardNavigationDirection(keyEvent("ArrowLeft", document.body))).toBe(-1);
    expect(getCardNavigationDirection(keyEvent("ArrowRight", document.body))).toBe(1);
    expect(getCardNavigationDirection(keyEvent("ArrowRight", null))).toBe(1);
  });

  it("ignores other keys", () => {
    expect(getCardNavigationDirection(keyEvent("ArrowUp", document.body))).toBeNull();
    expect(getCardNavigationDirection(keyEvent("a", document.body))).toBeNull();
  });

  it.each([
    ["textarea", "<textarea></textarea>", "textarea"],
    ["text input", "<input type='text' />", "input"],
    ["select", "<select><option>1</option></select>", "select"],
    ["Radix slider thumb", "<span role='slider' tabindex='0'></span>", "[role=slider]"],
    ["element inside a slider", "<div role='slider'><span class='thumb'></span></div>", ".thumb"],
    ["radio group", "<div role='radiogroup'><button role='radio'>1</button></div>", "[role=radio]"],
    ["contenteditable", "<div contenteditable='true'><p>x</p></div>", "p"],
  ])("does not hijack arrows inside a %s", (_name, html, selector) => {
    const target = el(html, selector);
    expect(getCardNavigationDirection(keyEvent("ArrowLeft", target))).toBeNull();
    expect(getCardNavigationDirection(keyEvent("ArrowRight", target))).toBeNull();
  });

  it("ignores modified or already-handled key presses", () => {
    for (const mod of ["altKey", "ctrlKey", "metaKey", "shiftKey"] as const) {
      expect(getCardNavigationDirection(keyEvent("ArrowRight", document.body, { [mod]: true }))).toBeNull();
    }
    expect(
      getCardNavigationDirection(keyEvent("ArrowRight", document.body, { defaultPrevented: true }))
    ).toBeNull();
  });
});
