import type { DamageSource, Team } from '../combat/AttackTarget';
import type { MinionKind } from '../config/minions';
import type { Point } from '../simulation/Movement';

export interface MinionDeath extends Point { id: string; team: Team; kind: MinionKind; source?: DamageSource }

/** 只从真实死亡事件结算。抵达出口离场、清理对象不属于死亡。 */
export class LastHitStats {
  cs = 0;
  missed = 0;
  totalDeaths = 0;
  private readonly counted = new Set<string>();

  get successRate(): number { return this.cs + this.missed > 0 ? this.cs / (this.cs + this.missed) : 0; }

  record(death: MinionDeath): void {
    if (this.counted.has(death.id)) return;
    this.counted.add(death.id);
    this.totalDeaths++;
    if (death.team !== 'red') return;
    if (death.source?.kind === 'player' && death.source.team === 'blue') this.cs++;
    else this.missed++;
  }
}
