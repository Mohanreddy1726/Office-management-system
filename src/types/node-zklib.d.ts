declare module "node-zklib" {
  export default class ZKLib {
    constructor(ip: string, port: number, inTime: number, timeout: number, commKey?: number, connectionType?: string);
    createSocket(): Promise<void>;
    getInfo(): Promise<any>;
    getUsers(): Promise<{ data: any[] }>;
    getAttendances(callback?: (received: number, total: number) => void): Promise<{ data: any[] }>;
    disconnect(): Promise<void>;
  }
}
