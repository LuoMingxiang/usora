import fs from "node:fs/promises";
import path from "node:path";
import { type IntegrationMessage, type MessagingCapability } from "@usora/integration";
import type { DingTalkAppClient } from "./app.ts";
import { renderDingTalkMarkdown } from "./renderer.ts";

export type DingTalkCardConfig = { templateId: string; conversationId: string; robotCode: string; stateDir: string };

export function cardFile(root: string, id: string) {
  if (!/^[a-f0-9]{64}$/.test(id)) throw Error("Invalid card id");
  return path.join(root, "cards", `${id}.json`);
}

export function createDingTalkCardTransport(
  client: DingTalkAppClient,
  config: DingTalkCardConfig,
): MessagingCapability {
  return {
    async sendMessage(message: IntegrationMessage) {
      if (!message.id) throw Error("Durable message id is required for cards");
      const file = cardFile(config.stateDir, message.id);
      await fs.mkdir(path.dirname(file), { recursive: true });
      // Persist the server-owned action targets before delivery; never trust callback-supplied targets.
      try {
        await fs.access(file);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        const tmp = `${file}.${process.pid}.tmp`;
        await fs.writeFile(tmp, JSON.stringify(message));
        await fs.rename(tmp, file);
      }
      const saved = JSON.parse(await fs.readFile(file, "utf8")) as IntegrationMessage;
      const rendered = renderDingTalkMarkdown(saved);
      const markdown = rendered.msgtype === "markdown" ? rendered.markdown.text : saved.title || "Usora";
      return client.request("/v1.0/card/instances/createAndDeliver", {
        body: {
          cardTemplateId: config.templateId,
          outTrackId: message.id,
          callbackType: "STREAM",
          cardData: {
            cardParamMap: { title: saved.title || "Usora", markdown, actions: JSON.stringify(saved.actions || []) },
          },
          openSpaceId: `dtv1.card//IM_GROUP.${config.conversationId}`,
          imGroupOpenSpaceModel: { supportForward: false },
          imGroupOpenDeliverModel: { robotCode: config.robotCode },
        },
      });
    },
  };
}
