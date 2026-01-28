"use client";

import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  Globe,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createAgent,
  getUserAgentsForSourceSelection,
} from "@/lib/actions/agents";
import { LANGUAGES } from "@/lib/constants/languages";
import { getScheduleOptions } from "@/lib/utils";
import type { LanguageCode, OutputFormat, SourceType } from "@/types/database";

import { SkillsGallery } from "./skills-gallery";

type Step = "basics" | "sources" | "instructions" | "schedule" | "review";

const steps: { id: Step; title: string }[] = [
  { id: "basics", title: "Basic Info" },
  { id: "sources", title: "Sources" },
  { id: "instructions", title: "Instructions" },
  { id: "schedule", title: "Schedule" },
  { id: "review", title: "Review" },
];

interface Source {
  type: SourceType;
  url: string;
  name: string;
  sourceReferenceId?: string;
  agentName?: string; // For display purposes
}

function getStepIndicatorClass(
  index: number,
  currentStepIndex: number,
): string {
  if (index <= currentStepIndex) {
    return "bg-primary text-primary-foreground";
  }
  return "bg-muted text-muted-foreground";
}

function getSourceDisplayName(source: Source): string {
  if (source.name) return source.name;
  if (source.type === "agent_report" && source.agentName) return source.agentName;
  if (source.type === "url" && source.url) {
    try {
      return new URL(source.url).hostname;
    } catch {
      return source.url;
    }
  }
  return source.type === "agent_report" ? "Agent Report" : "URL";
}

export function AgentWizard(): React.ReactElement {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>("basics");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [sources, setSources] = useState<Source[]>([
    { type: "url", url: "", name: "" },
  ]);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("text");
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [scheduleCron, setScheduleCron] = useState("");
  const [showSkillsGallery, setShowSkillsGallery] = useState(false);
  const [availableAgents, setAvailableAgents] = useState<
    { id: string; name: string }[]
  >([]);

  // Load available agents when on sources step
  useEffect(() => {
    if (currentStep === "sources") {
      let cancelled = false;
      getUserAgentsForSourceSelection().then((agents) => {
        if (!cancelled) {
          setAvailableAgents(agents);
        }
      });
      return () => {
        cancelled = true;
      };
    }
  }, [currentStep]);

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;
  const scheduleOptions = getScheduleOptions();

  function goNext(): void {
    if (!isLastStep) {
      setCurrentStep(steps[currentStepIndex + 1].id);
    }
  }

  function goBack(): void {
    if (!isFirstStep) {
      setCurrentStep(steps[currentStepIndex - 1].id);
    }
  }

  function addSource(type: SourceType = "url"): void {
    setSources([...sources, { type, url: "", name: "" }]);
  }

  function removeSource(index: number): void {
    setSources(sources.filter((_, i) => i !== index));
  }

  function updateSource(
    index: number,
    field: "url" | "name" | "type" | "sourceReferenceId" | "agentName",
    value: string,
  ): void {
    const updated = [...sources];
    if (field === "type") {
      updated[index] = {
        type: value as SourceType,
        url: "",
        name: updated[index].name,
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setSources(updated);
  }

  function updateAgentSource(
    index: number,
    agentId: string,
    agentName: string,
  ): void {
    const updated = [...sources];
    updated[index] = {
      ...updated[index],
      sourceReferenceId: agentId,
      agentName,
    };
    setSources(updated);
  }

  async function handleSubmit(): Promise<void> {
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("name", name);
    formData.append("systemPrompt", systemPrompt);
    formData.append("outputFormat", outputFormat);
    formData.append("language", language);
    formData.append("scheduleCron", scheduleCron);
    formData.append("sources", JSON.stringify(sources.filter(isValidSource)));

    const result = await createAgent(formData);

    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
    }
    // Redirect happens in the server action
  }

  function isValidSource(s: Source): boolean {
    if (s.type === "url") return s.url.trim().length > 0;
    return Boolean(s.sourceReferenceId);
  }

  function canProceed(): boolean {
    switch (currentStep) {
      case "basics":
        return name.trim().length > 0;
      case "sources":
        return sources.some(isValidSource);
      case "instructions":
        return systemPrompt.trim().length > 0;
      case "schedule":
      case "review":
        return true;
    }
  }

  function handleBackClick(): void {
    if (isFirstStep) {
      router.back();
    } else {
      goBack();
    }
  }

  const validSources = sources.filter(isValidSource);
  const selectedScheduleLabel =
    scheduleOptions.find((o) => o.value === scheduleCron)?.label ?? "Manual";

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create New Agent</CardTitle>
        <CardDescription>
          Set up an intelligent agent to gather and analyze web content.
        </CardDescription>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 pt-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${getStepIndicatorClass(index, currentStepIndex)}`}
              >
                {index < currentStepIndex ? (
                  <Check className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`h-0.5 w-8 ${index < currentStepIndex ? "bg-primary" : "bg-muted"}`}
                />
              )}
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Step: Basics */}
        {currentStep === "basics" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Agent Name *</Label>
              <Input
                id="name"
                placeholder="My News Monitor"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Step: Sources */}
        {currentStep === "sources" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Add sources for this agent to monitor. You can use web URLs or
              reports from other agents.
            </p>
            {sources.map((source, index) => (
              <div
                key={index}
                className="space-y-2 rounded-lg border p-3 bg-muted/30"
              >
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={source.type === "url" ? "default" : "outline"}
                    onClick={() => updateSource(index, "type", "url")}
                  >
                    <Globe className="mr-2 h-4 w-4" />
                    Web URL
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={
                      source.type === "agent_report" ? "default" : "outline"
                    }
                    onClick={() => updateSource(index, "type", "agent_report")}
                    disabled={availableAgents.length === 0}
                  >
                    <Bot className="mr-2 h-4 w-4" />
                    Agent Report
                  </Button>
                  {sources.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="ml-auto"
                      onClick={() => removeSource(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    {source.type === "url" ? (
                      <Input
                        placeholder="https://example.com/page"
                        value={source.url}
                        onChange={(e) =>
                          updateSource(index, "url", e.target.value)
                        }
                      />
                    ) : (
                      <Select
                        value={source.sourceReferenceId || ""}
                        onValueChange={(value) => {
                          const agent = availableAgents.find(
                            (a) => a.id === value,
                          );
                          if (agent) {
                            updateAgentSource(index, agent.id, agent.name);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              availableAgents.length === 0
                                ? "No agents available"
                                : "Select an agent"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {availableAgents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="w-32">
                    <Input
                      placeholder="Label"
                      value={source.name}
                      onChange={(e) =>
                        updateSource(index, "name", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addSource("url")}
              >
                <Globe className="mr-2 h-4 w-4" />
                Add URL
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addSource("agent_report")}
                disabled={availableAgents.length === 0}
              >
                <Bot className="mr-2 h-4 w-4" />
                Add Agent
              </Button>
            </div>
          </div>
        )}

        {/* Step: Instructions */}
        {currentStep === "instructions" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="systemPrompt">Instructions *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSkillsGallery(true)}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Browse Skills
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Tell the AI what to look for and how to analyze the content.
              </p>
              <Textarea
                id="systemPrompt"
                placeholder="Extract the main headlines and summarize any breaking news..."
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="min-h-[150px]"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Select
                  value={language}
                  onValueChange={(v) => setLanguage(v as LanguageCode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="outputFormat">Report Format</Label>
                <Select
                  value={outputFormat}
                  onValueChange={(v) => setOutputFormat(v as OutputFormat)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text (paragraph)</SelectItem>
                    <SelectItem value="list">List (bullet points)</SelectItem>
                    <SelectItem value="table">
                      Table (structured data)
                    </SelectItem>
                    <SelectItem value="json">JSON (raw data)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Step: Schedule */}
        {currentStep === "schedule" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Schedule</Label>
              <p className="text-sm text-muted-foreground">
                Choose when this agent should run automatically.
              </p>
              <div className="grid gap-2">
                {scheduleOptions.map((option) => {
                  const isSelected = scheduleCron === option.value;
                  const labelClass = isSelected
                    ? "border-primary bg-primary/5"
                    : "";
                  const radioClass = isSelected
                    ? "border-primary bg-primary"
                    : "border-muted-foreground";

                  return (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 ${labelClass}`}
                    >
                      <input
                        type="radio"
                        name="schedule"
                        value={option.value}
                        checked={isSelected}
                        onChange={(e) => setScheduleCron(e.target.value)}
                        className="sr-only"
                      />
                      <div
                        className={`h-4 w-4 rounded-full border-2 ${radioClass}`}
                      />
                      <span>{option.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Step: Review */}
        {currentStep === "review" && (
          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3">
              <div>
                <span className="text-sm text-muted-foreground">Name</span>
                <p className="font-medium">{name}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Sources</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {validSources.map((source, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {source.type === "url" ? (
                        <Globe className="h-3 w-3" />
                      ) : (
                        <Bot className="h-3 w-3" />
                      )}
                      {getSourceDisplayName(source)}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">
                  Instructions
                </span>
                <p className="text-sm">{systemPrompt}</p>
              </div>
              <div className="flex gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">
                    Language
                  </span>
                  <p>
                    {LANGUAGES.find((l) => l.value === language)?.label ??
                      "English"}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Format</span>
                  <p>{outputFormat}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">
                    Schedule
                  </span>
                  <p>{selectedScheduleLabel}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button type="button" variant="outline" onClick={handleBackClick}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {isFirstStep ? "Cancel" : "Back"}
        </Button>
        {isLastStep ? (
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Agent
          </Button>
        ) : (
          <Button onClick={goNext} disabled={!canProceed()}>
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </CardFooter>

      <SkillsGallery
        open={showSkillsGallery}
        onOpenChange={setShowSkillsGallery}
        onSelect={(prompt) => {
          setSystemPrompt(prompt);
          setShowSkillsGallery(false);
        }}
      />
    </Card>
  );
}
