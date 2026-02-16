import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OnboardingDialog from "@/components/OnboardingDialog";

const steps = [
  { title: "Step One", description: "First step" },
  { title: "Step Two", description: "Second step" },
];

describe("OnboardingDialog", () => {
  it("shows first step with disabled back button and next action", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();

    render(
      <OnboardingDialog
        open
        onboardingStep={0}
        onboardingSteps={steps}
        publicBasePath=""
        onBack={vi.fn()}
        onNext={onNext}
        onFinish={vi.fn()}
      />,
    );

    expect(screen.getByText("Step One")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("uses finish action on last step", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();

    render(
      <OnboardingDialog
        open
        onboardingStep={1}
        onboardingSteps={steps}
        publicBasePath=""
        onBack={vi.fn()}
        onNext={vi.fn()}
        onFinish={onFinish}
      />,
    );

    expect(screen.getByText("Step Two")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Finish" }));
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(
        "If Ollama is not running locally, open Settings and set a remote Ollama URL.",
      ),
    ).toBeInTheDocument();
  });
});
