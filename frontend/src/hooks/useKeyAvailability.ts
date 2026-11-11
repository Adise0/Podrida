import { ErrorCode, FieldErrorCode } from "@podrida/shared";
import { useEffect, useState } from "react";
import { authApi } from "../api/auth";
import { isApiError } from "../api/client";

export type KeyAvailability = "idle" | "checking" | "available" | "taken";

const debounceMs = 450;

// What a field shows for each state.
export function availabilityMessages(availability: KeyAvailability, takenMessage: string) {
  return {
    error: availability === "taken" ? takenMessage : undefined,
    success: availability === "available" ? "Available" : undefined,
    hint: availability === "checking" ? "Checking…" : undefined,
  };
}

// Asks the API, as the user types, whether a username or email is still free. `skip` is for values
// that aren't worth asking about (invalid, or unchanged from the user's own).
export function useKeyAvailability(
  field: "email" | "username",
  value: string,
  skip = false,
): KeyAvailability {
  const [result, setResult] = useState<{ value: string; availability: KeyAvailability }>({
    value: "",
    availability: "idle",
  });

  const shouldCheck = !skip && value !== "";

  useEffect(() => {
    if (!shouldCheck) return undefined;

    let isCurrent = true;

    const timer = setTimeout(() => {
      authApi
        .checkKeys({ [field]: value })
        .then(() => {
          if (isCurrent) setResult({ value, availability: "available" });
        })
        .catch((error: unknown) => {
          if (!isCurrent) return;
          const isTaken =
            isApiError(error) &&
            error.code === ErrorCode.DUPLICATE_KEY &&
            error.body.fields?.[field] === FieldErrorCode.TAKEN;
          // Anything else (rate limited, offline) just isn't known: the submit will tell.
          setResult({ value, availability: isTaken ? "taken" : "idle" });
        });
    }, debounceMs);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [field, value, shouldCheck]);

  if (!shouldCheck) return "idle";
  return result.value === value ? result.availability : "checking";
}
