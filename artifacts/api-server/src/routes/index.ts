import { Router, type IRouter } from "express";
import healthRouter from "./health";
import todosRouter from "./todos";

const router: IRouter = Router();

router.use(healthRouter);
router.use(todosRouter);

export default router;
