"use client";

import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  deleteAgent,
  toggleAgentActive,
  updateAgent,
} from "@/lib/actions/agents";
import { LANGUAGES } from "@/lib/constants/languages";
import { getScheduleOptions } from "@/lib/utils";
import type { Agent, LanguageCode } from "@/types/database";

import { SkillsGallery } from "./skills-gallery";

interface AgentSettingsProps {
  agent: Agent;
}

export function AgentSettings({ agent }: AgentSettingsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description || "");
  const [systemPrompt, setSystemPrompt] = useState(agent.system_prompt);
  const [outputFormat, setOutputFormat] = useState(agent.output_format);
  const [language, setLanguage] = useState<LanguageCode>(
    agent.language || "en",
  );
  const [scheduleCron, setScheduleCron] = useState(agent.schedule_cron || "");
  const [isActive, setIsActive] = useState(agent.is_active);
  const [showSkillsGallery, setShowSkillsGallery] = useState(false);

  const scheduleOptions = getScheduleOptions();

  async function handleSave() {
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    formData.append("systemPrompt", systemPrompt);
    formData.append("outputFormat", outputFormat);
    formData.append("language", language);
    formData.append("scheduleCron", scheduleCron);
    formData.append("isActive", String(isActive));

    const result = await updateAgent(agent.id, formData);

    if (result?.error) {
      setError(result.error);
    } else {
      router.refresh();
    }

    setIsLoading(false);
  }

  async function handleToggleActive() {
    const result = await toggleAgentActive(agent.id);
    if (result?.success) {
      setIsActive(result.isActive);
      router.refresh();
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    await deleteAgent(agent.id);
    // Redirect happens in server action
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Agent Settings</CardTitle>
          <CardDescription>
            Configure your agent&apos;s behavior.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="systemPrompt">Instructions</Label>
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
            <Textarea
              id="systemPrompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="min-h-[120px]"
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
                onValueChange={(v) => setOutputFormat(v as typeof outputFormat)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="list">List</SelectItem>
                  <SelectItem value="table">Table</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="schedule">Schedule</Label>
            <Select value={scheduleCron} onValueChange={setScheduleCron}>
              <SelectTrigger>
                <SelectValue placeholder="Select schedule" />
              </SelectTrigger>
              <SelectContent>
                {scheduleOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value || "manual"}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant={isActive ? "outline" : "default"}
            onClick={handleToggleActive}
          >
            {isActive ? "Pause Agent" : "Activate Agent"}
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </CardFooter>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible actions. Proceed with caution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Agent
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Agent</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete &quot;{agent.name}&quot;? This
                  will also delete all associated sources, jobs, and reports.
                  This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <SkillsGallery
        open={showSkillsGallery}
        onOpenChange={setShowSkillsGallery}
        onSelect={(prompt) => {
          setSystemPrompt(prompt);
          setShowSkillsGallery(false);
        }}
      />
    </div>
  );
}
