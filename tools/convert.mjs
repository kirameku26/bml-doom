
import fs from "node:fs";
import iconv from "iconv-lite";

function convert() {
  const source = fs.readFileSync("startup.bml", "utf8");

  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync(
    "public/startup.bml",
    iconv.encode(source, "EUC-JP")
  );

  console.log("Converted startup.bml to EUC-JP");
}

convert();

if (process.argv.includes("--watch")) {
  let timer;

  fs.watch("startup.bml", () => {
    clearTimeout(timer);
    timer = setTimeout(convert, 150);
  });
}
