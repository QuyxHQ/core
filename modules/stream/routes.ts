import express, { Request, Response } from "express";
import { isStreamSenderValid } from "../../shared/utils/validators";
// import { broadcastEvent } from "../../shared/utils/socket";

const router = express.Router();

router.post("/", isStreamSenderValid, async function (req: Request, res: Response) {
  try {
    console.log(req);

    // broadcastEvent({}); - send web socket messages

    // do stuffs with whatever will be sent here....

    return res.sendStatus(200);
  } catch (e: any) {
    console.error("Stream could not go through: ", e.message);
    return res.status(500).json({
      status: false,
      message: e.message,
    });
  }
});

export = router;
