import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ConfirmDialogBoxProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  loading?: boolean;
  closeOnConfirm?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

const ConfirmDialogBox = ({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  loading = false,
  closeOnConfirm = true,
  onConfirm,
  onCancel,
}: ConfirmDialogBoxProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isConfirmDisabled = loading || isSubmitting;

  const handleConfirm = async () => {
    if (isConfirmDisabled) return;

    setIsSubmitting(true);
    try {
      await onConfirm();
      if (closeOnConfirm) onOpenChange?.(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const destructiveClassName =
    variant === "destructive"
      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
      : undefined;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger ? (
        <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      ) : null}

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            className={destructiveClassName}
            onClick={handleConfirm}
          >
            {isConfirmDisabled ? "Processing..." : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export type { ConfirmDialogBoxProps };
export default ConfirmDialogBox;
