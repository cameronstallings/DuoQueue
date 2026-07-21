import type { DiscordShareRow, MessageRow } from "@duoqueue/shared-types";

export type ChatTimelineItem =
  | { kind: "message"; at: string; message: MessageRow }
  | { kind: "discord_share"; at: string; share: DiscordShareRow };
