import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NetworkScanDialog from "@/components/NetworkScanDialog";

describe("NetworkScanDialog", () => {
  const renderDialog = (overrides?: Partial<ComponentProps<typeof NetworkScanDialog>>) => {
    const props: ComponentProps<typeof NetworkScanDialog> = {
      open: true,
      onOpenChange: vi.fn(),
      isScanning: false,
      scanError: "",
      items: [],
      configuredHostUrls: [],
      addedHostUrls: [],
      onScan: vi.fn(),
      onAddHost: vi.fn(),
      ...overrides,
    };
    render(<NetworkScanDialog {...props} />);
    return props;
  };

  it("shows 4 ip boxes on not-found state and scans using combined ip", async () => {
    const user = userEvent.setup();
    const { onScan } = renderDialog({
      scanError: "No active host found",
      items: [],
    });

    const seg1 = screen.getByLabelText("IP segment 1");
    const seg2 = screen.getByLabelText("IP segment 2");
    const seg3 = screen.getByLabelText("IP segment 3");
    const seg4 = screen.getByLabelText("IP segment 4");

    await user.type(seg1, "192");
    await user.type(seg2, "168");
    await user.type(seg3, "1");
    await user.type(seg4, "45");

    await user.click(screen.getByRole("button", { name: "Rescan Network" }));
    expect(onScan).toHaveBeenCalledWith("192.168.1.45");
  });

  it("moves focus to next ip box on Enter", async () => {
    const user = userEvent.setup();
    renderDialog({ scanError: "No active host found", items: [] });
    const seg1 = screen.getByLabelText("IP segment 1");
    const seg2 = screen.getByLabelText("IP segment 2");

    seg1.focus();
    await user.keyboard("{Enter}");
    expect(seg2).toHaveFocus();
  });

  it("renders default ready state and triggers normal scan", async () => {
    const user = userEvent.setup();
    const { onScan } = renderDialog();

    expect(screen.getByText("Ready to scan")).toBeInTheDocument();
    expect(screen.getByText("Add IP range (optional)")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Scan Network" }));
    expect(onScan).toHaveBeenCalledWith("");
  });

  it("renders scanning state and does not show scan action button", () => {
    const { onScan } = renderDialog({ isScanning: true });
    expect(screen.getByText("Searching network...")).toBeInTheDocument();
    expect(screen.getByLabelText("IP segment 1")).toBeDisabled();
    expect(screen.getByLabelText("IP segment 2")).toBeDisabled();
    expect(screen.getByLabelText("IP segment 3")).toBeDisabled();
    expect(screen.getByLabelText("IP segment 4")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Scan Network" })).not.toBeInTheDocument();
    expect(onScan).not.toHaveBeenCalled();
  });

  it("renders results list and supports add action state", async () => {
    const user = userEvent.setup();
    const { onAddHost } = renderDialog({
      items: [
        { url: "http://10.0.0.2:11434", modelCount: 2 },
        { url: "http://10.0.0.3:11434", modelCount: 1 },
      ],
      configuredHostUrls: ["http://10.0.0.2:11434"],
    });

    expect(screen.getByText("Scan complete")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Added" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(onAddHost).toHaveBeenCalledWith("http://10.0.0.3:11434");
  });
});
