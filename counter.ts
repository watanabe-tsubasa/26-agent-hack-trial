const sentense = `
施設管理向けの事故報告書作成AIエージェント。
突発的に発生する事故報告書作成をエージェントで代替。現地での施工のような人が実施すべき業務に時間を割けるように設計。
さらに作成文書の平準化によって、データとしての活用も見込む。
事故概要を入力すると、関連するカメラ画像候補を探索・評価し、写真台帳付きの事故報告書ドラフトを生成。
施設管理員の修正差分から施設固有の情報や知見を蓄積し、次回以降の改善にも繋げる。
`

const counter = (str: string) => {
  const charCount = str.length;
  const wordCount = str.trim().split(/\s+/).length;
  return { charCount, wordCount };
}

const result = counter(sentense);
console.log(result);