import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OllamaSetupAlertDialog from "@/components/OllamaSetupAlertDialog";

describe("OllamaSetupAlertDialog", () => {
  it("renders setup content and triggers actions", async () => {
    const user = userEvent.setup();
    const onCopyInstallCommand = vi.fn();
    const onCopyNetworkCommand = vi.fn();
    const onOpenSettings = vi.fn();

    render(
      <OllamaSetupAlertDialog
        open
        onOpenChange={vi.fn()}
        apiBaseUrl="http://127.0.0.1:11434"
        didCopyInstallCommand={false}
        didCopyNetworkCommand={false}
        ollamaNetworkCommand={'OLLAMA_HOST=0.0.0.0:11434 OLLAMA_ORIGINS="*" ollama serve'}
        ollamaNetworkCommandLabel="macOS / Ubuntu / Linux"
        onCopyInstallCommand={onCopyInstallCommand}
        onCopyNetworkCommand={onCopyNetworkCommand}
        onOpenSettings={onOpenSettings}
      />,
    );

    expect(screen.getByText("Unable to connect to Ollama")).toBeInTheDocument();
    expect(screen.getByText("Current Ollama URL")).toBeInTheDocument();
    expect(
      screen.getByText("5. Start Ollama for browser/network access (macOS / Ubuntu / Linux):"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Copy command" }));
    await user.click(screen.getByRole("button", { name: "Copy network command" }));
    await user.click(screen.getByRole("button", { name: "Open Settings" }));

    expect(onCopyInstallCommand).toHaveBeenCalledTimes(1);
    expect(onCopyNetworkCommand).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("shows fallback URL text and copied state icons", () => {
    render(
      <OllamaSetupAlertDialog
        open
        onOpenChange={vi.fn()}
        apiBaseUrl=""
        didCopyInstallCommand
        didCopyNetworkCommand
        ollamaNetworkCommand={'OLLAMA_HOST=0.0.0.0:11434 OLLAMA_ORIGINS="*" ollama serve'}
        ollamaNetworkCommandLabel="macOS / Ubuntu / Linux"
        onCopyInstallCommand={vi.fn()}
        onCopyNetworkCommand={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    );

    expect(screen.getByText("Not configured")).toBeInTheDocument();
    expect(
      screen.getAllByText((content) => content.includes('OLLAMA_ORIGINS="*"')).length,
    ).toBeGreaterThan(0);
  });

  it("renders Windows command label when provided", () => {
    render(
      <OllamaSetupAlertDialog
        open
        onOpenChange={vi.fn()}
        apiBaseUrl="http://127.0.0.1:11434"
        didCopyInstallCommand={false}
        didCopyNetworkCommand={false}
        ollamaNetworkCommand={'$env:OLLAMA_HOST="0.0.0.0:11434"; $env:OLLAMA_ORIGINS="*"; ollama serve'}
        ollamaNetworkCommandLabel="Windows PowerShell"
        onCopyInstallCommand={vi.fn()}
        onCopyNetworkCommand={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    );

    expect(
      screen.getByText("5. Start Ollama for browser/network access (Windows PowerShell):"),
    ).toBeInTheDocument();
  });
});
