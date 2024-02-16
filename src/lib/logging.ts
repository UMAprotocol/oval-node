import { AugmentedLogger, Logger as LoggerModule } from "@uma/logger";

export class Logger {
  private static instance: AugmentedLogger;

  private constructor() {}

  static getInstance(): AugmentedLogger {
    if (!Logger.instance) {
      Logger.instance = LoggerModule;
    }
    return Logger.instance;
  }

  static info(transactionId: string, message: string, ...args: { [key: string]: any }[]) {
    Logger.getInstance().info(Logger.getLogBody(message + " ℹ️", transactionId, ...args));
  }

  static error(transactionId: string, message: string, ...args: { [key: string]: any }[]) {
    Logger.getInstance().error(Logger.getLogBody(message + " 🚨", transactionId, ...args));
  }

  static debug(transactionId: string, message: string, ...args: { [key: string]: any }[]) {
    Logger.getInstance().debug(Logger.getLogBody(message, transactionId, ...args));
  }

  static getLogBody(message: string, transactionId: string, ...args: { [key: string]: any }[]): { [key: string]: any } {
    return {
      at: "Oval-RPC",
      transactionId,
      message,
      ...Object.assign({}, ...args),
    };
  }
}
