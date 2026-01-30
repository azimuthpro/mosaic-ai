"use client";

import { useCallback, useEffect, useState } from "react";

import { soundManager } from "@/lib/sounds/sound-manager";

interface UseSoundReturn {
  playEmptyClick: () => void;
  playTileClick: () => void;
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
  isReady: boolean;
}

export function useSound(): UseSoundReturn {
  const [isReady, setIsReady] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    // Initialize sound manager on first user interaction
    const initOnInteraction = () => {
      soundManager.initialize().then(() => {
        setIsReady(true);
      });
      // Remove listeners after first interaction
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

  const playEmptyClick = useCallback(() => {
    if (isEnabled) {
      soundManager.playEmptyClick();
    }
  }, [isEnabled]);

  const playTileClick = useCallback(() => {
    if (isEnabled) {
      soundManager.playTileClick();
    }
  }, [isEnabled]);

  const setEnabled = useCallback((enabled: boolean) => {
    setIsEnabled(enabled);
    soundManager.setEnabled(enabled);
  }, []);

  return {
    playEmptyClick,
    playTileClick,
    isEnabled,
    setEnabled,
    isReady,
  };
}
