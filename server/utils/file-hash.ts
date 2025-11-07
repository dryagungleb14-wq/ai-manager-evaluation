import fs from "fs";
import { createHash } from "crypto";

export async function computeFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = fs.createReadStream(filePath);

    stream.on("error", (error) => {
      stream.destroy();
      reject(error);
    });

    stream.on("data", (chunk) => {
      hash.update(chunk);
    });

    stream.on("end", () => {
      try {
        resolve(hash.digest("hex"));
      } catch (error) {
        reject(error);
      }
    });
  });
}
