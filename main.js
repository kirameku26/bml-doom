
import { BMLBrowser, keyCodeToAribKey } from "web-bml";

const browser = new BMLBrowser({
  containerElement: document.querySelector("#screen"),
  mediaElement: document.querySelector("#media"),
  tabIndex: 0,
  log: { level: "debug" },
  showErrorMessage(title, message) {
    console.error(`[BML] ${title}: ${message}`);
  },
});

browser.addEventListener("load", (event) => {
  console.log("BML loaded:", event.detail);
});

async function start() {
  const response = await fetch(
    "/startup.bml?t=" + Date.now()
  );

  if (!response.ok) {
    throw new Error("BML file not found");
  }

  const data = new Uint8Array(await response.arrayBuffer());

  let binary = "";
  for (const byte of data) {
    binary += String.fromCharCode(byte);
  }

  // 番組情報を模擬
  browser.emitMessage({
    type: "programInfo",
    originalNetworkId: 1,
    transportStreamId: 1,
    serviceId: 1,
    eventId: 1,
    eventName: "BML Development",
    startTimeUnixMillis: Date.now(),
    durationSeconds: 3600,
    indefiniteDuration: false,
    networkId: 1,
  });

  // 地デジ Aプロファイルのコンポーネント
  browser.emitMessage({
    type: "pmt",
    components: [{
      pid: 0x100,
      componentId: 0x40,
      streamType: 0x0d,
      dataComponentId: 0x000c,
    }],
  });

  browser.emitMessage({
    type: "moduleListUpdated",
    componentId: 0x40,
    dataEventId: 0,
    modules: [{
      id: 0,
      version: 1,
      size: data.length,
    }],
  });

  // 自作BMLをデータカルーセルとして供給
  browser.emitMessage({
    type: "moduleDownloaded",
    componentId: 0x40,
    moduleId: 0,
    version: 1,
    dataEventId: 0,
    files: [{
      contentLocation: "startup.bml",
      contentType: {
        type: "text",
        originalType: "text",
        subtype: "x-arib-bml",
        originalSubtype: "X-arib-bml",
        parameters: [],
      },
      dataBase64: btoa(binary),
    }],
  });
}

// 画面上のリモコンボタン
for (const button of document.querySelectorAll("[data-key]")) {
  button.addEventListener("click", () => {
    const code = keyCodeToAribKey(button.dataset.key);

    console.log("Key:", button.dataset.key);
    console.log("ARIB code:", code);

    if (code === -1) return;

    browser.content.processKeyDown(code);
    browser.content.processKeyUp(code);
  });
}

// キーボード操作
document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented || event.repeat) return;

  const code = keyCodeToAribKey(event.key);
  if (code === -1) return;

  event.preventDefault();
  browser.content.processKeyDown(code);
});

document.addEventListener("keyup", (event) => {
  if (event.defaultPrevented) return;

  const code = keyCodeToAribKey(event.key);
  if (code === -1) return;

  event.preventDefault();
  browser.content.processKeyUp(code);
});

start().catch(console.error);
