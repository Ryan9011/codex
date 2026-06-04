const nameSeeds = [
  "赛博牛马",
  "工位幽灵",
  "加班幸存者",
  "被 KPI 追杀的人",
  "摸鱼观察员",
  "需求避雷针",
  "会议受害者",
  "早八逃生舱",
  "PPT 驯兽师",
  "咖啡因续命员",
  "日报搬运工",
  "周报炼金术士",
  "工牌流浪者",
  "已读乱回的人",
  "OKR 迷路人",
  "排期许愿池",
];

const nameCodes = [
  "007",
  "024",
  "099",
  "233",
  "404",
  "512",
  "618",
  "711",
  "996",
  "1024",
  "1145",
  "2333",
];

export function generateAnonymousName() {
  const seed = nameSeeds[Math.floor(Math.random() * nameSeeds.length)];
  const code = nameCodes[Math.floor(Math.random() * nameCodes.length)];

  return `${seed} #${code}`;
}
