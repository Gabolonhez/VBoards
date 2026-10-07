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

interface DaySummaryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Generated summary; empty when nothing was completed that day */
    summary: string;
}

export function DaySummaryDialog({ open, onOpenChange, summary }: DaySummaryDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px]">
                {/* Content unmounts on close, so each open starts from a freshly generated summary */}
                <SummaryBody summary={summary} onClose={() => onOpenChange(false)} />
            </DialogContent>
        </Dialog>
    );
}

function SummaryBody({ summary, onClose }: { summary: string; onClose: () => void }) {
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
            <DialogHeader>
                <DialogTitle>{t("schedule.summary_title")}</DialogTitle>
                <DialogDescription>{t("schedule.summary_description")}</DialogDescription>
            </DialogHeader>

            {summary ? (
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    title={t("schedule.summary_title")}
                    aria-label={t("schedule.summary_title")}
                    className="w-full min-h-[300px] max-h-[60vh] rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-y"
                />
            ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">{t("schedule.summary_empty")}</p>
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
