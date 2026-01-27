"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CheckCircle2, AlertCircle } from "lucide-react"
import { requestInvite } from "@/lib/actions/invite"

export function InviteForm() {
  const [email, setEmail] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSubmitted, setIsSubmitted] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    
    const result = await requestInvite(email)
    
    setIsLoading(false)
    
    if (result.error) {
      setError(result.error)
    } else {
      setIsSubmitted(true)
      setEmail("")
    }
  }

  if (isSubmitted) {
    return (
      <div className="flex items-center gap-2 text-green-600 font-medium py-2">
        <CheckCircle2 className="h-5 w-5" />
        <span>Request sent! We'll get back to you soon.</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-full max-w-sm gap-2">
      <form onSubmit={handleSubmit} className="flex w-full items-center space-x-2">
        <Input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="h-11"
          disabled={isLoading}
        />
        <Button type="submit" size="lg" disabled={isLoading}>
          {isLoading ? "Sending..." : "Request Invite"}
        </Button>
      </form>
      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm font-medium px-1">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
