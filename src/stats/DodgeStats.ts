/** 躲避只在威胁弹道完成飞行、且未触碰玩家/被挡住时结算。 */
export class DodgeStats {
  fired = 0;
  threats = 0;
  hits = 0;
  dodges = 0;
  blocked = 0;
  protectedContacts = 0;
  harmlessMisses = 0;
}
