import Noble from '@/base/noble';
import MoveCard from '@/base/moveCard';
import { ServantBase } from '@/base/servant';
import { AttackerNp, DefenderNp, NormalAttack } from '@/base/attack';
import {
  calculationAttackerBonusNp,
  calculationNormalDamage,
  classAttackPatch,
  hiddenCharacteristicRestraint,
  restraint,
} from '@/base/base';

interface MoveCardPerformanceParams {
  color:CardType,
  activeRate:number,
  buffType:BuffType,
  round:number,
  times:number,
  value:number
}

export function moveCardPerformance (value:Array<MoveCardPerformanceParams>):() => void {
  return function(this:Noble) {
    let buffs:Array<Buff> = [];
    value.forEach(t => {
      const id = Symbol(t.color);
      let buff:Buff = {
        activeRate: t.activeRate,
        buffEffect: AttackBuffEffect.moveCardPerformance,
        buffType: t.buffType,
        description ():string {
          return t.color + (t.buffType === BuffType.strengthen ? '提升' : '下降');
        },
        handle (value:{ actionType:ActionType; [ p:string ]:any }):boolean {
          if (value.actionType === ActionType.attack || value.actionType === ActionType.noble) {
            if ((value.attackParams as NormalAttack).moveCardColor === t.color) {
              (value.attackParams as NormalAttack).moveCardPerformance += t.value;
              return true;
            }
          }
          return false;
        },
        id,
        remove: (removePower:number):boolean => {
          if (removePower > Math.random()) {
            let index = this.owner.buffStack.stack.findIndex(t => t.id === id);
            this.owner.buffStack.stack.splice(index, 1);
            return true;
          }
          return false;
        },
        get shouldRemove () {
          return this.timer.round === 0 || this.timer.times === 0;
        },
        timer: { round: t.round, times: t.times },
      };
      buffs.push(buff);
    });
    this.owner.buffStack.handle({ actionType: ActionType.strengthen, buffs });
    buffs.forEach(buff => {
      if (buff.activeRate === -Infinity) {
        console.log('无效');
      } else if (buff.activeRate > Math.random()) {
        this.owner.buffStack.stack.push(buff);
      } else {
        console.log('miss');
      }
    });
  };
}

export function attack (
  moveCard:MoveCard,
  attacker:ServantBase,
  defender:ServantBase,
  chainType:ChainType,
  cardPosition:0 | 1 | 2 | 3,
  firstCard:CardType,
) {
  let attackInstance:NormalAttack = {
    attackPower: 0,
    busterChainBonus: chainType === ChainType.buster ? attacker.atk * 0.2 : 0,
    criticPower: 0,
    damageAppend: 0,
    defenceAppend: 0,
    defencePower: 0,
    extraBonus: cardPosition !== 3 ? 1 : chainType === ChainType.buster ? 3.5 : 2,
    firstBonus: firstCard === CardType.buster ? 0.5 : 0,
    hiddenStatus: hiddenCharacteristicRestraint(attacker.hiddenCharacteristic, defender.hiddenCharacteristic),
    get isCritic () {
      return Math.random() < moveCard.criticRate ? 1 : 0;
    },
    moveCardColor: moveCard.cardType,
    moveCardEndurance: 0,
    moveCardHitRate: moveCard.hitsRate,
    moveCardPerformance: 0,
    moveCardRate: cardPosition === 3 ? 1 : moveCard.basePowerRate * (1 + 0.2 * cardPosition),
    random: (0.9 + Math.random() * 0.2),
    rankRestraint: restraint(attacker.servantClass, defender.servantClass),
    rankSupplement: classAttackPatch(attacker.servantClass),
    specialAttack: 0,
    specialDefend: 0,
  };
  let attackerNpInstance:AttackerNp = {
    NpBonus: 0,
    firstBonus: firstCard === CardType.art ? 1 : 0,
    get isCritic () {
      return attackInstance.isCritic + 1;
    },
    moveCardEndurance: 0,
    moveCardPerformance: 0,
    moveCaredBonus: moveCard.cardType === CardType.buster ? 0 : cardPosition === 3 ? 1 : ((moveCard.cardType === CardType.art ? 3 : 1) * (1 + (0.5 * cardPosition))),
    npRate: attacker.npType==='process'? moveCard.npRate:0,
    overKillBonus: 0,
    targetBonus: 0,
  };
  let defenderNpInstance:DefenderNp = {
    attackerNpBonus: 0,
    defenceNpBonus: 0,
    defenceNpRate: defender.npType==='process'? defender.npRate:0,
    npBuff: 0,
    overKillBonus: 0,
  };
  attacker.buffStack.handle({ actionType: ActionType.attack, attackInstance });
  attacker.buffStack.handle({ actionType: ActionType.attackerBonusNp, attackerNpInstance });

  defender.buffStack.handle({ actionType: ActionType.defence, attackInstance });
  defender.buffStack.handle({ actionType: ActionType.defenderBonusNp, defenderNpInstance });

  const damage = calculationNormalDamage(attackInstance, attacker.atk);
  const hitChain = moveCard.hitsChain;
  const TotalHit = moveCard.hitsRate;
  hitChain.forEach(t => {
    defender.hpAdd(-(damage / (t / TotalHit)), false);
    attackerNpInstance.overKillBonus = defender.hp === 0 ? 1.5 : 1;
    defenderNpInstance.overKillBonus = defender.hp === 0 ? 1.5 : 1;
    attacker.np = attacker.np + Number(calculationAttackerBonusNp(attackerNpInstance).toFixed(2));
    defender.np = defender.np + Number(calculationAttackerBonusNp(attackerNpInstance).toFixed(2));
  });
  attacker.buffStack.handle({ actionType: ActionType.afterAttack, target: defender });
  defender.buffStack.handle({ actionType: ActionType.afterDefence, target: attacker });
  defender.hpAdd(-0, true);
}