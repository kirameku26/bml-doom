
import fs from "node:fs";

const count = Number(process.argv[2] ?? 8);
const allowed = [8, 16, 32, 64, 128];

if (!allowed.includes(count)) {
  console.error("Choose 8, 16, 32, 64, or 128");
  process.exit(1);
}

// Generate CSS positions
let styles = "";
let elements = "";

for (let i = 0; i < count; i++) {
  const y = 100 + (i % 16) * 20;
  const x = 40 + Math.floor(i / 16) * 100;

  styles += `
      #b${i} {
        position: absolute;
        left: ${x}px;
        top: ${y}px;
        width: 30px;
        height: 12px;
        background-color: #ffff00;
      }
`;

  elements += `    <div id="b${i}"></div>\n`;
}

const bml = `<?xml version="1.0" encoding="EUC-JP"?>
<?bml bml-version="3.0"?>
<bml>
  <head>
    <title>BML Benchmark</title>
    <style><![CDATA[
      body {
        resolution: 960x540;
        background-color: #102040;
        color: white;
        used-key-list: basic data-button;
      }

      #title {
        position: absolute;
        left: 40px;
        top: 20px;
        width: 850px;
        height: 50px;
        font-size: 32px;
      }

      #status {
        position: absolute;
        left: 40px;
        top: 450px;
        width: 850px;
        height: 50px;
        font-size: 24px;
      }
${styles}
    ]]></style>

    <script><![CDATA[
      var frame = 0;
      var frameCount = 0;
      var lastTime = 0;
      var totalWork = 0;
      var timerId = 0;

      var BOX_COUNT = ${count};

      function init() {
        lastTime = new Date().getTime();
        timerId = browser.setInterval("tick()", 50, 0);
      }

      function tick() {
        var start = new Date().getTime();

        var i;
        for (i = 0; i < BOX_COUNT; i++) {
          var box = document.getElementById("b" + i);

          var x = 40 + ((frame * 4 + i * 23) % 850);
          box.normalStyle.left = x + "px";
        }

        frame++;

        var end = new Date().getTime();

        totalWork += end - start;
        frameCount++;

        var elapsed = end - lastTime;

        if (elapsed >= 1000) {
          var ups = (frameCount * 1000 / elapsed) | 0;

          var avg100 =
            (totalWork * 100 / frameCount) | 0;

          var avgWhole = (avg100 / 100) | 0;
          var avgFraction = avg100 % 100;

          var avgText = avgWhole + ".";

          if (avgFraction < 10) {
            avgText += "0";
          }

          avgText += avgFraction;

          var text =
            "UPS: " + ups +
            "  AVG: " + avgText + "ms" +
            "  BOXES: " + BOX_COUNT;

          document.getElementById("status")
            .firstChild.data = text;

          frameCount = 0;
          totalWork = 0;
          lastTime = end;
        }
      }
    ]]></script>
  </head>

  <body onload="init();">
    <p id="title">BML Rendering Benchmark</p>

${elements}
    <p id="status">Starting benchmark...</p>
  </body>
</bml>
`;

fs.writeFileSync("startup.bml", bml, "utf8");

console.log(
  "Generated benchmark with " + count + " boxes"
);
