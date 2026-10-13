import type { KeyboardEvent } from "react";

/**
 * Makes a clickable card behave like a button from the keyboard: Enter or Space on the card itself
 * runs `activate`. Keys pressed on the buttons inside the card are left alone.
 */
export function activateOnKey(event: KeyboardEvent<HTMLElement>, activate: () => void) {
  if (event.target !== event.currentTarget) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  activate();
}
