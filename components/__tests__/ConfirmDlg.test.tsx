import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfirmDlg from "@/components/ConfirmDlg";

describe("ConfirmDlg", () => {
  it("renders cancel + confirm and fires onConfirm", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <ConfirmDlg
        open
        onOpenChange={vi.fn()}
        title="Delete chat?"
        description="This chat will be removed."
        confirmText="Delete"
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Delete chat?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("supports hideCancel and custom confirm class", () => {
    render(
      <ConfirmDlg
        open
        onOpenChange={vi.fn()}
        title="Confirm"
        description="Proceed"
        confirmText="Delete"
        confirmClassName="bg-destructive text-destructive-foreground"
        hideCancel
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" }).className).toContain(
      "bg-destructive",
    );
  });
});

