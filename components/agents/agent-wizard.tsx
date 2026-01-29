"use client";

import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  Globe,
  Loader2,
  Search,
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

type Step = "sources" | "instructions" | "schedule" | "review";

const steps: { id: Step; title: string }[] = [
  { id: "sources", title: "Sources" },
  { id: "instructions", title: "Instructions" },
  { id: "schedule", title: "Schedule" },
  { id: "review", title: "Review" },
];

function generateDefaultName(): string {
  const date = new Date();
  const month = date.toLocaleString("en-US", { month: "short" });
  const day = date.getDate();
  return `Agent ${month} ${day}`;
}

interface Source {
  type: SourceType;
  url: string;
  name: string;
  sourceReferenceId?: string;
  agentName?: string; // For display purposes
  // Web search fields
  searchQuery?: string;
  searchDepth?: "basic" | "advanced";
  maxResults?: number;
}

function getStepIndicatorClass(
  index: number,
  currentStepIndex: number,
): string {
  const isCompleteOrActive = index <= currentStepIndex;
  return isCompleteOrActive
    ? "bg-primary text-primary-foreground"
    : "bg-muted text-muted-foreground";
}

function getSourceDisplayName(source: Source): string {
  if (source.name) {
    return source.name;
  }

  switch (source.type) {
    case "agent_report":
      return source.agentName ?? "Agent Report";
    case "web_search":
      if (source.searchQuery) {
        return `Search: ${source.searchQuery}`;
      }
      return "Web Search";
    case "url":
      if (source.url) {
        try {
          return new URL(source.url).hostname;
        } catch {
          return source.url;
        }
      }
      return "URL";
  }
}

const SOURCE_ICONS = {
  agent_report: Bot,
  web_search: Search,
  url: Globe,
} as const;

type SourceIcon = (typeof SOURCE_ICONS)[SourceType];

function getSourceIcon(type: SourceType): SourceIcon {
  return SOURCE_ICONS[type];
}

export function AgentWizard(): React.ReactElement {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>("sources");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state - name is auto-generated, editable in settings after creation
  const [name] = useState(generateDefaultName);
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
    field:
      | "url"
      | "name"
      | "type"
      | "sourceReferenceId"
      | "agentName"
      | "searchQuery"
      | "searchDepth"
      | "maxResults",
    value: string | number,
  ): void {
    const updated = [...sources];
    if (field === "type") {
      updated[index] = {
        type: value as SourceType,
        url: "",
        name: updated[index].name,
        searchQuery: "",
        searchDepth: "basic",
        maxResults: 5,
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

    // Transform sources to include config for web_search type
    const transformedSources = sources.filter(isValidSource).map((s) => {
      if (s.type === "web_search") {
        return {
          ...s,
          config: {
            query: s.searchQuery,
            search_depth: s.searchDepth || "basic",
            max_results: s.maxResults || 5,
          },
        };
      }
      return s;
    });

    const formData = new FormData();
    formData.append("name", name);
    formData.append("systemPrompt", systemPrompt);
    formData.append("outputFormat", outputFormat);
    formData.append("language", language);
    formData.append("scheduleCron", scheduleCron);
    formData.append("sources", JSON.stringify(transformedSources));

    const result = await createAgent(formData);

    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
    }
    // Redirect happens in the server action
  }

  function isValidSource(s: Source): boolean {
    if (s.type === "url") return s.url.trim().length > 0;
    if (s.type === "web_search") return Boolean(s.searchQuery?.trim());
    return Boolean(s.sourceReferenceId);
  }

  function canProceed(): boolean {
    switch (currentStep) {
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
      return;
    }
    goBack();
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

        {/* Step: Sources */}
        {currentStep === "sources" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Add sources for this agent to monitor. You can use web URLs, web
              search, or reports from other agents.
            </p>
            {sources.map((source, index) => (
              <div
                key={index}
                className="space-y-2 rounded-lg border p-3 bg-muted/30"
              >
                <div className="flex flex-wrap gap-2">
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
                      source.type === "web_search" ? "default" : "outline"
                    }
                    onClick={() => updateSource(index, "type", "web_search")}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Web Search
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
                <div className="space-y-2">
                  {source.type === "url" && (
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Input
                          placeholder="https://example.com/page"
                          value={source.url}
                          onChange={(e) =>
                            updateSource(index, "url", e.target.value)
                          }
                        />
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
                  )}
                  {source.type === "web_search" && (
                    <>
                      <Input
                        placeholder="Search query (e.g., latest AI developments)"
                        value={source.searchQuery || ""}
                        onChange={(e) =>
                          updateSource(index, "searchQuery", e.target.value)
                        }
                      />
                      <div className="flex gap-2">
                        <Select
                          value={source.searchDepth || "basic"}
                          onValueChange={(v) =>
                            updateSource(index, "searchDepth", v)
                          }
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="basic">Basic Search</SelectItem>
                            <SelectItem value="advanced">
                              Deep Search
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={String(source.maxResults || 5)}
                          onValueChange={(v) =>
                            updateSource(index, "maxResults", Number(v))
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[3, 5, 7, 10].map((n) => (
                              <SelectItem key={n} value={String(n)}>
                                {n} results
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                    </>
                  )}
                  {source.type === "agent_report" && (
                    <div className="flex gap-2">
                      <div className="flex-1">
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
                  )}
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
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
                onClick={() => addSource("web_search")}
              >
                <Search className="mr-2 h-4 w-4" />
                Add Search
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

                  return (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 ${isSelected ? "border-primary bg-primary/5" : ""}`}
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
                        className={`h-4 w-4 rounded-full border-2 ${isSelected ? "border-primary bg-primary" : "border-muted-foreground"}`}
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
                  {validSources.map((source, i) => {
                    const Icon = getSourceIcon(source.type);
                    return (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        <Icon className="h-3 w-3" />
                        {getSourceDisplayName(source)}
                      </Badge>
                    );
                  })}
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
