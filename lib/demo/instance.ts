import { AWS_LIVE, AWS_REGION, EC2_INSTANCE_ID } from "./config";

/**
 * The one thing that can turn the box on and off.
 *
 * Scoped to exactly one instance id — the IAM policy is scoped the same way, so
 * these credentials cannot touch anything else in the account.
 */
export interface InstanceController {
  /** True only when real AWS calls are armed; false in dry-run. */
  readonly live: boolean;
  /** The instance's power state, e.g. "running" | "stopped", or null if unknown. */
  describeState(): Promise<string | null>;
  start(): Promise<void>;
  stop(): Promise<void>;
}

/**
 * Logs what it would do and calls nothing. This is the default until AWS_LIVE
 * is set, so the whole wake/sleep flow works end to end — state machine, status
 * polling, UI — with the single real side effect stubbed.
 */
class DryRunController implements InstanceController {
  readonly live = false;

  describeState(): Promise<string | null> {
    return Promise.resolve(null);
  }
  start(): Promise<void> {
    console.info(
      "[instance] dry-run StartInstances",
      EC2_INSTANCE_ID ?? "(no id)",
    );
    return Promise.resolve();
  }
  stop(): Promise<void> {
    console.info(
      "[instance] dry-run StopInstances",
      EC2_INSTANCE_ID ?? "(no id)",
    );
    return Promise.resolve();
  }
}

/**
 * The real thing. The SDK is imported lazily so the dry-run path never pays to
 * load it, and credentials come from the standard AWS env chain
 * (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION).
 */
class Ec2Controller implements InstanceController {
  readonly live = true;

  constructor(private readonly instanceId: string) {}

  private async client() {
    const { EC2Client } = await import("@aws-sdk/client-ec2");
    return new EC2Client({ region: AWS_REGION });
  }

  async describeState(): Promise<string | null> {
    const { DescribeInstancesCommand } = await import("@aws-sdk/client-ec2");
    const ec2 = await this.client();
    const out = await ec2.send(
      new DescribeInstancesCommand({ InstanceIds: [this.instanceId] }),
    );
    return out.Reservations?.[0]?.Instances?.[0]?.State?.Name ?? null;
  }

  async start(): Promise<void> {
    const { StartInstancesCommand } = await import("@aws-sdk/client-ec2");
    const ec2 = await this.client();
    await ec2.send(
      new StartInstancesCommand({ InstanceIds: [this.instanceId] }),
    );
  }

  async stop(): Promise<void> {
    const { StopInstancesCommand } = await import("@aws-sdk/client-ec2");
    const ec2 = await this.client();
    await ec2.send(
      new StopInstancesCommand({ InstanceIds: [this.instanceId] }),
    );
  }
}

export function getInstanceController(): InstanceController {
  return AWS_LIVE && EC2_INSTANCE_ID
    ? new Ec2Controller(EC2_INSTANCE_ID)
    : new DryRunController();
}
