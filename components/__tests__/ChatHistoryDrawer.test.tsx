import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChatHistoryDrawer from "@/components/ChatHistoryDrawer";

describe("ChatHistoryDrawer", () => {
  it("renders sessions and triggers selection/new chat", async () => {
    const user = userEvent.setup();
    const onSelectSession = vi.fn();
    const onDeleteSession = vi.fn();
    const onNewChat = vi.fn();

    render(
      <ChatHistoryDrawer
        open
        onOpenChange={vi.fn()}
        sessions={[
          {
            id: "c1",
            title: "First",
            updatedAt: Date.now(),
            modelCount: 2,
            hostCount: 1,
          },
          {
            id: "c2",
            title: "Second",
            updatedAt: Date.now() - 1000,
            modelCount: 3,
            hostCount: 2,
          },
        ]}
        activeSessionId="c1"
        onSelectSession={onSelectSession}
        onDeleteSession={onDeleteSession}
        onNewChat={onNewChat}
      />,
    );

    expect(screen.getByText("Chats")).toBeInTheDocument();
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete chat First" }).className).toContain(
      "md:opacity-0",
    );
    expect(screen.getByRole("button", { name: "Delete chat Second" }).className).toContain(
      "md:group-hover:opacity-100",
    );

    await user.click(screen.getByRole("button", { name: "New chat" }));
    expect(onNewChat).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /^Second/ }));
    expect(onSelectSession).toHaveBeenCalledWith("c2");

    await user.click(screen.getByRole("button", { name: "Delete chat Second" }));
    expect(onDeleteSession).toHaveBeenCalledWith("c2");
  });
});
