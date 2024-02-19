import { ethers } from "ethers";
import abi from "../../contract/abi.json";

export function decodeLog(data: MoralisStreamResponse) {
  const intrfc = new ethers.utils.Interface(JSON.stringify(abi));
  let decodedLog = [];

  const logs = data.logs;
  for (let log of logs) {
    const topics: string[] = [];
    if (log.topic0) {
      topics.push(log.topic0);

      if (log.topic1) {
        topics.push(log.topic1);

        if (log.topic2) {
          topics.push(log.topic2);

          if (log.topic3) {
            topics.push(log.topic3);
          }
        }
      }
    }

    const logObj: { topics: string[]; data: string } = {
      data: log.data,
      topics,
    };

    decodedLog.push(intrfc.parseLog(logObj));
  }

  return decodedLog;
}
