import { useAlert } from "@/Components/HorusPrompt/horus_alert";
import { useConfirm } from "@/Components/HorusPrompt/horus_confirm";
import { usePrompt } from "@/Components/HorusPrompt/horus_prompt";
import { useEffect } from "react";

export function OverrideAlert({ children }: { children: React.ReactNode }) {
  const horusAlert = useAlert();
  const horusConfirm = useConfirm();
  const horusPromt = usePrompt();

  useEffect(() => {
    window.alert = horusAlert as any;
    window.confirm = horusConfirm as any;
    window.prompt = horusPromt as any;
  }, [horusAlert, horusConfirm, horusPromt]);

  return children;
}
