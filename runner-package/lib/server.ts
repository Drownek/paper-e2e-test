export class ServerWrapper {
    execute: (cmd: string) => void;

    constructor(executeFn: (cmd: string) => void) {
        this.execute = executeFn;
    }
}