import { Router } from 'express';
import {
  listProfiles,
  getProfile,
  createProfile,
  updateProfile,
  deleteProfile,
  runJob,
  listRuns,
  listPostings,
  updatePosting,
  deletePosting,
  getStatuses,
} from '../controllers/jobSearchController.js';

const router = Router();

// Statuses enum (powers the Kanban columns).
router.get('/statuses', getStatuses);

// Profiles CRUD.
router.get('/profiles', listProfiles);
router.post('/profiles', createProfile);
router.get('/profiles/:id', getProfile);
router.put('/profiles/:id', updateProfile);
router.delete('/profiles/:id', deleteProfile);

// Trigger a search run (10–45s).
router.post('/profiles/:id/run', runJob);

// Run history.
router.get('/runs', listRuns);

// Postings.
router.get('/postings', listPostings);
router.patch('/postings/:id', updatePosting);
router.delete('/postings/:id', deletePosting);

export default router;
