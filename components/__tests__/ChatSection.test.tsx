import { render, screen } from "@testing-library/react";
import ChatSection from "@/components/ChatSection";

describe("ChatSection", () => {
  it("renders empty state", () => {
    render(
      <ChatSection
        model="qwen:4b"
        chat={{ modelName: "qwen:4b", messages: [], isLoading: false }}
      />,
    );

    expect(screen.getByText("qwen:4b")).toBeInTheDocument();
    expect(screen.getByText("No messages yet. Start chatting!")).toBeInTheDocument();
  });

  it("renders messages and loading indicator", () => {
    render(
      <ChatSection
        model="llama3.2:3b"
        chat={{
          modelName: "llama3.2:3b",
          messages: [
            { role: "user", content: "hello" },
            { role: "assistant", content: "hi there" },
          ],
          isLoading: true,
        }}
      />,
    );

    expect(screen.getByText("2 messages")).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.getByText("hi there")).toBeInTheDocument();
    expect(screen.getByText("Thinking...")).toBeInTheDocument();
  });
});

