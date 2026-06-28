"use client";

import * as React from "react";
import { Mp3Encoder } from "@breezystack/lamejs";
import { AlertCircle, LoaderCircle, Mic, Paperclip, Send, Smile, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Lead } from "@/lib/crm";
import type { MessagingConnectionState } from "@/lib/messages";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  conversationKey: string;
  connection: MessagingConnectionState | null;
  canEdit: boolean;
  canSendMessages: boolean | null | undefined;
  lead: Lead | null;
  sending: boolean;
  messageError: string;
  onSend: (value: string) => Promise<void>;
  onSendAttachment: (file: File, caption: string) => Promise<void>;
};

const QUICK_EMOJIS = ["😀", "😁", "😂", "😊", "😍", "🤩", "😉", "🙏", "👏", "🎉", "❤️", "✨", "📚", "🎓", "💬", "📞"];

function MessageComposerComponent({
  conversationKey,
  connection,
  canEdit,
  canSendMessages,
  lead,
  sending,
  messageError,
  onSend,
  onSendAttachment,
}: Props) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const messageInputRef = React.useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = React.useState("");
  const [emojiPickerOpen, setEmojiPickerOpen] = React.useState(false);
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingSeconds, setRecordingSeconds] = React.useState(0);
  const [recordingError, setRecordingError] = React.useState("");
  const [isProcessingAudio, setIsProcessingAudio] = React.useState(false);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const recordingTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStreamRef = React.useRef<MediaStream | null>(null);
  const recordingShouldSendRef = React.useRef(true);

  React.useEffect(() => { setDraft(""); }, [conversationKey]);
  React.useEffect(() => { setEmojiPickerOpen(false); }, [conversationKey]);
  React.useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  React.useEffect(() => {
    if (mediaRecorderRef.current) finishRecording(false);
    setRecordingError("");
  }, [conversationKey]);

  function pickAudioMimeType() {
    if (typeof MediaRecorder === "undefined") return "";
    const candidates = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    return candidates.find((candidate) => MediaRecorder.isTypeSupported?.(candidate)) ?? "";
  }

  async function startRecording() {
    if (isRecording || !canSendMessages) return;
    setRecordingError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickAudioMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      recordingShouldSendRef.current = true;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        if (!recordingShouldSendRef.current || chunks.length === 0) return;

        const recordedType = recorder.mimeType || mimeType || "audio/webm";
        const baseType = recordedType.split(";")[0].trim();
        const recordedBlob = new Blob(chunks, { type: baseType });

        setIsProcessingAudio(true);
        void encodeAudioBlobToMp3(recordedBlob)
          .then((mp3Blob) => {
            const file = new File([mp3Blob], `audio-${Date.now()}.mp3`, { type: "audio/mpeg" });
            return onSendAttachment(file, "");
          })
          .catch(() => { setRecordingError("Não foi possível processar o áudio gravado."); })
          .finally(() => { setIsProcessingAudio(false); focusMessageInput(); });
      };

      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((current) => current + 1);
      }, 1000);
    } catch (error) {
      setRecordingError(error instanceof Error && error.name === "NotAllowedError" ? "Permita o acesso ao microfone para gravar um áudio." : "Não foi possível acessar o microfone.");
    }
  }

  function finishRecording(shouldSend: boolean) {
    recordingShouldSendRef.current = shouldSend;
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
    setRecordingSeconds(0);
  }

  function focusMessageInput() {
    requestAnimationFrame(() => {
      const input = messageInputRef.current;
      if (!input) return;
      input.focus();
      const caretPosition = input.value.length;
      input.setSelectionRange(caretPosition, caretPosition);
    });
  }

  function insertEmoji(emoji: string) {
    const input = messageInputRef.current;
    if (!input) {
      setDraft((current) => `${current}${emoji}`);
      return;
    }
    const selectionStart = input.selectionStart ?? input.value.length;
    const selectionEnd = input.selectionEnd ?? input.value.length;
    const nextValue = `${draft.slice(0, selectionStart)}${emoji}${draft.slice(selectionEnd)}`;
    setDraft(nextValue);
    requestAnimationFrame(() => {
      input.focus();
      const caretPosition = selectionStart + emoji.length;
      input.setSelectionRange(caretPosition, caretPosition);
    });
  }

  async function submitCurrentDraft() {
    const nextValue = draft.trim();
    if (!nextValue || !canSendMessages) return;
    setDraft("");
    try { await onSend(nextValue); } finally { focusMessageInput(); }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitCurrentDraft();
  }

  function handleDraftKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void submitCurrentDraft();
  }

  return (
    <div className="shrink-0 bg-transparent px-4 pb-6 pt-2 z-10">
      {!connection?.configured ? (
        <div className="flex items-center gap-3 rounded-[20px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[11px] font-medium tracking-wide text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.15)] backdrop-blur">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>O envio oficial não foi liberado neste ambiente. Verifique o checklist do canal.</span>
        </div>
      ) : connection.status !== "online" ? (
        <div className="flex items-center gap-3 rounded-[20px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[11px] font-medium tracking-wide text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.15)] backdrop-blur">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>O canal oficial da Meta ainda não está pronto para envio nesta instalação.</span>
        </div>
      ) : (
        <>
          {isProcessingAudio ? (
            <div className="flex h-14 items-center gap-4 rounded-[28px] border border-white/10 bg-[#0c0c0c]/90 px-6 shadow-2xl backdrop-blur-[24px]">
              <LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-primary" />
              <span className="text-[13px] font-light text-white/70 tracking-wide">Processando áudio...</span>
            </div>
          ) : isRecording ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex h-14 items-center gap-4 rounded-[28px] border border-rose-500/30 bg-[#0c0c0c]/90 px-4 shadow-[0_0_24px_rgba(244,63,94,0.15)] backdrop-blur-[24px]">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500/60" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
              </span>
              <span className="text-[16px] font-light tracking-widest text-rose-500">{formatRecordingTime(recordingSeconds)}</span>
              <span className="flex-1 text-[11px] font-bold uppercase tracking-widest text-rose-400/50">Gravando...</span>
              <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-full text-white/50 hover:bg-white/5 hover:text-white" onClick={() => finishRecording(false)}>
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button type="button" size="icon" className="h-10 w-10 shrink-0 rounded-full bg-primary text-white shadow-[0_0_15px_rgba(219,13,113,0.5)] hover:bg-primary/90" onClick={() => finishRecording(true)}>
                <Send className="h-4 w-4" />
              </Button>
            </motion.div>
          ) : (
          <form className="relative flex flex-wrap gap-2 rounded-[28px] border border-white/10 bg-[#0a0a0a]/80 p-2 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-[24px] xl:flex-nowrap" onSubmit={handleSubmit}>
            <input
              ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (file) {
                  const caption = draft;
                  setDraft("");
                  try { await onSendAttachment(file, caption); } finally { focusMessageInput(); }
                }
                event.target.value = "";
              }}
            />
            <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-full text-white/50 hover:bg-white/10 hover:text-white" disabled={!canSendMessages} onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="h-4 w-4" />
            </Button>
            <div className="relative shrink-0">
              <Button type="button" variant="ghost" size="icon" className="h-11 w-11 rounded-full text-white/50 hover:bg-white/10 hover:text-white" disabled={!canSendMessages} onClick={() => { setEmojiPickerOpen((current) => !current); focusMessageInput(); }}>
                <Smile className="h-4 w-4" />
              </Button>
              <AnimatePresence>
                {emojiPickerOpen && (
                  <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute bottom-14 left-0 z-20 w-[240px] rounded-[24px] border border-white/10 bg-[#0c0c0c]/95 p-3 shadow-[0_10px_40px_rgba(0,0,0,0.8)] backdrop-blur-[24px]">
                    <div className="grid grid-cols-4 gap-2">
                      {QUICK_EMOJIS.map((emoji) => (
                        <button key={emoji} type="button" className="flex h-10 w-10 items-center justify-center rounded-full text-[20px] transition-colors hover:bg-white/10" onMouseDown={(e) => e.preventDefault()} onClick={() => insertEmoji(emoji)}>{emoji}</button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-full text-white/50 hover:bg-white/10 hover:text-white" disabled={!canSendMessages} onClick={startRecording}>
              <Mic className="h-4 w-4" />
            </Button>
            
            {/* Input Wrapper Glass */}
            <div className="flex-1 bg-white/5 rounded-[20px] px-4 py-1.5 border border-white/5 shadow-inner flex items-center">
               <Textarea
                 ref={messageInputRef}
                 disabled={!canSendMessages}
                 value={draft}
                 onChange={(e) => setDraft(e.target.value)}
                 onKeyDown={handleDraftKeyDown}
                 placeholder="Escreva uma mensagem..."
                 rows={1}
                 className="min-h-8 min-w-[120px] w-full resize-none border-0 bg-transparent text-[14px] font-light tracking-wide text-white placeholder:text-white/30 focus-visible:ring-0 p-0 shadow-none leading-relaxed crm-scrollbar"
               />
            </div>

            <Button type="submit" size="icon" className={cn("h-11 w-11 shrink-0 rounded-full transition-all duration-300", draft.trim() ? "bg-primary text-white shadow-[0_0_15px_rgba(219,13,113,0.5)] hover:bg-primary/90 hover:scale-105" : "bg-white/10 text-white/30")} disabled={!canSendMessages || !draft.trim()}>
              {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 ml-0.5" />}
            </Button>
          </form>
          )}
          {messageError ? <p className="mt-2 text-[11px] font-bold uppercase tracking-widest text-rose-400 pl-4">{messageError}</p> : null}
          {recordingError ? <p className="mt-2 text-[11px] font-bold uppercase tracking-widest text-rose-400 pl-4">{recordingError}</p> : null}
        </>
      )}
    </div>
  );
}

export const MessageComposer = React.memo(MessageComposerComponent, (prev, next) => prev.conversationKey === next.conversationKey && prev.connection?.configured === next.connection?.configured && prev.connection?.status === next.connection?.status && prev.canEdit === next.canEdit && prev.canSendMessages === next.canSendMessages && prev.lead?.id === next.lead?.id && prev.lead?.status_funil === next.lead?.status_funil && prev.sending === next.sending && prev.messageError === next.messageError && prev.onSend === next.onSend && prev.onSendAttachment === next.onSendAttachment);

function formatRecordingTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function floatTo16BitPCM(input: Float32Array) {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
}

async function encodeAudioBlobToMp3(blob: Blob): Promise<Blob> {
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioContext = new AudioContextClass();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const channels = Math.min(audioBuffer.numberOfChannels, 2);
    const encoder = new Mp3Encoder(channels, audioBuffer.sampleRate, 128);
    const left = floatTo16BitPCM(audioBuffer.getChannelData(0));
    const right = channels > 1 ? floatTo16BitPCM(audioBuffer.getChannelData(1)) : null;

    const blockSize = 1152;
    const mp3Chunks: Uint8Array<ArrayBuffer>[] = [];
    for (let i = 0; i < left.length; i += blockSize) {
      const leftChunk = left.subarray(i, i + blockSize);
      const encoded = right ? encoder.encodeBuffer(leftChunk, right.subarray(i, i + blockSize)) : encoder.encodeBuffer(leftChunk);
      if (encoded.length > 0) mp3Chunks.push(new Uint8Array(encoded));
    }
    const final = encoder.flush();
    if (final.length > 0) mp3Chunks.push(new Uint8Array(final));

    return new Blob(mp3Chunks, { type: "audio/mpeg" });
  } finally {
    void audioContext.close();
  }
}
