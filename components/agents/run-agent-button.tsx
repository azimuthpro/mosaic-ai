"use client";

import { Loader2, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

interface RunAgentButtonProps {
  agentId: string;
}

export function RunAgentButton({ agentId }: RunAgentButtonProps) {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);

  async function handleRun() {
    setIsRunning(true);

    try {
      const response = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to run agent:", error);
    }

    setIsRunning(false);
  }

  return (
    <Button onClick={handleRun} disabled={isRunning}>
      {isRunning ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Play className="mr-2 h-4 w-4" />
      )}
      Run Now
    </Button>
  );
}
