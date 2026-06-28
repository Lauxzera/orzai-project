import { describe, expect, it } from "vitest";
import { isServiceWindowClosedError, isWithinServiceWindow, META_SERVICE_WINDOW_MS } from "@/lib/server/whatsapp-service-window";

describe("isWithinServiceWindow", () => {
  const now = Date.parse("2026-06-25T12:00:00.000Z");

  it("retorna false quando nao ha conversa", () => {
    expect(isWithinServiceWindow(null, now)).toBe(false);
    expect(isWithinServiceWindow(undefined, now)).toBe(false);
  });

  it("retorna false quando a ultima mensagem foi enviada pelo CRM (outbound)", () => {
    expect(
      isWithinServiceWindow({ lastMessageAt: new Date(now - 60_000).toISOString(), lastMessageDirection: "outbound" }, now),
    ).toBe(false);
  });

  it("retorna true quando o lead respondeu ha menos de 24h", () => {
    expect(
      isWithinServiceWindow({ lastMessageAt: new Date(now - 60_000).toISOString(), lastMessageDirection: "inbound" }, now),
    ).toBe(true);
  });

  it("retorna false quando a ultima resposta do lead passou de 24h", () => {
    expect(
      isWithinServiceWindow(
        { lastMessageAt: new Date(now - META_SERVICE_WINDOW_MS - 60_000).toISOString(), lastMessageDirection: "inbound" },
        now,
      ),
    ).toBe(false);
  });

  it("considera o limite exato como fora da janela (estrito)", () => {
    expect(
      isWithinServiceWindow({ lastMessageAt: new Date(now - META_SERVICE_WINDOW_MS).toISOString(), lastMessageDirection: "inbound" }, now),
    ).toBe(false);
  });
});

describe("isServiceWindowClosedError", () => {
  it("identifica o codigo 131047 da Meta", () => {
    expect(isServiceWindowClosedError({ code: 131047 })).toBe(true);
  });

  it("identifica o subcode 2018278 da Meta", () => {
    expect(isServiceWindowClosedError({ subcode: 2018278 })).toBe(true);
  });

  it("retorna false para outros erros", () => {
    expect(isServiceWindowClosedError({ code: 190 })).toBe(false);
    expect(isServiceWindowClosedError(new Error("token invalido"))).toBe(false);
    expect(isServiceWindowClosedError(null)).toBe(false);
  });
});
