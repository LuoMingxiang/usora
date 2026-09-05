import { DWClient, TOPIC_CARD, TOPIC_ROBOT, type DWClientDownStream } from "dingtalk-stream";
import type { createDingTalkService } from "./service.ts";

export async function startDingTalkStream(service: Awaited<ReturnType<typeof createDingTalkService>>) {
  const client = new DWClient({
    clientId: service.config.secrets.appKey!,
    clientSecret: service.config.secrets.appSecret!,
    debug: false,
    maxPendingCallbackHandlers: 1,
  });
  client.on("error", () => {
    console.error("DingTalk Stream connection error");
  });
  client.registerCallbackListener(TOPIC_CARD, async (event: DWClientDownStream) => {
    try {
      const result = await service.handleCard(event.headers.messageId, event.data);
      if (!result.ok && !["DUPLICATE_CALLBACK", "PERMISSION_DENIED", "UNMAPPED_USER"].includes(result.code || ""))
        return;
      client.socketCallBackResponse(event.headers.messageId, {
        cardUpdateOptions: { updatePrivateDataByKey: true },
        userPrivateData: { cardParamMap: { feedback: result.ok ? "Completed" : result.error } },
      });
    } catch {
      console.error("DingTalk card callback rejected; no acknowledgement sent");
    }
  });
  client.registerCallbackListener(TOPIC_ROBOT, async (event: DWClientDownStream) => {
    try {
      await service.handleBot(event.data);
      client.socketCallBackResponse(event.headers.messageId, { status: "SUCCESS" });
    } catch {
      console.error("DingTalk bot message failed; no acknowledgement sent");
    }
  });
  try {
    await client.connect();
  } catch {
    client.disconnect();
    throw Error("DingTalk Stream connection failed");
  }
  return client;
}
