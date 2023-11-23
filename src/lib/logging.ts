import { AugmentedLogger, Logger as LoggerModule } from "@uma/logger";

export class Logger {
  private static instance: AugmentedLogger;

  private constructor() { }

  static getInstance(): AugmentedLogger {
    if (!Logger.instance) {
      Logger.instance = LoggerModule;
    }
    return Logger.instance;
  }

  static info(message: string, ...args: { [key: string]: any }[]) {
    Logger.getInstance().info(Logger.getLogBody("ℹ️ " + message, ...args));
  }

  static error(message: string, ...args: { [key: string]: any }[]) {
    Logger.getInstance().error(Logger.getLogBody("🚨 " + message, ...args));
  }

  static debug(message: string, ...args: { [key: string]: any }[]) {
    Logger.getInstance().debug(Logger.getLogBody(message, ...args));
  }

  static getLogBody(message: string, ...args: { [key: string]: any }[]): { [key: string]: any } {
    return {
      at: "OVAL-RPC",
      message,
      ...Object.assign({}, ...args),
    };
  }
}

export function createShortHexString(hex: string): string {
  return hex.substring(0, 5) + "..." + hex.substring(hex.length - 6, hex.length);
}

export function createEtherscanLinkMarkdown(hex: string): string | null {
  const url = "https://etherscan.io/";
  if (hex.substring(0, 2) != "0x") return null;
  const shortURLString = createShortHexString(hex);
  // Transaction hash
  if (hex.length == 66) return `<${url}tx/${hex}|${shortURLString}>`;
  // Account
  else if (hex.length == 42) return `<${url}address/${hex}|${shortURLString}>`;
  return null;
}
