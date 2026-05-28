"use client";

import { Button } from "@/components/ui/button";

interface CatalogPagerProps {
  page: number;
  totalPages: number;
  total: number;
  label: string;
  onPrev: () => void;
  onNext: () => void;
}

export function CatalogPager({
  page,
  totalPages,
  total,
  label,
  onPrev,
  onNext,
}: CatalogPagerProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
      <p className="text-xs text-muted-foreground">
        Page {page} of {totalPages} ({total} {label})
      </p>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrev}
          disabled={page === 1}
        >
          Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={page === totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
