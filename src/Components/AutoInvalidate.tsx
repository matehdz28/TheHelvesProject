import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";

export default function AutoInvalidate({ active, clip }: { active: boolean; clip: string | null }) {
  const { invalidate } = useThree();
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (active) {
      const loop = () => {
        invalidate(); // ~60fps mientras está activo
        raf.current = requestAnimationFrame(loop);
      };
      raf.current = requestAnimationFrame(loop);
      return () => {
        if (raf.current) cancelAnimationFrame(raf.current);
        raf.current = null;
      };
    } else {
      // no activo: invalida una vez cuando cambie el clip
      invalidate();
    }
  }, [active, clip, invalidate]);

  return null;
}