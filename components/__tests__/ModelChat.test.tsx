import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ModelChat from "@/components/ModelChat";

const baseProps = {
  model: "qwen:4b",
  role: "tester",
  roleOptions: ["tester", "designer", "reviewer"],
  onRoleChange: vi.fn(),
  chat: {
    modelName: "qwen:4b",
    messages: [{ role: "assistant" as const, content: "ready" }],
    isLoading: false,
  },
  onDuplicate: vi.fn(),
  onRemove: vi.fn(),
};

describe("ModelChat", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const mockClipboard = (writeText: ReturnType<typeof vi.fn>) => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  };

  it("renders header and message content", () => {
    render(<ModelChat {...baseProps} />);

    expect(screen.getByText("qwen:4b")).toBeInTheDocument();
    expect(screen.getByText("1 msg")).toBeInTheDocument();
    expect(screen.getByText("ready")).toBeInTheDocument();
  });

  it("opens role dialog and applies selected role", async () => {
    const user = userEvent.setup();
    const onRoleChange = vi.fn();
    render(<ModelChat {...baseProps} onRoleChange={onRoleChange} />);

    await user.click(screen.getByRole("button", { name: "Edit role for qwen:4b" }));
    expect(screen.getByText("Assign Role")).toBeInTheDocument();

    const roleInput = screen.getByPlaceholderText(
      "Type role (e.g. tester, designer, pm)",
    );
    await user.clear(roleInput);
    await user.type(roleInput, "designer");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(onRoleChange).toHaveBeenCalledWith("designer");
  });

  it("calls duplicate and remove handlers", async () => {
    const user = userEvent.setup();
    const onDuplicate = vi.fn();
    const onRemove = vi.fn();
    render(<ModelChat {...baseProps} onDuplicate={onDuplicate} onRemove={onRemove} />);

    await user.click(screen.getByRole("button", { name: "Duplicate qwen:4b" }));
    await user.click(screen.getByRole("button", { name: "Remove qwen:4b" }));

    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("renders empty state when there are no messages", () => {
    render(
      <ModelChat
        {...baseProps}
        chat={{ modelName: "qwen:4b", messages: [], isLoading: false }}
      />,
    );

    expect(screen.getByText("No messages yet")).toBeInTheDocument();
    expect(
      screen.getByText("Start a conversation to see responses"),
    ).toBeInTheDocument();
  });

  it("shows loading indicator and supports fenced code copy", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);

    render(
      <ModelChat
        {...baseProps}
        chat={{
          modelName: "qwen:4b",
          messages: [
            {
              role: "assistant",
              content: "Here:\n```ts\nconst a = 1;\n```",
            },
          ],
          isLoading: true,
        }}
      />,
    );

    expect(screen.getByText("Thinking...")).toBeInTheDocument();
    const copyBtn = screen.getByRole("button", { name: "Copy code" });
    await user.click(copyBtn);
    expect(writeText).toHaveBeenCalledWith("const a = 1;\n");
    expect(screen.getByText("Copied")).toBeInTheDocument();
  });

  it("handles malformed markdown and clipboard failures gracefully", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("clipboard denied"));
    mockClipboard(writeText);

    render(
      <ModelChat
        {...baseProps}
        chat={{
          modelName: "qwen:4b",
          messages: [
            {
              role: "assistant",
              content: "inline `code` and dangling `tick\n```broken block",
            },
            { role: "user", content: "hello from user" },
          ],
          isLoading: false,
        }}
      />,
    );

    expect(screen.getByText("hello from user")).toBeInTheDocument();
    expect(screen.getByText("code")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy code" })).toBeNull();
    expect(writeText).not.toHaveBeenCalled();
  });

  it("respects disabled duplicate/remove controls and role assignment off", async () => {
    const user = userEvent.setup();
    const onDuplicate = vi.fn();
    const onRemove = vi.fn();

    render(
      <ModelChat
        {...baseProps}
        enableRoleAssignment={false}
        onDuplicate={onDuplicate}
        disableDuplicate
        onRemove={onRemove}
        disableRemove
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Edit role for qwen:4b" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Duplicate qwen:4b" }));
    await user.click(screen.getByRole("button", { name: "Remove qwen:4b" }));
    expect(onDuplicate).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("shows no matching roles and cancel resets draft", async () => {
    const user = userEvent.setup();
    render(<ModelChat {...baseProps} />);

    await user.click(screen.getByRole("button", { name: "Edit role for qwen:4b" }));
    const roleInput = screen.getByPlaceholderText(
      "Type role (e.g. tester, designer, pm)",
    );
    await user.clear(roleInput);
    await user.type(roleInput, "unknown-role");
    expect(screen.getByText("No matching roles")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await user.click(screen.getByRole("button", { name: "Edit role for qwen:4b" }));
    expect(
      screen.getByDisplayValue("tester"),
    ).toBeInTheDocument();
  });
});
