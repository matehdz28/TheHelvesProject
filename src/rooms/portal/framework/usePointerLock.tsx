import { useEffect } from "react";

export const usePointerLock = (active: boolean, setLocked: (v:boolean)=>void, el: HTMLElement | null) => {
  useEffect(() => {
    if (!el) return;
    const onPLC = () => setLocked(document.pointerLockElement === el && active);
    const onKey = (e: KeyboardEvent) => {
      if (!active) return;
      if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        el.requestPointerLock?.().catch(()=>{});
      }
    };
    const onDown = () => {
      if (!active) return;
      el.requestPointerLock?.().catch(()=>{});
    };

    el.addEventListener("mousedown", onDown);
    document.addEventListener("pointerlockchange", onPLC);
    window.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("mousedown", onDown);
      document.removeEventListener("pointerlockchange", onPLC);
      window.removeEventListener("keydown", onKey);
    };
  }, [active, setLocked, el]);
};