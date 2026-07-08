import "server-only";

export type GenericChannelProvider = "whatsapp" | "instagram" | "messenger";

export interface GenericMessage {
  provider: GenericChannelProvider;
  providerAccountId: string; // Meta Page ID / Instagram Account ID / WABA ID
  contactId: string; // PSID, IGSID or Phone Number
  messageId: string;
  timestamp: Date;
  direction: "inbound" | "outbound";
  type: "text" | "image" | "audio" | "document" | "unsupported";
  content: string;
  mediaUrl?: string;
  mimeType?: string;
}

export interface MetaWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    time?: number;
    messaging?: Array<{
      sender: { id: string };
      recipient: { id: string };
      timestamp: number;
      message?: {
        mid: string;
        text?: string;
        is_echo?: boolean;
        attachments?: Array<{
          type: string;
          payload: {
            url?: string;
          };
        }>;
      };
    }>;
  }>;
}

/**
 * Adapter to transform Meta Graph API Webhook payload (Instagram / Messenger)
 * into a generic message object.
 */
export function parseMetaWebhookPayload(payload: MetaWebhookPayload): GenericMessage[] {
  const messages: GenericMessage[] = [];

  if (!payload || !payload.entry || !Array.isArray(payload.entry)) {
    return messages;
  }

  // Identify provider from 'object' field (can be 'page' or 'instagram')
  // Note: Some Meta APIs might use 'page' for both, we can refine this later if needed.
  let defaultProvider: GenericChannelProvider = "messenger";
  if (payload.object === "instagram") {
    defaultProvider = "instagram";
  }

  for (const entry of payload.entry) {
    const providerAccountId = entry.id;

    if (!entry.messaging || !Array.isArray(entry.messaging)) {
      continue;
    }

    for (const messagingEvent of entry.messaging) {
      if (!messagingEvent.message) {
        // Not a message event (e.g., delivery, read receipt, opt-in)
        continue;
      }

      const isEcho = messagingEvent.message.is_echo;
      const direction = isEcho ? "outbound" : "inbound";
      const contactId = isEcho ? messagingEvent.recipient.id : messagingEvent.sender.id;
      
      let type: GenericMessage["type"] = "text";
      let content = messagingEvent.message.text || "";
      let mediaUrl: string | undefined = undefined;

      // Handle attachments
      if (messagingEvent.message.attachments && messagingEvent.message.attachments.length > 0) {
        const attachment = messagingEvent.message.attachments[0];
        
        switch (attachment.type) {
          case "image":
            type = "image";
            break;
          case "audio":
            type = "audio";
            break;
          case "file":
          case "document":
            type = "document";
            break;
          default:
            type = "unsupported";
        }
        
        mediaUrl = attachment.payload?.url;
        
        if (!content) {
          content = `[${attachment.type} attachment]`;
        }
      }

      messages.push({
        provider: defaultProvider,
        providerAccountId,
        contactId,
        messageId: messagingEvent.message.mid,
        timestamp: new Date(messagingEvent.timestamp),
        direction,
        type,
        content,
        mediaUrl,
      });
    }
  }

  return messages;
}
