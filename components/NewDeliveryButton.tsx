"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Step,
  StepButton,
  Stepper,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeliveryForm, { type DeliveryFormHandle } from "@/components/DeliveryForm";

type KnightOpt = { id: string; display_name: string };
type ClientOpt = {
  id: string;
  client_name: string;
  company_name: string | null;
  gst_no: string | null;
  address: string | null;
};
type RateTier = { min_km: number | null; max_km: number | null; fee: number | null };

const STEPS = ["Booking", "Route", "Assignment", "Payment", "Billing"] as const;
const FORM_ID = "new-delivery-form";

export default function NewDeliveryButton({
  knights,
  clients,
  rateTiers,
  defaultOpen = false,
}: {
  knights: KnightOpt[];
  clients: ClientOpt[];
  rateTiers: RateTier[];
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<DeliveryFormHandle>(null);
  const [open, setOpen] = useState(defaultOpen);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  function close() {
    setOpen(false);
    setStep(0);
    if (defaultOpen) {
      router.replace("/deliveries", { scroll: false });
    }
  }

  function handleSaved() {
    close();
    router.refresh();
  }

  const isLast = step === STEPS.length - 1;

  async function goNext() {
    const ok = (await formRef.current?.validateStep(step)) ?? true;
    if (!ok) return;
    setStep((s) => s + 1);
  }

  function goToStep(index: number) {
    setStep(index);
  }

  async function handleCreate() {
    const result = await formRef.current?.validateAllSteps();
    if (!result?.ok) {
      if (result?.firstInvalidStep != null) setStep(result.firstInvalidStep);
      return;
    }
    const form = document.getElementById(FORM_ID);
    if (form instanceof HTMLFormElement) form.requestSubmit();
  }

  return (
    <>
      <Button variant="contained" color="primary" onClick={() => setOpen(true)}>
        + New delivery
      </Button>

      <Dialog open={open} onClose={close} fullWidth maxWidth="md">
        <DialogTitle sx={{ pr: 6 }}>
          New delivery
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.25, fontWeight: 400 }}>
            Step {step + 1} of {STEPS.length} · {STEPS[step]}
          </Typography>
          <IconButton
            aria-label="Close"
            onClick={close}
            sx={{ position: "absolute", right: 12, top: 12 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ pt: 2 }}>
          <Stepper activeStep={step} nonLinear alternativeLabel sx={{ mb: 3, display: { xs: "none", sm: "flex" } }}>
            {STEPS.map((label, index) => (
              <Step key={label} completed={index < step}>
                <StepButton color="inherit" onClick={() => goToStep(index)}>
                  {label}
                </StepButton>
              </Step>
            ))}
          </Stepper>

          <Box sx={{ maxHeight: "min(60vh, 520px)", overflowY: "auto", pr: 0.5 }}>
            <DeliveryForm
              ref={formRef}
              mode="new"
              variant="modal"
              wizardStep={step}
              hideActions
              formId={FORM_ID}
              knights={knights}
              clients={clients}
              rateTiers={rateTiers}
              onSaved={handleSaved}
              onCancel={close}
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, justifyContent: "space-between" }}>
          <Button variant="outlined" onClick={close}>
            Cancel
          </Button>
          <Box sx={{ display: "flex", gap: 1 }}>
            {step > 0 ? (
              <Button variant="outlined" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            ) : null}
            {!isLast ? (
              <Button variant="contained" onClick={goNext}>
                Next
              </Button>
            ) : (
              <Button variant="contained" onClick={handleCreate}>
                Create delivery
              </Button>
            )}
          </Box>
        </DialogActions>
      </Dialog>
    </>
  );
}
