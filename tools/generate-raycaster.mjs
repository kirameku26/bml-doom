
import fs from "node:fs";

const COLUMNS = 48;
const DIRECTIONS = 24;
const FOV = Math.PI / 3; // 60 degrees
const SCALE = 1000;

// Precompute trigonometry on Node.js
const directions = [];
for (let i = 0; i < DIRECTIONS; i++) {
  const angle = i * 2 * Math.PI / DIRECTIONS;

  directions.push([
    Math.round(Math.cos(angle) * SCALE),
    Math.round(Math.sin(angle) * SCALE),
  ]);
}

const rays = [];
for (let i = 0; i < COLUMNS; i++) {
  const angle = ((i + 0.5) / COLUMNS - 0.5) * FOV;

  rays.push([
    Math.round(Math.cos(angle) * SCALE),
    Math.round(Math.sin(angle) * SCALE),
  ]);
}


// 0 = empty, 1 = wall
const map = [
  [1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,1],
  [1,0,1,1,1,0,0,1],
  [1,0,0,0,1,0,0,1],
  [1,0,1,0,1,0,0,1],
  [1,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1],
];

let styles = "";
let elements = "";

for (let i = 0; i < COLUMNS; i++) {
  const left = i * (960 / COLUMNS);
  const color = i % 2 === 0
    ? "#a0a0a0"
    : "#929292";

  styles += `
      #wall${i} {
        position: absolute;
        left: ${left}px;
        top: 100px;
        width: ${960 / COLUMNS}px;
        height: 200px;
        background-color: ${color};
      }
`;

  elements += `    <div id="wall${i}"></div>\n`;
}

const bml = `<?xml version="1.0" encoding="EUC-JP"?>
<?bml bml-version="3.0"?>
<bml>
  <head>
    <title>BML Raycaster</title>
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
        width: 900px;
        height: 40px;
        font-size: 24px;
        color: yellow;
      }

      #help {
        position: absolute;
        left: 20px;
        top: 495px;
        width: 900px;
        height: 35px;
        font-size: 20px;
        color: white;
      }
    ]]></style>

    <script><![CDATA[
      var map = new Array();
var directions = new Array();
var rays = new Array();

${map.map((row, i) =>
  `map[${i}] = new Array(${row.join(",")});`
).join("\n")}

${directions.map((row, i) =>
  `directions[${i}] = new Array(${row.join(",")});`
).join("\n")}

${rays.map((row, i) =>
  `rays[${i}] = new Array(${row.join(",")});`
).join("\n")}

var px = 3500;
var py = 5500;
var heading = 0;

      var frameCount = 0;
      var totalWork = 0;
      var lastTime = 0;


function isWall(x, y) {
  if (x < 0 || y < 0 || x >= 8000 || y >= 8000) {
    return true;
  }

  var mx = (x / 1000) | 0;
  var my = (y / 1000) | 0;

  return map[my][mx] == 1;
}

function move(distance) {
  var dir = directions[heading];

  var nx = px + (dir[0] * distance / 1000);
  var ny = py + (dir[1] * distance / 1000);

  if (!isWall(nx, py)) {
    px = nx;
  }

  if (!isWall(px, ny)) {
    py = ny;
  }
}


      function handleKey() {
        var key = document.currentEvent.keyCode;

if (key == 1) {
  move(180);
} else if (key == 2) {
  move(-180);
} else if (key == 3) {
          heading--;
          if (heading < 0) heading = 23;
        } else if (key == 4) {
          heading++;
          if (heading >= 24) heading = 0;
        }

        // Immediately redraw after input
        render();
      }


function render() {
  var dir = directions[heading];

  for (var i = 0; i < 48; i++) {
    var ray = rays[i];

    // Fixed-point direction
    var dx =
      (dir[0] * ray[0] - dir[1] * ray[1]) / 1000;

    var dy =
      (dir[1] * ray[0] + dir[0] * ray[1]) / 1000;

    var distance = 10;
    var step = 0;
    var hit = false;

    // Ray marching using integers
    while (step < 70) {
      var rx = px + dx * distance / 1000;
      var ry = py + dy * distance / 1000;

      if (isWall(rx, ry)) {
        hit = true;
        break;
      }

      distance += 150;
      step++;
    }

    // Fish-eye correction
    var corrected = distance * ray[0] / 1000;

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

    // Debug center ray
    /*
    if (i == 24) {
      document.getElementById("status")
        .firstChild.data =
          "HIT:" + hit +
          " DIST:" + distance +
          " DX:" + dx +
          " DY:" + dy +
          " H:" + height;
    }*/
  }
}


      function tick() {
        var start = new Date().getTime();

        render();

        var end = new Date().getTime();

        frameCount++;
        totalWork += end - start;

        var elapsed = end - lastTime;

        if (elapsed >= 1000) {
          var ups =
            (frameCount * 1000 / elapsed) | 0;

          var avg100 =
            (totalWork * 100 / frameCount) | 0;

          var whole = (avg100 / 100) | 0;
          var fraction = avg100 % 100;

          var avgText = whole + ".";

          if (fraction < 10) {
            avgText += "0";
          }

          avgText += fraction;

          document.getElementById("status")
            .firstChild.data =
              "UPS: " + ups +
              "  AVG: " + avgText + "ms" +
              "  DIR: " + heading;

          frameCount = 0;
          totalWork = 0;
          lastTime = end;
        }
      }




function init() {
  document.getElementById("controller").focus();

  lastTime = new Date().getTime();

  render();

  browser.setInterval("tick()", 100, 0);
}



    ]]></script>
  </head>

  <body onload="init();">
    <div id="controller" onkeydown="handleKey();">
${elements}
      <p id="status">Starting raycaster...</p>
      <p id="help">UP/DOWN: Move  LEFT/RIGHT: Turn</p>
    </div>
  </body>
</bml>
`;

fs.writeFileSync("startup.bml", bml, "utf8");
console.log(
  "Generated BML raycaster with " +
  COLUMNS + " columns"
);
