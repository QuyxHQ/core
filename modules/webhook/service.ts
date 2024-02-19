import { ethers } from "ethers";
import abi from "../../contract/abi.json";

export function decodeLog(data: MoralisStreamResponse) {
  const intrfc = new ethers.utils.Interface(JSON.stringify(abi));

  const logs = data.logs[0];
  const topics: string[] = [];
  if (logs.topic0) {
    topics.push(logs.topic0);

    if (logs.topic1) {
      topics.push(logs.topic1);

      if (logs.topic2) {
        topics.push(logs.topic2);

        if (logs.topic3) {
          topics.push(logs.topic3);
        }
      }
    }
  }

  const log: { topics: string[]; data: string } = {
    data: logs.data,
    topics,
  };

  let decodedLog = intrfc.parseLog(log);
  return decodedLog;
}
