import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsDrawer from "@/components/SettingsDrawer";

const settings = {
  hosts: [{ id: "h1", url: "http://127.0.0.1:11434" }],
  persistDataLocally: true,
  enableRoles: true,
  allowSameModelMultiChat: true,
  chatConfigEnabled: false,
  chatConfigPrePrompt: "",
  chatConfigPostPrompt: "",
  chatConfigMaxOutputLength: null,
};

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  hostStatuses: { h1: "connected" as const },
  onAddHost: vi.fn(),
  onRemoveHost: vi.fn(),
  onHostUrlChange: vi.fn(),
  onHostUrlBlur: vi.fn(),
  onTestHostConnection: vi.fn(),
  onOpenNetworkScan: vi.fn(),
  onPersistDataChange: vi.fn(),
  onEnableRolesChange: vi.fn(),
  onAllowSameModelMultiChatChange: vi.fn(),
  onChatConfigEnabledChange: vi.fn(),
  onChatConfigPrePromptChange: vi.fn(),
  onChatConfigPostPromptChange: vi.fn(),
  onChatConfigMaxOutputLengthChange: vi.fn(),
  onClearSavedChats: vi.fn(),
  canInstallPwa: false,
  canUpdatePwa: false,
  isUpdatingPwa: false,
  onInstallPwa: vi.fn(),
  onUpdatePwa: vi.fn(),
};

describe("SettingsDrawer", () => {
  it("renders host list and triggers host test", async () => {
    const user = userEvent.setup();
    const onTestHostConnection = vi.fn();

    render(
      <SettingsDrawer
        {...baseProps}
        settings={settings}
        onTestHostConnection={onTestHostConnection}
      />,
    );

    expect(screen.getByText("Ollama Hosts")).toBeInTheDocument();
    expect(screen.getByDisplayValue("http://127.0.0.1:11434")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Test host 1" }));
    expect(onTestHostConnection).toHaveBeenCalledWith("h1");
  });

  it("opens network scan from settings action", async () => {
    const user = userEvent.setup();
    const onOpenNetworkScan = vi.fn();

    render(
      <SettingsDrawer
        {...baseProps}
        settings={settings}
        onOpenNetworkScan={onOpenNetworkScan}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Scan network for Ollama hosts" }));
    expect(onOpenNetworkScan).toHaveBeenCalledTimes(1);
  });

  it("shows subtle green border for connected host", () => {
    render(<SettingsDrawer {...baseProps} settings={settings} />);
    const input = screen.getByLabelText("Ollama host 1");
    expect(input.className).toContain("border-emerald-300");
  });

  it("shows failed host input style", () => {
    render(
      <SettingsDrawer
        {...baseProps}
        settings={settings}
        hostStatuses={{ h1: "failed" }}
      />,
    );

    const input = screen.getByLabelText("Ollama host 1");
    expect(input.className).toContain("border-rose-300");
  });

  it("supports add host/remove host and input callbacks", async () => {
    const user = userEvent.setup();
    const onAddHost = vi.fn();
    const onRemoveHost = vi.fn();
    const onHostUrlChange = vi.fn();
    const onHostUrlBlur = vi.fn();

    render(
      <SettingsDrawer
        {...baseProps}
        settings={{
          ...settings,
          hosts: [
            { id: "h1", url: "http://127.0.0.1:11434" },
            { id: "h2", url: "http://192.168.1.9:11434" },
          ],
        }}
        onAddHost={onAddHost}
        onRemoveHost={onRemoveHost}
        onHostUrlChange={onHostUrlChange}
        onHostUrlBlur={onHostUrlBlur}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add host" }));
    expect(onAddHost).toHaveBeenCalledTimes(1);

    const host2Input = screen.getByLabelText("Ollama host 2");
    await user.type(host2Input, "x");
    host2Input.blur();

    expect(onHostUrlChange).toHaveBeenCalled();
    expect(onHostUrlBlur).toHaveBeenCalledWith("h2");

    await user.click(screen.getByRole("button", { name: "Remove host 2" }));
    expect(onRemoveHost).toHaveBeenCalledWith("h2");
  });

  it("fires config toggles and optional chat configuration callbacks", async () => {
    const user = userEvent.setup();
    const onPersistDataChange = vi.fn();
    const onEnableRolesChange = vi.fn();
    const onAllowSameModelMultiChatChange = vi.fn();
    const onChatConfigEnabledChange = vi.fn();
    const onChatConfigPrePromptChange = vi.fn();
    const onChatConfigPostPromptChange = vi.fn();
    const onChatConfigMaxOutputLengthChange = vi.fn();

    render(
      <SettingsDrawer
        {...baseProps}
        settings={{
          ...settings,
          chatConfigEnabled: true,
          chatConfigPrePrompt: "be concise",
          chatConfigPostPrompt: "reply in bullets",
          chatConfigMaxOutputLength: 500,
        }}
        onPersistDataChange={onPersistDataChange}
        onEnableRolesChange={onEnableRolesChange}
        onAllowSameModelMultiChatChange={onAllowSameModelMultiChatChange}
        onChatConfigEnabledChange={onChatConfigEnabledChange}
        onChatConfigPrePromptChange={onChatConfigPrePromptChange}
        onChatConfigPostPromptChange={onChatConfigPostPromptChange}
        onChatConfigMaxOutputLengthChange={onChatConfigMaxOutputLengthChange}
      />,
    );

    await user.click(screen.getByRole("switch", { name: "Persist data locally" }));
    await user.click(screen.getByRole("switch", { name: "Enable role assignment" }));
    await user.click(
      screen.getByRole("switch", { name: "Allow same model multiple instances" }),
    );
    await user.click(screen.getByRole("switch", { name: "Enable chat configuration" }));

    await user.type(screen.getByLabelText("Pre prompt (optional)"), "!");
    await user.type(screen.getByLabelText("Post prompt (optional)"), "!");
    await user.clear(screen.getByLabelText("Max output length (optional)"));

    expect(onPersistDataChange).toHaveBeenCalled();
    expect(onEnableRolesChange).toHaveBeenCalled();
    expect(onAllowSameModelMultiChatChange).toHaveBeenCalled();
    expect(onChatConfigEnabledChange).toHaveBeenCalled();
    expect(onChatConfigPrePromptChange).toHaveBeenCalled();
    expect(onChatConfigPostPromptChange).toHaveBeenCalled();
    expect(onChatConfigMaxOutputLengthChange).toHaveBeenCalledWith(null);
  });

  it("shows disabled install button when PWA install is unavailable", () => {
    render(
      <SettingsDrawer
        {...baseProps}
        settings={settings}
        canInstallPwa={false}
      />,
    );

    expect(screen.getByRole("button", { name: "Install app" })).toBeDisabled();
  });

  it("enables update app button only when update is available", async () => {
    const user = userEvent.setup();
    const onUpdatePwa = vi.fn();

    const { rerender } = render(
      <SettingsDrawer
        {...baseProps}
        settings={settings}
        canUpdatePwa={false}
        onUpdatePwa={onUpdatePwa}
      />,
    );

    expect(screen.getByRole("button", { name: "Update app" })).toBeDisabled();

    rerender(
      <SettingsDrawer
        {...baseProps}
        settings={settings}
        canUpdatePwa
        isUpdatingPwa={false}
        onUpdatePwa={onUpdatePwa}
      />,
    );

    const updateButton = screen.getByRole("button", { name: "Update app" });
    expect(updateButton).toBeEnabled();
    await user.click(updateButton);
    expect(onUpdatePwa).toHaveBeenCalledTimes(1);
  });
});
