import { useCallback, useEffect, useRef, useState } from 'react';
import useSafeEffect from 'use-safe-effect-hook';

export function useCallbackInNextRender() {
  const [cb, setCb] = useState(null);

  useSafeEffect(
    (safetyGuard) => {
      if (!cb) return;
      const [callback, args] = cb;
      callback(safetyGuard, ...args);
      // setCb(null);
    },
    [cb]
  );

  return useCallback((callback, ...args) => {
    setCb([callback, args]);
  }, []);
}

export function useWarnOnChanged(name, value) {
  const original = useRef(value);

  useEffect(() => {
    if (original.current !== value)
      console.warn(
        `property ${name} should not be changed from ${original.current} to ${value}`
      );
  });
}
