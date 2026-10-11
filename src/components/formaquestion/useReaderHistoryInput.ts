import { useEffect, useRef, type RefObject } from 'react';

/** The mouse's back and forward buttons, as a `MouseEvent.button` names them. */
const MOUSE_BACK = 3;
const MOUSE_FORWARD = 4;

/**
 * Alt+Left and Alt+Right, and the mouse back and forward buttons, step the reader's history while the
 * input is in the help window or the full-screen Guide. The mouse buttons are swallowed there, so they
 * never reach the browser's own history, even where the history has no entry that way.
 */
export function useReaderHistoryInput({ enabled, windowRef, guideOpen, onStep }: {
  enabled: boolean;
  windowRef: RefObject<HTMLElement | null>;
  /** The full-screen Guide is open. It is modal, so all input is in it. */
  guideOpen: boolean;
  onStep: (delta: -1 | 1) => void;
}) {
  const step = useRef(onStep);
  useEffect(() => { step.current = onStep; });

  useEffect(() => {
    if (!enabled) return;
    const inKeyScope = () => guideOpen || !!windowRef.current?.contains(document.activeElement);
    const inMouseScope = (target: EventTarget | null) => guideOpen || (target instanceof Node && !!windowRef.current?.contains(target));

    const onKey = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (!inKeyScope()) return;
      event.preventDefault();
      // A held key repeats. One press is one step.
      if (!event.repeat) step.current(event.key === 'ArrowLeft' ? -1 : 1);
    };
    // The browser steps its own history on the button's release, so the release is the press to stop. The
    // press and the aux click are stopped too, so no layer between sees the button.
    const onMouse = (event: MouseEvent) => {
      if (event.button !== MOUSE_BACK && event.button !== MOUSE_FORWARD) return;
      if (!inMouseScope(event.target)) return;
      event.preventDefault();
      if (event.type === 'mouseup') step.current(event.button === MOUSE_BACK ? -1 : 1);
    };

    // Capture: a prompt field stops keydown from bubbling.
    window.addEventListener('keydown', onKey, true);
    const mouseTypes = ['mousedown', 'mouseup', 'auxclick'] as const;
    mouseTypes.forEach((type) => window.addEventListener(type, onMouse, true));
    return () => {
      window.removeEventListener('keydown', onKey, true);
      mouseTypes.forEach((type) => window.removeEventListener(type, onMouse, true));
    };
  }, [enabled, windowRef, guideOpen]);
}
