export { };
declare global {
    namespace Express {
        export interface Request {
            transactionId: string;
        }
    }
}
