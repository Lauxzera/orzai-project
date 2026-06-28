"use client";

import * as React from "react";
import { Phone, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  phone: string;
  contactName: string;
  canEdit: boolean;
  onCallInitiated: (note: string) => Promise<void>;
};

export function CallButton({ phone, contactName, canEdit, onCallInitiated }: Props) {
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  function formatDisplay(raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 13) {
      // +55 11 9 8765-4321
      return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 5)} ${digits.slice(5, 9)}-${digits.slice(9)}`;
    }
    if (digits.length === 12) {
      // +55 11 8765-4321
      return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
    }
    return `+${digits}`;
  }

  async function handleConfirm() {
    const finalNote = note.trim() || `Chamada WhatsApp para ${contactName}`;
    setLoading(true);
    setError("");
    try {
      await onCallInitiated(finalNote);
      const digits = phone.replace(/\D/g, "");
      window.open(`https://wa.me/${digits}`, "_blank", "noopener,noreferrer");
      setOpen(false);
      setNote("");
    } catch {
      setError("Não foi possível registrar a ligação. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (!canEdit) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 rounded-xl px-2.5 text-[11px] text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950"
        >
          <Phone className="h-3.5 w-3.5" />
          Ligar via WhatsApp
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <PhoneCall className="h-4 w-4" />
            </span>
            Ligar via WhatsApp
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-xl border bg-muted/40 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">Contato</p>
            <p className="mt-0.5 font-semibold">{contactName}</p>
            <p className="text-sm text-muted-foreground">{formatDisplay(phone)}</p>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Observação <span className="font-normal">(opcional)</span>
            </p>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={`Chamada WhatsApp para ${contactName}`}
              rows={2}
              maxLength={600}
              className="resize-none text-sm"
            />
          </div>

          <p className="text-[11px] text-muted-foreground">
            O WhatsApp será aberto em uma nova aba. A tentativa de ligação será registrada no histórico de atendimento.
          </p>

          {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => { setOpen(false); setNote(""); setError(""); }}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
            onClick={handleConfirm}
            disabled={loading}
          >
            <PhoneCall className="h-3.5 w-3.5" />
            {loading ? "Registrando..." : "Confirmar e ligar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
