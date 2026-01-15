import * as net from "net";
import * as fs from "fs/promises";
import * as path from "path";
import { getIPCSocketDir, getQutebrowserDataDir } from "../utils/paths.js";
import type { QutebrowserIPCMessage } from "../types.js";

export class QutebrowserIPC {
  private socketPath: string | null = null;

  async findSocket(): Promise<string> {
    // Try runtime dir first
    const runtimeDir = getIPCSocketDir();
    try {
      const files = await fs.readdir(runtimeDir);
      const socketFile = files.find((f) => f.startsWith("ipc-"));
      if (socketFile) {
        return path.join(runtimeDir, socketFile);
      }
    } catch {
      // Runtime dir doesn't exist or not accessible
    }

    // Fallback to data dir
    const dataDir = getQutebrowserDataDir();
    try {
      const files = await fs.readdir(dataDir);
      const socketFile = files.find((f) => f.startsWith("ipc-"));
      if (socketFile) {
        return path.join(dataDir, socketFile);
      }
    } catch {
      // Data dir doesn't exist or not accessible
    }

    throw new Error(
      "No qutebrowser IPC socket found. Is qutebrowser running?"
    );
  }

  async sendCommand(...args: string[]): Promise<void> {
    const socket = await this.findSocket();
    // qutebrowser expects the full command as a single string in the args array
    const commandString = args
      .filter((a) => a !== undefined && a !== null)
      .join(" ");
    const message: QutebrowserIPCMessage = {
      args: [commandString],
      target_arg: null,
      protocol_version: 1,
    };

    return new Promise((resolve, reject) => {
      const client = net.createConnection(socket, () => {
        client.write(JSON.stringify(message) + "\n");
        client.end();
        resolve();
      });
      client.on("error", (err) => {
        reject(new Error(`IPC error: ${err.message}`));
      });
    });
  }

  async open(url: string, options?: { tab?: boolean; background?: boolean }): Promise<void> {
    const args = [":open"];
    if (options?.tab) args.push("-t");
    if (options?.background) args.push("-b");
    args.push(url);
    await this.sendCommand(...args);
  }

  async tabClose(): Promise<void> {
    await this.sendCommand(":tab-close");
  }

  async tabFocus(index: number | string): Promise<void> {
    await this.sendCommand(":tab-focus", String(index));
  }

  async back(count?: number): Promise<void> {
    if (count) {
      await this.sendCommand(":back", String(count));
    } else {
      await this.sendCommand(":back");
    }
  }

  async forward(count?: number): Promise<void> {
    if (count) {
      await this.sendCommand(":forward", String(count));
    } else {
      await this.sendCommand(":forward");
    }
  }

  async reload(force?: boolean): Promise<void> {
    if (force) {
      await this.sendCommand(":reload", "-f");
    } else {
      await this.sendCommand(":reload");
    }
  }

  async screenshot(filename: string, rect?: string): Promise<void> {
    if (rect) {
      await this.sendCommand(":screenshot", "--rect", rect, filename);
    } else {
      await this.sendCommand(":screenshot", filename);
    }
  }

  async jseval(code: string, quiet?: boolean): Promise<void> {
    if (quiet) {
      await this.sendCommand(":jseval", "-q", code);
    } else {
      await this.sendCommand(":jseval", code);
    }
  }
}

export const ipc = new QutebrowserIPC();
