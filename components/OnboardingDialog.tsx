import React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface OnboardingStep {
  title: string;
  description: string;
}

interface OnboardingDialogProps {
  open: boolean;
  onboardingStep: number;
  onboardingSteps: OnboardingStep[];
  publicBasePath: string;
  onBack: () => void;
  onNext: () => void;
  onFinish: () => void;
}

export default function OnboardingDialog({
  open,
  onboardingStep,
  onboardingSteps,
  publicBasePath,
  onBack,
  onNext,
  onFinish,
}: OnboardingDialogProps) {
  const isLastOnboardingStep = onboardingStep === onboardingSteps.length - 1;

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-md"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <img
            src={`${publicBasePath}/logo-black.png`}
            alt="Multi Llama Chat logo"
            className="h-12 w-12 object-contain mx-auto sm:mx-0 dark:hidden"
          />
          <img
            src={`${publicBasePath}/logo.png`}
            alt="Multi Llama Chat logo"
            className="hidden h-12 w-12 object-contain mx-auto sm:mx-0 dark:block"
          />
          <DialogTitle>{onboardingSteps[onboardingStep].title}</DialogTitle>
          <DialogDescription>
            {onboardingSteps[onboardingStep].description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Step {onboardingStep + 1} of {onboardingSteps.length}
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: `${((onboardingStep + 1) / onboardingSteps.length) * 100}%`,
              }}
            />
          </div>

          {onboardingStep === onboardingSteps.length - 1 && (
            <div className="rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground leading-relaxed">
              If Ollama is not running locally, open Settings and set a remote
              Ollama URL.
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={onBack} disabled={onboardingStep === 0}>
            Back
          </Button>

          <Button onClick={isLastOnboardingStep ? onFinish : onNext}>
            {isLastOnboardingStep ? "Finish" : "Next"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
