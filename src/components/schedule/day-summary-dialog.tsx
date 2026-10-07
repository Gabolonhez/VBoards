"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import { DaySummaryMode } from "@/lib/schedule";
import { cn } from "@/lib/utils";

const MODES: DaySummaryMode[] = ["done", "doing", "both"];

interface DaySummaryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Generated summary for the current mode; empty when there is nothing to report */
    summary: string;
    mode: DaySummaryMode;
    onModeChange: (mode: DaySummaryMode) => void;
}

export function DaySummaryDialog({ open, onOpenChange, summary, mode, onModeChange }: DaySummaryDialogProps) {
    const { t } = useLanguage();
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px]">
                <DialogHeader>
                    <DialogTitle>{t("schedule.summary_title")}</DialogTitle>
                    <DialogDescription>{t("schedule.summary_description")}</DialogDescription>
                </DialogHeader>

                <div role="radiogroup" aria-label={t("schedule.summary_title")} className="flex gap-1 rounded-md bg-muted p-1 w-fit">
                    {MODES.map((m) => (
                        <button
                            key={m}
                            type="button"
                            role="radio"
                            aria-checked={mode === m}
                            onClick={() => onModeChange(m)}
                            className={cn(
                                "px-3 py-1 rounded text-xs font-medium transition-colors",
                                mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {t(`schedule.summary_mode_${m}`)}
                        </button>
                    ))}
                </div>

                {/* Content unmounts on close and remounts per mode, so edits never leak into a regenerated summary */}
                <SummaryBody key={mode} summary={summary} mode={mode} onClose={() => onOpenChange(false)} />
            </DialogContent>
        </Dialog>
    );
}

function SummaryBody({ summary, mode, onClose }: { summary: string; mode: DaySummaryMode; onClose: () => void }) {
    const { t } = useLanguage();
    const { toast } = useToast();
    const [text, setText] = useState(summary);
    const [copied, setCopied] = useState(false);

    async function copy() {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            console.error(e);
            toast({ title: t("common.error"), description: t("schedule.summary_copy_error"), variant: "destructive" });
        }
    }

    return (
        <>
            {summary ? (
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    title={t("schedule.summary_title")}
                    aria-label={t("schedule.summary_title")}
                    className="w-full min-h-[300px] max-h-[60vh] rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-y"
                />
            ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">{t(`schedule.summary_empty_${mode}`)}</p>
            )}

            <DialogFooter>
                <Button variant="ghost" onClick={onClose}>
                    {t("common.cancel")}
                </Button>
                <Button onClick={copy} disabled={!summary || !text.trim()}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? t("schedule.summary_copied") : t("schedule.summary_copy")}
                </Button>
            </DialogFooter>
        </>
    );
}
