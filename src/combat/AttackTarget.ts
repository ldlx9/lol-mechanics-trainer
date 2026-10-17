import type { Point } from '../simulation/Movement';

export type Team = 'blue' | 'red';
export interface DamageSource { id: string; team: Team; kind: 'player' | 'minion' | 'skill' }
export interface AttackTarget extends Point {
  id: string;
  generation: number;
  team: Team;
  name: string;
  collisionRadius: number;
  readonly alive: boolean;
  receiveDamage(damage: number, source?: DamageSource): number;
  update(dt: number): void;
}
