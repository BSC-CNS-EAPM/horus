export type Remote = {
  name: string;
  host: string;
  port: string;
  username: string;
  password?: string;
  keyPath?: string;
  proxyCommand?: string;
  workDir?: string;
};
