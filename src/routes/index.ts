import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import qrRouter from "./qr.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(qrRouter);

export default router;
