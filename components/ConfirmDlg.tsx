import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDlgProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  confirmClassName?: string;
  cancelText?: string;
  hideCancel?: boolean;
  onConfirm: () => void;
}

export default function ConfirmDlg({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  confirmClassName,
  cancelText = "Cancel",
  hideCancel = false,
  onConfirm,
}: ConfirmDlgProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {!hideCancel ? <AlertDialogCancel>{cancelText}</AlertDialogCancel> : null}
          <AlertDialogAction className={confirmClassName} onClick={onConfirm}>
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
