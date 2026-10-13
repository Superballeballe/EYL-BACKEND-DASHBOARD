"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, Dialog, DialogActions, IconButton, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeliveryForm, {
  DELIVERY_FORM_STEPS as STEPS,
  submitDeliveryForm,
  type DeliveryFormHandle,
} from "@/components/DeliveryForm";
import { DeliveryStepItems, DialogRail, RailGroup, railDialogSx } from "@/components/DialogRail";

type KnightOpt = { id: string; display_name: string };
type ClientOpt = {
  id: string;
  client_name: string;
  company_name: string | null;
  gst_no: string | null;
  address: string | null;
};
type RateTier = { min_km: number | null; max_km: number | null; fee: number | null };

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

  function handleCreate() {
    return submitDeliveryForm(formRef.current, FORM_ID, setStep);
  }

  return (
    <>
      <Button variant="contained" color="primary" onClick={() => setOpen(true)}>
        + New delivery
      </Button>

      <Dialog open={open} onClose={close} fullWidth maxWidth="lg" aria-labelledby="new-delivery-title">
        <Box sx={railDialogSx}>
          <DialogRail label="New delivery steps">
            <RailGroup title="New delivery">
              <DeliveryStepItems current={step} doneBefore={step} onSelect={goToStep} />
            </RailGroup>
          </DialogRail>

          <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, px: 3, pt: 3, pb: 2 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography id="new-delivery-title" component="h2" variant="h6">
                  New delivery
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.25 }}>
                  Step {step + 1} of {STEPS.length} · {STEPS[step]}
                </Typography>
              </Box>
              <IconButton aria-label="Close" onClick={close} sx={{ mt: -0.5, mr: -1 }}>
                <CloseIcon />
              </IconButton>
            </Box>

            <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 3, py: 2.5, borderTop: 1, borderColor: "divider" }}>
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

            <DialogActions sx={{ justifyContent: "space-between", pt: 2 }}>
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
          </Box>
        </Box>
      </Dialog>
    </>
  );
}
