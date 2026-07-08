import { expect, test, describe } from "vitest";
import { parseMetaWebhookPayload, MetaWebhookPayload } from "./meta-webhook-adapter";

describe("meta-webhook-adapter", () => {
  test("should parse a valid inbound messenger text message", () => {
    const payload: MetaWebhookPayload = {
      object: "page",
      entry: [
        {
          id: "PAGE_ID_123",
          time: 1234567890,
          messaging: [
            {
              sender: { id: "USER_PSID" },
              recipient: { id: "PAGE_ID_123" },
              timestamp: 1612345678,
              message: {
                mid: "m_12345",
                text: "Hello there!",
              },
            },
          ],
        },
      ],
    };

    const messages = parseMetaWebhookPayload(payload);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({
      provider: "messenger",
      providerAccountId: "PAGE_ID_123",
      contactId: "USER_PSID",
      messageId: "m_12345",
      timestamp: new Date(1612345678),
      direction: "inbound",
      type: "text",
      content: "Hello there!",
      mediaUrl: undefined,
    });
  });

  test("should parse an image attachment from instagram", () => {
    const payload: MetaWebhookPayload = {
      object: "instagram",
      entry: [
        {
          id: "IG_ACCOUNT_ID",
          time: 1234567890,
          messaging: [
            {
              sender: { id: "IG_SENDER_ID" },
              recipient: { id: "IG_ACCOUNT_ID" },
              timestamp: 1612345678,
              message: {
                mid: "m_ig123",
                attachments: [
                  {
                    type: "image",
                    payload: {
                      url: "https://example.com/image.jpg",
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const messages = parseMetaWebhookPayload(payload);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({
      provider: "instagram",
      providerAccountId: "IG_ACCOUNT_ID",
      contactId: "IG_SENDER_ID",
      messageId: "m_ig123",
      timestamp: new Date(1612345678),
      direction: "inbound",
      type: "image",
      content: "[image attachment]",
      mediaUrl: "https://example.com/image.jpg",
    });
  });

  test("should handle outbound (echo) messages", () => {
    const payload: MetaWebhookPayload = {
      object: "page",
      entry: [
        {
          id: "PAGE_ID_123",
          messaging: [
            {
              sender: { id: "PAGE_ID_123" },
              recipient: { id: "USER_PSID" },
              timestamp: 1612345678,
              message: {
                is_echo: true,
                mid: "m_echo_123",
                text: "We will respond shortly.",
              },
            },
          ],
        },
      ],
    };

    const messages = parseMetaWebhookPayload(payload);
    expect(messages).toHaveLength(1);
    expect(messages[0].direction).toBe("outbound");
    expect(messages[0].contactId).toBe("USER_PSID");
  });
});
