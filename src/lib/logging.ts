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
