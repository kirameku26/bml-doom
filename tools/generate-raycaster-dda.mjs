import fs from "node:fs";

// BML uses integer-like arithmetic for +, -, and / in web-bml.
// Keep world positions and direction vectors scaled by 1000.
const COLUMNS = 48;
const DIRECTIONS = 24;
const FOV = Math.PI / 3;
const SCALE = 1000;
const MAP_SIZE = 8;
const INTERVAL_MS = 50; // Target 20 updates per second

// Trigonometry is performed by Node.js, not by BML's ES2 interpreter.
const directions = [];
for (let heading = 0; heading < DIRECTIONS; heading++) {
  const angle = (heading * 2 * Math.PI) / DIRECTIONS;
  directions.push([
    Math.round(Math.cos(angle) * SCALE),
    Math.round(Math.sin(angle) * SCALE),
  ]);
}

// Precompute the direction of every screen ray for each heading.
// This avoids fractional additions/subtractions inside web-bml.
const rayDX = [];
const rayDY = [];
for (let heading = 0; heading < DIRECTIONS; heading++) {
  const baseAngle = (heading * 2 * Math.PI) / DIRECTIONS;
  const xs = [];
  const ys = [];

  for (let column = 0; column < COLUMNS; column++) {
    const offset = ((column + 0.5) / COLUMNS - 0.5) * FOV;
    xs.push(Math.round(Math.cos(baseAngle + offset) * SCALE));
    ys.push(Math.round(Math.sin(baseAngle + offset) * SCALE));
  }

  rayDX.push(xs);
  rayDY.push(ys);
}

const rayCos = [];
for (let column = 0; column < COLUMNS; column++) {
  const offset = ((column + 0.5) / COLUMNS - 0.5) * FOV;
  rayCos.push(Math.round(Math.cos(offset) * SCALE));
}

// 0 = empty cell; 1 = wall.
const map = [
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 0, 0, 1],
  [1, 0, 0, 0, 1, 0, 0, 1],
  [1, 0, 1, 0, 1, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
];

// Generate arrays using new Array(), not array literals, for BML ES2.
function bmlArray(name, rows) {
  const lines = [`var ${name} = new Array();`];
  rows.forEach((row, index) => {
    lines.push(`${name}[${index}] = new Array(${row.join(",")});`);
  });
  return lines.join("\n");
}

let styles = "";
let elements = "";
for (let column = 0; column < COLUMNS; column++) {
  const left = column * (960 / COLUMNS);
  const color = column % 2 === 0 ? "#a0a0a0" : "#929292";

  styles += `
      #wall${column} {
        position: absolute;
        left: ${left}px;
        top: 100px;
        width: ${960 / COLUMNS}px;
        height: 200px;
        background-color: ${color};
      }
`;
  elements += `      <div id="wall${column}"></div>\n`;
}

const bml = `<?xml version="1.0" encoding="EUC-JP"?>
<?bml bml-version="3.0"?>
<bml>
  <head>
    <title>BML DDA Raycaster</title>
    <style><![CDATA[
      body {
        resolution: 960x540;
        used-key-list: basic data-button;
        background-color: #203050;
        color: white;
      }
      #controller {
        position: absolute;
        left: 0px;
        top: 0px;
        width: 960px;
        height: 540px;
        nav-index: 1;
      }
${styles}
      #status {
        position: absolute;
        left: 20px;
        top: 15px;
        width: 920px;
        height: 40px;
        font-size: 22px;
        color: yellow;
      }
      #help {
        position: absolute;
        left: 20px;
        top: 495px;
        width: 920px;
        height: 35px;
        font-size: 20px;
        color: white;
      }
    ]]></style>

    <script><![CDATA[
      ${bmlArray("map", map)}
      ${bmlArray("directions", directions)}
      ${bmlArray("rayDX", rayDX)}
      ${bmlArray("rayDY", rayDY)}
      var rayCos = new Array(${rayCos.join(",")});

      var px = 3500;
      var py = 5500;
      var heading = 0;
      var frameCount = 0;
      var totalWork = 0;
      var totalSteps = 0;
      var lastSteps = 0;
      var lastTime = 0;

      function isWallCell(x, y) {
        if (x < 0 || y < 0 || x >= ${MAP_SIZE} || y >= ${MAP_SIZE}) {
          return true;
        }
        return map[y][x] == 1;
      }

      function isWall(x, y) {
        if (x < 0 || y < 0 || x >= ${MAP_SIZE * SCALE} || y >= ${MAP_SIZE * SCALE}) {
          return true;
        }
        return isWallCell((x / ${SCALE}) | 0, (y / ${SCALE}) | 0);
      }

      function move(distance) {
        var dir = directions[heading];
        var nx = px + (dir[0] * distance / ${SCALE});
        var ny = py + (dir[1] * distance / ${SCALE});
        if (!isWall(nx, py)) px = nx;
        if (!isWall(px, ny)) py = ny;
      }

      function handleKey() {
        var key = document.currentEvent.keyCode;
        if (key == 1) {
          move(180);
        } else if (key == 2) {
          move(-180);
        } else if (key == 3) {
          heading--;
          if (heading < 0) heading = ${DIRECTIONS - 1};
        } else if (key == 4) {
          heading++;
          if (heading >= ${DIRECTIONS}) heading = 0;
        }
        render();
      }

      function render() {
        var dxRow = rayDX[heading];
        var dyRow = rayDY[heading];
        var gridX = (px / ${SCALE}) | 0;
        var gridY = (py / ${SCALE}) | 0;
        var stepsInFrame = 0;

        for (var i = 0; i < ${COLUMNS}; i++) {
          var dx = dxRow[i];
          var dy = dyRow[i];
          var cellX = gridX;
          var cellY = gridY;
          var stepX = 0;
          var stepY = 0;
          var deltaX = 0;
          var deltaY = 0;
          var sideX = 100000000;
          var sideY = 100000000;
          var absDX = dx;
          var absDY = dy;

          if (absDX < 0) absDX = -absDX;
          if (absDY < 0) absDY = -absDY;

          // DDA distances are also in thousandths of a map cell.
          // The zero-direction case stays at the large sentinel distance.
          if (dx < 0) {
            stepX = -1;
            deltaX = (1000000 / absDX) | 0;
            sideX = ((px - cellX * ${SCALE}) * ${SCALE} / absDX) | 0;
          } else if (dx > 0) {
            stepX = 1;
            deltaX = (1000000 / absDX) | 0;
            sideX = (((cellX + 1) * ${SCALE} - px) * ${SCALE} / absDX) | 0;
          }

          if (dy < 0) {
            stepY = -1;
            deltaY = (1000000 / absDY) | 0;
            sideY = ((py - cellY * ${SCALE}) * ${SCALE} / absDY) | 0;
          } else if (dy > 0) {
            stepY = 1;
            deltaY = (1000000 / absDY) | 0;
            sideY = (((cellY + 1) * ${SCALE} - py) * ${SCALE} / absDY) | 0;
          }

          var distance = 0;
          var hit = false;
          var steps = 0;

          // Jump from one cell boundary to the next (not 150-unit samples).
          while (steps < ${MAP_SIZE * 2}) {
            if (sideX < sideY) {
              distance = sideX;
              sideX += deltaX;
              cellX += stepX;
            } else {
              distance = sideY;
              sideY += deltaY;
              cellY += stepY;
            }

            steps++;
            if (isWallCell(cellX, cellY)) {
              hit = true;
              break;
            }
          }
          stepsInFrame += steps;

          // Project the distance onto the center view direction.
          var corrected = (distance * rayCos[i] / ${SCALE}) | 0;
          var height = 0;
          if (hit && corrected > 0) {
            height = (440000 / corrected) | 0;
          }
          if (height > 540) height = 540;
          if (height < 0) height = 0;

          var top = ((540 - height) / 2) | 0;
          var wall = document.getElementById("wall" + i);
          wall.normalStyle.top = top + "px";
          wall.normalStyle.height = height + "px";
        }
        lastSteps = stepsInFrame;
      }

      function tick() {
        var start = new Date().getTime();
        render();
        var end = new Date().getTime();
        frameCount++;
        totalWork += end - start;
        totalSteps += lastSteps;

        var elapsed = end - lastTime;
        if (elapsed >= 1000) {
          var ups = (frameCount * 1000 / elapsed) | 0;
          var avg100 = (totalWork * 100 / frameCount) | 0;
          var whole = (avg100 / 100) | 0;
          var fraction = avg100 % 100;
          var avgText = whole + ".";
          if (fraction < 10) avgText += "0";
          avgText += fraction;
          var avgSteps = (totalSteps / frameCount) | 0;

          document.getElementById("status").firstChild.data =
            "UPS: " + ups +
            " AVG: " + avgText + "ms" +
            " DDA: " + avgSteps +
            " DIR: " + heading;

          frameCount = 0;
          totalWork = 0;
          totalSteps = 0;
          lastTime = end;
        }
      }

      function init() {
        document.getElementById("controller").focus();
        lastTime = new Date().getTime();
        render();
        browser.setInterval("tick()", ${INTERVAL_MS}, 0);
      }
    ]]></script>
  </head>
  <body onload="init();">
    <div id="controller" onkeydown="handleKey();">
${elements}
      <p id="status">Starting DDA raycaster...</p>
      <p id="help">UP/DOWN: Move  LEFT/RIGHT: Turn</p>
    </div>
  </body>
</bml>
`;

fs.writeFileSync("startup.bml", bml, "utf8");
console.log(`Generated ${COLUMNS}-column DDA raycaster (${INTERVAL_MS}ms interval)`);
