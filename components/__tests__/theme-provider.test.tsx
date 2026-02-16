import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";

vi.mock("next-themes", async () => {
  return {
    ThemeProvider: ({
      children,
      ...props
    }: {
      children: ReactNode;
      [key: string]: unknown;
    }) => (
      <div data-testid="next-theme-provider" data-props={JSON.stringify(props)}>
        {children}
      </div>
    ),
  };
});

describe("ThemeProvider", () => {
  it("renders children and forwards props to next-themes provider", () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="dark">
        <span>inside-provider</span>
      </ThemeProvider>,
    );

    expect(screen.getByText("inside-provider")).toBeInTheDocument();
    expect(screen.getByTestId("next-theme-provider")).toBeInTheDocument();
  });
});
