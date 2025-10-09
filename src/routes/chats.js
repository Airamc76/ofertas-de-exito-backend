import { Router } from 'express';
const router = Router();

router.get('/', (_req, res) => res.status(501).json({ error: 'Not Implemented: DB integration pending' }));
router.post('/', (_req, res) => res.status(501).json({ error: 'Not Implemented: DB integration pending' }));
router.get('/:id', (_req, res) => res.status(501).json({ error: 'Not Implemented: DB integration pending' }));
router.post('/:id/messages', (_req, res) => res.status(501).json({ error: 'Not Implemented: DB integration pending' }));
router.delete('/:id', (_req, res) => res.status(501).json({ error: 'Not Implemented: DB integration pending' }));

export default router;
