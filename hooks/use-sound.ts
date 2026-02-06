"use client";

import { useCallback, useEffect, useState } from "react";

import { soundManager } from "@/lib/sounds/sound-manager";

interface UseSoundReturn {
  playClick: () => void;
  playStop: () => void;
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
  isReady: boolean;
}

export function useSound(): UseSoundReturn {
  const [isReady, setIsReady] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    const initOnInteraction = () => {
      soundManager.initialize();
      setIsReady(true);
      document.removeEventListener("click", initOnInteraction);
      document.removeEventListener("keydown", initOnInteraction);
      document.removeEventListener("touchstart", initOnInteraction);
    };

    document.addEventListener("click", initOnInteraction);
    document.addEventListener("keydown", initOnInteraction);
    document.addEventListener("touchstart", initOnInteraction);

    return () => {
      document.removeEventListener("click", initOnInteraction);
      document.removeEventListener("keydown", initOnInteraction);
      document.removeEventListener("touchstart", initOnInteraction);
    };
  }, []);

  const playClick = useCallback(() => {
    if (isEnabled) {
      soundManager.playClick();
    }
  }, [isEnabled]);

  const playStop = useCallback(() => {
    if (isEnabled) {
      soundManager.playStop();
    }
  }, [isEnabled]);

  const setEnabled = useCallback((enabled: boolean) => {
    setIsEnabled(enabled);
    soundManager.setEnabled(enabled);
  }, []);

  return {
    playClick,
    playStop,
    isEnabled,
    setEnabled,
    isReady,
  };
}
